'use strict';

const COIN_COLORS = ['#f2a900', '#ff4757', '#00ff88', '#00d4ff', '#9c27b0', '#e84393', '#ff9f43', '#25af61'];
const GAME_TOKENS = ['RLT', 'RST'];
const COIN_RENAME = {SAT: 'BTC', MATIC: 'POL'};
let leagueCards = {game: [], crypto: []};   // для копіювання «для П'єро»

function initLeagueDashboard(leagues) {
    $('leagueSelect').innerHTML = leagues
        .map((l, i) => `<option value="${i}">${esc(l.title || `Ліга ${i + 1}`)}</option>`).join('');
    if (leagues.length) renderSelectedLeague(0);
}

function renderSelectedLeague(index) {
    const league = state.leagues[index];
    if (!league) return;

    $('leagueSummaryBlock').hidden = false;
    const currencies = league.currencies || [];
    const totalPower = currencies.reduce((s, c) => s + (c.totalPower || 0), 0);

    $('currentLeagueTitle').textContent = league.title || 'Ліга';
    $('totalPowerDisplay').textContent = formatPower(totalPower);

    let acc = 0;
    const html = {game: '', crypto: ''};
    const paths = [];
    leagueCards = {game: [], crypto: []};

    currencies.forEach((curr, idx) => {
        const nameRaw = curr.name ? curr.name.replace('_SMALL', '') : '';
        const name = COIN_RENAME[nameRaw] || nameRaw;
        const pctRaw = totalPower > 0 ? curr.totalPower / totalPower : 0;
        const pct = (pctRaw * 100).toFixed(0) + '%';
        const color = COIN_COLORS[idx % COIN_COLORS.length];

        const dur = curr.duration || 0;
        const time = [Math.floor(dur / 3600), Math.floor((dur % 3600) / 60), dur % 60]
            .map(v => String(v).padStart(2, '0')).join(':');

        // Мітки англійською навмисно — сумісність парсингу для П'єро
        const power = formatPower(curr.totalPower);
        const users = (curr.userCount || 0).toLocaleString();
        const perBlock = `${curr.payoutAmount / coinConfig(name).divisor || 0} ${name}`;
        // значення в картках відображаються капсом (CSS), а П'єро отримує текст саме в такому вигляді
        const asCopied = v => v.toUpperCase().replace(/ZH\/S/g, 'Zh/s');

        const group = GAME_TOKENS.includes(name) ? 'game' : 'crypto';
        leagueCards[group].push({name, pct, power: asCopied(power), users: asCopied(users), perBlock: asCopied(perBlock), time: asCopied(time)});
        html[group] += `<div class="result-container coin-card" style="--c:${color}44;--cc:${color}">
<div class="coin-head"><span class="coin-name" style="--c:${color}">${esc(name)}</span><span class="indiv-res" style="--c:${color}">${pct}</span></div>
<div class="grid-labels"><span>Power</span><span>${power}</span></div>
<div class="grid-labels"><span>Active Users</span><span>${users}</span></div>
<div class="grid-labels"><span>Per Block</span><span>${esc(perBlock)}</span></div>
<div class="grid-labels"><span>Block Time</span><span>${time}</span></div>
</div>`;

        if (pctRaw > 0) {
            const pt = p => `${Math.cos(2 * Math.PI * p)} ${Math.sin(2 * Math.PI * p)}`;
            const start = pt(acc);
            acc += pctRaw;
            paths.push(`<path d="M 0 0 L ${start} A 1 1 0 ${pctRaw > 0.5 ? 1 : 0} 1 ${pt(acc)} Z" fill="${color}"></path>`);
        }
    });

    $('gameCurrenciesContainer').innerHTML = html.game;
    $('cryptoCurrenciesContainer').innerHTML = html.crypto;
    $('pieChart').innerHTML = paths.join('');
}

function copyLeagueToClipboard(btn) {
    const card = c => `${c.name}\n${c.pct}\nPower\n${c.power}\nActive Users\n${c.users}\nPer Block\n${c.perBlock}\nBlock Time\n${c.time}\n`;
    const text = (leagueCards.game.map(card).join('') + 'Crypto Currencies\n' + leagueCards.crypto.map(card).join('')).trim();

    navigator.clipboard.writeText(text).then(() => {
        if (!btn) return;
        const origText = btn.textContent;
        const origKey = btn.dataset.lang;
        const isEn = store.get('selectedLang') === 'en';
        btn.textContent = isEn ? '✓ Copied!' : '✓ Скопійовано!';
        btn.dataset.lang = 'btn_copied_success';
        btn.style.pointerEvents = 'none';
        setTimeout(() => {
            if (origKey) btn.dataset.lang = origKey; else delete btn.dataset.lang;
            btn.textContent = origText;
            btn.style.pointerEvents = 'auto';
        }, 1000);
    }).catch(err => {
        console.error('Не вдалося скопіювати:', err);
        if (btn) {
            btn.dataset.lang = 'btn_copied_error';
            btn.textContent = '❌ Помилка';
        }
    });
}
