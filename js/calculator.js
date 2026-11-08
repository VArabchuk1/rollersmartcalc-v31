'use strict';

/* ================= таблиця прибутковості ================= */
const USD_DIRECT = new Set(['rlt', 'rst', 'hmt', 'usdt']);
const NO_DOLLAR = new Set(['rlt', 'rst', 'hmt']);

function buildCoinRows(userPower, leagueName, headerSel = '#nextLeagueHeader .nl-name') {
    const leagues = state.leagues;
    if (!leagues.length) return [];

    const cur = leagues.find(l => l.title === leagueName) || leagues[0];
    const next = leagues[leagues.indexOf(cur) + 1] || null;

    const nameEl = headerSel && document.querySelector(headerSel);
    if (nameEl) {
        if (next) {
            nameEl.textContent = next.title;
            nameEl.removeAttribute('data-lang');
        } else {
            nameEl.setAttribute('data-lang', 'text_max_level');
            nameEl.textContent = t('text_max_level', 'Макс. рівень');
        }
    }

    const rows = cur.currencies.map(coin => {
        const netPower = coin.totalPower;
        let name = coin.name.toLowerCase().replace('_small', '').trim();

        let nextNetPower = 0, nextReward = 0, nextBlockTime = 0;
        const nc = next && next.currencies.find(c => c.name === coin.name);
        if (nc) {
            nextNetPower = nc.totalPower || 0;
            nextReward = nc.payoutAmount || 0;
            nextBlockTime = nc.duration || 0;
        }

        if (name === 'sat') name = 'btc';
        if (name === 'matic') name = 'pol';

        const reward = coin.payoutAmount;
        const blockTime = coin.duration;
        const {divisor, prec, geckoId} = coinConfig(name);

        const rewardPerBlock = (userPower / netPower) * reward;
        const diff = nextBlockTime ? (blockTime / nextBlockTime) : 0;
        const neededPower = (nextReward > 0 && diff > 0)
            ? ((rewardPerBlock * nextNetPower) / nextReward) / diff : 0;

        const dailyRaw = (rewardPerBlock * (86400 / blockTime)) / divisor;

        let usdPrice = 0;
        if (USD_DIRECT.has(name)) usdPrice = dailyRaw;
        else if (geckoId && state.prices[geckoId]) usdPrice = dailyRaw * state.prices[geckoId];

        return {name, reward: reward / divisor, netPower, neededPower, userPower, dailyRaw, usdPrice, prec};
    });

    return rows.sort((a, b) => b.usdPrice - a.usdPrice);
}

/* Колонка «для такого ж доходу в наступній лізі»: у першому рядку потрібна потужність,
   у другому — скільки бракує саме тобі (або що вже вистачає). */
function neededCellHtml(d) {
    if (!(d.neededPower > 0)) return '<span data-lang="text_unavailable">Недоступно</span>';
    const diff = d.neededPower - d.userPower;
    const status = diff > 0
        ? `<span class="nd lack">⚠ <span data-lang="text_lacks">бракує</span> +${formatPowerShort(diff)}</span>`
        : '<span class="nd ok">✅ <span data-lang="text_enough">вже вистачає</span></span>';
    return `<b>${formatPower(d.neededPower)}</b>${status}`;
}

function coinRowHtml(d, showNeeded = true) {
    const cur = NO_DOLLAR.has(d.name) ? '' : '$';
    const usd = v => `<br><span class="usd">${v.toFixed(2)}${cur}</span>`;
    return `<tr>
<td class="coin-cell"><img class="coin-icon" src="images/symbols/${d.name}.svg" width="24" height="24" alt=""><span>${d.name.toUpperCase()}</span></td>
<td>${d.reward}</td>
<td>${formatPower(d.netPower)}</td>
${showNeeded ? `<td class="need">${neededCellHtml(d)}</td>` : ''}
<td class="c-cyan">${d.dailyRaw.toFixed(d.prec)}${usd(d.usdPrice)}</td>
<td>${(d.dailyRaw * 7).toFixed(d.prec > 6 ? 6 : d.prec)}${usd(d.usdPrice * 7)}</td>
<td>${(d.dailyRaw * 30).toFixed(d.prec > 4 ? 4 : d.prec)}${usd(d.usdPrice * 30)}</td>
</tr>`;
}

