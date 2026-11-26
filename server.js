const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

require('./public/players-data.js');
require('./public/seasons.js');
const Core = require('./public/auction-core.js');

const PORT = Number(process.env.PORT || 4173);
const PUBLIC = path.join(__dirname, 'public');
const rooms = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg'
};

function uid(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

function code() {
  return uid(5);
}

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 200000) req.destroy();
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(PUBLIC, rel);
  if (!file.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function broadcast(room, event = 'state') {
  const data = `event: ${event}\ndata: ${JSON.stringify(Core.snapshot(room.state))}\n\n`;
  room.streams.forEach((res) => {
    try { res.write(data); } catch (err) { /* dead stream */ }
  });
}

function touchClient(room, clientId) {
  const client = room.state.clients.find((c) => c.id === clientId);
  if (client) client.lastSeen = Date.now();
  return client;
}

function promoteHost(room) {
  const state = room.state;
  if (state.clients.some((c) => c.host && c.connected)) return;
  const next = state.clients.find((c) => c.connected);
  if (next) {
    state.clients.forEach((c) => { c.host = false; });
    next.host = true;
    state.hostId = next.id;
    Core.addLog(state, `${next.name} is now the host.`, 'system');
    broadcast(room);
  }
}

async function handleAPI(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'api') return false;

  if (parts[1] === 'health') {
    sendJSON(res, 200, { ok: true, rooms: rooms.size, players: (globalThis.IPL_PLAYER_DATA || []).length });
    return true;
  }

  if (parts[1] === 'rooms' && parts.length === 2 && req.method === 'POST') {
    const body = await readBody(req);
    const roomCode = code();
    const clientId = uid(10);
    const state = Core.createGame({
      id: roomCode,
      mode: 'multi',
      season: body.season || '2025',
      timer: clampTimer(body.timer),
      difficulty: body.difficulty || 'standard',
      hostId: clientId,
      ownerTeam: body.teamId
    });
    state.clients.push({
      id: clientId,
      name: String(body.name || 'Host').slice(0, 24),
      teamId: body.teamId || 'CSK',
      host: true,
      connected: true,
      lastSeen: Date.now()
    });
    state.chat = [];
    state.paused = false;
    rooms.set(roomCode, { state, streams: new Set() });
    Core.addLog(state, `Room ${roomCode} created. Share the code with your friends.`, 'system');
    sendJSON(res, 200, { code: roomCode, clientId, state: Core.snapshot(state) });
    return true;
  }

  const roomCode = parts[2];
  const room = getRoom(roomCode);
  if (!room) { sendJSON(res, 404, { ok: false, reason: 'Room not found' }); return true; }

  if (parts[3] === 'join' && req.method === 'POST') {
    const body = await readBody(req);
    const teamId = body.teamId || 'CSK';
    if (room.state.clients.some((c) => c.teamId === teamId && c.connected)) {
      sendJSON(res, 409, { ok: false, reason: 'That franchise is already taken' });
      return true;
    }
    const clientId = uid(10);
    room.state.clients.push({
      id: clientId,
      name: String(body.name || 'Player').slice(0, 24),
      teamId,
      host: false,
      connected: true,
      lastSeen: Date.now()
    });
    Core.addLog(room.state, `${body.name || 'A player'} joined as ${teamId}.`, 'system');
    broadcast(room);
    sendJSON(res, 200, { clientId, code: roomCode, state: Core.snapshot(room.state) });
    return true;
  }

  if (!parts[3] && req.method === 'GET') {
    sendJSON(res, 200, Core.snapshot(room.state));
    return true;
  }

  if (parts[3] === 'events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`event: state\ndata: ${JSON.stringify(Core.snapshot(room.state))}\n\n`);
    room.streams.add(res);
    const ping = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (err) { clearInterval(ping); }
    }, 15000);
    req.on('close', () => { clearInterval(ping); room.streams.delete(res); });
    return true;
  }

  if (parts[3] === 'action' && req.method === 'POST') {
    const body = await readBody(req);
    const client = touchClient(room, body.clientId);
    if (!client) { sendJSON(res, 403, { ok: false, reason: 'Join the room first' }); return true; }
    const state = room.state;
    const payload = body.payload || {};
    let result = { ok: false, reason: 'Unknown action' };

    switch (body.type) {
      case 'start':
        if (!client.host) result = { ok: false, reason: 'Only the host can start' };
        else {
          state.paused = false;
          result = Core.startAuction(state);
        }
        break;
      case 'bid':
        result = Core.placeBid(state, client.teamId, Number(payload.amount), client.id);
        break;
      case 'rtm':
        result = Core.useRTM(state, client.teamId);
        break;
      case 'next':
        if (!client.host) result = { ok: false, reason: 'Only the host can advance' };
        else result = Core.forceNext(state);
        break;
      case 'pause':
        if (!client.host) result = { ok: false, reason: 'Only the host can pause' };
        else { state.paused = true; Core.addLog(state, 'Auction paused by host.', 'system'); result = { ok: true }; }
        break;
      case 'resume':
        if (!client.host) result = { ok: false, reason: 'Only the host can resume' };
        else { state.paused = false; Core.addLog(state, 'Auction resumed.', 'system'); result = { ok: true }; }
        break;
      case 'timer':
        if (!client.host) result = { ok: false, reason: 'Only the host can change timer' };
        else { state.settings.timer = clampTimer(payload.timer); result = { ok: true }; }
        break;
      case 'chat':
        state.chat = state.chat || [];
        state.chat.unshift({ name: client.name, team: client.teamId, text: String(payload.text || '').slice(0, 140), at: Date.now() });
        if (state.chat.length > 60) state.chat.length = 60;
        Core.bump(state);
        result = { ok: true };
        break;
      case 'restart':
        if (!client.host) result = { ok: false, reason: 'Only the host can restart' };
        else {
          const fresh = Core.createGame({ id: roomCode, mode: 'multi', season: state.season, timer: state.settings.timer, difficulty: state.settings.difficulty, hostId: client.id, ownerTeam: client.teamId });
          fresh.clients = state.clients.map((c) => ({ ...c, connected: true }));
          fresh.chat = [];
          fresh.paused = false;
          room.state = fresh;
          Core.addLog(fresh, 'Auction reset. Ready for a fresh draft.', 'system');
          result = { ok: true };
        }
        break;
    }

    broadcast(room);
    sendJSON(res, result.ok ? 200 : 400, result);
    return true;
  }

  sendJSON(res, 404, { ok: false, reason: 'Endpoint not found' });
  return true;
}

function clampTimer(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(8, Math.min(60, Math.round(n))) : 20;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (await handleAPI(req, res, url)) return;
    serveStatic(req, res, url.pathname);
  } catch (err) {
    sendJSON(res, 500, { ok: false, reason: err.message || 'Server error' });
  }
});

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, key) => {
    const state = room.state;
    state.clients.forEach((c) => {
      if (c.connected && now - c.lastSeen > 45000) c.connected = false;
    });
    promoteHost(room);
    if (!state.paused && state.status !== 'ended') {
      const before = state.version;
      Core.tick(state, 1);
      if (state.version !== before) broadcast(room);
    }
    if (now - (room.lastCleanup || 0) > 120000) {
      room.lastCleanup = now;
      if (!room.streams.size && state.clients.every((c) => !c.connected)) rooms.delete(key);
    }
  });
}, 1000);

function lanAddress() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const addr of addresses || []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return null;
}

server.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddress();
  console.log(`IPL Auction running at http://localhost:${PORT}`);
  if (lan) console.log(`Open on your phone (same Wi-Fi): http://${lan}:${PORT}`);
  console.log(`Players loaded: ${(globalThis.IPL_PLAYER_DATA || []).length}`);
});
