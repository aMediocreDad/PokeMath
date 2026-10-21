// ── Constants ────────────────────────────────────────────────────────────────
const EASTER_END = new Date('2026-04-30T23:59:59');
const LOCAL_CAP  = 500;
const GLOBAL_CAP = 1_500_000;
const SEG_COUNT  = 10;
const LOCAL_STEP = LOCAL_CAP / SEG_COUNT;   // 50
const GLOBAL_STEP = GLOBAL_CAP / SEG_COUNT; // 250 000

const EXTRA_PRIZES = [
  { threshold: 3_000_000, entry: 'S421-E1', imageid: 50161, name: 'Shiny Blossom Cherrim',       coins: 150_000 },
  { threshold: 4_000_000, entry: 'S915-E1', imageid: 50167, name: 'Shiny Egg Forager Lechonk',   coins: 200_000 },
  { threshold: 5_000_000, entry: 'S132-E1', imageid: 50227, name: 'Shiny Cracked Ditto',         coins: 300_000 },
];

const LOCAL_PRIZES = [
  { entry:'N659-E1', imageid:50143, name:'Nibbling Bunnelby',       coins:   1000 },
  { entry:'N298-E1', imageid:50164, name:'Easter Egg Azurill',      coins:   2000 },
  { entry:'N427-E1', imageid:50096, name:'Egg Basket Buneary',      coins:   3000 },
  { entry:'N399-E1', imageid:50228, name:'Easter Bidoof',           coins:   4000 },
  { entry:'N52-E1',  imageid:50163, name:'Egg Painter Meowth',      coins:   5000 },
  { entry:'N82-E1',  imageid:50092, name:'Eggneton',                coins:   7500 },
  { entry:'N115-E1', imageid:50093, name:'Egg Hunter Kangaskhan',   coins:  10000 },
  { entry:'N719-E1', imageid:50097, name:'Spring Blooming Diancie', coins:  15000 },
  { entry:'N492-E1', imageid:50060, name:'Bouquet Shaymin',         coins:  20000 },
  { entry:'S795-E1', imageid:50099, name:'Shiny Flower Pheromosa',  coins:  50000 },
];

const GLOBAL_PRIZES = [
  { entry:'N43-E1',  imageid:50059, name:'Sprouting Oddish',        coins:   5000 },
  { entry:'N660-E1', imageid:50253, name:'Bonnersby',               coins:   7500 },
  { entry:'N46-E1',  imageid:50091, name:'Flower Paras',            coins:  10000 },
  { entry:'N131-E1', imageid:50226, name:'Egg Nest Lapras',         coins:  15000 },
  { entry:'N267-E1', imageid:50094, name:'Hatching Beautifly',      coins:  20000 },
  { entry:'N421-E1', imageid:50161, name:'Blossom Cherrim',         coins:  25000 },
  { entry:'N777-E1', imageid:50166, name:'Easter Togedemaru',       coins:  30000 },
  { entry:'N915-E1', imageid:50167, name:'Egg Forager Lechonk',     coins:  50000 },
  { entry:'N132-E1', imageid:50227, name:'Cracked Ditto',           coins:  75000 },
  { entry:'S719-E1', imageid:50097, name:'Shiny Spring Diancie',   coins: 100000 },
];

// ── localStorage helpers ──────────────────────────────────────────────────────
function getLocalCaught() {
  const year = new Date().getFullYear();
  const storedYear = parseInt(localStorage.getItem('easterYear') || '0');
  if (storedYear !== year) {
    localStorage.setItem('easterYear', year);
    localStorage.setItem('easterCaught', '0');
    localStorage.setItem('easterClaimed', '[]');
    localStorage.setItem('easterLocalTs', '{}');
    return 0;
  }
  return parseInt(localStorage.getItem('easterCaught') || '0');
}

function getLocalClaimed() {
  try { return JSON.parse(localStorage.getItem('easterClaimed') || '[]'); }
  catch { return []; }
}

function getLocalTimestamps() {
  try { return JSON.parse(localStorage.getItem('easterLocalTs') || '{}'); }
  catch { return {}; }
}

function getGlobalClaimed() {
  try { return JSON.parse(localStorage.getItem('easterGlobalClaimed') || '[]'); }
  catch { return []; }
}

function getExtraClaimed() {
  try { return JSON.parse(localStorage.getItem('easterExtraClaimed') || '[]'); }
  catch { return []; }
}

function saveExtraClaimed(arr) {
  localStorage.setItem('easterExtraClaimed', JSON.stringify(arr));
}

function saveLocalClaimed(arr) {
  localStorage.setItem('easterClaimed', JSON.stringify(arr));
}

function saveGlobalClaimed(arr) {
  localStorage.setItem('easterGlobalClaimed', JSON.stringify(arr));
}

