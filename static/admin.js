/**
 * 知识库后台管理 JS
 */

let currentTab = '例题';  // 当前标签
let currentEntries = [];  // 当前显示的条目

// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    bindNav();
    loadEntries();
    document.getElementById('searchInput').addEventListener('input', debounce(loadEntries, 300));
});

function bindNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            currentTab = item.dataset.tab;
            document.getElementById('searchInput').value = '';
            loadEntries();
            // 更新弹窗默认类型
            document.getElementById('entryType').value = currentTab;
        });
    });
}

// ============================================================
// 加载列表
// ============================================================
async function loadEntries() {
    const search = document.getElementById('searchInput').value.trim();
    const type = currentTab;
    try {
        const resp = await fetch(`/admin/api/entries?type=${encodeURIComponent(type)}&search=${encodeURIComponent(search)}`);
        const data = await resp.json();
        if (data.success) {
            currentEntries = data.entries;
            renderList(data.entries);
        }
    } catch (err) {
        console.error('加载失败:', err);
    }
    updateStats();
}

function renderList(entries) {
    const container = document.getElementById('entryList');
    const info = document.getElementById('listInfo');

    if (entries.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">📭</div><p>暂无${currentTab}，点击「＋ 新增」添加</p></div>`;
        info.textContent = '';
        return;
    }

    container.innerHTML = entries.map(e => `
        <div class="entry-card">
            <div class="entry-info">
                <div class="title">
                    ${e.title}
                    ${e.type === '例题' ? '<span class="badge badge-example">例题</span>' : '<span class="badge badge-knowledge">知识点</span>'}
                    <span class="badge badge-category">${escHtml(e.category)}</span>
                </div>
                <div class="meta">
                    标签：${e.tags || '无'} &nbsp;|&nbsp;
                    ${e.created_at ? e.created_at.slice(0, 16) : ''}
                </div>
                <div class="content-preview">${escHtml(e.content || '').slice(0, 80)}</div>
            </div>
            <div class="entry-actions">
                <button class="btn-icon" onclick="openEditForm(${e.id})" title="编辑">✏️</button>
                <button class="btn-icon danger" onclick="handleDelete(${e.id})" title="删除">🗑️</button>
            </div>
        </div>
    `).join('');

    info.textContent = `共 ${entries.length} 条`;
}

async function updateStats() {
    try {
        const [r1, r2] = await Promise.all([
            fetch('/admin/api/entries?type=例题&limit=1'),
            fetch('/admin/api/entries?type=知识点&limit=1')
        ]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        document.getElementById('stat-example').textContent = d1.entries ? d1.entries.length : '-';
        document.getElementById('stat-knowledge').textContent = d2.entries ? d2.entries.length : '-';
    } catch (e) {}
}

// ============================================================
// 弹窗
// ============================================================
function openAddForm() {
    document.getElementById('editId').value = '';
    document.getElementById('entryType').value = currentTab;
    document.getElementById('entryCategory').value = '通用';
    document.getElementById('entryTitle').value = '';
    document.getElementById('entryTags').value = '';
    document.getElementById('entryContent').value = '';
    document.getElementById('modalTitle').textContent = `新增${currentTab}`;
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function openEditForm(id) {
    const entry = currentEntries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('editId').value = entry.id;
    document.getElementById('entryType').value = entry.type;
    document.getElementById('entryCategory').value = entry.category;
    document.getElementById('entryTitle').value = entry.title;
    document.getElementById('entryTags').value = entry.tags;
    document.getElementById('entryContent').value = entry.content;
    document.getElementById('modalTitle').textContent = '编辑条目';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
}

// 点击遮罩关闭
document.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') closeModal();
});

// ESC 关闭
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ============================================================
// 保存
// ============================================================
async function handleSave(e) {
    e.preventDefault();

    const id = document.getElementById('editId').value;
    const data = {
        type: document.getElementById('entryType').value,
        category: document.getElementById('entryCategory').value,
        title: document.getElementById('entryTitle').value.trim(),
        tags: document.getElementById('entryTags').value.trim(),
        content: document.getElementById('entryContent').value.trim()
    };

    if (!data.title) return;

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/admin/api/entries/${id}` : '/admin/api/entries';

    try {
        const resp = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await resp.json();
        if (result.success) {
            closeModal();
            loadEntries();
        } else {
            alert('保存失败: ' + (result.error || '未知错误'));
        }
    } catch (err) {
        alert('网络错误: ' + err.message);
    }
}

// ============================================================
// 删除
// ============================================================
async function handleDelete(id) {
    if (!confirm('确定要删除这条记录吗？')) return;

    try {
        const resp = await fetch(`/admin/api/entries/${id}`, { method: 'DELETE' });
        const data = await resp.json();
        if (data.success) {
            loadEntries();
        }
    } catch (err) {
        alert('删除失败');
    }
}

// ============================================================
// 退出
// ============================================================
async function handleLogout() {
    await fetch('/admin/api/logout', { method: 'POST' });
    location.href = '/admin';
}

// ============================================================
// 工具函数
// ============================================================
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