function renderMarket(ids, powerGh, leagueName, powerBadgeKey, powerBadgeText) {
    const info = $(ids.info), body = $(ids.body);
    info.innerHTML = `<span data-lang="text_current_league_badge">ПОТОЧНА ЛІГА:</span> ${esc(leagueName)}<br><span data-lang="${powerBadgeKey}">${powerBadgeText}</span> ${formatPower(powerGh)}`;
    body.innerHTML = buildCoinRows(powerGh, leagueName, ids.header).map(r => coinRowHtml(r, !!ids.header)).join('');
    applyLanguage(info);
    applyLanguage(body);
}

function syncMarket(powerGh, leagueName) {
    renderMarket({info: 'leagueInfo', body: 'tableBody', header: '#nextLeagueHeader .nl-name'},
        powerGh, leagueName, 'text_power_badge', 'ПОТУЖНІСТЬ:');
}

/* ================= вкладка «Топ ліги» =================
   Потужність на 1 Gh/s нижче порога переходу в наступну лігу. Для Legend наступної ліги немає. */
const TOP_LEAGUES = LEAGUES;          // для останньої ліги (Legend) межі немає — потужність вводиться вручну
const isLegendIdx = i => i === LEAGUES.length - 1;
let topTouched = false;

function initTopLeagues() {
    const sel = $('topLeagueSelect');
    if (!sel.options.length) {
        sel.innerHTML = TOP_LEAGUES.map((l, i) => `<option value="${i}">${esc(l.name)}</option>`).join('');
    }
    renderTopLeague();
}

function renderTopLeague() {
    const idx = Number($('topLeagueSelect').value) || 0;
    const legend = isLegendIdx(idx);
    $('topCustomPower').hidden = !legend;
    const ids = {info: 'topLeagueInfo', body: 'topTableBody', header: null};   // без колонки наступної ліги
    if (legend) {
        const zh = parseFloat($('topLegendPower').value);
        const power = zh > 0 ? zh * 1e12 : LEAGUES[idx].limit;     // Zh/s → Gh/s
        renderMarket(ids, power, LEAGUES[idx].name, 'text_power_badge', 'ПОТУЖНІСТЬ:');
    } else {
        renderMarket(ids, LEAGUES[idx + 1].limit - 1, LEAGUES[idx].name, 'text_top_power', 'ПОТУЖНІСТЬ НА МЕЖІ:');
    }
}

/* ================= рядки старих/нових майнерів ================= */
const ROW_HTML = `<div class="input-grid">
<input type="number" class="p-in" placeholder="0">
<select class="u-in"><option value="1000000">Ph</option><option value="1000000000">Eh</option><option value="1000">Th</option></select>
<input type="number" class="b-in" placeholder="0%">
<input type="number" class="r-in" placeholder="0%">
<div class="indiv-res">0</div>
<button class="btn-del" type="button">×</button>
</div>`;

function addRow(containerId, autoCalculate = true) {
    const container = $(containerId);
    if (!container) return;
    container.insertAdjacentHTML('beforeend', ROW_HTML);
    if (autoCalculate) calculateAll();
}

function readRows(containerId) {
    return Array.from(document.querySelectorAll(`#${containerId} .input-grid`), row => ({
        row,
        p: num(row.querySelector('.p-in').value) * parseFloat(row.querySelector('.u-in').value),
        b: num(row.querySelector('.b-in').value),
        r: num(row.querySelector('.r-in').value),
        out: row.querySelector('.indiv-res')
    }));
}

/* ================= парсинг Profile Stats (ручний режим) ================= */
const GH_STRICT = {Eh: 1e9, Th: 1e3, Ph: 1e6, Zh: 1e12};
const RX_MINERS = /Miners[^\d]*([\d.,\s]+)\s*(Eh|Ph|Th|Zh)/i;
const RX_CURRENT = /Current power[^\d]*([\d.,\s]+)\s*(Eh|Ph|Th|Zh)/i;
const RX_MAX = /Maximum power[^\d]*([\d.,\s]+)\s*(Eh|Ph|Th|Zh)/i;
const RX_BONUS = /Bonus Power[^\d]*([\d.,\s]+)%?[^\d]*([\d.,\s]+)?\s*(Eh|Ph|Th|Zh)/i;

