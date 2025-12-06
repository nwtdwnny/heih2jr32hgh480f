// Основные переменные
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const gridOverlay = document.getElementById('gridOverlay');
const locationMenu = document.getElementById('locationMenu');
const tooltip = document.getElementById('tooltip');
const locationModal = document.getElementById('locationModal');
const transitionModal = document.getElementById('transitionModal');
const locationsList = document.getElementById('locationsList');
const currentLocationName = document.getElementById('currentLocationName');
const currentLocationInfo = document.getElementById('currentLocationInfo');

// Элементы управления
const createLocationBtn = document.getElementById('createLocationBtn');
const backToMainBtn = document.getElementById('backToMainBtn');
const saveLocationBtn = document.getElementById('saveLocationBtn');
const cancelLocationBtn = document.getElementById('cancelLocationBtn');
const saveTransitionBtn = document.getElementById('saveTransitionBtn');
const cancelTransitionBtn = document.getElementById('cancelTransitionBtn');

// Элементы форм
const newLocationName = document.getElementById('newLocationName');
const newLocationDescription = document.getElementById('newLocationDescription');
const gridRows = document.getElementById('gridRows');
const gridCols = document.getElementById('gridCols');
const transitionName = document.getElementById('transitionName');
const targetLocationSelect = document.getElementById('targetLocation');
const transitionNote = document.getElementById('transitionNote');

// Меню переходов
const editNameBtn = document.getElementById('editNameBtn');
const editNoteBtn = document.getElementById('editNoteBtn');
const goToLocationBtn = document.getElementById('goToLocationBtn');
const deleteLocationBtn = document.getElementById('deleteLocationBtn');

// Константы
const MAIN_LOCATION_ID = 'main';
const CELL_SIZE = 60;

// Состояние приложения
let state = {
    currentLocationId: MAIN_LOCATION_ID,
    locations: {
        [MAIN_LOCATION_ID]: {
            id: MAIN_LOCATION_ID,
            name: 'Главная карта',
            description: 'Основная карта локаций',
            rows: 6,
            cols: 10,
            transitions: [],
            createdAt: new Date().toISOString()
        }
    },
    dragging: false,
    draggingTransition: null,
    dragOffset: { x: 0, y: 0 },
    panning: false,
    panStart: { x: 0, y: 0 },
    scale: 1,
    offset: { x: 0, y: 0 },
    selectedTransition: null,
    nextTransitionId: 1,
    nextLocationId: 1
};

// Инициализация
function init() {
    resizeCanvas();
    loadState();
    setupEventListeners();
    render();
    updateUI();
    updateLocationsList();
}

// Изменение размера холста
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    updateGridOverlay();
}

// Обновление сетки
function updateGridOverlay() {
    const location = state.locations[state.currentLocationId];
    if (!location) return;
    
    const gridWidth = location.cols * CELL_SIZE;
    const gridHeight = location.rows * CELL_SIZE;
    
    gridOverlay.style.backgroundImage = `
        linear-gradient(rgba(79, 111, 158, 0.3) 1px, transparent 1px),
        linear-gradient(90deg, rgba(79, 111, 158, 0.3) 1px, transparent 1px)
    `;
    gridOverlay.style.backgroundSize = `${CELL_SIZE}px ${CELL_SIZE}px`;
    gridOverlay.style.width = `${gridWidth}px`;
    gridOverlay.style.height = `${gridHeight}px`;
}

