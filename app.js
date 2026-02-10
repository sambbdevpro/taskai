// ===== CONFIG =====
// Link API Apps Script v2 (Thay URL của anh vào đây)
const API_URL = 'https://script.google.com/macros/s/AKfycbzfbnathUa7K65z91TFBj6-q6VXiW74UY-RruNReWitLIGYymvwEnZrvh2v8hDaU-Ey/exec';

// ===== STATE =====
let tasks = [];
let currentFilter = 'all';
let currentDetailId = null;
let draggedTaskId = null;
let isLoading = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    setupFilters();
    setupKeyboard();
    
    // Auto refresh every 30 seconds (fix: cache busting via timestamp)
    setInterval(loadTasks, 30 * 1000);

    // Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.innerHTML = '🔄';
    refreshBtn.className = 'refresh-btn';
    refreshBtn.title = 'Làm mới dữ liệu';
    refreshBtn.onclick = loadTasks;
    document.querySelector('.header').appendChild(refreshBtn);
});

// ===== API CALLS =====
async function apiCall(params) {
    isLoading = true;
    updateLoadingState();
    
    // Add timestamp to prevent caching
    const url = new URL(API_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    url.searchParams.append('_t', Date.now()); // Cache buster
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        isLoading = false;
        updateLoadingState();
        return data;
    } catch (err) {
        console.error('API Error:', err);
        isLoading = false;
        updateLoadingState();
        // Fallback to local data if offline
        return { error: err.message };
    }
}

// ===== TASK CRUD =====
async function loadTasks() {
    try {
        const data = await apiCall({ action: 'list' });
        if (data && data.tasks) {
            tasks = data.tasks;
            renderBoard();
        }
    } catch (err) {
        console.error('Failed to load tasks:', err);
    }
}

