let baseEfficiency = 0;
let testEfficiency = 0;
let newMinerGain = 0;
let oldMinersGain = 0;
let isMinersLoaded = false;

function suggestMinersToRemove(filterValue) {

    const target = document.getElementById('minerPower').value;
    const unit = document.getElementById('minerUnit').value;
    const bonus = parseFloat(document.getElementById('minerBonus').value) || 0;

    if (!target) {
        return;
    }

    const power = target + unit;


    let formatPowerNewMiner = formatPowerSN(power) || 0;

// 1. Рахуємо базу: поточна потужність * (1 + бонус/100)
    let currentPower = minersRaw;
    let currentBonus = bonusPercentClear;
    baseEfficiency = currentPower * (1 + currentBonus / 100);

    console.log(baseEfficiency)
    let minersToRemove = []; // Список тих, кого викидаємо
    let tempPower = currentPower;


    let tempBonus = currentBonus;

    let filteredMiners = filterMiners(efficiency);
    for (let m of filteredMiners) {
        // Віднімаємо дані слабкого
        let nextPower = tempPower - m.power;

        let nextBonus = tempBonus - m.realBonusDisplay;
        // Додаємо дані нового (target)
        testEfficiency = (nextPower + formatPowerNewMiner) * (1 + (nextBonus + bonus) / 100);

        // Якщо приріст або рівність зберігається — додаємо в список на видалення
        if (testEfficiency >= baseEfficiency) {
            minersToRemove.push(m);
            tempPower = nextPower;
            tempBonus = nextBonus;
            console.log(`Можна викинути ${m.name}, ефективність ${testEfficiency.toFixed(2)}`);
        } else {
            // Якщо ефективність впала — зупиняємось, бо це межа
            console.log("Межу досягнуто, далі видаляти невигідно.");
            break;
        }
    }

    // 🛠️ НОВІ ЗМІННІ ПРИРОСТУ (ДОДАНІ В КІНЕЦЬ ПЕРЕД РЕНДЕРОМ)
    // ==========================================================================


    // 2. Який сумарний приріст (база + бонус) ТИМЧАСОВО ДАВАЛИ ці старі майнери в системі
    // Формула: Початкова загальна ефективність мінус ефективність системи після їх видалення
    oldMinersGain = baseEfficiency - tempPower * (1 + tempBonus / 100);

    // 3. Який приріст (база + бонус) ДАСТЬ ОДИН НАШ НОВИЙ МАЙНЕР на порожньому місці

    newMinerGain = minersToRemove.length > 0 ? formatPowerNewMiner * (1 + (tempBonus + bonus) / 100) : 0;

    // 4. Фінальний чистий профіт від такої рокіровки (Різниця)
    const optimalNetDifference = newMinerGain - oldMinersGain;

    renderMinersTableForOptimal('minersTableBodyRecommendation',minersToRemove);
    document.getElementById('minPowerGainResult').textContent = formatPowerSN(optimalNetDifference);
}

// ==========================================
// 1. ЧАСТИНА: ФУНКЦІЯ РЕНДЕРУ ТАБЛИЦІ
// ==========================================
function renderMinersTable(targetId, minersArray, append = false) {
    // Шукаємо таргет за тим ID, який передали в аргумент
    const targetTbody = document.getElementById(targetId);
    if (!targetTbody) return;

    // Якщо не довантажуємо, очищаємо саме цю таблицю повністю
    if (!append) targetTbody.innerHTML = '';

    if (!minersArray || minersArray.length === 0) {
        if (!append) {
            const noResultsText = (typeof currentTranslations !== 'undefined' && currentTranslations.text_no_results)
                ? currentTranslations.text_no_results : "Нічого не знайдено";
            targetTbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#888; padding:20px;">${noResultsText}</td></tr>`;
        }
        return;
    }

    minersArray.forEach(miner => {
        const gifUrl = getMinerGifUrl(miner.name);
        const tr = document.createElement('tr');
        const yesText = (typeof currentTranslations !== 'undefined') ? currentTranslations.filter_sellable_yes : "Так";
        const noText = (typeof currentTranslations !== 'undefined') ? currentTranslations.filter_sellable_no : "Ні";

        tr.innerHTML = `
<td style="text-align: left; font-weight: bold; padding-left: 12px;">
    <div style="margin-bottom: 4px; display: block;">${miner.name}</div>
    
    <div style="width: 75px; height: 52px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #0f3460; border-radius: 4px; overflow: hidden;">
        <img src="${gifUrl}" alt="" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.parentElement.style.display='none'">
    </div>
</td>
            <td><span>${typeof formatPowerSN === 'function' ? formatPowerSN(parseFloat(miner.power)) : miner.power}</span></td>
            <td><span>${miner.realBonusDisplay || parseFloat(miner.bonus).toFixed(2)}</span>%</td>
            <td>${miner.cells || 1}</td>
            <td><span style="color: ${miner.sellable ? '#00ff88' : '#ff4757'};" data-lang="${miner.sellable ? 'filter_sellable_yes' : 'filter_sellable_no'}">${miner.sellable ? yesText : noText}</span></td>
        `;
        targetTbody.appendChild(tr);
    });
    isMinersLoaded = true;
}

