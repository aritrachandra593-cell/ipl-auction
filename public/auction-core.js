(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AuctionCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const SEASONS = root.IPL_SEASONS || {};
  const TEAMS = [
    { id: 'CSK', name: 'Chennai Super Kings', short: 'CSK', color: '#f9b233', city: 'Chennai' },
    { id: 'MI', name: 'Mumbai Indians', short: 'MI', color: '#3b82f6', city: 'Mumbai' },
    { id: 'RCB', name: 'Royal Challengers Bengaluru', short: 'RCB', color: '#f43f5e', city: 'Bengaluru' },
    { id: 'KKR', name: 'Kolkata Knight Riders', short: 'KKR', color: '#a855f7', city: 'Kolkata' },
    { id: 'DC', name: 'Delhi Capitals', short: 'DC', color: '#60a5fa', city: 'Delhi' },
    { id: 'SRH', name: 'Sunrisers Hyderabad', short: 'SRH', color: '#fb923c', city: 'Hyderabad' },
    { id: 'RR', name: 'Rajasthan Royals', short: 'RR', color: '#facc15', city: 'Jaipur' },
    { id: 'PBKS', name: 'Punjab Kings', short: 'PBKS', color: '#e879f9', city: 'Mohali' },
    { id: 'GT', name: 'Gujarat Titans', short: 'GT', color: '#38bdf8', city: 'Ahmedabad' },
    { id: 'LSG', name: 'Lucknow Super Giants', short: 'LSG', color: '#4ade80', city: 'Lucknow' }
  ];

  const ROLE_TARGETS = { BAT: 5, ALL: 4, WK: 2, FAST: 6, SPIN: 5 };
  const BASE_BY_TIER = { A: 2, B: 1.2, C: 0.6, D: 0.3 };
  const RATING_BY_TIER = { A: 9.3, B: 8.1, C: 6.8, D: 5.6 };
  const DIFFICULTY_AGGRESSION = { easy: 0.38, standard: 0.62, tough: 0.88 };
  const PURSE = 120;
  const PRIZE_MONEY = { champion: 20, runnerUp: 12.5, third: 7, fourth: 6.5 };

  const POOLS = {
    m1: { id: 'm1', label: 'Set 1 · Marquee', short: 'M1', note: 'Balloted marquee stars from the real 2025 M1 list.' },
    m2: { id: 'm2', label: 'Set 2 · Marquee', short: 'M2', note: 'Second marquee ballot, also from the real 2025 M2 list.' },
    bat: { id: 'bat', label: 'Set 3 · Batters', short: 'BAT', note: 'Capped and uncapped batters.' },
    all: { id: 'all', label: 'Set 4 · All-rounders', short: 'ALL', note: 'Batting and bowling all-rounders.' },
    wk: { id: 'wk', label: 'Set 5 · Wicketkeepers', short: 'WK', note: 'Keepers and keeper-batters.' },
    fast: { id: 'fast', label: 'Set 6 · Fast bowlers', short: 'FAST', note: 'Seam and pace options.' },
    spin: { id: 'spin', label: 'Set 7 · Spinners', short: 'SPIN', note: 'Slow bowlers and mystery spinners.' }
  };
  const POOL_ORDER = ['m1', 'm2', 'bat', 'all', 'wk', 'fast', 'spin'];
  const MINI_POOLS = {
    bat: { id: 'bat', label: 'Batters', short: 'BAT', note: 'Batters in the 2027 auction pool.' },
    all: { id: 'all', label: 'All-rounders', short: 'ALL', note: 'Batting and bowling all-rounders.' },
    wk: { id: 'wk', label: 'Wicketkeepers', short: 'WK', note: 'Keepers and keeper-batters.' },
    fast: { id: 'fast', label: 'Fast bowlers', short: 'FAST', note: 'Seam and pace options.' },
    spin: { id: 'spin', label: 'Spinners', short: 'SPIN', note: 'Slow bowlers and mystery spinners.' }
  };
  const MINI_POOL_ORDER = ['bat', 'all', 'wk', 'fast', 'spin'];
  const MARQUEE_ONE = ['Jos Buttler', 'Shreyas Iyer', 'Rishabh Pant', 'Kagiso Rabada', 'Arshdeep Singh', 'Mitchell Starc'];
  const MARQUEE_TWO = ['Yuzvendra Chahal', 'Liam Livingstone', 'David Miller', 'KL Rahul', 'Mohammad Shami', 'Mohammed Shami', 'Mohammed Siraj'];

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function chance(p) { return Math.random() < clamp(p, 0, 1); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function poolForPlayer(name, role, seasonId) {
    const byRole = { BAT: 'bat', ALL: 'all', WK: 'wk', FAST: 'fast', SPIN: 'spin' };
    if (seasonId !== '2027') {
      if (MARQUEE_ONE.includes(name)) return 'm1';
      if (MARQUEE_TWO.includes(name)) return 'm2';
    }
    return byRole[role] || 'bat';
  }

  function buildPlayers(raw, seasonId) {
    return raw.map((p, i) => {
      const tier = p.tier || 'D';
      const jitter = (hash(p.name + i) % 14 - 7) / 10;
      const pool = poolForPlayer(p.name, p.role || 'BAT', seasonId);
      const isMarquee = pool === 'm1' || pool === 'm2';
      const base = p.base != null ? p.base : (isMarquee ? 2 : (BASE_BY_TIER[tier] ?? 0.3));
      const baseSource = p.baseSource || (isMarquee ? 'official' : 'mock');
      return {
        id: `${slug(p.name)}-${i}`,
        name: p.name,
        role: p.role || 'BAT',
        country: p.country || 'IND',
        lastTeam: p.lastTeam || null,
        tier,
        pool,
        base,
        baseSource,
        rating: clamp(Math.round((RATING_BY_TIER[tier] + jitter) * 10) / 10, 4.5, 10)
      };
    });
  }

  function orderPlayers(players) {
    return players.slice().sort((a, b) => {
      const poolDelta = POOL_ORDER.indexOf(a.pool) - POOL_ORDER.indexOf(b.pool);
      if (poolDelta) return poolDelta;
      const tierDelta = Object.keys(BASE_BY_TIER).indexOf(a.tier) - Object.keys(BASE_BY_TIER).indexOf(b.tier);
      if (tierDelta) return tierDelta;
      return b.rating - a.rating;
    });
  }

  function nameKey(name) { return String(name || '').toLowerCase().trim(); }

  function metaForName(name, rawByName, cfg) {
    const found = rawByName.get(nameKey(name));
    const meta = (cfg && cfg.playerMeta && cfg.playerMeta[name]) || {};
    return {
      role: (found && found.role) || meta.role || 'BAT',
      country: (found && found.country) || meta.country || 'IND',
      tier: (found && found.tier) || meta.tier || 'C',
      rating: found && found.rating ? found.rating : null
    };
  }

  function rawByName(raw) {
    const map = new Map();
    raw.forEach((p) => map.set(nameKey(p.name), p));
    return map;
  }

  function build2027PlayerData(raw) {
    const cfg = SEASONS['2027'];
    if (!cfg) return raw;
    const byName = rawByName(raw);
    const seen = new Set();
    const retainedNames = new Set(Object.values(cfg.retained || {}).flat().map(nameKey));
    const players = [];
    Object.keys(cfg.released || {}).forEach((teamId) => {
      (cfg.released[teamId] || []).forEach((name) => {
        const key = nameKey(name);
        if (seen.has(key) || retainedNames.has(key)) return;
        seen.add(key);
        const meta = metaForName(name, byName, cfg);
        players.push({ name, role: meta.role, country: meta.country, lastTeam: teamId, tier: meta.tier });
      });
    });
    (cfg.extraReleased || []).forEach((entry) => {
      const name = typeof entry === 'string' ? entry : entry.name;
      const key = nameKey(name);
      if (seen.has(key) || retainedNames.has(key)) return;
      seen.add(key);
      const meta = metaForName(name, byName, cfg);
      players.push({
        name,
        role: meta.role,
        country: meta.country,
        lastTeam: (typeof entry === 'object' && entry.team) || null,
        tier: meta.tier
      });
    });
    const confirmed = new Set((cfg.confirmedBasePlayers || []).map(nameKey));
    const estimates = cfg.estimatedBaseByTier || {};
    players.forEach((p) => {
      if (confirmed.has(nameKey(p.name))) {
        p.base = 2;
        p.baseSource = 'confirmed';
      } else {
        p.base = estimates[p.tier] ?? 0.3;
        p.baseSource = 'estimated';
      }
    });
    return players;
  }

  function buildRetainedSquads(cfg, raw) {
    const byName = rawByName(raw);
    return TEAMS.map((t) => {
      const teamCfg = (cfg.teams && cfg.teams[t.id]) || { purse: cfg.purse, slots: cfg.squadCap, overseas: 0 };
      const squad = (cfg.retained && cfg.retained[t.id] || []).map((name) => {
        const meta = metaForName(name, byName, cfg);
        const jitter = (hash(name + t.id) % 14 - 7) / 10;
        return {
          id: `retained-${slug(name)}-${t.id}`,
          name,
          role: meta.role,
          country: meta.country,
          lastTeam: t.id,
          tier: meta.tier,
          base: 0,
          rating: clamp(Math.round(((RATING_BY_TIER[meta.tier] || 6.8) + jitter) * 10) / 10, 4.5, 10),
          retained: true
        };
      });
      const roleCount = { BAT: 0, ALL: 0, WK: 0, FAST: 0, SPIN: 0 };
      squad.forEach((p) => { roleCount[p.role] = (roleCount[p.role] || 0) + 1; });
      return {
        ...t,
        purse: teamCfg.purse,
        startingPurse: teamCfg.purse,
        squad,
        overseas: cfg.overseasCap - teamCfg.overseas,
        overseasLeft: teamCfg.overseas,
        slotsLeft: teamCfg.slots,
        rtm: false,
        roleCount
      };
    });
  }

  function allSlotsFilled(state) {
    return state.teams.every((t) => (t.slotsLeft == null ? 25 - t.squad.length : t.slotsLeft) <= 0);
  }

  function createGame(opts = {}) {
    const seasonId = SEASONS[opts.season] ? opts.season : '2025';
    const cfg = SEASONS[seasonId];
    const rawAll = opts.playerData || root.IPL_PLAYER_DATA || [];
    const raw = seasonId === '2027' && !opts.playerData ? build2027PlayerData(rawAll) : rawAll;
    const players = orderPlayers(buildPlayers(raw, seasonId));
    const poolOrder = seasonId === '2027' ? MINI_POOL_ORDER : POOL_ORDER;
    const poolDefs = seasonId === '2027' ? MINI_POOLS : POOLS;
    const pools = poolOrder.map((id) => ({
      ...poolDefs[id],
      id,
      total: players.filter((p) => p.pool === id).length,
      sold: 0,
      unsold: 0,
      current: false
    }));
    const teams = seasonId === '2027'
      ? buildRetainedSquads(cfg, rawAll)
      : TEAMS.map((t) => ({
        ...t,
        purse: cfg.purse,
        startingPurse: cfg.purse,
        squad: [],
        overseas: 0,
        overseasLeft: cfg.overseasCap,
        slotsLeft: cfg.squadCap,
        rtm: cfg.rtm,
        roleCount: { BAT: 0, ALL: 0, WK: 0, FAST: 0, SPIN: 0 }
      }));
    return {
      id: opts.id || Math.random().toString(36).slice(2, 8).toUpperCase(),
      mode: opts.mode || 'solo',
      season: seasonId,
      seasonLabel: cfg.label,
      seasonTagline: cfg.tagline,
      rtmEnabled: cfg.rtm,
      totalPurse: cfg.purse,
      squadCap: cfg.squadCap,
      overseasCap: cfg.overseasCap,
      prizeMoney: cfg.prizeMoney,
      prizeLabel: cfg.prizeLabel,
      settings: { timer: opts.timer || 20, difficulty: opts.difficulty || 'standard' },
      teams,
      players,
      pools,
      currentPoolId: null,
      queue: players.map((p) => p.id),
      index: 0,
      current: null,
      timeLeft: opts.timer || 20,
      advanceIn: 0,
      status: 'idle',
      log: [],
      sold: [],
      unsold: [],
      clients: [],
      ownerTeam: opts.ownerTeam || null,
      hostId: opts.hostId || null,
      version: 0,
      createdAt: Date.now()
    };
  }

  function bump(state) { state.version = (state.version || 0) + 1; }

  function addLog(state, text, kind = 'info') {
    state.log.unshift({ text, kind, at: Date.now(), id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    if (state.log.length > 140) state.log.length = 140;
    bump(state);
  }

  function findTeam(state, teamId) { return state.teams.find((t) => t.id === teamId) || null; }
  function findPlayer(state, playerId) { return state.players.find((p) => p.id === playerId) || null; }

  function incrementFor(amount) {
    if (amount < 2) return 0.2;
    if (amount < 5) return 0.3;
    if (amount < 10) return 0.5;
    return 1;
  }

  function nextBid(state) {
    if (!state.current) return 0;
    return Math.round((state.current.bid + incrementFor(state.current.bid)) * 10) / 10;
  }

  function canBid(state, teamId, amount) {
    if (!state.current || state.status !== 'live') return { ok: false, reason: 'No player is live right now' };
    const team = findTeam(state, teamId);
    if (!team) return { ok: false, reason: 'Unknown team' };
    const slotsLeft = team.slotsLeft == null ? 25 - team.squad.length : team.slotsLeft;
    const overseasLeft = team.overseasLeft == null ? 8 - team.overseas : team.overseasLeft;
    if (state.current.leader === teamId) return { ok: false, reason: 'You are already the highest bidder' };
    if (slotsLeft <= 0) return { ok: false, reason: 'No squad slots left' };
    if (state.current.player.country === 'OV' && overseasLeft <= 0) return { ok: false, reason: 'No overseas slots left' };
    if (team.purse < amount) return { ok: false, reason: 'Insufficient budget' };
    if (amount < nextBid(state)) return { ok: false, reason: `Bid must be at least ₹${nextBid(state).toFixed(1)} Cr` };
    return { ok: true, team };
  }

  function startAuction(state) {
    if (state.status !== 'idle') return { ok: false, reason: 'Auction already started' };
    state.status = 'live';
    addLog(state, 'Auction underway. First player coming up.', 'system');
    loadNextPlayer(state);
    return { ok: true };
  }

  function syncPool(state, player) {
    if (!state.pools || !player) return;
    let changed = false;
    state.pools.forEach((pool) => {
      const active = pool.id === player.pool;
      if (active && state.currentPoolId !== pool.id) changed = true;
      pool.current = active;
    });
    state.currentPoolId = player.pool;
    if (changed) {
      const pool = state.pools.find((p) => p.id === player.pool);
      if (pool) addLog(state, `${pool.label} is now up. ${pool.note}`, 'set');
    }
  }

  function loadNextPlayer(state) {
    if (state.index >= state.queue.length || allSlotsFilled(state)) {
      state.status = 'ended';
      state.current = null;
      state.currentPoolId = null;
      if (state.pools) state.pools.forEach((pool) => { pool.current = false; });
      addLog(state, 'Auction complete. Final squads are ready.', 'system');
      return { ok: false, reason: 'No players left' };
    }
    const player = findPlayer(state, state.queue[state.index]);
    state.index += 1;
    syncPool(state, player);
    state.current = {
      player,
      bid: player.base,
      leader: null,
      bids: [],
      rtmUsed: []
    };
    state.timeLeft = state.settings.timer;
    state.advanceIn = 0;
    state.status = 'live';
    const pool = state.pools && state.pools.find((p) => p.id === player.pool);
    addLog(state, `${pool ? `${pool.short}: ` : ''}${player.name} (${player.role}) — base ₹${player.base.toFixed(1)} Cr. Bids open.`, 'player');
    return { ok: true };
  }

  function placeBid(state, teamId, amount, clientId) {
    const check = canBid(state, teamId, amount);
    if (!check.ok) return check;
    const team = check.team;
    const rounded = Math.round(amount * 10) / 10;
    state.current.bid = rounded;
    state.current.leader = teamId;
    state.current.bids.push({ team: teamId, amount: rounded, at: Date.now(), by: clientId || null });
    if (state.timeLeft < 5) state.timeLeft = 5;
    addLog(state, `${team.short} bid ₹${rounded.toFixed(1)} Cr for ${state.current.player.name}.`, 'bid');
    return { ok: true };
  }

  function useRTM(state, teamId) {
    if (!state.current || state.status !== 'live') return { ok: false, reason: 'No live auction' };
    if (state.rtmEnabled === false) return { ok: false, reason: 'No RTM in a mini auction' };
    const team = findTeam(state, teamId);
    const player = state.current.player;
    if (!team || !team.rtm) return { ok: false, reason: 'RTM already used' };
    if (team.id !== player.lastTeam) return { ok: false, reason: 'Only the former franchise can use RTM' };
    if (!state.current.leader || state.current.leader === teamId) return { ok: false, reason: 'RTM needs another leading bidder' };
    const slotsLeft = team.slotsLeft == null ? 25 - team.squad.length : team.slotsLeft;
    const overseasLeft = team.overseasLeft == null ? 8 - team.overseas : team.overseasLeft;
    if (slotsLeft <= 0) return { ok: false, reason: 'No squad slots left' };
    if (player.country === 'OV' && overseasLeft <= 0) return { ok: false, reason: 'No overseas slots left' };
    if (team.purse < state.current.bid) return { ok: false, reason: 'Insufficient budget' };
    team.rtm = false;
    state.current.leader = teamId;
    state.current.bids.push({ team: teamId, amount: state.current.bid, at: Date.now(), rtm: true });
    state.current.rtmUsed.push(teamId);
    state.timeLeft = Math.max(state.timeLeft, 6);
    addLog(state, `${team.short} use RTM and match ₹${state.current.bid.toFixed(1)} Cr for ${player.name}.`, 'rtm');
    return { ok: true };
  }

  function finishPlayer(state, forced = false) {
    if (!state.current || state.status !== 'live') return;
    const { player, leader, bid } = state.current;
    const pool = state.pools && state.pools.find((p) => p.id === player.pool);
    if (leader) {
      const team = findTeam(state, leader);
      if (pool) pool.sold += 1;
      if (team) {
        team.purse = Math.round((team.purse - bid) * 10) / 10;
        team.squad.push(player);
        if (team.slotsLeft != null) team.slotsLeft = Math.max(0, team.slotsLeft - 1);
        if (player.country === 'OV') {
          team.overseas += 1;
          if (team.overseasLeft != null) team.overseasLeft = Math.max(0, team.overseasLeft - 1);
        }
        team.roleCount[player.role] = (team.roleCount[player.role] || 0) + 1;
        state.sold.unshift({ player, team: leader, bid, at: Date.now() });
        addLog(state, `${forced ? 'Host advanced — ' : ''}SOLD! ${player.name} to ${team.short} for ₹${bid.toFixed(1)} Cr.`, 'sold');
      }
    } else {
      if (pool) pool.unsold += 1;
      state.unsold.unshift(player);
      addLog(state, forced
        ? `Host skipped ${player.name} at base ₹${player.base.toFixed(1)} Cr.`
        : `${player.name} goes unsold at ₹${player.base.toFixed(1)} Cr.`, 'unsold');
    }
    state.status = leader ? 'sold' : 'unsold';
    state.advanceIn = 3;
    bump(state);
  }

  function forceNext(state) {
    if (state.status === 'live') finishPlayer(state, true);
    state.advanceIn = 0;
    loadNextPlayer(state);
    return { ok: true };
  }

  function roleNeed(team, role) {
    const have = team.roleCount[role] || 0;
    return (ROLE_TARGETS[role] || 0) - have;
  }

  function maxBidFor(state, team, player) {
    const tierBoost = { A: 8, B: 4.5, C: 1.4, D: 0.2 }[player.tier] || 0.2;
    const need = roleNeed(team, player.role);
    const needBoost = need > 0 ? need * 0.65 : (state.season === '2027' ? -0.35 : -1.4);
    const wkBoost = player.role === 'WK' && !team.roleCount.WK ? 2 : 0;
    const slots = team.slotsLeft == null ? 25 - team.squad.length : team.slotsLeft;
    const reserve = slots > 4 ? 4 : 1;
    const cap = tierBoost + needBoost + wkBoost + (player.rating - 6) * 0.7 + rand(-0.6, 0.9);
    return clamp(cap, player.base, team.purse - reserve);
  }

  function aiBids(state) {
    if (state.mode !== 'solo' || !state.current || state.status !== 'live') return;
    const aggression = DIFFICULTY_AGGRESSION[state.settings.difficulty] || 0.62;
    const player = state.current.player;
    const contenders = state.teams.filter((t) => t.id !== state.ownerTeam).map((team) => {
      const max = maxBidFor(state, team, player);
      return { team, max };
    }).filter((c) => c.max >= nextBid(state) && c.team.purse > 3);

    if (state.current.leader && player.lastTeam && state.current.leader !== player.lastTeam) {
      const former = findTeam(state, player.lastTeam);
      if (former && former.rtm && former.id !== state.ownerTeam && chance(aggression * 0.55)) useRTM(state, former.id);
    }

    if (!contenders.length || !chance(aggression * 0.7)) return;
    const eligible = contenders.filter((c) => c.team.id !== state.current.leader && c.team.id !== player.lastTeam);
    const pool = eligible.length ? eligible : contenders;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const amount = nextBid(state);
    if (amount <= chosen.max) placeBid(state, chosen.team.id, amount, `ai-${chosen.team.id}`);
  }

  function tick(state, dt = 1) {
    if (!state || state.status === 'ended') return;
    if (state.status === 'live') {
      aiBids(state);
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      bump(state);
      if (state.timeLeft <= 0) finishPlayer(state);
    } else if (state.status === 'sold' || state.status === 'unsold') {
      state.advanceIn = Math.max(0, state.advanceIn - dt);
      bump(state);
      if (state.advanceIn <= 0) loadNextPlayer(state);
    }
  }

  function standings(state) {
    return state.teams.slice().sort((a, b) => {
      const spentA = (a.startingPurse ?? PURSE) - a.purse;
      const spentB = (b.startingPurse ?? PURSE) - b.purse;
      if (spentB !== spentA) return spentB - spentA;
      if (b.squad.length !== a.squad.length) return b.squad.length - a.squad.length;
      const ratingA = a.squad.reduce((s, p) => s + p.rating, 0);
      const ratingB = b.squad.reduce((s, p) => s + p.rating, 0);
      return ratingB - ratingA;
    });
  }

  function bestXI(team) {
    const squad = team.squad.slice().sort((a, b) => b.rating - a.rating);
    const wk = squad.filter((p) => p.role === 'WK').slice(0, 1);
    const bowlers = squad.filter((p) => p.role === 'FAST' || p.role === 'SPIN').slice(0, 5);
    const others = squad.filter((p) => p !== wk[0] && !bowlers.includes(p));
    return [...wk, ...bowlers, ...others].slice(0, 11);
  }

  function snapshot(state) {
    return JSON.parse(JSON.stringify(state));
  }

  return {
    TEAMS, ROLE_TARGETS, BASE_BY_TIER, DIFFICULTY_AGGRESSION, PURSE, PRIZE_MONEY,
    POOLS, POOL_ORDER, MINI_POOLS, MINI_POOL_ORDER, SEASONS,
    createGame, startAuction, loadNextPlayer, placeBid, useRTM, finishPlayer,
    forceNext, tick, nextBid, incrementFor, canBid, standings, bestXI, snapshot,
    findTeam, findPlayer, addLog, bump
  };
});
