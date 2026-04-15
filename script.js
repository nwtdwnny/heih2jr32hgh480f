(function() {
    "use strict";

    // ---------- ДАННЫЕ ЛОКАЦИЙ ----------
    const LOCATIONS = {
        "Предгорья":             { temp: 0,   crowd: 5, fertility: 5 },
        "Вересковая пустошь":    { temp: 10,  crowd: 7, fertility: 4 },
        "Сосновый бор":          { temp: 14,  crowd: 7, fertility: 9 },
        "Лиственный лес":        { temp: 20,  crowd: 10, fertility: 8 },
        "Заледеневшие вершины":  { temp: -10, crowd: 1, fertility: 2 },
        "Город":                 { temp: 5,   crowd: 10, fertility: 3 }
    };

    // Сезоны и модификаторы температуры
    const SEASONS = ["spring", "summer", "autumn", "winter"];
    const SEASON_NAMES = { spring: "🌸 Весна", summer: "☀️ Лето", autumn: "🍂 Осень", winter: "❄️ Зима" };
    const SEASON_TEMP_MOD = { spring: 0, summer: 10, autumn: 0, winter: -15 };

    // Цвета для окраса
    const BASE_COLORS = ["черный", "серый", "белый", "рыжий", "коричневый", "палевый"];
    const EYE_COLORS = ["зеленые", "серые", "голубые", "янтарные"];
    const ELEMENT_TYPES = ["полосы", "пятна", "глаза", "кожа", "носочки на лапах", "кончик хвоста", "грудь", "морда", "уши"];
    const BODY_TYPES = ["долговязый", "коренастый", "обычный"];

    // Таймеры (в миллисекундах)
    const TICK_INTERVAL = 60000; // 1 минута (для проверки голода/жажды)
    const SEASON_CHANGE_INTERVAL = 10800000; // 3 часа
    
    // Состояние приложения
    let character = null;
    let gameTimer = null;
    let seasonTimer = null;
    let lastTickTime = Date.now();

    // DOM элементы
    const creationScreen = document.getElementById('creation-screen');
    const gameScreen = document.getElementById('game-screen');
    const nameInput = document.getElementById('cat-name');
    const genderRadios = document.getElementsByName('gender');
    const locationSelect = document.getElementById('location-select');
    const locationStatsDiv = document.getElementById('location-stats');
    const appearanceEditorDiv = document.getElementById('appearance-editor');
    const appearancePreviewDiv = document.getElementById('appearance-preview');
    const startBtn = document.getElementById('start-game');
    const randomBtn = document.getElementById('random-appearance');
    const resetBtn = document.getElementById('reset-character');
    const characterSummary = document.getElementById('character-summary');
    const seasonDisplay = document.getElementById('season-display');

    // Бары параметров
    const statElements = {
        health: { bar: document.getElementById('health-bar'), value: document.getElementById('health-value') },
        energy: { bar: document.getElementById('energy-bar'), value: document.getElementById('energy-value') },
        hunger: { bar: document.getElementById('hunger-bar'), value: document.getElementById('hunger-value') },
        thirst: { bar: document.getElementById('thirst-bar'), value: document.getElementById('thirst-value') },
        cleanliness: { bar: document.getElementById('cleanliness-bar'), value: document.getElementById('cleanliness-value') },
        mood: { bar: document.getElementById('mood-bar'), value: document.getElementById('mood-value') }
    };

    // ---------- ИНИЦИАЛИЗАЦИЯ ЛОКАЦИЙ ----------
    function populateLocationSelect() {
        locationSelect.innerHTML = '';
        Object.keys(LOCATIONS).forEach(locName => {
            const option = document.createElement('option');
            option.value = locName;
            option.textContent = locName;
            locationSelect.appendChild(option);
        });
        updateLocationStats();
        locationSelect.addEventListener('change', updateLocationStats);
    }

    function updateLocationStats() {
        const loc = LOCATIONS[locationSelect.value];
        if (!loc) return;
        const currentSeason = character?.season || 'spring';
        const tempMod = SEASON_TEMP_MOD[currentSeason];
        const effectiveTemp = loc.temp + tempMod;
        locationStatsDiv.innerHTML = `
            🌡 Температура: ${effectiveTemp}° (базовая: ${loc.temp}°)<br>
            👥 Оживленность: ${loc.crowd} &nbsp;&nbsp;|&nbsp;&nbsp;
            🌱 Плодородность: ${loc.fertility}
        `;
    }

    // ---------- РЕДАКТОР ВНЕШНОСТИ ----------
    function buildAppearanceEditor() {
        let html = '<div class="appearance-section">';
        
        html += `<div class="appearance-row"><label>Основной цвет:</label><select id="app-base">`;
        BASE_COLORS.forEach(c => html += `<option value="${c}">${c}</option>`);
        html += `</select></div>`;

        ELEMENT_TYPES.forEach(elem => {
            const elemId = `app-elem-${elem.replace(/\s+/g, '')}`;
            html += `<div class="appearance-row"><label>${elem}:</label><select id="${elemId}">`;
            if (elem !== 'глаза') {
                html += `<option value="отсутствует">отсутствует</option>`;
            }
            const colorList = (elem === 'глаза') ? EYE_COLORS : BASE_COLORS;
            colorList.forEach(c => html += `<option value="${c}">${c}</option>`);
            html += `</select></div>`;
        });

        html += `<div class="appearance-row"><label>Телосложение:</label><select id="app-body">`;
        BODY_TYPES.forEach(b => html += `<option value="${b}">${b}</option>`);
        html += `</select></div>`;
        
        html += '</div>';
        appearanceEditorDiv.innerHTML = html;

        document.querySelectorAll('#appearance-editor select').forEach(sel => {
            sel.addEventListener('change', updateAppearancePreview);
        });
    }

    function getAppearanceFromForm() {
        const base = document.getElementById('app-base')?.value || 'серый';
        const body = document.getElementById('app-body')?.value || 'обычный';
        const elements = {};
        ELEMENT_TYPES.forEach(elem => {
            const elemId = `app-elem-${elem.replace(/\s+/g, '')}`;
            const select = document.getElementById(elemId);
            if (select) elements[elem] = select.value;
        });
        return { base, body, elements };
    }

    function setAppearanceToForm(app) {
        if (!app) return;
        const baseSelect = document.getElementById('app-base');
        if (baseSelect) baseSelect.value = app.base || 'серый';
        
        const bodySelect = document.getElementById('app-body');
        if (bodySelect) bodySelect.value = app.body || 'обычный';

        ELEMENT_TYPES.forEach(elem => {
            const elemId = `app-elem-${elem.replace(/\s+/g, '')}`;
            const select = document.getElementById(elemId);
            if (select) {
                const val = app.elements?.[elem];
                if (val !== undefined && select.querySelector(`option[value="${val}"]`)) {
                    select.value = val;
                } else {
                    if (elem === 'глаза') select.value = 'зеленые';
                    else select.value = 'отсутствует';
                }
            }
        });
    }

    function generateDescription(name, gender, app) {
        const genderWord = (gender === 'кот') ? 'кот' : 'кошка';
        let desc = `${name} — ${app.base} ${genderWord}`;
        
        const eyeColor = app.elements?.['глаза'] || 'зеленые';
        desc += ` с ${eyeColor} глазами`;
        
        const parts = [];
        for (let elem of ELEMENT_TYPES) {
            if (elem === 'глаза') continue;
            const color = app.elements?.[elem];
            if (color && color !== 'отсутствует') {
                parts.push(`${color} ${elem}`);
            }
        }
        if (parts.length > 0) {
            desc += `, ${parts.join(', ')}`;
        }
        desc += `. Телосложение: ${app.body}.`;
        return desc;
    }

    function updateAppearancePreview() {
        const name = nameInput.value.trim() || "Безымянный";
        const gender = getSelectedGender();
        const app = getAppearanceFromForm();
        const desc = generateDescription(name, gender, app);
        appearancePreviewDiv.textContent = desc;
    }

    function getSelectedGender() {
        for (let radio of genderRadios) {
            if (radio.checked) return radio.value;
        }
        return 'кот';
    }

    function randomAppearance() {
        const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
        const base = randomItem(BASE_COLORS);
        const body = randomItem(BODY_TYPES);
        const elements = {};
        ELEMENT_TYPES.forEach(elem => {
            if (elem === 'глаза') {
                elements[elem] = randomItem(EYE_COLORS);
            } else {
                if (Math.random() < 0.5) {
                    elements[elem] = 'отсутствует';
                } else {
                    elements[elem] = randomItem(BASE_COLORS);
                }
            }
        });
        return { base, body, elements };
    }

    function applyRandomAppearance() {
        const rand = randomAppearance();
        setAppearanceToForm(rand);
        updateAppearancePreview();
    }

    // ---------- ПАРАМЕТРЫ ПЕРСОНАЖА ----------
    function initializeStats() {
        return {
            health: 100,
            energy: 100,
            hunger: 100,
            thirst: 100,
            cleanliness: 100,
            mood: 100
        };
    }

    function clampStats() {
        if (!character) return;
        const stats = character.stats;
        Object.keys(stats).forEach(key => {
            stats[key] = Math.max(0, Math.min(100, stats[key]));
        });
    }

    function updateStatBars() {
        if (!character) return;
        const stats = character.stats;
        Object.keys(statElements).forEach(stat => {
            const value = stats[stat];
            const elements = statElements[stat];
            if (elements) {
                elements.bar.style.width = value + '%';
                elements.value.textContent = `${Math.round(value)}/100`;
            }
        });
    }

    function getCurrentTemperature() {
        if (!character) return 0;
        const loc = LOCATIONS[character.location];
        if (!loc) return 0;
        const season = character.season || 'spring';
        return loc.temp + SEASON_TEMP_MOD[season];
    }

    // Обработка тиков (голод, жажда, здоровье)
    function processTick() {
        if (!character) return;
        
        const now = Date.now();
        const minutesPassed = (now - lastTickTime) / 60000;
        if (minutesPassed < 1) return;
        
        lastTickTime = now;
        
        const temp = getCurrentTemperature();
        const stats = character.stats;
        
        // Голод: -1% за 10 минут при 0°, но округлим до минут
        const hungerDecay = (minutesPassed / 10) * 1;
        stats.hunger = Math.max(0, stats.hunger - hungerDecay);
        
        // Жажда: зависит от температуры (чем выше, тем больше)
        const thirstBaseDecay = (minutesPassed / 10) * 1;
        const tempMultiplier = 1 + (temp / 30); // при 30° множитель 2
        stats.thirst = Math.max(0, stats.thirst - thirstBaseDecay * Math.max(1, tempMultiplier));
        
        // Здоровье: если голод/жажда слишком низкие
        if (stats.hunger < 10 || stats.thirst < 10 || stats.cleanliness < 10) {
            stats.health = Math.max(0, stats.health - 0.5 * minutesPassed);
        }
        
        clampStats();
        updateStatBars();
        saveGame();
    }

    // Смена сезона
    function changeSeason() {
        if (!character) return;
        
        const seasons = SEASONS;
        let currentIdx = seasons.indexOf(character.season);
        currentIdx = (currentIdx + 1) % seasons.length;
        character.season = seasons[currentIdx];
        
        updateSeasonDisplay();
        saveGame();
    }

    function updateSeasonDisplay() {
        if (!character) return;
        const season = character.season || 'spring';
        seasonDisplay.textContent = SEASON_NAMES[season];
        seasonDisplay.setAttribute('data-season', season);
    }

    // ---------- ТАЙМЕРЫ ----------
    function startTimers() {
        stopTimers();
        lastTickTime = Date.now();
        gameTimer = setInterval(() => processTick(), TICK_INTERVAL);
        seasonTimer = setInterval(() => changeSeason(), SEASON_CHANGE_INTERVAL);
    }

    function stopTimers() {
        if (gameTimer) {
            clearInterval(gameTimer);
            gameTimer = null;
        }
        if (seasonTimer) {
            clearInterval(seasonTimer);
            seasonTimer = null;
        }
    }

    // Обработка ухода/возврата на вкладку
    function handleVisibilityChange() {
        if (document.hidden) {
            // Пользователь ушел - останавливаем таймеры, но запоминаем время
            stopTimers();
            if (character) {
                character.lastActive = Date.now();
                saveGame();
            }
        } else {
            // Пользователь вернулся - пересчитываем прошедшее время
            if (character && character.lastActive) {
                const awayTime = Date.now() - character.lastActive;
                const minutesAway = awayTime / 60000;
                
                if (minutesAway >= 1) {
                    // Рассчитываем изменения
                    const temp = getCurrentTemperature();
                    const stats = character.stats;
                    
                    // Голод
                    const hungerDecay = (minutesAway / 10) * 1;
                    stats.hunger = Math.max(0, stats.hunger - hungerDecay);
                    
                    // Жажда
                    const thirstBaseDecay = (minutesAway / 10) * 1;
                    const tempMultiplier = 1 + (temp / 30);
                    stats.thirst = Math.max(0, stats.thirst - thirstBaseDecay * Math.max(1, tempMultiplier));
                    
                    // Здоровье
                    if (stats.hunger < 10 || stats.thirst < 10 || stats.cleanliness < 10) {
                        stats.health = Math.max(0, stats.health - 0.5 * minutesAway);
                    }
                    
                    // Проверяем смену сезонов
                    if (character.lastSeasonChange) {
                        const seasonsPassed = Math.floor((Date.now() - character.lastSeasonChange) / SEASON_CHANGE_INTERVAL);
                        if (seasonsPassed > 0) {
                            const seasons = SEASONS;
                            let currentIdx = seasons.indexOf(character.season);
                            currentIdx = (currentIdx + seasonsPassed) % seasons.length;
                            character.season = seasons[currentIdx];
                            character.lastSeasonChange = Date.now();
                        }
                    }
                    
                    clampStats();
                    updateStatBars();
                    updateSeasonDisplay();
                }
                
                delete character.lastActive;
                saveGame();
            }
            
            lastTickTime = Date.now();
            startTimers();
        }
    }

    // ---------- СОХРАНЕНИЕ / ЗАГРУЗКА ----------
    const STORAGE_KEY = 'catGameSave';

    function saveGame() {
        if (!character) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        character.lastSave = Date.now();
        if (!character.lastSeasonChange) {
            character.lastSeasonChange = Date.now();
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    }

    function loadGame() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                character = JSON.parse(saved);
                
                // Обработка времени отсутствия
                if (character.lastSave) {
                    const awayTime = Date.now() - character.lastSave;
                    const minutesAway = awayTime / 60000;
                    
                    if (minutesAway >= 1) {
                        const temp = character.location ? 
                            LOCATIONS[character.location]?.temp + SEASON_TEMP_MOD[character.season || 'spring'] : 0;
                        const stats = character.stats;
                        
                        const hungerDecay = (minutesAway / 10) * 1;
                        stats.hunger = Math.max(0, stats.hunger - hungerDecay);
                        
                        const thirstBaseDecay = (minutesAway / 10) * 1;
                        const tempMultiplier = 1 + (temp / 30);
                        stats.thirst = Math.max(0, stats.thirst - thirstBaseDecay * Math.max(1, tempMultiplier));
                        
                        if (stats.hunger < 10 || stats.thirst < 10 || stats.cleanliness < 10) {
                            stats.health = Math.max(0, stats.health - 0.5 * minutesAway);
                        }
                        
                        // Сезоны
                        if (character.lastSeasonChange) {
                            const seasonsPassed = Math.floor((Date.now() - character.lastSeasonChange) / SEASON_CHANGE_INTERVAL);
                            if (seasonsPassed > 0) {
                                const seasons = SEASONS;
                                let currentIdx = seasons.indexOf(character.season);
                                currentIdx = (currentIdx + seasonsPassed) % seasons.length;
                                character.season = seasons[currentIdx];
                                character.lastSeasonChange = Date.now();
                            }
                        }
                        
                        clampStats();
                    }
                }
                
                return true;
            } catch(e) {
                console.warn("Ошибка загрузки");
                return false;
            }
        }
        return false;
    }

    // ---------- ЭКРАНЫ ----------
    function showCreationScreen() {
        creationScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        stopTimers();
        
        if (character) {
            nameInput.value = character.name || '';
            setGenderRadio(character.gender);
            locationSelect.value = character.location || 'Предгорья';
            if (character.appearance) setAppearanceToForm(character.appearance);
            updateLocationStats();
            updateAppearancePreview();
        }
    }

    function setGenderRadio(gender) {
        genderRadios.forEach(r => r.checked = (r.value === gender));
    }

    function showGameScreen() {
        creationScreen.style.display = 'none';
        gameScreen.style.display = 'block';
        
        if (character) {
            characterSummary.innerHTML = `
                <strong>${character.name}</strong> (${character.gender})<br>
                📍 ${character.location}<br>
                ${character.description}
            `;
            updateStatBars();
            updateSeasonDisplay();
        }
        
        startTimers();
    }

    function buildCharacterFromForm() {
        const name = nameInput.value.trim();
        if (!name) {
            alert("Введите имя!");
            return null;
        }
        const gender = getSelectedGender();
        const location = locationSelect.value;
        const appearance = getAppearanceFromForm();
        const description = generateDescription(name, gender, appearance);
        
        return {
            name, gender, location, appearance, description,
            season: 'spring',
            stats: initializeStats(),
            createdAt: new Date().toISOString(),
            lastSeasonChange: Date.now()
        };
    }

    function startNewGame() {
        const newChar = buildCharacterFromForm();
        if (!newChar) return;
        character = newChar;
        saveGame();
        showGameScreen();
    }

    function resetCharacter() {
        if (confirm('Сбросить персонажа и начать заново?')) {
            character = null;
            localStorage.removeItem(STORAGE_KEY);
            stopTimers();
            
            nameInput.value = '';
            setGenderRadio('кот');
            locationSelect.value = 'Предгорья';
            applyRandomAppearance();
            updateLocationStats();
            showCreationScreen();
        }
    }

    // ---------- ЗАПУСК ----------
    function init() {
        populateLocationSelect();
        buildAppearanceEditor();
        
        nameInput.addEventListener('input', updateAppearancePreview);
        genderRadios.forEach(r => r.addEventListener('change', updateAppearancePreview));
        randomBtn.addEventListener('click', applyRandomAppearance);
        startBtn.addEventListener('click', startNewGame);
        resetBtn.addEventListener('click', resetCharacter);
        
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const hasSave = loadGame();
        if (hasSave && character) {
            nameInput.value = character.name || '';
            setGenderRadio(character.gender);
            locationSelect.value = character.location || 'Предгорья';
            if (character.appearance) setAppearanceToForm(character.appearance);
            updateLocationStats();
            updateAppearancePreview();
            showGameScreen();
        } else {
            applyRandomAppearance();
            nameInput.value = '';
            setGenderRadio('кот');
            locationSelect.value = 'Предгорья';
            updateLocationStats();
            showCreationScreen();
        }
    }

    init();
})();