// ==========================================
// 2. ЧАСТИНА: ФУНКЦІЯ ЗАПИТУ ДО ВОРКЕРА
// ==========================================
let currentPage = 1; // Глобальна змінна для сторінки

async function handleMinerSearch(page = 1) { // Прибрали append
    currentPage = page;
    const loader = document.getElementById('minersLoader');

    if (loader) loader.style.display = 'block';

    const query = document.getElementById('minerSearchInside')?.value.trim();
    const sellableFilter = document.getElementById('minerSellableFilter')?.value;

    const params = new URLSearchParams({ page: currentPage, per_page: '50' });
    if (query) params.append('q', query);
    if (sellableFilter === 'true' || sellableFilter === 'false') params.append('sellable', sellableFilter);

    try {
        const response = await fetch(`https://wispy-credit-1be8.arabon3.workers.dev/?${params.toString()}`);
        const miners = await response.json();

        if (loader) loader.style.display = 'none';

        // Завжди передаємо false, щоб таблиця оновлювалась, а не дописувалась в кінець
        renderMinersTable('minersTableBody', miners, false);

        // ВИКЛИКАЄМО НАШУ ПАГІНАЦІЮ замість старої кнопки
        renderPagination(currentPage, miners.length);

    } catch (error) {
        console.error("Помилка:", error);
        if (loader) loader.style.display = 'none';
    }
}

// Додаткова функція для кнопки в HTML
function renderPagination(current, incomingLength) {
    const container = document.getElementById('paginationContainer');
    if (!container) return;

    container.innerHTML = '';

    // Стилі для кнопок (можна винести в CSS, або залишити так)
    const btnStyle = "padding: 6px 12px; border: 1px solid #ccc; background: #fff; cursor: pointer; border-radius: 4px; transition: 0.2s;";
    const activeStyle = "padding: 6px 12px; background: #007bff; color: #fff; border: 1px solid #007bff; font-weight: bold; border-radius: 4px;";

    if (current > 1) {
        container.innerHTML += `<button onclick="handleMinerSearch(${current - 1})" style="${btnStyle}">❮</button>`;
    }

    // Поточна сторінка (активна)
    container.innerHTML += `<span style="${activeStyle}">${current}</span>`;

    if (incomingLength >= 50) {
        container.innerHTML += `<button onclick="handleMinerSearch(${current + 1})" style="${btnStyle}">❯</button>`;
    }
}

// ==========================================
let searchTimeout;

function initMinerSearchEvents() {
    const searchInput = document.getElementById('minerSearchInside');
    const filterSelect = document.getElementById('minerSellableFilter');

    if (searchInput) {
        searchInput.removeEventListener('input', onSearchInput);
        searchInput.addEventListener('input', onSearchInput);
    }

    if (filterSelect) {
        filterSelect.removeEventListener('change', onFilterChange);
        filterSelect.addEventListener('change', onFilterChange);
    }
}

// Функція обробки живого пошуку (чекає 500 мс після введення)
function onSearchInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        handleMinerSearch().catch(err => console.error("Помилка пошуку:", err));
    }, 500);
}

// Додали функцію для селекту, якої не вистачало
function onFilterChange() {
    handleMinerSearch().catch(err => console.error("Помилка фільтра:", err));
}

// Просто вішаємо слухачі на елементи, але сам пошук тут НЕ викликаємо!
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMinerSearchEvents);
} else {
    initMinerSearchEvents();
}
setTimeout(initMinerSearchEvents, 1000);