async function createTask(data) {
    // Optimistic update
    const tempId = 'temp_' + Date.now();
    const newTask = {
        id: tempId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    tasks.unshift(newTask);
    renderBoard();
    
    // Call API
    try {
        const res = await apiCall({
            action: 'add',
            title: data.title,
            description: data.description,
            assignee: data.assignee,
            priority: data.priority,
            status: data.status
        });
        
        if (res.success && res.task) {
            // Replace temp task with real one
            const idx = tasks.findIndex(t => t.id === tempId);
            if (idx !== -1) {
                tasks[idx] = res.task;
                renderBoard();
            }
        }
    } catch (err) {
        console.error('Create task failed:', err);
        alert('Lỗi tạo task: ' + err.message);
        // Rollback
        tasks = tasks.filter(t => t.id !== tempId);
        renderBoard();
    }
}

async function updateTask(id, data) {
    // Optimistic update
    const idx = tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    
    const oldTask = { ...tasks[idx] };
    tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
    renderBoard();
    
    // Call API
    try {
        await apiCall({
            action: 'update',
            id: id,
            ...data
        });
    } catch (err) {
        console.error('Update task failed:', err);
        // Rollback
        tasks[idx] = oldTask;
        renderBoard();
    }
}

async function deleteTask(id) {
    // Optimistic update
    const oldTasks = [...tasks];
    tasks = tasks.filter(t => t.id !== id);
    renderBoard();
    
    // Call API
    try {
        await apiCall({ action: 'delete', id: id });
    } catch (err) {
        console.error('Delete task failed:', err);
        // Rollback
        tasks = oldTasks;
        renderBoard();
    }
}

async function moveTask(id, newStatus) {
    updateTask(id, { status: newStatus });
}

// ===== RENDER =====
function renderBoard() {
    const statuses = ['new', 'working', 'completed', 'recheck'];
    
    statuses.forEach(status => {
        const list = document.getElementById(`list-${status}`);
        const filteredTasks = tasks.filter(t => {
            if (t.status !== status) return false;
            if (currentFilter === 'all') return true;
            return t.assignee === currentFilter;
        });
        
        if (filteredTasks.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">${getEmptyIcon(status)}</div>
                    <div>Không có task</div>
                </div>
            `;
        } else {
            list.innerHTML = filteredTasks.map(t => renderTaskCard(t)).join('');
        }
        
        // Update counts
        document.getElementById(`count-${status}`).textContent = filteredTasks.length;
    });
    
    updateStats();
    setupDragAndDrop();
}

function renderTaskCard(task) {
    const assigneeLabel = getAssigneeLabel(task.assignee);
    const timeAgo = getTimeAgo(task.updatedAt);
    const isTemp = task.id.toString().startsWith('temp_');
    
    return `
        <div class="task-card ${isTemp ? 'loading' : ''}" 
             draggable="true" 
             data-id="${task.id}"
             onclick="openDetail('${task.id}')">
            <div class="task-card-title">${escapeHtml(task.title)}</div>
            ${task.description ? `<div class="task-card-desc">${escapeHtml(task.description)}</div>` : ''}
            <div class="task-card-footer">
                <div class="task-card-meta">
                    <span class="label label-${task.assignee}">${assigneeLabel}</span>
                    <span class="priority-dot priority-${task.priority}" title="${getPriorityText(task.priority)}"></span>
                </div>
                <span class="task-date">${timeAgo}</span>
            </div>
        </div>
    `;
}

function updateLoadingState() {
    const header = document.querySelector('.header h1');
    if (isLoading) {
        header.innerHTML = '🎯 Team AI Dashboard <span style="font-size:0.8rem">↻ Syncing...</span>';
    } else {
        header.innerHTML = '🎯 Team AI Dashboard';
    }
}

// ... (Rest of UI functions: getAssigneeLabel, getPriorityText, etc. remain same) ...

function getAssigneeLabel(assignee) {
    const labels = {
        kate: '💃 Kate',
        mira: '🔍 Mira',
        kaka: '👾 Kaka',
        personal: '👤 Cá nhân'
    };
    return labels[assignee] || assignee;
}

function getPriorityText(priority) {
    const texts = { low: 'Ưu tiên thấp', medium: 'Ưu tiên TB', high: 'Ưu tiên cao' };
    return texts[priority] || priority;
}

function getPriorityLabel(priority) {
    const labels = { low: '🟢 Thấp', medium: '🟡 Trung bình', high: '🔴 Cao' };
    return labels[priority] || priority;
}

function getStatusLabel(status) {
    const labels = { new: '📥 New', working: '🔨 Working', completed: '✅ Done', recheck: '🔄 Recheck' };
    return labels[status] || status;
}

function getEmptyIcon(status) {
    const icons = { new: '📭', working: '💤', completed: '🎉', recheck: '👍' };
    return icons[status] || '📭';
}

function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)}p trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h trước`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d trước`;
    return date.toLocaleDateString('vi-VN');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== STATS =====
function updateStats() {
    const filtered = currentFilter === 'all' ? tasks : tasks.filter(t => t.assignee === currentFilter);
    document.getElementById('stat-total').textContent = filtered.length;
    document.getElementById('stat-new').textContent = filtered.filter(t => t.status === 'new').length;
    document.getElementById('stat-working').textContent = filtered.filter(t => t.status === 'working').length;
    document.getElementById('stat-completed').textContent = filtered.filter(t => t.status === 'completed').length;
    document.getElementById('stat-recheck').textContent = filtered.filter(t => t.status === 'recheck').length;
}

// ===== FILTERS =====
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderBoard();
        });
    });
}

// ===== DRAG AND DROP =====
function setupDragAndDrop() {
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedTaskId = card.dataset.id;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.dataset.id);
        });
        
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedTaskId = null;
            document.querySelectorAll('.task-list').forEach(list => {
                list.classList.remove('drag-over');
            });
        });
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;
    
    const column = e.currentTarget.closest('.column');
    const newStatus = column.dataset.status;
    
    // Optimistic move
    moveTask(taskId, newStatus);
}

// ===== MODAL - ADD/EDIT =====
function openModal(taskId) {
    const modal = document.getElementById('modal');
    const form = document.getElementById('task-form');
    
    if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        document.getElementById('modal-title').textContent = 'Sửa Task';
        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description;
        document.getElementById('task-assignee').value = task.assignee;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-status').value = task.status;
    } else {
        document.getElementById('modal-title').textContent = 'Thêm Task Mới';
        form.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-priority').value = 'medium';
        document.getElementById('task-status').value = 'new';
    }
    
    modal.classList.add('show');
    setTimeout(() => document.getElementById('task-title').focus(), 100);
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

function closeModalOutside(e) {
    if (e.target === e.currentTarget) closeModal();
}

function handleSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('task-id').value;
    const data = {
        title: document.getElementById('task-title').value.trim(),
        description: document.getElementById('task-desc').value.trim(),
        assignee: document.getElementById('task-assignee').value,
        priority: document.getElementById('task-priority').value,
        status: document.getElementById('task-status').value
    };
    
    if (!data.title) return;
    
    if (id) {
        updateTask(id, data);
    } else {\n        createTask(data);
    }
    
    closeModal();
}

// ===== DETAIL MODAL =====
function openDetail(taskId) {
    if (draggedTaskId) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    currentDetailId = taskId;
    
    document.getElementById('detail-title').textContent = task.title;
    document.getElementById('detail-assignee').innerHTML = `<span class="label label-${task.assignee}">${getAssigneeLabel(task.assignee)}</span>`;
    document.getElementById('detail-priority').innerHTML = getPriorityLabel(task.priority);
    document.getElementById('detail-status').textContent = getStatusLabel(task.status);
    document.getElementById('detail-desc').textContent = task.description || '(Không có mô tả)';
    document.getElementById('detail-created').textContent = formatDate(task.createdAt);
    document.getElementById('detail-updated').textContent = formatDate(task.updatedAt);
    
    document.getElementById('detail-modal').classList.add('show');
}

function closeDetail() {
    document.getElementById('detail-modal').classList.remove('show');
    currentDetailId = null;
}

function closeDetailOutside(e) {
    if (e.target === e.currentTarget) closeDetail();
}

function editFromDetail() {
    if (!currentDetailId) return;
    closeDetail();
    openModal(currentDetailId);
}

function deleteFromDetail() {
    if (!currentDetailId) return;
    if (confirm('Xóa task này?')) {
        deleteTask(currentDetailId);
        closeDetail();
    }
}

// ===== KEYBOARD =====
function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDetail();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openModal();
        }
    });
}
