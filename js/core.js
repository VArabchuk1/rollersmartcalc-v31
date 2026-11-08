'use strict';

/* ================= config ================= */
const ENDPOINTS = {
    proxy: 'https://morning-thunder-0ce3.wminerrc.workers.dev/?',
    user: 'https://tiny-mouse-rget.arabon3.workers.dev',
    leagues: 'https://winter-thunder-5bd1.arabon3.workers.dev/',
    miners: 'https://wispy-miners-sync-1be8.arabon3.workers.dev/',
    quest: 'https://polished-wave-ceac.arabon3.workers.dev/',
    savePlayer: 'https://billowing-leaf-save-pl.arabon3.workers.dev/',
    prices: 'https://api.coingecko.com/api/v3/simple/price',
    minerImg: 'https://static.rollercoin.com/static/img/market/miners/'
};

const COINS = [
    {name: 'btc', divisor: 1e10, prec: 8, geckoId: 'bitcoin'},
    {name: 'trx', divisor: 1e10, prec: 8, geckoId: 'tron'},
    {name: 'pol', divisor: 1e10, prec: 8, geckoId: 'polygon-ecosystem-token'},
    {name: 'bnb', divisor: 1e10, prec: 8, geckoId: 'binancecoin'},
    {name: 'eth', divisor: 1e10, prec: 8, geckoId: 'ethereum'},
    {name: 'doge', divisor: 1e4, prec: 2, geckoId: 'dogecoin'},
    {name: 'ltc', divisor: 1e8, prec: 8, geckoId: 'litecoin'},
    {name: 'algo', divisor: 1e6, prec: 4, geckoId: 'algorand'},
    {name: 'sol', divisor: 1e9, prec: 8, geckoId: 'solana'},
    {name: 'xrp', divisor: 1e6, prec: 2, geckoId: 'ripple'},
    {name: 'default', divisor: 1e6, prec: 6, geckoId: null}
];
const COIN_BY_NAME = new Map(COINS.map(c => [c.name, c]));
const DEFAULT_COIN = COIN_BY_NAME.get('default');
const coinConfig = name => COIN_BY_NAME.get((name || '').toLowerCase()) || DEFAULT_COIN;

const LEAGUES = [
    {name: 'Bronze I', limit: 0}, {name: 'Bronze II', limit: 25e6}, {name: 'Bronze III', limit: 50e6},
    {name: 'Silver I', limit: 100e6}, {name: 'Silver II', limit: 150e6}, {name: 'Silver III', limit: 250e6},
    {name: 'Gold I', limit: 650e6}, {name: 'Gold II', limit: 1.5e9}, {name: 'Gold III', limit: 3.5e9},
    {name: 'Platinum I', limit: 16e9}, {name: 'Platinum II', limit: 50e9}, {name: 'Platinum III', limit: 100e9},
    {name: 'Diamond I', limit: 200e9}, {name: 'Diamond II', limit: 375e9}, {name: 'Diamond III', limit: 650e9},
    {name: 'Titan I', limit: 1.15e12}, {name: 'Titan II', limit: 2.16e12}, {name: 'Titan III', limit: 4e12},
    {name: 'Emerald I', limit: 13e12}, {name: 'Emerald II', limit: 25e12}, {name: 'Emerald III', limit: 70e12},
    {name: 'Legend', limit: 1e15}
];

function getLeagueInfo(gh) {
    let cur = LEAGUES[0], nxt = null;
    for (let i = 0; i < LEAGUES.length; i++) {
        if (gh >= LEAGUES[i].limit) {
            cur = LEAGUES[i];
            nxt = LEAGUES[i + 1] || null;
        } else break;
    }
    return {cur, nxt};
}

/* ================= shared state ================= */
const state = {
    api: null,              // дані користувача з API (null = ручний режим)
    minersRaw: 0,
    bonusRaw: 0,
    hamsterPowerRaw: 0,
    bonusPercentClear: 0,
    hooks: {hamstersCount: 0, hamstersPower: 0, cleanTemp: 0},
    efficiency: [],         // майнери з кімнат користувача
    leagues: [],
    prices: {},
    minersLoaded: false
};

/* ================= utils ================= */
const $ = id => document.getElementById(id);
const num = v => parseFloat(v) || 0;
const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
};

const UNIT_GH = {gh: 1, th: 1e3, ph: 1e6, eh: 1e9, zh: 1e12};

function scalePower(value, units) {
    let i = 0;
    while (value >= 1000 && i < units.length - 1) { value /= 1000; i++; }
    return [value, units[i]];
}

/** 3 знаки, зі знаком, до Zh/s */
function formatPower(gh) {
    if (typeof gh !== 'number') return '0';
    if (gh === 0) return '0 Gh/s';
    const [v, u] = scalePower(Math.abs(gh), ['Gh/s', 'Th/s', 'Ph/s', 'Eh/s', 'Zh/s']);
    return (gh < 0 ? '-' : '') + v.toFixed(3) + ' ' + u;
}

/** 2 знаки, до Eh/s (для таблиць майнерів) */
function formatPowerShort(gh) {
    if (gh === 0) return '0 Gh/s';
    const [v, u] = scalePower(gh, ['Gh/s', 'Th/s', 'Ph/s', 'Eh/s']);
    return v.toFixed(2) + ' ' + u;
}

