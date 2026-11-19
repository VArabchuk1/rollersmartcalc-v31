'use strict';

/* Вкладка Progression: розрахунок ігор, часу та пойнтів Progression event */
(function () {
    const TIERS = [
        {from: 0, to: 19, cd: 30}, {from: 20, to: 29, cd: 60}, {from: 30, to: 49, cd: 150}, {from: 50, to: 79, cd: 250},
        {from: 80, to: 99, cd: 400}, {from: 100, to: 199, cd: 600}, {from: 200, to: 299, cd: 1000}, {from: 300, to: Infinity, cd: 2500}
    ];
    const PER_DAY = 2;   // заходів на добу (ранок + вечір); кулдаун скидається щодоби
    const LOCALES = {ua: 'uk-UA', en: 'en-US', es: 'es-ES'};
    const IDS = ['progR', 'progL', 'progP', 'progK', 'progS'];
    const SAVE_KEY = 'prog_inputs_v1';

    const tierOf = n => TIERS.find(x => n >= x.from && n <= x.to);

    /** Усі обчислення — із сирими числами, округлення лише у виводі */
    function calc(a) {
        const rounds = a.L <= 1 ? 1 : (a.L - 1) * 3;      // кіл за захід
        const perSession = a.R * rounds;                   // ігор за захід
        const perDay = perSession * Math.min(a.K, PER_DAY);
        const tier = tierOf(perDay);
        const interval = tier.cd + a.S * 60;               // від старту кола до старту наступного
        const lvl = Math.max(a.L - 1, 0);
        const pts1 = a.P * lvl * a.R;                      // 1-й захід: пойнти × (рівень−1) × ігор за коло
        const pts2 = a.P * lvl * perSession;               // 2-й і наступні: пойнти × (рівень−1) × ігор за захід
        return {
            perSession, perDay, total: perSession * a.K, tier, interval,
            sessionTime: rounds * interval, pts1, pts2, ptsTotal: pts1 + (a.K - 1) * pts2
        };
    }
    window.progressionCalc = calc;

    /* ---------- відображення ---------- */
    const lang = () => store.get('selectedLang') || 'en';
    const num = x => (Math.round(x * 100) / 100).toLocaleString(LOCALES[lang()] || 'en-US');
    const mmss = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    function hm(s) {
        s = Math.round(s);
        let h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60);
        if (m === 60) { h++; m = 0; }
        const H = t('prog_h', 'год'), M = t('prog_m', 'хв');
        return h ? `${h} ${H} ${m} ${M}` : `${m} ${M}`;
    }

    function readInputs() {
        return {
            R: Math.floor(+$('progR').value), L: Math.floor(+$('progL').value), P: +$('progP').value,
            K: Math.floor(+$('progK').value), S: +$('progS').value
        };
    }

    function render() {
        const a = readInputs();
        const out = $('progOut');
        if (!(a.R > 0 && a.L > 0 && a.K > 0 && a.P >= 0 && a.S >= 0)) { out.innerHTML = ''; return; }
        const r = calc(a);
        let h = '';
        const grp = text => { h += `<tr class="group"><td colspan="2">${esc(text)}</td></tr>`; };
        const row = (name, val, cls) => { h += `<tr${cls ? ` class="${cls}"` : ''}><td>${esc(name)}</td><td>${esc(val)}</td></tr>`; };

        grp(t('prog_g_games', 'Ігри'));
        row(t('prog_games_session', 'Ігор за один захід'), num(r.perSession));
        row(t('prog_games_day', 'Ігор за добу'), num(r.perDay));
        row(t('prog_games_all', 'Ігор за всі заходи ({n})').replace('{n}', a.K), num(r.total));
        grp(t('prog_g_time', 'Час'));
        row(t('prog_cooldown', 'Кулдаун (діапазон {from}–{to})')
            .replace('{from}', r.tier.from).replace('{to}', r.tier.to === Infinity ? '∞' : r.tier.to), mmss(r.tier.cd));
        row(t('prog_interval', 'Інтервал між стартами кіл'), mmss(r.interval));
        row(t('prog_session_time', 'Час на один захід'), hm(r.sessionTime));
        grp(t('prog_g_points', 'Пойнти'));
        row(t('prog_pts1', 'Пойнти за 1-й захід'), num(r.pts1));
        row(a.K > 2 ? t('prog_pts2_next', 'Пойнти за 2-й захід (і кожен наступний)') : t('prog_pts2', 'Пойнти за 2-й захід'), num(r.pts2));
        row(t('prog_pts_total', 'Пойнти разом'), num(r.ptsTotal), 'total');
        out.innerHTML = h;
    }

    function save() { store.set(SAVE_KEY, JSON.stringify(IDS.map(id => $(id).value))); }

    function init() {
        if (!$('progOut')) return;
        try {
            const saved = JSON.parse(store.get(SAVE_KEY) || 'null');
            if (Array.isArray(saved) && saved.length === IDS.length) IDS.forEach((id, i) => { $(id).value = saved[i]; });
        } catch (e) { /* ignore */ }
        IDS.forEach(id => $(id).addEventListener('input', () => { save(); render(); }));
        document.addEventListener('langchange', render);   // перемалювати підписи після зміни мови
        render();
    }
    init();
})();
