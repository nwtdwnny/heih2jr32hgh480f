// Основные переменные
const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const gridOverlay = document.querySelector('.grid-overlay');
const locationMenu = document.getElementById('locationMenu');
const editModal = document.getElementById('editModal');
const editNameBtn = document.getElementById('editNameBtn');
const editNoteBtn = document.getElementById('editNoteBtn');
const deleteLocationBtn = document.getElementById('deleteLocationBtn');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const locationNameInput = document.getElementById('locationName');
const locationNoteInput = document.getElementById('locationNote');
const resetViewBtn = document.getElementById('resetView');
const clearAllBtn = document.getElementById('clearAll');
const locationCountElement = document.getElementById('locationCount');
const zoomLevelElement = document.getElementById('zoomLevel');

// Параметры карты
const ROWS = 6;
const COLS = 10;
const CELL_SIZE = 100;

// Состояние приложения
let state = {
    locations: [],
    connections: [],
    selectedLocation: null,
    dragging: false,
    dragLocation: null,
    dragOffset: { x: 0, y: 0 },
    panning: false,
    panStart: { x: 0, y: 0 },
    scale: 1,
    offset: { x: 0, y: 0 },
    editingLocation: null,
    editMode: 'name', // 'name' или 'note'
    nextId: 1
};

// Инициализация
function init() {
    resizeCanvas();
    loadState();
    render();
    setupEventListeners();
    updateUI();
}

// Изменение размера холста
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

// Загрузка состояния из localStorage
function loadState() {
    const saved = localStorage.getItem('mapState');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.locations = parsed.locations || [];
        state.connections = parsed.connections || [];
        state.nextId = parsed.nextId || 1;
        state.scale = parsed.scale || 1;
        state.offset = parsed.offset || { x: 0, y: 0 };
    }
}

// Сохранение состояния в localStorage
function saveState() {
    const toSave = {
        locations: state.locations,
        connections: state.connections,
        nextId: state.nextId,
        scale: state.scale,
        offset: state.offset
    };
    localStorage.setItem('mapState', JSON.stringify(toSave));
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
    
    // События меню локации
    editNameBtn.addEventListener('click', () => openEditModal('name'));
    editNoteBtn.addEventListener('click', () => openEditModal('note'));
    deleteLocationBtn.addEventListener('click', deleteSelectedLocation);
    
    // События модального окна
    saveEditBtn.addEventListener('click', saveEdit);
    cancelEditBtn.addEventListener('click', closeEditModal);
    
    // Кнопки управления
    resetViewBtn.addEventListener('click', resetView);
    clearAllBtn.addEventListener('click', clearAll);
    
    // Закрытие меню при клике вне его
    document.addEventListener('click', (e) => {
        if (!locationMenu.contains(e.target)) {
            hideLocationMenu();
        }
    });
    
    // Закрытие модального окна при клике вне его
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
            closeEditModal();
        }
    });
    
    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideLocationMenu();
            closeEditModal();
        }
    });
}

// Обработка нажатия кнопки мыши
function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.offset.x) / state.scale;
    const y = (e.clientY - rect.top - state.offset.y) / state.scale;
    
    // Проверяем, попали ли в существующую локацию
    const location = findLocationAt(x, y);
    
    if (e.button === 0) { // ЛКМ
        if (location) {
            // Начало перетаскивания локации
            state.dragging = true;
            state.dragLocation = location;
            state.dragOffset = {
                x: x - location.x,
                y: y - location.y
            };
            state.selectedLocation = location;
            canvas.style.cursor = 'grabbing';
        } else {
            // Начало панорамирования карты
            state.panning = true;
            state.panStart = { x: e.clientX, y: e.clientY };
            canvas.style.cursor = 'grabbing';
        }
    } else if (e.button === 2) { // ПКМ
        e.preventDefault();
        
        if (location) {
            // Показ меню для существующей локации
            state.selectedLocation = location;
            showLocationMenu(e.clientX, e.clientY);
        } else {
            // Создание новой локации
            const gridX = Math.round(x / CELL_SIZE) * CELL_SIZE;
            const gridY = Math.round(y / CELL_SIZE) * CELL_SIZE;
            
            // Проверяем, не занята ли клетка
            const existing = state.locations.find(loc => 
                Math.abs(loc.x - gridX) < CELL_SIZE/2 && 
                Math.abs(loc.y - gridY) < CELL_SIZE/2
            );
            
            if (!existing) {
                const newLocation = {
                    id: state.nextId++,
                    x: gridX,
                    y: gridY,
                    name: `Локация ${state.nextId - 1}`,
                    note: '',
                    color: getRandomColor()
                };
                
                state.locations.push(newLocation);
                state.selectedLocation = newLocation;
                saveState();
                render();
                updateUI();
            }
        }
    }
}

