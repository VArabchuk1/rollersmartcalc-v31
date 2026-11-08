'use strict';

/* ================= підбір майнерів на видалення ================= */
function filterMiners(miners) {
    const sellFilter = $('minerSellableFilterRec').value;
    const widthFilter = $('minerWidthFilterRec').value;
    const noSets = $('minerSetFilterRec').value !== 'all';

    return miners.filter(m =>
        (sellFilter === 'all' || m.sellable === (sellFilter === 'true')) &&
        (!noSets || m.isInSet === false) &&
        (widthFilter === 'all' || m.width === Number(widthFilter)));
}

function suggestMinersToRemove() {
    const target = $('minerPower').value;
    if (!target) return;

    const newPower = (parseFloat(target) || 0) * UNIT_GH[$('minerUnit').value];
    const newBonus = num($('minerBonus').value);

    const basePower = state.minersRaw;
    const baseBonus = state.bonusPercentClear;
    const baseEfficiency = basePower * (1 + baseBonus / 100);

    const tbodyId = 'minersTableBodyRecommendation';
    $(tbodyId).innerHTML = '';

    const toRemove = [];
    let tempPower = basePower;
    let tempBonus = baseBonus;

    for (const m of filterMiners(state.efficiency)) {
        const nextPower = tempPower - m.power;
        const nextBonus = tempBonus - (!m.isDupe ? m.bonusPct : 0);
        const testEfficiency = (nextPower + newPower) * (1 + (nextBonus + newBonus) / 100);
        if (testEfficiency < baseEfficiency) break;   // межа: далі видаляти невигідно
        toRemove.push(m);
        tempPower = nextPower;
        tempBonus = nextBonus;
    }

    const gainEl = $('minPowerGainResult');
    if (!toRemove.length) {
        gainEl.textContent = formatPower(0);
        return;
    }

    const withoutOld = tempPower * (1 + tempBonus / 100);
    const finalWithNew = (tempPower + newPower) * (1 + (tempBonus + newBonus) / 100);
    const oldLoss = baseEfficiency - withoutOld;
    const newGain = finalWithNew - withoutOld;
    gainEl.textContent = formatPower(newGain - oldLoss);

    const sortRadio = document.querySelector('input[name="minerSortDir"]:checked');
    const sortBy = sortRadio ? sortRadio.value : 'name';
    if (sortBy === 'name') toRemove.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'power') toRemove.sort((a, b) => a.power - b.power);

    renderOptimalTable(tbodyId, toRemove, oldLoss, newGain);
}

const sellText = sellable => sellable
    ? `<span class="yes" data-lang="filter_sellable_yes">${esc(t('filter_sellable_yes', 'Так'))}</span>`
    : `<span class="no" data-lang="filter_sellable_no">${esc(t('filter_sellable_no', 'Ні'))}</span>`;

function renderOptimalTable(tbodyId, miners, oldLoss, newGain) {
    const body = $(tbodyId);
    let totalPower = 0, totalPercent = 0;

    const rows = miners.map(m => {
        totalPower += m.power;
        if (!m.isDupe) totalPercent += m.bonusPct || 0;
        return `<tr>
<td class="miner-cell bold rec">${thumbHtml(m.name, 'thumb-50')}<div class="mn-info"><span class="mn-name">${esc(m.name)}</span> <br><small class="mn-lvl">${esc(m.levelLabel)}</small> ${TAGS_HTML(m)}${m.locationHtml}</div></td>
<td class="c-gray fs10 pad-sm">${formatPowerShort(m.power)}</td>
<td class="c-orange fs10 pad-sm">${m.realBonusDisplay}%</td>
<td class="yes fs10">${m.width}</td>
<td>${sellText(m.sellable)}</td>
</tr>`;
    });

    rows.push(`<tr>
<td class="tot-orange" data-lang="text_total">${esc(t('text_total', 'Усього:'))}</td>
<td class="tot-green">${formatPowerShort(totalPower)}</td>
<td class="tot-green">${totalPercent.toFixed(2)}%</td>
<td class="tot-green"><span data-lang="text_loss">Втрата</span><br>-${formatPower(oldLoss)}</td>
<td class="tot-green"><span data-lang="text_gain">Приріст</span><br>+${formatPower(newGain)}</td>
</tr>`);

    body.innerHTML = rows.join('');
    applyLanguage(body);
}

/* ================= пошук майнерів (серверний, з пагінацією) ================= */
const MINERS_PER_PAGE = 50;
let searchSeq = 0;

function renderMinersTable(miners) {
    const tbody = $('minersTableBody');
    if (!miners.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-row">${esc(t('text_no_results', 'Нічого не знайдено'))}</td></tr>`;
        return;
    }
    tbody.innerHTML = miners.map(m => `<tr>
<td class="name-cell"><div class="nm">${esc(m.name)}</div>${thumbHtml(m.name, 'thumb-75')}</td>
<td><span>${formatPower(parseFloat(m.power))}</span></td>
<td><span>${m.realBonusDisplay || parseFloat(m.bonus).toFixed(2)}</span>%</td>
<td>${m.cells || 1}</td>
<td>${sellText(m.sellable)}</td>
</tr>`).join('');
    state.minersLoaded = true;
}

function renderPagination(current, incomingLength) {
    let html = '';
    if (current > 1) html += `<button class="pg-btn" type="button" data-page="${current - 1}">❮</button>`;
    html += `<span class="pg-cur">${current}</span>`;
    if (incomingLength >= MINERS_PER_PAGE) html += `<button class="pg-btn" type="button" data-page="${current + 1}">❯</button>`;
    $('paginationContainer').innerHTML = html;
}

async function handleMinerSearch(page = 1) {
    const seq = ++searchSeq;
    const loader = $('minersLoader');
    loader.hidden = false;

    const query = $('minerSearchInside').value.trim();
    const sellable = $('minerSellableFilter').value;
    const params = new URLSearchParams({page, per_page: String(MINERS_PER_PAGE)});
    if (query) params.append('q', query);
    if (sellable === 'true' || sellable === 'false') params.append('sellable', sellable);

    try {
        const miners = await fetchJson(`${ENDPOINTS.miners}?${params}`);
        if (seq !== searchSeq) return;          // прийшла застаріла відповідь
        loader.hidden = true;
        if (!Array.isArray(miners)) throw new Error('Unexpected response');
        renderMinersTable(miners);
        renderPagination(page, miners.length);
        applyLanguage($('minersTableBody'));
    } catch (error) {
        console.error('Помилка:', error);
        if (seq === searchSeq) loader.hidden = true;
    }
}

let searchTimeout;
function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleMinerSearch(), 500);
}