function filterMiners(miners) {
    // 1. Беремо значення з усіх трьох селекторів
    const sellFilter = document.getElementById('minerSellableFilterRec').value;
    const widthFilter = document.getElementById('minerWidthFilterRec').value;

    const setSelect = document.getElementById('minerSetFilterRec');
    const setFilter = setSelect ? setSelect.value : 'all';

    // 2. Фільтруємо масив
    return miners.filter(m => {
        // Умова для першого фільтра (Маркет: Продажні / Не продажні / Всі)
        const matchesSell = (sellFilter === 'all') || (m.sellable === (sellFilter === 'true'));

        // Умова для другого фільтра (Сети: якщо 'true' — ховаємо ті, що в сеті)
        const matchesSet = (setFilter === 'all') || (m.isInSet === false);

        // Умова для третього фільтра (Слоти: якщо не 'all', порівнюємо ширину майнера m.width)
        const matchesWidth = (widthFilter === 'all') || (m.width === Number(widthFilter));

        // Майнер залишається, якщо пройшов ВСІ три фільтри одночасно
        return matchesSell && matchesSet && matchesWidth;
    });
}

function renderMinersTableForOptimal (targetId, miners) {
    const body = document.getElementById(targetId);
    if (!body) return;

    body.innerHTML = "";

    const yesText = (typeof currentTranslations !== 'undefined') ? currentTranslations.filter_sellable_yes : "Так";
    const noText = (typeof currentTranslations !== 'undefined') ? currentTranslations.filter_sellable_no : "Ні";

    let finalPower = 0;
    let finalPercent = 0;

    for (const m of miners) {
        finalPower += m.power;
        if (!m.isDupe) {
            finalPercent += parseFloat(m.realBonusDisplay) || 0;
        }

        let tags = (m.isInSet ? `<span style="background:#f1c40f; color:#000; font-size:10px; padding:1px 4px; border-radius:3px; margin-left:5px; font-weight:bold;">SET</span>` : "") +
            (m.isDupe ? `<span style="background:#ff4757; color:#fff; font-size:10px; padding:1px 4px; border-radius:3px; margin-left:5px; font-weight:bold;">DUPE</span>` : "");

        const gifUrl = getMinerGifUrl(m.name);
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td style="font-weight:bold; display: flex; padding: 6px 2px; font-size: 10px;
             align-items: center; gap: 12px; border-bottom: 1px solid #30475e;">
                <div style="width: 50px; height: 35px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #0f3460; border-radius: 4px; overflow: hidden;">
                    <img src="${gifUrl}" alt="" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.parentElement.style.display='none'">
                </div>
                <div style="line-height: 1.2;">
                    <span style="color: #fff;">${m.name}</span> <br>
                    <small style="color: #888; font-size: 11px;">${m.levelLabel}</small> ${tags}
                    ${m.locationHtml}
                </div>
            </td>
            <td style="color:#ccc; padding: 6px 2px; font-size: 10px;">${formatPowerSNw(m.power)}</td>
            <td style="color:#ffa502; padding: 6px 2px; font-size: 10px;">${m.realBonusDisplay}%</td>
            <td style="color:#00ff88; font-size: 10px;">${m.width}</td>
            <td><span style="color: ${m.sellable ? '#00ff88' : '#ff4757'}; font-size: 10px; padding: 6px 2px;" 
        data-lang="${m.sellable ? 'filter_sellable_yes' : 'filter_sellable_no'}">${m.sellable ? yesText : noText}</span></td>
        `;

        body.appendChild(tr);
    }

    // Твої дефолтні стовпчики, без лівих маргінів та бекграундів
    const totalText = (typeof currentTranslations !== 'undefined' && currentTranslations.text_total) ? currentTranslations.text_total : "Усього:";
    const totalTr = document.createElement('tr');

    totalTr.innerHTML = `
        <td style="color:#ffa502; font-size: 10px;" data-lang="text_total">${totalText}</td>
        <td style="color:#00ff88; font-size: 10px;">${formatPowerSNw(finalPower)}</td>
        <td style="color:#00ff88; font-size: 10px;">${finalPercent.toFixed(2)}%</td>
        <td style="color:#00ff88; font-size: 10px;">
        <span data-lang="text_loss">Втрата</span><br>-${formatPowerSN(oldMinersGain)}
        </td>
        <td style="color:#00ff88; font-size: 10px;">
        <span data-lang="text_gain">Приріст</span><br>+${formatPowerSN(newMinerGain)}
        </td>`;

    body.appendChild(totalTr);

    if (typeof currentTranslations !== 'undefined' && typeof applyLanguage === 'function') {
        applyLanguage(currentTranslations);
    }
}