// Настройка обработчиков событий
function setupEventListeners() {
    window.addEventListener('resize', resizeCanvas);
    
    // События мыши на холсте
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // События для подсказок
    canvas.addEventListener('mousemove', handleTooltip);
    
    // Кнопки управления
    createLocationBtn.addEventListener('click', openLocationModal);
    backToMainBtn.addEventListener('click', () => switchLocation(MAIN_LOCATION_ID));
    
    // Модальные окна
    saveLocationBtn.addEventListener('click', saveLocation);
    cancelLocationBtn.addEventListener('click', closeLocationModal);
    saveTransitionBtn.addEventListener('click', saveTransition);
    cancelTransitionBtn.addEventListener('click', closeTransitionModal);
    
    // Меню переходов
    editNameBtn.addEventListener('click', () => openTransitionModal('name'));
    editNoteBtn.addEventListener('click', () => openTransitionModal('note'));
    goToLocationBtn.addEventListener('click', goToTargetLocation);
    deleteLocationBtn.addEventListener('click', deleteTransition);
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (e) => {
        if (!locationMenu.contains(e.target)) {
            hideLocationMenu();
        }
    });
    
    // Закрытие модальных окон при клике вне их
    locationModal.addEventListener('click', (e) => {
        if (e.target === locationModal) closeLocationModal();
    });
    
    transitionModal.addEventListener('click', (e) => {
        if (e.target === transitionModal) closeTransitionModal();
    });
    
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideLocationMenu();
            closeLocationModal();
            closeTransitionModal();
        }
    });
}

// Обработка нажатия кнопки мыши
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.offset.x) / state.scale;
    const y = (e.clientY - rect.top - state.offset.y) / state.scale;
    
    // Проверяем, попали ли в переход
    const transition = findTransitionAt(x, y);
    
    if (e.button === 0) { // ЛКМ
        if (transition) {
            // Начало перетаскивания перехода
            state.dragging = true;
            state.draggingTransition = transition;
            state.dragOffset = {
                x: x - transition.x,
                y: y - transition.y
            };
            state.selectedTransition = transition;
            canvas.style.cursor = 'grabbing';
        } else {
            // Начало панорамирования карты
            state.panning = true;
            state.panStart = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        }
    } else if (e.button === 2) { // ПКМ
        e.preventDefault();
        
        if (transition) {
            // Показ меню для перехода
            state.selectedTransition = transition;
            showLocationMenu(e.clientX, e.clientY);
        } else {
            // Создание нового перехода
            const location = state.locations[state.currentLocationId];
            if (!location) return;
            
            const gridX = Math.round(x / CELL_SIZE) * CELL_SIZE;
            const gridY = Math.round(y / CELL_SIZE) * CELL_SIZE;
            
            // Проверяем границы сетки
            if (gridX < 0 || gridX >= location.cols * CELL_SIZE ||
                gridY < 0 || gridY >= location.rows * CELL_SIZE) {
                return;
            }
            
            // Проверяем, не занята ли клетка
            const existing = location.transitions.find(t => 
                Math.abs(t.x - gridX) < CELL_SIZE/2 && 
                Math.abs(t.y - gridY) < CELL_SIZE/2
            );
            
            if (!existing) {
                const newTransition = {
                    id: state.nextTransitionId++,
                    x: gridX,
                    y: gridY,
                    name: `Переход ${state.nextTransitionId - 1}`,
                    targetLocationId: '',
                    note: '',
                    createdAt: new Date().toISOString()
                };
                
                location.transitions.push(newTransition);
                state.selectedTransition = newTransition;
                saveState();
                render();
                updateUI();
                
                // Показываем меню для настройки перехода
                showLocationMenu(e.clientX, e.clientY);
            }
        }
    }
}

// Обработка движения мыши
function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.offset.x) / state.scale;
    const y = (e.clientY - rect.top - state.offset.y) / state.scale;
    
    if (state.dragging && state.draggingTransition) {
        // Перетаскивание перехода
        const location = state.locations[state.currentLocationId];
        const gridX = Math.round(x / CELL_SIZE) * CELL_SIZE;
        const gridY = Math.round(y / CELL_SIZE) * CELL_SIZE;
        
        // Проверяем границы сетки
        if (gridX >= 0 && gridX < location.cols * CELL_SIZE &&
            gridY >= 0 && gridY < location.rows * CELL_SIZE) {
            
            // Проверяем, не занята ли новая позиция другим переходом
            const existing = location.transitions.find(t => 
                t.id !== state.draggingTransition.id &&
                Math.abs(t.x - gridX) < CELL_SIZE/2 && 
                Math.abs(t.y - gridY) < CELL_SIZE/2
            );
            
            if (!existing) {
                state.draggingTransition.x = gridX;
                state.draggingTransition.y = gridY;
                render();
            }
        }
    } else if (state.panning) {
        // Панорамирование карты
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;
        
        state.offset.x += dx;
        state.offset.y += dy;
        
        state.panStart = { x: e.clientX, y: e.clientY };
        
        saveState();
        render();
    } else {
        // Изменение курсора при наведении на переход
        const transition = findTransitionAt(x, y);
        canvas.style.cursor = transition ? 'move' : 'default';
    }
}