function fmtTs(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.toLocaleDateString('no-NO', { day:'numeric', month:'short' }) + ' ' +
         d.toLocaleTimeString('no-NO', { hour:'2-digit', minute:'2-digit' });
}

function fmtCoins(n) {
  return n.toLocaleString('no-NO') + ' mynter';
}

// ── Countdown ────────────────────────────────────────────────────────────────
function updateCountdown() {
  const now = Date.now();
  const diff = EASTER_END - now;
  const el = document.getElementById('easterCountdown');
  if (diff <= 0) {
    el.textContent = 'Eventet er avsluttet.';
    return;
  }
  const days = Math.floor(diff / 86400000);
  const hrs  = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  el.innerHTML =
    `Avsluttes om: <span class="cd-pill">${days}d</span> <span class="cd-pill">${hrs}t</span> <span class="cd-pill">${String(mins).padStart(2,'0')}m</span> <span class="cd-pill">${String(secs).padStart(2,'0')}s</span>`;
}

// ── Segment rendering ────────────────────────────────────────────────────────
function renderSegments(containerId, prizes, caught, claimed, timestamps, step, isGlobal, globalMilestones) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const cap = step * SEG_COUNT;
  const pct = Math.min(caught / cap * 100, 100).toFixed(2);

  // ── Wrapper (min-width forces single-line layout) ─────────────────────────
  const wrap = document.createElement('div');
  wrap.className = 'easter-track-wrap';

  // ── Progress bar track ────────────────────────────────────────────────────
  const track = document.createElement('div');
  track.className = 'easter-bar-track';

  const fill = document.createElement('div');
  fill.className = 'easter-bar-fill';
  fill.style.width = pct + '%';
  track.appendChild(fill);

  for (let i = 0; i < SEG_COUNT; i++) {
    const threshold = (i + 1) * step;
    const isClaimed = claimed.includes(i);
    const isReached = caught >= threshold;

    const dot = document.createElement('div');
    dot.className = 'easter-ms-dot ' + (isClaimed ? 'claimed' : isReached ? 'reached' : 'locked');
    dot.style.left = ((i + 1) / SEG_COUNT * 100).toFixed(1) + '%';
    dot.textContent = isClaimed ? '\u2713' : String(i + 1);
    track.appendChild(dot);
  }

  wrap.appendChild(track);

  // ── Grid row of reward items ──────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.className = 'easter-ms-grid';

  for (let i = 0; i < SEG_COUNT; i++) {
    const threshold = (i + 1) * step;
    const prize = prizes[i];
    const isClaimed   = claimed.includes(i);
    const isReached   = caught >= threshold;
    const isClaimable = isReached && !isClaimed;

    let ts = '';
    if (isGlobal && globalMilestones) {
      const m = globalMilestones.find(m => m.segment === i + 1);
      if (m) ts = fmtTs(m.reached_at);
    } else if (timestamps[i + 1]) {
      ts = fmtTs(timestamps[i + 1]);
    }

    const thresholdLabel = isGlobal
      ? (threshold >= 1_000_000
          ? (threshold / 1_000_000).toLocaleString('no-NO') + 'M'
          : (threshold / 1000).toLocaleString('no-NO') + 'k')
      : threshold;

    // Claimable: show bouncing egg sprite. Locked: show "?" box. Claimed: show pokemon.
    let imgHtml;
    if (isClaimed) {
      imgHtml = `<img class="easter-ms-img" src="images/pokemon/normal/${prize.imageid}.webp" alt="${prize.name}" title="${prize.name}" loading="lazy">`;
    } else if (isClaimable) {
      imgHtml = `<button class="easter-egg-btn" data-idx="${i}" data-global="${isGlobal ? 1 : 0}" title="Klikk for å åpne!"><img class="easter-ms-egg" src="images/events/easter/Spr_4d_Egg.png" alt="Egg"></button>`;
    } else {
      imgHtml = `<div class="easter-ms-unknown">?</div>`;
    }

    const actionHtml = isClaimed
      ? `<span class="easter-ms-check" title="Hentet"></span>`
      : isClaimable
        ? ''
        : `<span class="easter-ms-lock" title="Ikke nådd ennå"></span>`;

    const item = document.createElement('div');
    item.className = 'easter-ms-item ' + (isClaimed ? 'claimed' : isReached ? 'reached' : 'locked');
    item.innerHTML = `
      <div class="easter-ms-threshold">${thresholdLabel}</div>
      ${imgHtml}
      <div class="easter-ms-coins">${fmtCoins(prize.coins)}</div>
      ${ts ? `<div class="easter-ms-ts">${ts}</div>` : ''}
      <div class="easter-ms-action">${actionHtml}</div>
    `;
    grid.appendChild(item);
  }

  grid.querySelectorAll('.easter-egg-btn').forEach(btn => {
    btn.addEventListener('click', () => claimPrize(parseInt(btn.dataset.idx), btn.dataset.global === '1'));
  });

  wrap.appendChild(grid);
  container.appendChild(wrap);
}