// Обработка движения мыши
function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - state.offset.x) / state.scale;
    const y = (e.clientY - rect.top - state.offset.y) / state.scale;
    
    if (state.dragging && state.dragLocation) {
        // Перетаскивание локации
        const gridX = Math.round(x / CELL_SIZE) * CELL_SIZE;
        const gridY = Math.round(y / CELL_SIZE) * CELL_SIZE;
        
        // Проверяем, не занята ли новая позиция другой локацией
        const existing = state.locations.find(loc => 
            loc.id !== state.dragLocation.id &&
            Math.abs(loc.x - gridX) < CELL_SIZE/2 && 
            Math.abs(loc.y - gridY) < CELL_SIZE/2
        );
        
        if (!existing) {
            state.dragLocation.x = gridX;
            state.dragLocation.y = gridY;
            
            // Обновляем соединения
            updateConnections();
            render();
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
        // Изменение курсора при наведении на локацию
        const location = findLocationAt(x, y);
        canvas.style.cursor = location ? 'grab' : 'default';
    }
}

// Обработка отпускания кнопки мыши
function handleMouseUp(e) {
    if (e.button === 0) { // ЛКМ
        if (state.dragging && state.dragLocation) {
            saveState();
        }
        
        state.dragging = false;
        state.dragLocation = null;
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

// Поиск локации по координатам
function findLocationAt(x, y) {
    for (let i = state.locations.length - 1; i >= 0; i--) {
        const loc = state.locations[i];
        const size = CELL_SIZE * 0.8;
        
        if (x >= loc.x - size/2 && x <= loc.x + size/2 &&
            y >= loc.y - size/2 && y <= loc.y + size/2) {
            return loc;
        }
    }
    return null;
}

// Показать меню локации
function showLocationMenu(x, y) {
    locationMenu.style.left = `${x}px`;
    locationMenu.style.top = `${y}px`;
    locationMenu.style.display = 'flex';
}

// Скрыть меню локации
function hideLocationMenu() {
    locationMenu.style.display = 'none';
}

// Открыть модальное окно редактирования
function openEditModal(mode) {
    state.editMode = mode;
    
    if (state.selectedLocation) {
        state.editingLocation = state.selectedLocation;
        
        if (mode === 'name') {
            locationNameInput.value = state.selectedLocation.name;
            locationNoteInput.style.display = 'none';
            document.getElementById('nameEdit').style.display = 'block';
            document.getElementById('modalTitle').textContent = 'Редактировать название';
        } else {
            locationNoteInput.value = state.selectedLocation.note;
            locationNameInput.style.display = 'none';
            document.getElementById('nameEdit').style.display = 'none';
            document.getElementById('modalTitle').textContent = 'Редактировать заметку';
        }
        
        hideLocationMenu();
        editModal.style.display = 'flex';
    }
}

// Закрыть модальное окно
function closeEditModal() {
    editModal.style.display = 'none';
    state.editingLocation = null;
}

// Сохранить изменения
function saveEdit() {
    if (state.editingLocation) {
        if (state.editMode === 'name') {
            state.editingLocation.name = locationNameInput.value.trim() || `Локация ${state.editingLocation.id}`;
        } else {
            state.editingLocation.note = locationNoteInput.value.trim();
        }
        
        saveState();
        render();
        updateUI();
        closeEditModal();
    }
}

// Удалить выбранную локацию
function deleteSelectedLocation() {
    if (state.selectedLocation) {
        state.locations = state.locations.filter(loc => loc.id !== state.selectedLocation.id);
        state.connections = state.connections.filter(conn => 
            conn.from !== state.selectedLocation.id && conn.to !== state.selectedLocation.id
        );
        
        saveState();
        render();
        updateUI();
        hideLocationMenu();
    }
}

// Обновить соединения
function updateConnections() {
    state.connections = [];
    
    // Создаем соединения между соседними локациями
    for (let i = 0; i < state.locations.length; i++) {
        for (let j = i + 1; j < state.locations.length; j++) {
            const loc1 = state.locations[i];
            const loc2 = state.locations[j];
            
            // Проверяем, являются ли локации соседними по горизонтали или вертикали
            const dx = Math.abs(loc1.x - loc2.x);
            const dy = Math.abs(loc1.y - loc2.y);
            
            if ((dx === CELL_SIZE && dy === 0) || (dy === CELL_SIZE && dx === 0)) {
                state.connections.push({
                    from: loc1.id,
                    to: loc2.id
                });
            }
        }
    }
}

// Сбросить вид
function resetView() {
    state.scale = 1;
    state.offset = { x: 0, y: 0 };
    saveState();
    render();
    updateUI();
}

// Очистить карту
function clearAll() {
    if (confirm('Вы уверены, что хотите удалить все локации?')) {
        state.locations = [];
        state.connections = [];
        state.selectedLocation = null;
        saveState();
        render();
        updateUI();
    }
}

// Обновление UI
function updateUI() {
    locationCountElement.textContent = `Локаций: ${state.locations.length}`;
    zoomLevelElement.textContent = `Масштаб: ${Math.round(state.scale * 100)}%`;
}

// Генерация случайного цвета
function getRandomColor() {
    const colors = [
        '#1abc9c', '#3498db', '#9b59b6', '#e74c3c', 
        '#f39c12', '#2ecc71', '#34495e', '#d35400'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Отрисовка
function render() {
    // Очищаем холст
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Сохраняем текущее состояние контекста
    ctx.save();
    
    // Применяем трансформации (масштаб и смещение)
    ctx.translate(state.offset.x, state.offset.y);
    ctx.scale(state.scale, state.scale);
    
    // Рисуем сетку
    drawGrid();
    
    // Рисуем соединения
    drawConnections();
    
    // Рисуем локации
    drawLocations();
    
    // Восстанавливаем состояние контекста
    ctx.restore();
}

// Отрисовка сетки
function drawGrid() {
    const width = COLS * CELL_SIZE;
    const height = ROWS * CELL_SIZE;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
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
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width, height);
}

// Отрисовка соединений
function drawConnections() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    for (const conn of state.connections) {
        const fromLoc = state.locations.find(l => l.id === conn.from);
        const toLoc = state.locations.find(l => l.id === conn.to);
        
        if (fromLoc && toLoc) {
            ctx.beginPath();
            ctx.moveTo(fromLoc.x, fromLoc.y);
            ctx.lineTo(toLoc.x, toLoc.y);
            ctx.stroke();
            
            // Стрелка на конце линии
            drawArrow(fromLoc.x, fromLoc.y, toLoc.x, toLoc.y);
        }
    }
}

// Отрисовка стрелки
function drawArrow(fromX, fromY, toX, toY) {
    const headlen = 10;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    
    // Начало новой точки отсчета
    ctx.translate(toX, toY);
    ctx.rotate(angle - Math.PI / 2);
    
    // Рисуем стрелку
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-headlen, headlen * 2);
    ctx.lineTo(headlen, headlen * 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

// Отрисовка локаций
function drawLocations() {
    for (const loc of state.locations) {
        const size = CELL_SIZE * 0.8;
        const isSelected = state.selectedLocation && state.selectedLocation.id === loc.id;
        
        // Тень
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 3;
        
        // Тело локации
        ctx.fillStyle = loc.color;
        ctx.strokeStyle = isSelected ? '#ffffff' : '#16a085';
        ctx.lineWidth = isSelected ? 4 : 3;
        
        ctx.beginPath();
        ctx.roundRect(loc.x - size/2, loc.y - size/2, size, size, 8);
        ctx.fill();
        ctx.stroke();
        
        // Сбрасываем тень для текста
        ctx.shadowColor = 'transparent';
        
        // Название локации
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Обрезаем текст, если он слишком длинный
        let displayName = loc.name;
        const maxChars = 10;
        if (displayName.length > maxChars) {
            displayName = displayName.substring(0, maxChars) + '...';
        }
        
        ctx.fillText(displayName, loc.x, loc.y - 10);
        
        // Индикатор заметки
        if (loc.note) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = '12px Arial';
            ctx.fillText('📝', loc.x, loc.y + 15);
        }
    }
}

// Добавляем поддержку roundRect для старых браузеров
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
    }
}

// Запуск приложения
init();
