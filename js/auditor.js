'use strict';

async function fetchSellableMap(names) {
    if (!names.length) return {};
    try {
        const response = await fetch(ENDPOINTS.miners, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({names})
        });
        if (!response.ok) throw new Error(`Помилка проксі-воркера: ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) {
            console.error('Проксі повернув помилку замість масиву:', data);
            return {};
        }
        return Object.fromEntries(data.map(i => [i.name, i.sellable]));
    } catch (error) {
        console.error('Помилка масової перевірки sellable через проксі:', error);
        return {};
    }
}

function locationHtml(rack, shelfIdx) {
    const roomLevel = rack?.placement?.room_level ?? 0;
    const x = rack?.placement?.x ?? 0;
    const y = rack?.placement?.y ?? 0;
    const racksInRow = roomLevel === 0 ? 4 : 6;
    const rackNumber = y * racksInRow + (x + 1);
    return `<div class="miner-loc">📍 <span data-lang-room="true">Кімн.</span> ${roomLevel + 1} | <span data-lang-rack="true">Стел.</span> ${rackNumber} | <span data-lang-shelf="true">Пол.</span> ${shelfIdx + 1}</div>`;
}

/** Розбір кімнат: повертає {efficiency, groups} (groups — дублікати за назвою+рівнем) */
function analyzeRoom(roomData) {
    const {miners, racks} = roomData.data;
    const {minersRaw, bonusRaw, hamsterPowerRaw} = state;

    const globalBonusMult = ((bonusRaw - hamsterPowerRaw) / minersRaw) + 1;

    const rackById = new Map();
    for (const r of racks) if (!rackById.has(r._id)) rackById.set(r._id, r);

    const groups = new Map();
    const efficiency = [];

    for (const m of miners) {
        const lvlLabel = `[Lvl ${m.level + 1}]`;
        const key = `${m.name}_${lvlLabel}`;
        const loc = locationHtml(rackById.get(m.placement.user_rack_id), m.placement.y);

        let g = groups.get(key);
        const isDupe = !!g;
        if (!g) groups.set(key, g = {name: m.name, lvl: lvlLabel, count: 0, locs: []});
        g.count++;
        g.locs.push(loc);

        const bonusFrac = (m.bonus_percent || 0) / 10000;
        const grossLoss = m.power * globalBonusMult + (isDupe ? 0 : bonusFrac * minersRaw);

        efficiency.push({
            name: m.name,
            levelLabel: lvlLabel,
            power: m.power,
            bonusPct: bonusFrac * 100,                       // сире значення для розрахунків
            realBonusDisplay: (bonusFrac * 100).toFixed(2),   // лише для показу
            contribution: grossLoss / (m.width || 1),
            isDupe,
            width: m.width || 1,
            isInSet: m.is_in_set,
            locationHtml: loc,
            sellable: null
        });
    }
    return {efficiency, groups};
}

function renderDupes(groups) {
    const rows = [];
    for (const g of groups.values()) {
        if (g.count < 2) continue;
        rows.push(`<tr>
<td class="miner-cell dupe">${thumbHtml(g.name, 'thumb-45')}<div class="mn-info"><span class="dupe-name">${esc(g.name)}</span> <br><small style="color:#888">${esc(g.lvl)}</small>${g.locs.join('')} </div></td>
<td style="vertical-align:middle"><span class="dupe-qty"><span data-lang="text_quantity_val">${g.count}</span> <span data-lang="text_pcs">шт.</span></span></td>
</tr>`);
    }
    $('dupesTable').tBodies[0].innerHTML = rows.length
        ? rows.join('')
        : '<tr><td colspan="2" class="all-unique" data-lang="text_all_unique">Усі унікальні! 🎉</td></tr>';
}

function renderWorst(efficiency) {
    const rows = [];
    let nonSet = 0, small = 0, big = 0;

    for (const m of efficiency) {
        if (nonSet >= 3) break;
        if (!m.isInSet) {
            if (m.width === 1 && small >= 2) continue;
            if (m.width === 2 && big >= 1) continue;
            if (m.width === 1) small++;
            if (m.width === 2) big++;
            nonSet++;
        }
        rows.push(`<tr>
<td class="miner-cell bold">${thumbHtml(m.name, 'thumb-50')}<div class="mn-info"><span class="mn-name">${esc(m.name)}</span> <br><small class="mn-lvl">${esc(m.levelLabel)}</small> ${TAGS_HTML(m)}${m.locationHtml}</div></td>
<td class="c-gray">${formatPowerShort(m.power)}</td>
<td class="c-orange">${m.realBonusDisplay}%</td>
<td class="yes" style="font-weight:bold">${formatPowerShort(m.contribution)}/<span data-lang="text_per_slot">сл</span></td>
</tr>`);
    }
    $('worstTable').tBodies[0].innerHTML = rows.join('');
}

async function runAudit(roomPromise) {
    const loader = $('auditLoader');
    const results = $('auditResults');

    $('minersInfoContainer').hidden = true;
    $('minersInfoContainerAudit').hidden = true;
    $('minersLastUpdateBlock').hidden = false;

    const nickInput = $('nicknameInput');
    if (!nickInput || !nickInput.value.trim()) return;

    $('minersTableBodyRecommendation').innerHTML = '';
    state.efficiency = [];
    $('minPowerGainResult').textContent = '0';

    loader.hidden = false;
    results.hidden = true;

    try {
        const roomData = await roomPromise;
        const {efficiency, groups} = analyzeRoom(roomData);
        state.efficiency = efficiency;

        renderDupes(groups);
        efficiency.sort((a, b) => a.contribution - b.contribution);
        renderWorst(efficiency);
        results.hidden = false;

        // «sellable» підвантажується після показу таблиць; пошук відкриваємо, коли дані готові
        const names = efficiency.map(m => m.name);
        fetchSellableMap(names).then(map => {
            efficiency.forEach(m => { m.sellable = map[m.name] ?? false; });
        }).finally(() => {
            if (state.efficiency === efficiency) $('minerSearchInput').hidden = false;
        });
    } catch (e) {
        alert(t('err_prefix', 'Помилка: ') + e.message);
    } finally {
        loader.hidden = true;
    }
    applyLanguage($('tab-auditor'));
}

function searchInputMiner() {
    const input = $('minerSearchInput');
    const out = $('searchResult');
    if (!input || !out) return;

    const query = input.value.trim().toLowerCase();
    out.innerHTML = '';

    if (query) {
        const found = state.efficiency.filter(m => m.name.toLowerCase().includes(query));
        if (found.length) {
            const hits = found.map(m => {
                const badge = m.sellable
                    ? '<span class="sell-ok" data-lang="miner_can_sell">Can be sold</span>'
                    : '<span class="sell-no" data-lang="miner_cant_sell">Can\'t be sold</span>';
                return `<div><b>${esc(m.name)}</b> ${esc(m.levelLabel)} — ${badge}<br>${m.locationHtml}</div>`;
            });
            out.style.color = '#fff';
            out.innerHTML = `<div class="search-hits"><div class="found-title" data-lang="text_found">✅ Знайдено:</div>${hits.join('')}</div>`;
        } else {
            out.style.color = '#ff4757';
            out.innerHTML = `<div class="not-found-wrapper" data-query="${esc(query)}" data-lang="text_miner_not_found">❌ Майнера "${esc(query)}" немає в кімнатах</div>`;
        }
    }
    applyLanguage(out);
}