// ── Extra goals rendering ─────────────────────────────────────────────────────
function renderExtraGoals() {
  const section = document.getElementById('extra-goals-section');
  if (!section) return;

  // Only show once main global goal is reached
  if (globalTotal < GLOBAL_CAP) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  const claimed = getExtraClaimed();
  const container = document.getElementById('extra-goals-cards');
  if (!container) return;
  container.innerHTML = '';

  EXTRA_PRIZES.forEach((prize, idx) => {
    const isReached   = globalTotal >= prize.threshold;
    const isClaimed   = claimed.includes(idx);
    const isClaimable = isReached && !isClaimed;

    const thresholdLabel = (prize.threshold / 1_000_000).toLocaleString('no-NO') + 'M';
    const progress = Math.min(globalTotal / prize.threshold * 100, 100).toFixed(1);

    let imgHtml;
    if (isClaimed) {
      imgHtml = `<img class="easter-ms-img" src="images/pokemon/normal/${prize.imageid}.webp" alt="${prize.name}" title="${prize.name}" loading="lazy">`;
    } else if (isClaimable) {
      imgHtml = `<button class="easter-egg-btn extra-egg-btn" data-extra-idx="${idx}" title="Klikk for å åpne!"><img class="easter-ms-egg" src="images/events/easter/Spr_4d_Egg.png" alt="Egg"></button>`;
    } else {
      imgHtml = `<div class="easter-ms-unknown">?</div>`;
    }

    const card = document.createElement('div');
    card.className = 'extra-goal-card' +
      (isClaimed ? ' extra-claimed' : isReached ? ' extra-reached' : ' extra-locked');
    card.innerHTML = `
      <div class="extra-goal-label">⭐ Ekstra mål</div>
      <div class="extra-goal-threshold">${thresholdLabel} Pokémon fanget globalt</div>
      <div class="extra-goal-img">${imgHtml}</div>
      <div class="extra-goal-name">${isClaimed || isReached ? prize.name : '???'}</div>
      <div class="extra-goal-coins">${fmtCoins(prize.coins)}</div>
      <div class="extra-goal-bar-wrap">
        <div class="extra-goal-bar-track">
          <div class="extra-goal-bar-fill" style="width:${progress}%"></div>
        </div>
        <div class="extra-goal-bar-label">${globalTotal.toLocaleString('no-NO')} / ${prize.threshold.toLocaleString('no-NO')}</div>
      </div>
      ${isClaimed ? '<div class="extra-goal-status claimed-status">✓ Hentet</div>' : ''}
    `;
    container.appendChild(card);
  });

  container.querySelectorAll('.extra-egg-btn').forEach(btn => {
    btn.addEventListener('click', () => claimExtraPrize(parseInt(btn.dataset.extraIdx)));
  });
}

function claimExtraPrize(idx) {
  const prize = EXTRA_PRIZES[idx];
  if (!prize) return;
  const claimed = getExtraClaimed();
  if (claimed.includes(idx)) return;
  if (globalTotal < prize.threshold) return;
  claimed.push(idx);
  saveExtraClaimed(claimed);

  if (typeof addSpecificToPokedex === 'function') addSpecificToPokedex(prize.entry);

  if (typeof state !== 'undefined') {
    state.totalScore += prize.coins;
    const moneyEl = document.querySelector('.money');
    if (moneyEl) {
      moneyEl.dataset.added = '+' + prize.coins;
      moneyEl.dataset.total = state.totalScore;
      moneyEl.textContent = '';
      if (state.totalScore) moneyEl.classList.add('animate');
      setTimeout(() => moneyEl.classList.remove('animate'), 1000);
    }
    if (typeof saveAll === 'function') saveAll();
  }

  const lootboxPrize = {
    type: 'pokemon',
    entry: prize.entry,
    pokedexId: prize.imageid,
    shiny: true,
    legendary: false,
    source: 'easter',
    easterCoins: prize.coins,
    easterName: prize.name
  };
  if (typeof _showSingleLootbox === 'function') {
    _showSingleLootbox(lootboxPrize, () => refresh());
  } else {
    refresh();
  }
}