const toNumber = s => parseFloat(s.replace(/\s/g, '').replace(',', '.'));

function parseSimple(text, rx) {
    const m = text.match(rx);
    if (!m) return 0;
    return toNumber(m[1]) * (GH_STRICT[m[2]] || 1);
}

function parseBonus(text) {
    const m = text.match(RX_BONUS);
    if (!m) return 0;
    const raw = m[2] ? m[2] : m[1];
    let unit = m[2] ? m[3] : m[2];
    if (!unit) unit = m[m.length - 1];
    return toNumber(raw) * (GH_STRICT[unit] || 1);
}

/* ================= підписи «до наступної ліги» ================= */
function setDist(el, nxt, leftGh, keyNext, keyMax, fbNext, fbMax) {
    if (nxt) {
        const power = formatPower(leftGh);
        el.dataset.name = nxt.name;
        el.dataset.power = power;
        el.dataset.lang = keyNext;
        el.textContent = fbNext(nxt.name, power);
    } else {
        delete el.dataset.name;
        delete el.dataset.power;
        el.dataset.lang = keyMax;
        el.textContent = fbMax;
    }
}

const withBonusHtml = (main, full) =>
    `${main}<br><small class="sub-note"><span data-lang="calc_with_bonus">З бонусом фреону та хом'яка:</span> ${full}</small>`;

/* Поле відсотка показує округлене значення, але в розрахунку використовується точне,
   поки користувач не змінив його вручну. */
function setPctInput(id, raw) {
    const el = $(id);
    el.value = raw.toFixed(2);
    el.dataset.raw = String(raw);
    el.dataset.shown = el.value;
}
function readPctInput(id) {
    const el = $(id);
    if (el.dataset.raw !== undefined && el.value === el.dataset.shown) return Number(el.dataset.raw);
    return num(el.value);
}