// Обработка отпускания кнопки мыши
function handleMouseUp(e) {
    if (e.button === 0) { // ЛКМ
        if (state.dragging && state.draggingTransition) {
            saveState();
        }
        
        state.dragging = false;
        state.draggingTransition = null;
        state.panning = false;
        canvas.style.cursor = 'default';
    }
}

// Обработка колесика мыши
function handleWheel(e) {
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomIntensity = 0.001;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity * 50);
    
    // Ограничиваем масштаб
    const newScale = Math.max(0.3, Math.min(3, state.scale * zoom));
    
    // Корректируем смещение для зума к курсору
    state.offset.x = mouseX - (mouseX - state.offset.x) * (newScale / state.scale);
    state.offset.y = mouseY - (mouseY - state.offset.y) * (newScale / state.scale);
    
    state.scale = newScale;
    
    saveState();
    render();
    updateUI();
}

// Подсказки при наведении
function handleTooltip(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.offset.x) / state.scale;
    const y = (e.clientY - rect.top - state.offset.y) / state.scale;
    
    // Проверяем, наведены ли на переход
    const transition = findTransitionAt(x, y);
    
    if (transition) {
        const targetLocation = state.locations[transition.targetLocationId];
        const targetLocationName = targetLocation ? targetLocation.name : 'Не указана';
        
        tooltip.innerHTML = `
            <h4>${transition.name}</h4>
            <p><strong>Целевая локация:</strong> ${targetLocationName}</p>
            <p><strong>Координаты:</strong> (${Math.round(transition.x/CELL_SIZE)}, ${Math.round(transition.y/CELL_SIZE)})</p>
            ${transition.note ? `<p><strong>Заметка:</strong> ${transition.note}</p>` : ''}
        `;
        
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
        tooltip.style.display = 'block';
    } else {
        tooltip.style.display = 'none';
    }
}

// Поиск перехода по координатам
function findTransitionAt(x, y) {
    const location = state.locations[state.currentLocationId];
    if (!location) return null;
    
    for (let i = location.transitions.length - 1; i >= 0; i--) {
        const transition = location.transitions[i];
        const size = 24;
        
        if (x >= transition.x - size/2 && x <= transition.x + size/2 &&
            y >= transition.y - size/2 && y <= transition.y + size/2) {
            return transition;
        }
    }
    return null;
}

// Показать меню
function showLocationMenu(x, y) {
    locationMenu.style.left = `${x}px`;
    locationMenu.style.top = `${y}px`;
    locationMenu.style.display = 'flex';
    
    // Обновляем текст кнопки "Перейти к локации"
    const targetLocation = state.locations[state.selectedTransition.targetLocationId];
    goToLocationBtn.disabled = !targetLocation;
    goToLocationBtn.innerHTML = targetLocation ? 
        `<i class="fas fa-external-link-alt"></i> Перейти к "${targetLocation.name}"` :
        `<i class="fas fa-external-link-alt"></i> Перейти к локации`;
}

// Скрыть меню
function hideLocationMenu() {
    locationMenu.style.display = 'none';
}

// Открыть модальное окно локации
function openLocationModal() {
    newLocationName.value = '';
    newLocationDescription.value = '';
    gridRows.value = '6';
    gridCols.value = '10';
    document.getElementById('modalTitle').textContent = 'Новая локация';
    locationModal.style.display = 'flex';
}

// Закрыть модальное окно локации
function closeLocationModal() {
    locationModal.style.display = 'none';
}

