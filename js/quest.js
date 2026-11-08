'use strict';

const QUEST_DIV = 1e6;
const questFmt = amount => {
    const v = amount / QUEST_DIV;
    return v.toLocaleString('en-US', {maximumFractionDigits: v >= 1 ? 2 : 6});
};

async function fetchQuest() {
    try {
        const response = await fetch(ENDPOINTS.quest);
        if (!response.ok) throw new Error('Proxy error');
        return await response.json();
    } catch (error) {
        console.error('Помилка завантаження даних:', error);
        $('bonus-quest-container').innerHTML =
            '<div class="audit-container dbq-err">Помилка завантаження бонусного квесту</div>';
        return null;
    }
}

function questAction(label, langKey, icon, price, currency) {
    return `<div class="dbq-col"><span class="dbq-lbl-s" data-lang="${langKey}">${label}</span>
<div class="dbq-badge dbq-static"><span class="dbq-ico">${icon}</span><span>${questFmt(price)} ${esc(currency)}</span></div></div>`;
}

function renderQuestCard(q) {
    if (!q) return '';

    let extra = null;
    try {
        extra = q.additionalData
            ? (typeof q.additionalData === 'string' ? JSON.parse(q.additionalData) : q.additionalData)
            : null;
    } catch (e) { console.warn('Failed to parse additionalData', e); }

    const gameName = extra?.game_name || '';
    const rawTitle = (q.title || '').trim().toLowerCase();
    const rawDesc = (q.description || '').trim().toLowerCase();
    const isExchange = (q.replaceConfigCurrency === 'RLT' || q.paidConfigCurrency === 'RLT')
        && (rawTitle.startsWith('exchange') || rawDesc.startsWith('exchange'));

    let repeats = q.countRepeats ?? 0;
    if (isExchange && repeats > 0) repeats /= QUEST_DIV;
    const fmtRepeats = Number.isInteger(repeats) ? repeats.toLocaleString('en-US') : String(repeats);
    const fill = s => s.replace(/\{count_repeats\}/g, fmtRepeats).replace(/\{game_name\}/g, gameName);

    const title = fill(q.title || '');
    const desc = fill(q.description || '');

    const rewards = (q.dailyBonusQuestRewards || [])
        .map(i => i?.dailyBonusReward).filter(Boolean)
        .map(r => r.type === 'season_xp'
            ? `<div class="dbq-badge"><span class="dbq-lbl">XP</span><span>${esc(r.amount)}</span></div>`
            : r.type === 'money' && r.currency
                ? `<div class="dbq-badge"><span class="dbq-tok">Ⓡ</span><span>${questFmt(r.amount)}</span></div>`
                : '')
        .join('');

    const replaceHtml = q.replaceConfigIsAvailable
        ? questAction('ЗМІНА', 'dbq_header_replace', '🔄', q.replaceConfigPrice, q.replaceConfigCurrency) : '';
    const paidHtml = q.paidConfigIsAvailable
        ? questAction('ВИКУП', 'dbq_header_paid', '⏩', q.paidConfigPrice, q.paidConfigCurrency) : '';

    return `<div class="block dbq-container">
<div class="dbq-top"><div class="dbq-top-l">
<span class="dbq-tag" data-lang="dbq_bonus">BONUS</span>
<span class="dbq-title" title="${esc(desc)}">${esc(title)}</span>
</div></div>
<div class="dbq-row">
<div class="dbq-col"><span class="dbq-lbl-s" data-lang="dbq_header_rewards">НАГОРОДА</span><div class="dbq-rewards">${rewards}</div></div>
<div class="dbq-actions">${replaceHtml}${paidHtml}</div>
</div></div>`;
}

async function initQuest() {
    const box = $('bonus-quest-container');
    try {
        const data = await fetchQuest();
        box.innerHTML = data ? renderQuestCard(data) : '';
        applyLanguage(box);
    } catch (error) {
        console.error('Помилка завантаження квесту:', error);
        box.innerHTML = '';
    }
}