/* ================= головний розрахунок ================= */
function calculateAll() {
    const rawEl = $('raw_data');
    if (!rawEl) return;

    const freon = readPctInput('freon_pct');
    let miners, hamsterPercent, hamsterPower, freonPower, bonusPercent, currentGame, hammyHooksPower, maxPower;

    if (!state.api) {
        const text = rawEl.value;
        miners = parseSimple(text, RX_MINERS);
        hamsterPercent = readPctInput('hamster_pct');
        hamsterPower = miners * (hamsterPercent / 100);
        freonPower = miners * (freon / 100);
        const bonus = parseBonus(text);
        bonusPercent = miners > 0 ? ((bonus - hamsterPower - freonPower) / miners) * 100 : 0;
        currentGame = parseSimple(text, RX_CURRENT) || 0;
        hammyHooksPower = (miners * 5) * parseFloat($('hammy_hooks').value) || 0;
        maxPower = parseSimple(text, RX_MAX) || currentGame;
    } else {
        const a = state.api;
        miners = a.miners;
        hamsterPercent = a.hamsterBonusPercent;
        hamsterPower = a.hamsterBonusValue;
        freonPower = a.freonPower;
        bonusPercent = a.bonusPowerPercent;
        currentGame = a.currentPower;
        hammyHooksPower = state.hooks.hamstersPower;
        maxPower = a.maximumPower;
    }
    const currentGameForCalc = currentGame - hamsterPower - freonPower - hammyHooksPower;

    $('total_display').textContent = formatPower(currentGame);

    const info = getLeagueInfo(maxPower);
    $('cur_league').textContent = info.cur.name;

    const distEl = $('dist_next');
    const left = info.nxt ? info.nxt.limit - maxPower : undefined;
    setDist(distEl, info.nxt, left, 'calc_dist_next', 'calc_max_league',
        (n, p) => `До ${n} ≈ ${p} (рахується від maxPower)`, 'Ти в максимальній лізі!');

    /* --- старі / нові майнери --- */
    const oldRows = readRows('old_list');
    const newRows = readRows('new_list');

    const bonusLost = oldRows.reduce((s, r) => s + r.b, 0);
    const bonusGained = newRows.reduce((s, r) => s + r.b, 0);
    const newMinersBase = newRows.reduce((s, r) => s + r.p, 0);
    const finalGlobalBonus = bonusPercent - bonusLost + bonusGained;
    const otherMinersBase = miners - oldRows.reduce((s, r) => s + r.p, 0);

    let totalLoss = 0;
    for (const r of oldRows) {
        const loss = r.p * (1 + (bonusPercent + r.r) / 100);
        totalLoss += loss;
        r.out.textContent = '-' + formatPower(loss + otherMinersBase * (r.b / 100));
        r.out.className = 'indiv-res loss';
    }

    let totalGain = 0;
    for (const r of newRows) {
        const gain = r.p * (1 + (finalGlobalBonus + r.r) / 100);
        totalGain += gain;
        const baseToBoost = otherMinersBase + newMinersBase - r.p;
        r.out.textContent = '+' + formatPower(gain + baseToBoost * (r.b / 100));
        r.out.className = 'indiv-res gain';
    }

    const finalMinersBase = otherMinersBase + newMinersBase;
    const freonDiff = finalMinersBase * (freon / 100) - freonPower;
    const hamsterDiff = finalMinersBase * (hamsterPercent / 100) - hamsterPower;
    const bonusShift = otherMinersBase * ((bonusGained - bonusLost) / 100);

    const finalTotalRaw = currentGameForCalc - totalLoss + totalGain + bonusShift;
    const finalTotal = finalTotalRaw + freonDiff + hamsterDiff;
    const finalTotalFull = currentGame - totalLoss + totalGain + bonusShift + freonDiff + hamsterDiff;
    const netGain = finalTotalRaw - currentGameForCalc;

    const resTotal = $('res_total');
    resTotal.innerHTML = withBonusHtml((netGain >= 0 ? '+' : '') + formatPower(netGain),
        formatPower(netGain + freonDiff + hamsterDiff));
    const fTotal = $('f_total');
    fTotal.innerHTML = withBonusHtml(formatPower(finalTotal), formatPower(finalTotalFull));

    /* --- ліга після змін --- */
    const finalMaxPower = maxPower + netGain;
    const finalNxt = getLeagueInfo(finalMaxPower).nxt;
    const finalLeft = maxPower < finalMaxPower && finalNxt ? finalNxt.limit - finalMaxPower : left;
    const finalDist = $('final_dist_next');
    setDist(finalDist, finalNxt, finalLeft, 'calc_final_dist_next', 'calc_final_max_league',
        (n, p) => `Після змін до ${n} ≈ ${p} Тестовий режим! (рахується від maxPower)`,
        'Після змін: Ти в максимальній лізі!');

    syncMarket(finalTotalFull, getLeagueInfo(finalMaxPower).cur.name);

    [distEl, resTotal, fTotal, finalDist].forEach(el => applyLanguage(el));
}

/* ================= завантаження даних користувача ================= */
function getHammyHooksDetails(tempPower, minersPower) {
    const totalTemp = tempPower || 0;
    const perHamster = (minersPower || 0) * 5;
    let count = 0, power = 0, clean = totalTemp;
    if (perHamster > 0) {
        count = Math.floor(totalTemp / perHamster);
        power = count * perHamster;
        clean = totalTemp - power;
    }
    return {hamstersCount: count, hamstersPower: power, cleanTemp: clean};
}