// Сохранить локацию
function saveLocation() {
    const name = newLocationName.value.trim();
    if (!name) {
        alert('Введите название локации');
        return;
    }
    
    const locationId = `location_${state.nextLocationId++}`;
    const newLocation = {
        id: locationId,
        name: name,
        description: newLocationDescription.value.trim(),
        rows: parseInt(gridRows.value),
        cols: parseInt(gridCols.value),
        transitions: [],
        createdAt: new Date().toISOString()
    };
    
    state.locations[locationId] = newLocation;
    saveState();
    updateLocationsList();
    closeLocationModal();
    
    // Переключаемся на новую локацию
    switchLocation(locationId);
}

// Открыть модальное окно перехода
function openTransitionModal(mode) {
    if (!state.selectedTransition) return;
    
    transitionName.value = state.selectedTransition.name;
    transitionNote.value = state.selectedTransition.note || '';
    
    // Заполняем список локаций
    updateTargetLocationSelect();
    
    if (state.selectedTransition.targetLocationId) {
        targetLocationSelect.value = state.selectedTransition.targetLocationId;
    }
    
    hideLocationMenu();
    transitionModal.style.display = 'flex';
}

// Обновить список целевых локаций
function updateTargetLocationSelect() {
    targetLocationSelect.innerHTML = '<option value="">Выберите локацию</option>';
    
    Object.values(state.locations).forEach(location => {
        if (location.id !== state.currentLocationId) {
            const option = document.createElement('option');
            option.value = location.id;
            option.textContent = `${location.name} (${location.rows}×${location.cols})`;
            targetLocationSelect.appendChild(option);
        }
    });
}

// Закрыть модальное окно перехода
function closeTransitionModal() {
    transitionModal.style.display = 'none';
}

// Сохранить переход
function saveTransition() {
    if (!state.selectedTransition) return;
    
    state.selectedTransition.name = transitionName.value.trim() || `Переход ${state.selectedTransition.id}`;
    state.selectedTransition.targetLocationId = targetLocationSelect.value;
    state.selectedTransition.note = transitionNote.value.trim();
    
    saveState();
    render();
    updateUI();
    closeTransitionModal();
}

// Перейти к целевой локации
function goToTargetLocation() {
    if (!state.selectedTransition || !state.selectedTransition.targetLocationId) return;
    
    const targetId = state.selectedTransition.targetLocationId;
    if (state.locations[targetId]) {
        switchLocation(targetId);
        hideLocationMenu();
    }
}

// Удалить переход
function deleteTransition() {
    if (!state.selectedTransition) return;
    
    const location = state.locations[state.currentLocationId];
    if (location && confirm('Удалить этот переход?')) {
        location.transitions = location.transitions.filter(t => t.id !== state.selectedTransition.id);
        state.selectedTransition = null;
        saveState();
        render();
        updateUI();
        hideLocationMenu();
    }
}

// Переключение локации
function switchLocation(locationId) {
    if (!state.locations[locationId]) return;
    
    state.currentLocationId = locationId;
    state.scale = 1;
    state.offset = { x: 0, y: 0 };
    state.selectedTransition = null;
    
    updateGridOverlay();
    saveState();
    render();
    updateUI();
    updateLocationsList();
}

// Обновление UI
function updateUI() {
    const location = state.locations[state.currentLocationId];
    if (location) {
        currentLocationName.textContent = location.name;
        currentLocationInfo.textContent = location.name;
    }
    
    const totalLocations = Object.keys(state.locations).length - 1; // Исключаем главную
    document.getElementById('locationCount').textContent = `Локаций: ${totalLocations}`;
    document.getElementById('zoomLevel').textContent = `Масштаб: ${Math.round(state.scale * 100)}%`;
}

// Обновление списка локаций
function updateLocationsList() {
    locationsList.innerHTML = '';
    
    // Главная карта
    const mainCard = createLocationCard(state.locations[MAIN_LOCATION_ID]);
    mainCard.classList.add('active');
    locationsList.appendChild(mainCard);
    
    // Остальные локации
    Object.values(state.locations)
        .filter(loc => loc.id !== MAIN_LOCATION_ID)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .forEach(location => {
            const card = createLocationCard(location);
            if (location.id === state.currentLocationId) {
                card.classList.add('active');
            }
            locationsList.appendChild(card);
        });
}

