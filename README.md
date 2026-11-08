# RollerSmart v31 (оптимізована версія)

Структура:
- `index.html` — розмітка (без inline-обробників і великих style-блоків)
- `css/style.css` — усі стилі
- `js/core.js` — конфіг, стан, форматери, переклади, API
- `js/calculator.js` — калькулятор, таблиця монет, завантаження профілю
- `js/miners.js` — підбір майнерів на заміну + пошук
- `js/auditor.js` — аудитор кімнат
- `js/leagues.js`, `js/quest.js`, `js/app.js` — ліги, бонус-квест, ініціалізація
- `lang/*.json` — переклади (мініфіковані)

Старі `index_backup.html`, `indexWithOutFisherBackUp.html`, `.idea/`, `base.js`, `minersSuggest.js`, `leagues_data.json` не потрібні (історія є в git).
