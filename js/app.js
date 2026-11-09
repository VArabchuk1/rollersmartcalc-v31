'use strict';

function openTab(btn, tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.toggle('active', el.id === tabId));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    if (tabId === 'tab-miners' && !state.minersLoaded) handleMinerSearch();
    if (tabId === 'tab-top') {
        // якщо ліга ще не вибиралась вручну — одразу показуємо поточну лігу користувача
        const sel = $('topLeagueSelect');
        const own = state.api && TOP_LEAGUES.findIndex(l => l.name === state.api.league);
        if (!topTouched && own >= 0) sel.value = String(own);
        initTopLeagues();
    }
}

function on(id, event, handler) {
    const el = $(id);
    if (el) el.addEventListener(event, handler);
}

function copyAddress(btn) {
    const text = $('supportAddr').textContent.trim();
    const done = () => {
        const key = btn.dataset.lang;
        btn.textContent = t('support_copied', '✓ Скопійовано!');
        setTimeout(() => { btn.textContent = t(key, 'Скопіювати адресу'); }, 1500);
    };
    const fallback = () => {          // для сторінок без доступу до clipboard API (наприклад file://)
        const r = document.createRange(); r.selectNodeContents($('supportAddr'));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r);
        try { document.execCommand('copy'); done(); } catch (e) { /* адресу виділено, користувач скопіює вручну */ }
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
}

function bindEvents() {
    // мова
    on('langSelect', 'change', e => switchLanguage(e.target.value));

    // вкладки
    document.querySelector('.tabs-navigation').addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (btn) openTab(btn, btn.dataset.tab);
    });

    // калькулятор
    on('auto_toggle', 'change', toggleMode);
    ['raw_data', 'hamster_pct', 'hammy_hooks', 'freon_pct'].forEach(id => on(id, 'input', calculateAll));
    on('btnClearProfile', 'click', () => { const a = $('raw_data'); a.value = ''; a.focus(); });
    on('nicknameInput', 'input', checkInput);
    on('calcBtn', 'click', e => { getUserApiForCalculateNew(); handleRefresh(e.currentTarget); });
    document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => addRow(b.dataset.add)));

    ['old_list', 'new_list'].forEach(id => {
        const c = $(id);
        c.addEventListener('input', calculateAll);
        c.addEventListener('change', e => { if (e.target.classList.contains('u-in')) calculateAll(); });
        c.addEventListener('click', e => {
            const del = e.target.closest('.btn-del');
            if (!del) return;
            del.parentElement.remove();
            calculateAll();
        });
    });

    // підбір майнерів
    ['minerPower', 'minerBonus'].forEach(id => on(id, 'input', suggestMinersToRemove));
    ['minerUnit', 'minerSellableFilterRec', 'minerSetFilterRec', 'minerWidthFilterRec']
        .forEach(id => on(id, 'change', suggestMinersToRemove));
    document.querySelectorAll('input[name="minerSortDir"]').forEach(r => r.addEventListener('change', suggestMinersToRemove));

    // пошук майнерів
    on('minerSearchInside', 'input', onSearchInput);
    on('minerSellableFilter', 'change', () => handleMinerSearch());
    on('paginationContainer', 'click', e => {
        const b = e.target.closest('[data-page]');
        if (b) handleMinerSearch(Number(b.dataset.page));
    });

    on('topLegendPower', 'input', () => { topTouched = true; renderTopLeague(); });
    on('topLeagueSelect', 'change', () => { topTouched = true; renderTopLeague(); });

    // підтримка проєкту
    on('btnCopyAddr', 'click', e => copyAddress(e.currentTarget));

    // аудитор
    on('minerSearchInput', 'input', searchInputMiner);
}

function init() {
    bindEvents();

    const savedLang = store.get('selectedLang') || 'en';
    $('langSelect').value = savedLang;
    switchLanguage(savedLang);

    const savedNick = store.get('userNickname');
    if (savedNick) {
        $('nicknameInput').value = savedNick;
        checkInput();
    }

    addRow('old_list', false);
    addRow('new_list', false);

    // запити незалежні — вантажимо паралельно
    loadCryptoPrices();
    loadLeagues();
    initQuest();
}

init();