// ── Claim prize ───────────────────────────────────────────────────────────────
function claimPrize(segIndex, isGlobal) {
  const prizes = isGlobal ? GLOBAL_PRIZES : LOCAL_PRIZES;
  const prize = prizes[segIndex];
  if (!prize) return;

  if (isGlobal) {
    const claimed = getGlobalClaimed();
    if (claimed.includes(segIndex)) return;
    claimed.push(segIndex);
    saveGlobalClaimed(claimed);
  } else {
    const claimed = getLocalClaimed();
    if (claimed.includes(segIndex)) return;
    claimed.push(segIndex);
    saveLocalClaimed(claimed);
  }

  // Give pokemon
  if (typeof addSpecificToPokedex === 'function') {
    addSpecificToPokedex(prize.entry);
  }

  // Give coins
  if (typeof state !== 'undefined') {
    state.totalScore += prize.coins;
    const moneyEl = document.querySelector('.money');
    if (moneyEl) {
      moneyEl.dataset.added = '+' + prize.coins;
      moneyEl.dataset.total = state.totalScore;
      moneyEl.textContent = '';
      if (state.totalScore) moneyEl.classList.add('animate');
      setTimeout(() => moneyEl.classList.remove('animate'), 1000);
    }
    if (typeof saveAll === 'function') saveAll();
  }

  // Show reveal overlay (reuse pokestuff lootbox, easter-themed)
  const isShiny = prize.entry.startsWith('S');
  const lootboxPrize = {
    type: 'pokemon',
    entry: prize.entry,
    pokedexId: prize.imageid,
    shiny: isShiny,
    legendary: false,
    source: 'easter',
    easterCoins: prize.coins,
    easterName: prize.name
  };
  if (typeof _showSingleLootbox === 'function') {
    _showSingleLootbox(lootboxPrize, () => refresh());
  } else {
    refresh();
  }
}

// ── Global fetch ──────────────────────────────────────────────────────────────
let globalTotal = 0;
let globalMilestones = [];

async function fetchGlobal(retryOnFail = true) {
  try {
    const r = await fetch('/api/easter/global');
    if (!r.ok) {
      if (retryOnFail) setTimeout(() => fetchGlobal(false), 15000);
      return;
    }
    const d = await r.json();
    globalTotal = d.total || 0;
    globalMilestones = d.milestones || [];
    document.getElementById('globalCount').textContent = globalTotal.toLocaleString('no-NO');
    refresh();
  } catch {
    if (retryOnFail) setTimeout(() => fetchGlobal(false), 15000);
  }
}

// ── Animated count-up ────────────────────────────────────────────────────────
function animateCount(el, from, to, duration = 600) {
  if (!el) return;
  if (from === to) return;
  const start = performance.now();
  const diff = to - from;
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease in-out
    el.textContent = Math.round(from + diff * ease).toLocaleString('no-NO');
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = to.toLocaleString('no-NO');
  }
  requestAnimationFrame(step);
}

// ── Main refresh ──────────────────────────────────────────────────────────────
let _lastLocal  = null;
let _lastGlobal = null;

function refresh() {
  const localCaught   = getLocalCaught();
  const localClaimed  = getLocalClaimed();
  const localTs       = getLocalTimestamps();
  const globalClaimed = getGlobalClaimed();

  const localEl  = document.getElementById('localCount');
  const globalEl = document.getElementById('globalCount');

  const prevLocal  = _lastLocal  ?? 0;
  const prevGlobal = _lastGlobal ?? 0;

  animateCount(localEl,  prevLocal,  localCaught);
  animateCount(globalEl, prevGlobal, globalTotal);

  _lastLocal  = localCaught;
  _lastGlobal = globalTotal;

  renderSegments('localSegs',  LOCAL_PRIZES,  localCaught,  localClaimed,  localTs, LOCAL_STEP,  false, null);
  renderSegments('globalSegs', GLOBAL_PRIZES, globalTotal,  globalClaimed, {},      GLOBAL_STEP, true,  globalMilestones);
  renderExtraGoals();
}

// ── Init ──────────────────────────────────────────────────────────────────────
let _fetchTimer = null;
let _easterInitDone = false;

function _startFetchTimer() {
  if (_fetchTimer) return;
  _fetchTimer = setInterval(fetchGlobal, 60000);
}

function _stopFetchTimer() {
  clearInterval(_fetchTimer);
  _fetchTimer = null;
}

document.addEventListener('loadAllComplete', () => {
  if (_easterInitDone) return; // guard against loadAllComplete firing more than once
  _easterInitDone = true;

  getLocalCaught(); // triggers year reset if needed
  refresh();
  fetchGlobal();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  _startFetchTimer();

  // Auto-refresh local bar when localStorage changes in another tab
  window.addEventListener('storage', (e) => {
    if (e.key === 'easterCaught' || e.key === 'easterClaimed' || e.key === 'easterGlobalClaimed' || e.key === 'easterExtraClaimed') {
      refresh();
    }
  });

  // Also poll localStorage every 5s to catch same-tab updates
  setInterval(refresh, 5000);

  // Pause polling while tab is hidden — resume (and fetch immediately) when visible again
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _stopFetchTimer();
    } else {
      fetchGlobal();
      _startFetchTimer();
    }
  });
});
