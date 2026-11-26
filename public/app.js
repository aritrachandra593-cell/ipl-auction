(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const Core = window.AuctionCore;
  const PLAYERS = window.IPL_PLAYER_DATA || [];
  const IMAGES = window.IPL_PLAYER_IMAGES || {};
  const TEAMS = Core.TEAMS;
  const SEASONS = window.IPL_SEASONS || {};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const teamById = (id) => TEAMS.find((t) => t.id === id) || TEAMS[0];
  const money = (n) => Number(n || 0).toFixed(1);
  const moneyPrecise = (n) => Number(n || 0).toFixed(2);
  const PURSE = Core.PURSE || 120;
  const PRIZE_MONEY = Core.PRIZE_MONEY || { champion: 20, runnerUp: 12.5, third: 7, fourth: 6.5 };
  const POOL_ORDER = Core.POOL_ORDER || ['m1', 'm2', 'bat', 'all', 'wk', 'fast', 'spin'];

  function initialsFor(name) {
    return String(name || '').split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  }

  function photoFor(player) {
    return player && IMAGES[player.name] ? IMAGES[player.name] : null;
  }

  function avatarHTML(player, extraClass = '', style = '') {
    const photo = photoFor(player);
    const name = player ? player.name : '';
    const title = photo ? `${photo.artist} · ${photo.license} · ${photo.source}` : `${name} — no free photo available`;
    return `<span class="player-photo-wrap ${extraClass} ${photo ? 'has-photo' : ''}" ${style ? `style="${esc(style)}"` : ''}>
      ${photo ? `<img class="player-photo" src="${esc(photo.src)}" alt="${esc(name)}" title="${esc(title)}" loading="lazy">` : ''}
      <span class="player-avatar avatar-fallback" aria-hidden="true">${esc(initialsFor(name))}</span>
    </span>`;
  }

  function photoCreditHTML(player) {
    const photo = photoFor(player);
    if (!photo) return '';
    return `<div class="photo-credit">Photo: <a href="${esc(photo.source)}" target="_blank" rel="noopener">${esc(photo.artist)}</a> · ${esc(photo.license)}</div>`;
  }

  function poolMeta(id) {
    const fromState = state && state.pools && state.pools.find((p) => p.id === id);
    if (fromState) return fromState;
    const fromCore = Core.POOLS && Core.POOLS[id];
    return fromCore ? { ...fromCore, total: 0, sold: 0, unsold: 0, current: false } : null;
  }

  function fallbackPools() {
    return [{
      id: 'all', label: 'All players', short: 'ALL',
      note: 'Single combined list used by an older room snapshot.',
      total: state.players.length, sold: state.sold.length, unsold: state.unsold.length, current: true
    }];
  }

  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!img || !img.classList || !img.classList.contains('player-photo')) return;
    const wrap = img.parentElement;
    if (!wrap) return;
    wrap.classList.remove('has-photo');
    img.remove();
  }, true);

  let mode = 'solo';
  let selectedSeason = '2025';
  let state = null;
  let myTeam = 'CSK';
  let createTeam = 'CSK';
  let joinTeam = 'MI';
  let clientId = null;
  let roomCode = null;
  let eventSource = null;
  let ticker = null;
  let activeTab = 'log';
  let poolFilter = 'all';
  let resultShown = false;
  let serverOnline = false;
  let selectedDifficulty = 'standard';

  /* ---------- setup ---------- */

  function renderTeamPicker(containerId, selected, setter, taken = []) {
    const el = $(containerId);
    el.innerHTML = TEAMS.map((t) => {
      const isTaken = taken.includes(t.id);
      return `<button class="team-card ${selected === t.id ? 'selected' : ''}" type="button" data-team="${t.id}" style="--team-color:${t.color}" ${isTaken ? 'disabled' : ''}>
        <b>${t.short}</b><span>${esc(t.name)}</span>${isTaken ? '<span class="taken">TAKEN</span>' : ''}
      </button>`;
    }).join('');
    el.querySelectorAll('[data-team]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setter(btn.dataset.team);
        renderTeamPicker(containerId, btn.dataset.team, setter, taken);
        updateSetupSummary();
      });
    });
  }

  function currentSeasonCfg() {
    return SEASONS[selectedSeason] || SEASONS['2025'] || {};
  }

  function updateSetupSummary() {
    const t = teamById(myTeam);
    const cfg = currentSeasonCfg();
    if (selectedSeason === '2027' && cfg.teams && cfg.teams[t.id]) {
      const teamCfg = cfg.teams[t.id];
      $('soloSummary').textContent = `${t.name} · ₹${moneyPrecise(teamCfg.purse)} Cr left · ${teamCfg.slots} slots · ${teamCfg.overseas} overseas`;
    } else {
      $('soloSummary').textContent = `${t.name} · ₹${PURSE} Cr purse · 25 slots · 8 overseas max`;
    }
    $('timerLabel').textContent = `${$('soloTimer').value}s`;
  }

  function updateSeasonUI() {
    const cfg = currentSeasonCfg();
    document.querySelectorAll('[data-season]').forEach((btn) => btn.classList.toggle('selected', btn.dataset.season === selectedSeason));
    if (selectedSeason === '2027') {
      const left = Object.values(cfg.teams || {}).reduce((sum, t) => sum + t.purse, 0);
      const retained = new Set(Object.values(cfg.retained || {}).flat().map((n) => n.toLowerCase().trim()));
      const tradedCount = Object.values(cfg.traded || {}).flat().length;
      const names = new Set([
        ...Object.values(cfg.released || {}).flat(),
        ...(cfg.extraReleased || []).map((e) => typeof e === 'string' ? e : e.name)
      ].filter((n) => !retained.has(n.toLowerCase().trim())));
      const confirmed = (cfg.confirmedBasePlayers || []).length;
      $('heroCopy').textContent = `Real 2027 mini auction on ${cfg.date} at ${cfg.venue}. Franchises arrive with their retained squads and ₹${moneyPrecise(left)} Cr left to fill 66 slots. ${names.size} released players go under the hammer — ${confirmed} confirmed at ₹2 Cr base, the rest estimated. All ${tradedCount} traded players are locked into their new squads and excluded. No RTM cards.`;
      $('playerCount').textContent = names.size;
      $('playerCountLabel').textContent = 'released players';
      $('heroPurse').textContent = `₹${moneyPrecise(left)} Cr`;
      $('heroPurseLabel').textContent = 'total left';
    } else {
      $('heroCopy').textContent = `200+ real IPL players split into seven auction sets — M1, M2, batters, all-rounders, wicketkeepers, fast bowlers and spinners. ₹${PURSE} Cr purse per franchise, live bids, RTM cards, overseas limits and 25-man squads.`;
      $('playerCount').textContent = PLAYERS.length;
      $('playerCountLabel').textContent = 'auction players';
      $('heroPurse').textContent = `₹${PURSE} Cr`;
      $('heroPurseLabel').textContent = 'each purse';
    }
    updateSetupSummary();
  }

  function showToast(text, kind = '') {
    const el = $('toast');
    el.textContent = text;
    el.className = `toast ${kind}`;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 2800);
  }

  function openModal(html) {
    $('modalCard').innerHTML = html;
    $('modalBackdrop').hidden = false;
  }
  function closeModal() { $('modalBackdrop').hidden = true; }

  function setMode(next) {
    mode = next;
    $('modeSolo').classList.toggle('selected', mode === 'solo');
    $('modeMulti').classList.toggle('selected', mode === 'multi');
    $('soloSetup').hidden = mode !== 'solo';
    $('multiSetup').hidden = mode !== 'multi';
    if (mode === 'multi') checkServer().then(refreshJoinTeams);
  }

  async function checkServer() {
    try {
      const r = await fetch('/api/health');
      const data = await r.json();
      serverOnline = !!data.ok;
      $('serverDot').classList.toggle('online', serverOnline);
      $('serverLabel').textContent = serverOnline ? `Server online · ${data.players} players` : 'Server offline';
    } catch (err) {
      serverOnline = false;
      $('serverDot').classList.remove('online');
      $('serverLabel').textContent = 'Server offline';
    }
  }

  async function api(path, body, method = 'POST') {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.reason || 'Request failed');
    return data;
  }

  /* ---------- game control ---------- */

  function showAuction() {
    $('homeScreen').hidden = true;
    $('auctionScreen').hidden = false;
    $('modeBadge').textContent = mode === 'solo' ? 'SINGLE PLAYER' : 'MULTIPLAYER';
    $('seasonBadge').textContent = state && state.season === '2027' ? '2027 MINI' : '2025 MEGA';
    $('roomCodeChip').hidden = mode !== 'multi';
    $('chatPanel').hidden = mode !== 'multi';
    $('chatTab').hidden = mode !== 'multi';
    $('leaveAuction').textContent = mode === 'solo' ? 'New setup' : 'Leave room';
    resultShown = false;
    activeTab = 'log';
    poolFilter = 'all';
    document.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('selected', t.dataset.tab === 'log'));
    render();
  }

  function showHome() {
    stopTicker();
    if (eventSource) { eventSource.close(); eventSource = null; }
    state = null;
    roomCode = null;
    clientId = null;
    $('auctionScreen').hidden = true;
    $('homeScreen').hidden = false;
    closeModal();
  }

  function startSolo() {
    const timer = Number($('soloTimer').value);
    state = Core.createGame({
      mode: 'solo',
      season: selectedSeason,
      timer,
      difficulty: selectedDifficulty,
      ownerTeam: myTeam,
      hostId: 'you'
    });
    state.clients = [{ id: 'you', name: $('soloName').value || 'You', teamId: myTeam, host: true, connected: true }];
    state.chat = [];
    state.paused = false;
    Core.startAuction(state);
    showAuction();
    startTicker();
    showToast(`${teamById(myTeam).short} ready. Good luck!`, 'ok');
  }

  function startTicker() {
    stopTicker();
    ticker = setInterval(() => {
      if (!state || mode !== 'solo' || state.paused || state.status === 'ended') return;
      Core.tick(state, 1);
      render();
      checkResult();
    }, 1000);
  }
  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  async function createRoom() {
    if (!serverOnline) { await checkServer(); if (!serverOnline) { showToast('Start server.js to use multiplayer rooms', 'error'); return; } }
    try {
      const data = await api('/api/rooms', {
        name: $('createName').value || 'Host',
        teamId: createTeam,
        season: selectedSeason,
        timer: Number($('createTimer').value),
        difficulty: 'standard'
      });
      roomCode = data.code;
      clientId = data.clientId;
      myTeam = createTeam;
      state = data.state;
      connectRoom();
      showAuction();
      showToast(`Room ${roomCode} created — share the code`, 'ok');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function joinRoom() {
    if (!serverOnline) { await checkServer(); if (!serverOnline) { showToast('Start server.js to use multiplayer rooms', 'error'); return; } }
    const code = $('joinCode').value.trim().toUpperCase();
    if (code.length < 4) { showToast('Enter a valid room code', 'error'); return; }
    try {
      const data = await api(`/api/rooms/${encodeURIComponent(code)}/join`, {
        name: $('joinName').value || 'Player',
        teamId: joinTeam
      });
      roomCode = code;
      clientId = data.clientId;
      myTeam = joinTeam;
      state = data.state;
      selectedSeason = state.season || selectedSeason;
      connectRoom();
      showAuction();
      showToast(`Joined ${teamById(myTeam).short}`, 'ok');
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function refreshJoinTeams() {
    const code = $('joinCode').value.trim().toUpperCase();
    if (!serverOnline || code.length < 4) return;
    try {
      const snapshot = await api(`/api/rooms/${encodeURIComponent(code)}`, null, 'GET');
      const taken = snapshot.clients.filter((c) => c.connected).map((c) => c.teamId);
      if (taken.includes(joinTeam)) {
        joinTeam = TEAMS.find((t) => !taken.includes(t.id))?.id || joinTeam;
      }
      renderTeamPicker('joinTeamPicker', joinTeam, (id) => { joinTeam = id; }, taken);
    } catch (err) { /* room not found yet */ }
  }

  function connectRoom() {
    if (eventSource) eventSource.close();
    eventSource = new EventSource(`/api/rooms/${encodeURIComponent(roomCode)}/events`);
    eventSource.addEventListener('state', (e) => {
      try {
        state = JSON.parse(e.data);
        render();
        checkResult();
      } catch (err) { /* ignore malformed event */ }
    });
    eventSource.onerror = () => {
      $('liveLabel').textContent = 'Reconnecting…';
      $('liveDot').classList.remove('on');
    };
  }

  function isHost() {
    return !!state && state.clients.some((c) => c.id === clientId && c.host);
  }
  function me() {
    return state && state.clients.find((c) => c.id === clientId);
  }

  async function localOrRemote(type, payload = {}) {
    if (!state) return;
    if (mode === 'solo') {
      let result = { ok: false, reason: 'Unavailable' };
      const amount = Number(payload.amount);
      switch (type) {
        case 'start': state.paused = false; result = Core.startAuction(state); break;
        case 'bid': result = Core.placeBid(state, myTeam, amount, 'you'); break;
        case 'rtm': result = Core.useRTM(state, myTeam); break;
        case 'next':
          result = Core.forceNext(state);
          if (result.ok && state.current) showToast(`Next: ${state.current.player.name} · base ₹${money(state.current.player.base)} Cr`);
          break;
        case 'pause': state.paused = true; result = { ok: true }; break;
        case 'resume': state.paused = false; result = { ok: true }; break;
        case 'restart': showHome(); setMode('solo'); return;
      }
      if (!result.ok) showToast(result.reason, 'error');
      render();
      checkResult();
      return;
    }
    try {
      const result = await api(`/api/rooms/${encodeURIComponent(roomCode)}/action`, { clientId, type, payload });
      if (!result.ok) showToast(result.reason, 'error');
    } catch (err) { showToast(err.message, 'error'); }
  }

  function checkResult() {
    if (state && state.status === 'ended' && !resultShown) {
      resultShown = true;
      showResult();
    }
  }

  /* ---------- rendering ---------- */

  function render() {
    if (!state) return;
    renderHeader();
    renderCurrentPlayer();
    renderBid();
    renderTeams();
    renderMyTeam();
    renderFeed();
    renderChat();
  }

  function renderHeader() {
    const live = state.status === 'live' && !state.paused;
    $('liveDot').classList.toggle('on', live);
    $('liveLabel').textContent = state.paused ? 'Paused' : state.status === 'live' ? 'Live auction' : state.status === 'ended' ? 'Completed' : 'Waiting';
    $('roomCodeChip').textContent = `CODE: ${roomCode || '—'}`;
    $('soldCount').textContent = `${state.sold.length} sold`;
  }

  function renderCurrentPlayer() {
    const el = $('currentPlayer');
    if (!state.current || state.status === 'ended') {
      el.innerHTML = `<div class="empty-state">${state.status === 'ended' ? 'Auction complete' : 'Auction not started'}</div>`;
      return;
    }
    const p = state.current.player;
    const color = teamById(p.lastTeam).color;
    const pool = poolMeta(p.pool);
    const isMarquee = p.pool === 'm1' || p.pool === 'm2';
    const stars = '★'.repeat(Math.max(1, Math.round(p.rating - 1))) + '☆'.repeat(Math.max(0, 10 - Math.round(p.rating - 1)));
    el.innerHTML = `
      ${pool ? `<div class="set-banner"><span>Now auctioning</span><b>${esc(pool.label)}</b><small>${esc(pool.note)}</small></div>` : ''}
      <div class="player-top">
        ${avatarHTML(p, 'player-photo-large', `--team-color:${color}`)}
        <div><div class="player-name">${esc(p.name)}</div><div class="player-sub">${p.role} · ${p.country === 'OV' ? 'Overseas' : 'Indian'} · Former: ${esc(p.lastTeam || '—')}</div></div>
      </div>
      <div class="badges">
        ${pool ? `<span class="badge set">${esc(pool.short)} set</span>` : ''}
        <span class="badge gold">${esc(p.tier)}-tier</span>
        <span class="badge ${p.baseSource === 'confirmed' ? 'green' : ''}">${p.baseSource === 'confirmed' ? 'Confirmed ₹2 Cr base' : p.baseSource === 'estimated' ? `Est. base ₹${money(p.base)} Cr` : `Base ₹${money(p.base)} Cr`}</span>
        ${isMarquee ? '<span class="badge green">Marquee</span>' : ''}
        ${p.country === 'OV' ? '<span class="badge">Overseas</span>' : ''}
      </div>
      <div class="rating-row"><span class="rating-stars">${stars}</span><span class="rating-num">${p.rating}/10 rating</span></div>
      <div class="player-note">${state.season === '2027'
        ? (p.baseSource === 'confirmed' ? 'Base price confirmed from the supplied ₹2 Cr list.' : 'Estimated base — the final IPL shortlist has not been published yet.')
        : (isMarquee ? `A real ${pool ? esc(pool.short) : 'marquee'} set name — ₹2 Cr base price, just like the 2025 auction.` : p.tier === 'A' ? 'A marquee name — expect a heated bidding war.' : p.tier === 'B' ? 'A proven IPL performer who can change a side.' : p.tier === 'C' ? 'Useful squad player with a clear role.' : 'A young or fringe player looking for a break.')}</div>
      ${photoCreditHTML(p)}
    `;
  }

  function renderBid() {
    const ring = $('timerRing');
    const pct = state.current ? Math.max(0, Math.min(100, state.timeLeft / state.settings.timer * 100)) : 100;
    ring.style.setProperty('--pct', `${pct}%`);
    ring.classList.toggle('urgent', state.timeLeft <= 5 && state.status === 'live');
    $('timerValue').textContent = state.current && state.status === 'live' ? Math.ceil(state.timeLeft) : '—';
    $('currentBid').textContent = state.current ? money(state.current.bid) : '0.0';
    $('bidStatus').textContent = state.paused ? 'PAUSED' : state.status.toUpperCase();

    const leader = state.current && state.current.leader;
    $('leaderLine').innerHTML = leader
      ? `Highest bidder: <b style="color:${teamById(leader).color}">${esc(leader)}</b> · ${state.current.bids.length} bids`
      : 'No bids yet — the floor price is on the table.';
    $('floorLine').textContent = state.current ? `Base price: ₹${money(state.current.player.base)} Cr${state.current.player.baseSource === 'confirmed' ? ' · confirmed' : state.current.player.baseSource === 'estimated' ? ' · estimated' : ''}` : 'Base ₹— Cr';

    const actions = $('bidActions');
    const host = $('hostActions');
    host.innerHTML = '';
    actions.innerHTML = '';

    if (state.status === 'ended') {
      actions.innerHTML = '<div class="empty-state">Check the final squads below</div>';
      return;
    }
    if (state.status === 'idle') {
      if (mode === 'solo' || isHost()) actions.innerHTML = '<button class="bid-btn primary-bid" data-action="start" type="button">Start auction 🚀</button>';
      else actions.innerHTML = '<div class="empty-state">Waiting for the host to start…</div>';
      return;
    }
    if (state.paused) {
      if (mode === 'solo' || isHost()) actions.innerHTML = '<button class="bid-btn primary-bid" data-action="resume" type="button">Resume auction</button>';
      else actions.innerHTML = '<div class="empty-state">Auction paused by host</div>';
      return;
    }
    if (state.status === 'sold' || state.status === 'unsold') {
      if (mode === 'solo' || isHost()) actions.innerHTML = '<button class="bid-btn primary-bid" data-action="next" type="button">Next player →</button>';
      else actions.innerHTML = `<div class="empty-state">${state.status === 'sold' ? 'Sold!' : 'Unsold.'} Next player loading…</div>`;
      return;
    }

    const next = Core.nextBid(state);
    const check = state.current ? Core.canBid(state, myTeam, next) : { ok: false };
    const canRTM = state.rtmEnabled !== false && state.current && state.current.player.lastTeam === myTeam && me() && me().teamId === myTeam &&
      state.current.leader && state.current.leader !== myTeam && teamById(myTeam) && findTeamState(myTeam).rtm;

    if (mode === 'solo' || (me() && me().teamId === myTeam)) {
      actions.innerHTML = `
        <button class="bid-btn primary-bid" data-action="bid" data-amount="${next}" type="button" ${check.ok ? '' : 'disabled'}>${check.ok ? `Bid ₹${money(next)} Cr` : check.reason}</button>
        <button class="bid-btn" data-action="bid" data-amount="${(next + 0.5).toFixed(1)}" type="button" ${check.ok ? '' : 'disabled'}>+ ₹0.5 Cr</button>
        <button class="bid-btn" data-action="bid" data-amount="${(next + 1).toFixed(1)}" type="button" ${canAfford(next + 1) ? '' : 'disabled'}>+ ₹1 Cr</button>
        ${canRTM ? `<button class="rtm-btn" data-action="rtm" type="button">Use RTM card · match ₹${money(state.current.bid)} Cr</button>` : ''}
      `;
    } else {
      actions.innerHTML = '<div class="empty-state">Watch the bidding</div>';
    }

    if (mode === 'solo' || isHost()) {
      host.innerHTML = `<button data-action="pause" type="button">Pause</button><button data-action="next" type="button">Force next</button><button data-action="restart" type="button">Reset</button>`;
    }
  }

  function canAfford(amount) {
    const t = findTeamState(myTeam);
    const slotsLeft = t && (t.slotsLeft == null ? 25 - t.squad.length : t.slotsLeft);
    return !!t && t.purse >= amount && slotsLeft > 0;
  }
  function findTeamState(id) { return state.teams.find((t) => t.id === id); }

  function renderTeams() {
    const leader = state.current && state.current.leader;
    const isMini = state.season === '2027';
    $('teamsList').innerHTML = state.teams.map((t) => {
      const slotsLeft = t.slotsLeft == null ? 25 - t.squad.length : t.slotsLeft;
      const overseasLeft = t.overseasLeft == null ? 8 - t.overseas : t.overseasLeft;
      const squadLine = isMini
        ? `${slotsLeft} slots · ${overseasLeft} overseas left`
        : `${t.squad.length}/25 players · ${t.overseas}/8 overseas`;
      return `
      <div class="team-row ${leader === t.id ? 'leading' : ''} ${me() && me().teamId === t.id ? 'you' : ''}" style="--team-color:${t.color}">
        <i></i>
        <div><b>${t.short}${state.rtmEnabled !== false && t.rtm ? ' · RTM' : ''}</b><small>${squadLine}</small></div>
        <div class="money"><strong>₹${moneyPrecise(t.purse)} Cr</strong><small>left</small></div>
      </div>
    `;
    }).join('');
  }

  function renderMyTeam() {
    const t = findTeamState(myTeam);
    if (!t) return;
    $('myPanel').querySelector('.panel-title').innerHTML = `Your franchise <span class="small-pill">${t.short}</span>`;
    const startingPurse = t.startingPurse || PURSE;
    const spent = startingPurse - t.purse;
    const slotsLeft = t.slotsLeft == null ? 25 - t.squad.length : t.slotsLeft;
    const overseasLeft = t.overseasLeft == null ? 8 - t.overseas : t.overseasLeft;
    $('myTeamCard').innerHTML = `
      <div class="my-team-head"><strong>${esc(t.name)}</strong><span>₹${moneyPrecise(t.purse)} Cr</span></div>
      <div class="my-meta">
        <span>${t.squad.length} in squad</span>
        <span>${slotsLeft} slots left</span>
        <span>${overseasLeft} overseas left</span>
        <span>₹${moneyPrecise(spent)} Cr spent</span>
      </div>
      <div class="mini-progress"><i style="width:${Math.min(100, spent / startingPurse * 100)}%"></i></div>
    `;
  }

  function timeLabel(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderFeed() {
    const el = $('feedContent');
    if (activeTab === 'log') {
      el.innerHTML = state.log.length ? state.log.map((l) => `
        <div class="feed-item ${esc(l.kind)}"><span class="feed-time">${timeLabel(l.at)}</span><span class="feed-text">${esc(l.text)}</span><span class="feed-team">${esc(l.kind)}</span></div>
      `).join('') : '<div class="empty-state">No bids yet</div>';
      return;
    }
    if (activeTab === 'squad') {
      const t = findTeamState(myTeam);
      el.innerHTML = t.squad.length ? `<div class="squad-list">${t.squad.map((p) => {
        const sale = state.sold.find((s) => s.player.id === p.id);
        return `<div class="squad-item"><span class="squad-player">${avatarHTML(p, 'squad-photo')}<span>${esc(p.name)}<br><small>${p.role}${p.traded ? ' · Traded in' : ''}</small></span></span><b>₹${money(sale ? sale.bid : p.base)}</b></div>`;
      }).join('')}</div>` : '<div class="empty-state">No players signed yet</div>';
      return;
    }
    if (activeTab === 'pool') {
      const soldIds = new Set(state.sold.map((s) => s.player.id));
      const unsoldIds = new Set(state.unsold.map((p) => p.id));
      const pools = state.pools && state.pools.length ? state.pools : fallbackPools();
      const selected = pools.some((p) => p.id === poolFilter) ? poolFilter : 'all';
      const visible = pools.filter((p) => selected === 'all' || p.id === selected);
      el.innerHTML = `
        <div class="pool-controls">
          <span class="field-label">Filter by real auction set</span>
          <div class="chip-row">
            <button class="chip ${selected === 'all' ? 'selected' : ''}" data-pool="all" type="button">All sets</button>
            ${pools.map((p) => `<button class="chip ${selected === p.id ? 'selected' : ''}" data-pool="${p.id}" type="button">${esc(p.short)} · ${p.total}</button>`).join('')}
          </div>
        </div>
        ${visible.map((pool) => {
          const players = state.players.filter((p) => pool.id === 'all' || p.pool === pool.id);
          return `<section class="pool-section ${pool.current ? 'current' : ''}">
            <div class="pool-head">
              <b>${esc(pool.label)}</b>
              <span>${players.length} players · ${pool.sold} sold · ${pool.unsold} unsold</span>
              ${pool.current ? '<span class="badge green">LIVE SET</span>' : ''}
            </div>
            <p>${esc(pool.note)}${state.season === '2027' ? ' ₹2.0 ✓ = confirmed base, “est.” = estimated base.' : ''}</p>
            <table class="pool-table"><thead><tr><th>Player</th><th>Role</th><th>Tier</th><th>Base</th><th>Status</th></tr></thead><tbody>
              ${players.map((p) => {
                const status = state.current && state.current.player.id === p.id ? 'LIVE' : soldIds.has(p.id) ? 'SOLD' : unsoldIds.has(p.id) ? 'UNSOLD' : 'Pending';
                const cls = status === 'LIVE' ? 'live-row' : status === 'SOLD' || status === 'UNSOLD' ? 'sold-row' : '';
                const baseLabel = `₹${money(p.base)}${p.baseSource === 'confirmed' ? ' ✓' : p.baseSource === 'estimated' ? ' est.' : ''}`;
                return `<tr class="${cls}"><td><span class="pool-player">${avatarHTML(p, 'pool-photo')}${esc(p.name)}</span></td><td>${p.role}</td><td>${p.tier}</td><td>${baseLabel}</td><td>${status}</td></tr>`;
              }).join('')}
            </tbody></table>
          </section>`;
        }).join('')}
      `;
      return;
    }
    if (activeTab === 'sold') {
      el.innerHTML = state.sold.length ? state.sold.map((s) => `
        <div class="feed-item sold"><span class="feed-time">${timeLabel(s.at)}</span><span class="feed-text feed-player">${avatarHTML(s.player, 'feed-photo')}<span><b>${esc(s.player.name)}</b> → ${esc(s.team)}</span></span><span class="feed-team">₹${money(s.bid)} Cr</span></div>
      `).join('') : '<div class="empty-state">No players sold yet</div>';
      return;
    }
    if (activeTab === 'chat') {
      el.innerHTML = (state.chat || []).length ? state.chat.map((c) => `
        <div class="feed-item"><span class="feed-time">${timeLabel(c.at)}</span><span class="feed-text"><b>${esc(c.name)} (${esc(c.team)})</b>: ${esc(c.text)}</span></div>
      `).join('') : '<div class="empty-state">No messages yet</div>';
    }
  }

  function renderChat() {
    const feed = $('chatFeed');
    feed.innerHTML = (state.chat || []).length ? state.chat.slice(0, 20).map((c) =>
      `<div class="chat-msg"><b>${esc(c.name)}</b> <span>[${esc(c.team)}]</span><br>${esc(c.text)}</div>`).join('') : '<div class="empty-state">No messages yet</div>';
  }

  function showResult() {
    const standings = Core.standings(state);
    const winner = standings[0];
    const myTeamState = findTeamState(myTeam);
    const xi = Core.bestXI(myTeamState);
    openModal(`
      <span class="eyebrow">Auction complete</span>
      <h1>🏆 ${esc(winner.name)} top the table</h1>
      <p>Most money spent, strongest squad depth and the best overall draft. Your ${esc(myTeamState.name)} finished with ₹${moneyPrecise(myTeamState.purse)} Cr of the ₹${moneyPrecise(myTeamState.startingPurse || PURSE)} Cr purse left and ${myTeamState.squad.length} players.</p>
      <div class="result-grid">
        ${standings.slice(0, 4).map((t, i) => `<div class="result-team"><b>${i + 1}. ${esc(t.name)}</b><span>₹${moneyPrecise((t.startingPurse || PURSE) - t.purse)} Cr spent · ${t.squad.length} players</span></div>`).join('')}
      </div>
      ${(() => { const prize = state.prizeMoney || PRIZE_MONEY; return `<div class="prize-note"><b>${esc(state.prizeLabel || 'Real IPL team prize money')}:</b> Champion ₹${money(prize.champion)} Cr · Runner-up ₹${money(prize.runnerUp)} Cr · Third ₹${money(prize.third)} Cr · Fourth ₹${money(prize.fourth)} Cr</div>`; })()}
      <h2>Your best XI</h2>
      <div class="squad-list">${xi.map((p) => `<div class="squad-item"><span class="squad-player">${avatarHTML(p, 'squad-photo')}<span>${esc(p.name)}<br><small>${p.role}</small></span></span><b>${p.rating}</b></div>`).join('')}</div>
      <div class="modal-actions">
        <button class="primary" data-modal="close" type="button">Back to auction</button>
        <button class="ghost" data-modal="new" type="button">New match</button>
      </div>
    `);
  }

  /* ---------- events ---------- */

  $('modeSolo').addEventListener('click', () => setMode('solo'));
  $('modeMulti').addEventListener('click', () => setMode('multi'));

  $('seasonSwitch').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-season]');
    if (!btn) return;
    selectedSeason = btn.dataset.season;
    updateSeasonUI();
  });

  $('difficultyPicker').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-difficulty]');
    if (!btn) return;
    selectedDifficulty = btn.dataset.difficulty;
    $('difficultyPicker').querySelectorAll('.chip').forEach((c) => c.classList.toggle('selected', c === btn));
  });

  $('soloTimer').addEventListener('input', () => { $('timerLabel').textContent = `${$('soloTimer').value}s`; });
  $('createTimer').addEventListener('input', () => { $('createTimerLabel').textContent = `${$('createTimer').value}s`; });
  $('startSolo').addEventListener('click', startSolo);
  $('createRoom').addEventListener('click', createRoom);
  $('joinRoom').addEventListener('click', joinRoom);
  $('joinCode').addEventListener('input', () => {
    $('joinCode').value = $('joinCode').value.toUpperCase();
    clearTimeout(refreshJoinTeams._t);
    refreshJoinTeams._t = setTimeout(refreshJoinTeams, 250);
  });

  document.querySelectorAll('[data-room-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-room-tab]').forEach((b) => b.classList.toggle('selected', b === btn));
      $('createRoomPane').hidden = btn.dataset.roomTab !== 'create';
      $('joinRoomPane').hidden = btn.dataset.roomTab !== 'join';
    });
  });

  $('roomCodeChip').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      showToast('Room code copied', 'ok');
    } catch (err) { showToast(`Room code: ${roomCode}`, 'ok'); }
  });

  $('bidActions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    localOrRemote(btn.dataset.action, { amount: Number(btn.dataset.amount) });
  });
  $('hostActions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    localOrRemote(btn.dataset.action);
  });

  $('feedTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    document.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('selected', t === btn));
    renderFeed();
  });

  $('feedContent').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pool]');
    if (!btn) return;
    poolFilter = btn.dataset.pool;
    renderFeed();
  });

  $('chatSend').addEventListener('click', () => {
    const text = $('chatInput').value.trim();
    if (!text || mode !== 'multi') return;
    $('chatInput').value = '';
    localOrRemote('chat', { text });
  });
  $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('chatSend').click(); });

  $('leaveAuction').addEventListener('click', showHome);
  $('modalBackdrop').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-modal]');
    if (btn) {
      closeModal();
      if (btn.dataset.modal === 'new') showHome();
    } else if (e.target === $('modalBackdrop')) closeModal();
  });

  /* ---------- init ---------- */

  renderTeamPicker('soloTeamPicker', myTeam, (id) => { myTeam = id; });
  renderTeamPicker('createTeamPicker', createTeam, (id) => { createTeam = id; });
  renderTeamPicker('joinTeamPicker', joinTeam, (id) => { joinTeam = id; });

  const params = new URLSearchParams(location.search);
  const roomParam = params.get('room');
  if (roomParam) {
    setMode('multi');
    $('joinCode').value = roomParam.toUpperCase();
    document.querySelector('[data-room-tab="join"]').click();
  }

  updateSeasonUI();
  checkServer();
})();
