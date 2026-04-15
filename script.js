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

    // Цвета для окраса
    const BASE_COLORS = ["черный", "серый", "белый", "рыжий", "коричневый", "палевый"];
    const EYE_COLORS = ["зеленые", "серые", "голубые", "янтарные"];
    const ELEMENT_TYPES = ["полосы", "пятна", "глаза", "кожа", "носочки на лапах", "кончик хвоста", "грудь", "морда", "уши"];
    const BODY_TYPES = ["долговязый", "коренастый", "обычный"];

    // Состояние приложения
    let character = null; // если null — персонаж не создан

    // DOM элементы
    const creationScreen = document.getElementById('creation-screen');
    const gameScreen = document.getElementById('game-screen');
    const imagePlaceholder = document.getElementById('image-placeholder');

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
        locationStatsDiv.innerHTML = `
            🌡 Температура: ${loc.temp} &nbsp;&nbsp;|&nbsp;&nbsp;
            👥 Оживленность: ${loc.crowd} &nbsp;&nbsp;|&nbsp;&nbsp;
            🌱 Плодородность: ${loc.fertility}
            <br><small>Летом +10° / Зимой -15°</small>
        `;
    }

    // ---------- РЕДАКТОР ВНЕШНОСТИ ----------
    function buildAppearanceEditor() {
        let html = '<div class="appearance-section">';
        
        // База
        html += `<div class="appearance-row"><label>Основной цвет:</label><select id="app-base">`;
        BASE_COLORS.forEach(c => html += `<option value="${c}">${c}</option>`);
        html += `</select></div>`;

        // Элементы: каждый с выбором цвета или "отсутствует"
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

        // Телосложение
        html += `<div class="appearance-row"><label>Телосложение:</label><select id="app-body">`;
        BODY_TYPES.forEach(b => html += `<option value="${b}">${b}</option>`);
        html += `</select></div>`;
        
        html += '</div>';
        appearanceEditorDiv.innerHTML = html;

        // Обновляем превью при изменении любого селекта
        document.querySelectorAll('#appearance-editor select').forEach(sel => {
            sel.addEventListener('change', updateAppearancePreview);
        });
    }

    // Сбор данных внешности из формы
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

    // Установка значений формы из объекта внешности
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
                    // значение по умолчанию
                    if (elem === 'глаза') select.value = 'зеленые';
                    else select.value = 'отсутствует';
                }
            }
        });
    }

    // Генерация текстового описания
    function generateDescription(name, gender, app) {
        const genderWord = (gender === 'кот') ? 'кот' : 'кошка';
        let desc = `${name} — ${app.base} ${genderWord}`;
        
        // глаза особо
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

    // ---------- СЛУЧАЙНАЯ ВНЕШНОСТЬ ----------
    function randomAppearance() {
        const randomItem = arr => arr[Math.floor(Math.random() * arr.length)];
        const base = randomItem(BASE_COLORS);
        const body = randomItem(BODY_TYPES);
        const elements = {};
        ELEMENT_TYPES.forEach(elem => {
            if (elem === 'глаза') {
                elements[elem] = randomItem(EYE_COLORS);
            } else {
                // 50% шанс отсутствия элемента
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

    // ---------- СОХРАНЕНИЕ / ЗАГРУЗКА ----------
    const STORAGE_KEY = 'catGameSave';

    function saveGame() {
        if (!character) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    }

    function loadGame() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                character = JSON.parse(saved);
                return true;
            } catch(e) {
                console.warn("Ошибка загрузки");
                return false;
            }
        }
        return false;
    }

    // Собрать полные данные персонажа из формы
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
            createdAt: new Date().toISOString()
        };
    }

    // Переключение экранов
    function showCreationScreen() {
        creationScreen.style.display = 'block';
        gameScreen.style.display = 'none';
        // Заполняем форму если есть сохраненный персонаж?
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
        }
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
            // Очистить форму
            nameInput.value = '';
            setGenderRadio('кот');
            locationSelect.value = 'Предгорья';
            // случайная внешность для удобства
            applyRandomAppearance();
            updateLocationStats();
            showCreationScreen();
        }
    }

    // ---------- ЗАПУСК ----------
    function init() {
        populateLocationSelect();
        buildAppearanceEditor();
        
        // При изменении имени или пола обновляем превью
        nameInput.addEventListener('input', updateAppearancePreview);
        genderRadios.forEach(r => r.addEventListener('change', updateAppearancePreview));
        
        randomBtn.addEventListener('click', () => {
            applyRandomAppearance();
        });

        startBtn.addEventListener('click', startNewGame);
        resetBtn.addEventListener('click', resetCharacter);

        // Пробуем загрузить сохранение
        const hasSave = loadGame();
        if (hasSave && character) {
            // Если сохранение есть, показываем игру
            // но сначала синхронизируем форму (чтобы при сбросе было актуально)
            nameInput.value = character.name || '';
            setGenderRadio(character.gender);
            locationSelect.value = character.location || 'Предгорья';
            if (character.appearance) setAppearanceToForm(character.appearance);
            updateLocationStats();
            updateAppearancePreview();
            showGameScreen();
        } else {
            // Нет сохранения: показываем создание, предзаполним случайной внешностью
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