async function getUserApiForCalculateNew() {
    const nickInput = $('nicknameInput');
    const loader = $('loader');
    if (!nickInput || !nickInput.value) return;
    loader.hidden = false;

    const userNick = nickInput.value;
    store.set('userNickname', userNick);

    try {
        const pData = await fetchJson(`${ENDPOINTS.user}/public-user-profile-data/${encodeURIComponent(userNick)}`);
        if (!pData.success) throw new Error(t('user_not_found', 'Користувача не знайдено'));

        const avatarId = pData.data.avatar_id;
        // кімнати вантажимо паралельно з даними потужності
        const roomPromise = fetchJson(`${ENDPOINTS.proxy}https%3A%2F%2Frollercoin.com%2Fapi%2Fgame%2Froom-config%2F${avatarId}`);
        roomPromise.catch(() => {});

        const userData = await fetchJson(`${ENDPOINTS.user}/user-power-data/${avatarId}`);
        const d = userData.data;

        const curPowerRaw = d.current_power;
        const maxPowerRaw = d.max_power;
        const minersRaw = d.miners;
        const bonusRaw = d.bonus;
        const freonPower = d.freon;
        const hamsterPowerRaw = d.hamster_expedition_bonus_power;
        const hamsterPercent = d.hamster_expedition_bonus_percent / 100;          // сире значення
        const freonPercent = (freonPower / minersRaw) * 100;                        // сире значення

        Object.assign(state, {minersRaw, bonusRaw, hamsterPowerRaw});
        state.hooks = getHammyHooksDetails(d.temp, minersRaw);
        state.bonusPercentClear = ((bonusRaw - hamsterPowerRaw - freonPower) / minersRaw) * 100;

        const leagueName = pData.data.league.title.en || 'Bronze I';

        setPctInput('freon_pct', freonPercent);
        setPctInput('hamster_pct', hamsterPercent);
        $('hammy_hooks').value = state.hooks.hamstersCount;

        state.api = {
            league: leagueName,
            maximumPower: maxPowerRaw,
            currentPower: curPowerRaw,
            miners: minersRaw,
            bonusPowerPercent: state.bonusPercentClear,
            bonusPowerValue: bonusRaw - hamsterPowerRaw,
            hamsterBonusPercent: hamsterPercent,
            hamsterBonusValue: hamsterPowerRaw,
            rackBonus: d.racks,
            games: d.games,
            temporary: d.temp,
            freonPower
        };

        // Назви параметрів (League, Maximum power ...) не перекладати — на них спираються regex у calculateAll
        $('raw_data').value = [
            'League', leagueName,
            'Maximum power', formatPower(maxPowerRaw),
            'Current power', formatPower(curPowerRaw),
            'Miners', formatPower(minersRaw),
            'Bonus Power', `+${state.bonusPercentClear.toFixed(2)}%`,
            `/ ${formatPower(bonusRaw - hamsterPowerRaw)}`,
            'Hamster Bonus Power', `${hamsterPercent.toFixed(2)}%`,
            `/ ${formatPower(hamsterPowerRaw)}`,
            'Rack Bonus', formatPower(d.racks),
            'Games', formatPower(d.games),
            'Temporary', formatPower(d.temp)
        ].join('\n');

        calculateAll();
        runAudit(roomPromise);
        savePlayerToDatabase(userNick, avatarId);   // у фоні, не блокує інтерфейс
    } catch (e) {
        console.error('Error: dynamic fetch failed', e.message);
        alert(t('err_fetch_user', 'Не вдалося отримати дані користувача') + ': ' + e.message);
    } finally {
        loader.hidden = true;
    }
}

/* ================= UI-хелпери вкладки калькулятора ================= */
function toggleMode() {
    const isAuto = $('auto_toggle').checked;
    $('manual_section').hidden = isAuto;
    $('auto_section').hidden = !isAuto;
    $('extra').hidden = !isAuto;
}

function handleRefresh(btn) {
    btn.disabled = true;
    btn.classList.add('cooling');
    let secondsLeft = 30;

    btn.removeAttribute('data-lang');   // локалізатор ігнорує кнопку під час відліку
    btn.textContent = secondsLeft;

    const timer = setInterval(() => {
        secondsLeft--;
        btn.textContent = secondsLeft;
        if (secondsLeft <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.classList.remove('cooling');
            btn.dataset.lang = 'btn_refresh_ready';
            btn.textContent = t('btn_refresh_ready', 'Оновити');
        }
    }, 1000);
}

function checkInput() {
    $('calcBtn').disabled = $('nicknameInput').value.trim() === '';
}