// Создание карточки локации
function createLocationCard(location) {
    const card = document.createElement('div');
    card.className = 'location-card';
    card.innerHTML = `
        <div class="location-name">${location.name}</div>
        <div class="location-info">${location.description || 'Нет описания'}</div>
        <div class="location-grid-size">Сетка: ${location.rows}×${location.cols}</div>
        <div class="location-info">Переходов: ${location.transitions.length}</div>
    `;
    
    card.addEventListener('click', () => switchLocation(location.id));
    return card;
}

// Загрузка состояния
function loadState() {
    const saved = localStorage.getItem('mapEditorState');
    if (saved) {
        const parsed = JSON.parse(saved);
        
        // Восстанавливаем все свойства
        Object.assign(state, parsed);
        
        // Убеждаемся, что главная карта всегда существует
        if (!state.locations[MAIN_LOCATION_ID]) {
            state.locations[MAIN_LOCATION_ID] = {
                id: MAIN_LOCATION_ID,
                name: 'Главная карта',
                description: 'Основная карта локаций',
                rows: 6,
                cols: 10,
                transitions: [],
                createdAt: new Date().toISOString()
            };
        }
    }
}

// Сохранение состояния
function saveState() {
    localStorage.setItem('mapEditorState', JSON.stringify(state));
}

// Отрисовка
function render() {
    // Очищаем холст
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Сохраняем текущее состояние контекста
    ctx.save();
    
    // Применяем трансформации
    ctx.translate(state.offset.x, state.offset.y);
    ctx.scale(state.scale, state.scale);
    
    // Рисуем сетку локации
    drawGrid();
    
    // Рисуем переходы
    drawTransitions();
    
    // Восстанавливаем состояние контекста
    ctx.restore();
}

// Отрисовка сетки
function drawGrid() {
    const location = state.locations[state.currentLocationId];
    if (!location) return;
    
    const width = location.cols * CELL_SIZE;
    const height = location.rows * CELL_SIZE;
    
    // Рисуем фон сетки
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Рисуем линии сетки
    ctx.strokeStyle = 'rgba(79, 111, 158, 0.5)';
    ctx.lineWidth = 1;
    
    // Вертикальные линии
    for (let x = 0; x <= width; x += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    
    // Горизонтальные линии
    for (let y = 0; y <= height; y += CELL_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Границы карты
    ctx.strokeStyle = 'rgba(233, 69, 96, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, width, height);
    
    // Номера колонн и строк
    ctx.fillStyle = 'rgba(160, 160, 192, 0.7)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Номера колонн сверху
    for (let col = 0; col < location.cols; col++) {
        ctx.fillText(col + 1, col * CELL_SIZE + CELL_SIZE/2, 15);
    }
    
    // Номера строк слева
    ctx.textAlign = 'right';
    for (let row = 0; row < location.rows; row++) {
        ctx.fillText(row + 1, -5, row * CELL_SIZE + CELL_SIZE/2 + 4);
    }
}

// Отрисовка переходов
function drawTransitions() {
    const location = state.locations[state.currentLocationId];
    if (!location) return;
    
    location.transitions.forEach(transition => {
        const isSelected = state.selectedTransition && state.selectedTransition.id === transition.id;
        const hasTarget = !!transition.targetLocationId;
        const hasNote = !!transition.note;
        
        // Цвет перехода зависит от наличия цели
        ctx.fillStyle = hasTarget ? '#e94560' : '#888888';
        ctx.strokeStyle = isSelected ? '#ffffff' : '#ffffff';
        ctx.lineWidth = isSelected ? 3 : 2;
        
        // Рисуем круг перехода
        ctx.beginPath();
        ctx.arc(transition.x, transition.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Иконка внутри
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hasTarget ? '→' : '?', transition.x, transition.y);
        
        // Индикатор заметки
        if (hasNote) {
            ctx.font = '8px Arial';
            ctx.fillText('📝', transition.x + 15, transition.y - 15);
        }
        
        // Название перехода под кругом
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.fillText(transition.name, transition.x, transition.y + 20);
    });
}

// Запуск приложения
init();