function minerGifUrl(name) {
    const f = name.toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/['’`‘]/g, '');
    return ENDPOINTS.minerImg + encodeURIComponent(f) + '.gif';
}

function thumbHtml(name, sizeClass) {
    return `<div class="thumb ${sizeClass}"><img class="miner-img" src="${minerGifUrl(name)}" alt="" loading="lazy" decoding="async"></div>`;
}

const TAGS_HTML = m =>
    (m.isInSet ? '<span class="tag tag-set">SET</span>' : '') +
    (m.isDupe ? '<span class="tag tag-dupe">DUPE</span>' : '');

/* Не вдалось завантажити картинку — ховаємо її (замість inline onerror) */
document.addEventListener('error', e => {
    const el = e.target;
    if (!el || el.tagName !== 'IMG') return;
    if (el.classList.contains('miner-img')) el.parentElement.hidden = true;
    else if (el.classList.contains('coin-icon')) el.style.display = 'none';
}, true);

/* ================= i18n ================= */
let translations = null;
let langToken = 0;

const t = (key, fallback) => translations?.[key] || fallback;

function loadLang(lang) {
    const tr = window.__LANG && window.__LANG[lang];
    return tr ? Promise.resolve(tr) : Promise.reject(new Error(`Немає перекладу: ${lang}`));
}

function translateEl(el, tr) {
    const key = el.dataset.lang;
    const val = tr[key];
    if (!val) return;
    const d = el.dataset;
    if (key === 'calc_dist_next' || key === 'calc_final_dist_next') {
        el.textContent = val.replace('{name}', d.name || '').replace('{power}', d.power || '0');
    } else if (key === 'text_miner_not_found') {
        el.textContent = val.replace('{query}', d.query || '');
    } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = val;
    } else if (val.includes('<')) {
        el.innerHTML = val;
    } else {
        el.textContent = val;
    }
}

/** Застосувати переклад до root (і його нащадків). Дешево викликати на малих фрагментах. */
function applyLanguage(root = document) {
    const tr = translations;
    if (!tr || !root) return;
    if (root.dataset && root.dataset.lang) translateEl(root, tr);
    root.querySelectorAll('[data-lang]').forEach(el => translateEl(el, tr));
    root.querySelectorAll('[data-lang-placeholder]').forEach(el => {
        const v = tr[el.dataset.langPlaceholder];
        if (v) el.placeholder = v;
    });
    root.querySelectorAll('[data-lang-alt]').forEach(el => {
        const v = tr[el.dataset.langAlt];
        if (v) el.alt = v;
    });
    root.querySelectorAll('[data-lang-room]').forEach(el => el.textContent = tr.room || 'Кімн.');
    root.querySelectorAll('[data-lang-rack]').forEach(el => el.textContent = tr.rack || 'Стел.');
    root.querySelectorAll('[data-lang-shelf]').forEach(el => el.textContent = tr.shelf || 'Пол.');
}

async function switchLanguage(lang) {
    const token = ++langToken;
    try {
        const tr = await loadLang(lang);
        if (token !== langToken) return;
        translations = tr;
        store.set('selectedLang', lang);
        applyLanguage(document);
    } catch (error) {
        console.error('Помилка локалізації:', error);
    }
}

/* ================= API ================= */
async function fetchJson(url, options) {
    const r = await fetch(url, options);
    return r.json();
}

async function savePlayerToDatabase(nickname, userId) {
    if (!userId || !nickname) return {success: false};
    try {
        const response = await fetch(ENDPOINTS.savePlayer, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nickname, user_id: userId})
        });
        if (response.ok) return {success: true};
        const err = await response.json().catch(() => ({}));
        // гравець уже існує (unique constraint у Supabase)
        return {success: err.code === '23505'};
    } catch (e) {
        return {success: false};
    }
}

const PRICE_CACHE_KEY = 'cg_prices_v1';
const PRICE_TTL = 5 * 60 * 1000;

async function loadCryptoPrices() {
    try {
        const cached = JSON.parse(store.get(PRICE_CACHE_KEY) || 'null');
        if (cached && Date.now() - cached.t < PRICE_TTL) {
            Object.assign(state.prices, cached.v);
            return;
        }
    } catch (e) { /* ignore */ }

    try {
        const ids = COINS.map(c => c.geckoId).filter(Boolean).join(',');
        const response = await fetch(`${ENDPOINTS.prices}?ids=${ids}&vs_currencies=usd`);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();
        const prices = {};
        for (const id in data) if (data[id] && data[id].usd != null) prices[id] = data[id].usd;
        Object.assign(state.prices, prices);
        if (Object.keys(prices).length) store.set(PRICE_CACHE_KEY, JSON.stringify({t: Date.now(), v: prices}));
    } catch (e) {
        console.error('Помилка завантаження курсів', e);
    }
}

async function loadLeagues() {
    try {
        const response = await fetch(ENDPOINTS.leagues);
        if (!response.ok) throw new Error('Помилка сервера');
        const data = await response.json();
        state.leagues = Array.isArray(data) ? data : [data];
        if ($('tab-top').classList.contains('active')) initTopLeagues();
    } catch (e) {
        console.error('Помилка ліг:', e);
        $('tableBody').innerHTML = '<tr><td colspan="7" style="color:red;text-align:center"><span data-lang="error_fetch_data">Помилка отримання даних</span></td></tr>';
    }
}
