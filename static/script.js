/**
 * 高中地理大题答题模板生成器 — 前端交互逻辑
 * 支持：桌面端 / 平板 / 手机  &  亮色 / 暗色模式
 */


// ============================================================
// 全局状态
// ============================================================
const STATE = {
    questionTypes: {},
    knowledgeModules: [],
    difficultyLevels: [],
    selectedType: null,
    apiAvailable: false,
    isGenerating: false,
    currentTemplate: null,
    isMobile: window.innerWidth <= 768,
    activePanel: 'config'  // 'config' | 'result'
};

// ============================================================
// DOM 引用
// ============================================================
const DOM = {
    typeGrid: document.getElementById('typeGrid'),
    subtypeSelect: document.getElementById('subtypeSelect'),
    topicInput: document.getElementById('topicInput'),
    moduleSelect: document.getElementById('moduleSelect'),
    difficultySelect: document.getElementById('difficultySelect'),
    generateBtn: document.getElementById('generateBtn'),
    apiHint: document.getElementById('apiHint'),
    apiStatus: document.getElementById('api-status'),
    themeToggle: document.getElementById('themeToggle'),
    resultPlaceholder: document.getElementById('resultPlaceholder'),
    resultContent: document.getElementById('resultContent'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    errorBox: document.getElementById('errorBox'),
    templateContent: document.getElementById('templateContent'),
    copyBtn: document.getElementById('copyBtn'),
    printBtn: document.getElementById('printBtn'),
    historySection: document.getElementById('historySection'),
    historyList: document.getElementById('historyList'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    mobileNav: document.getElementById('mobileNav'),
    configPanel: document.getElementById('configPanel'),
    resultPanel: document.getElementById('resultPanel'),
    mainContainer: document.querySelector('.main-container'),
    resultBadge: document.getElementById('resultBadge')
};


// ============================================================
// 初始化
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await loadConfig();
    renderHistory();
    bindEvents();
    handleResize();
    startHealthCheck();
});

window.addEventListener('resize', handleResize);


// ============================================================
// 定期健康检查（检测隧道断线）
// ============================================================
let healthCheckTimer = null;

function startHealthCheck() {
    // 每 30 秒检查一次
    healthCheckTimer = setInterval(async () => {
        try {
            const resp = await fetch('/api/health');
            const text = await resp.text();
            // 如果返回的不是 JSON，说明隧道可能断了
            if (!text.startsWith('{')) {
                showConnectionLost();
            }
        } catch (err) {
            // fetch 失败说明连接完全断了
            showConnectionLost();
        }
    }, 30000);
}

function showConnectionLost() {
    // 在顶部显示一个醒目的警告条
    if (document.getElementById('reconnectBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'reconnectBanner';
    banner.style.cssText = `
        position: fixed; top: 56px; left: 0; right: 0; z-index: 999;
        background: #fef2f2; color: #dc2626; text-align: center;
        padding: 12px 16px; font-weight: 600; font-size: 0.9rem;
        border-bottom: 2px solid #fecaca;
        cursor: pointer;
    `;
    banner.textContent = '⚠️ 连接已断开（网络变更/隧道刷新）— 点击刷新页面';
    banner.addEventListener('click', () => { location.reload(); });
    document.body.prepend(banner);

    // 也更新 API 状态
    DOM.apiStatus.textContent = '⚠️ 连接断开';
    DOM.apiStatus.className = 'status-badge disconnected';
    DOM.generateBtn.disabled = true;
}


// ============================================================
// 暗色模式
// ============================================================
function initTheme() {
    const saved = localStorage.getItem('geo_theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        DOM.themeToggle.textContent = '☀️';
    } else {
        document.documentElement.removeAttribute('data-theme');
        DOM.themeToggle.textContent = '🌙';
    }
}

function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        DOM.themeToggle.textContent = '🌙';
        localStorage.setItem('geo_theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        DOM.themeToggle.textContent = '☀️';
        localStorage.setItem('geo_theme', 'dark');
    }
}


// ============================================================
// 加载配置
// ============================================================
async function loadConfig() {
    try {
        const resp = await fetch('/api/config');
        const config = await resp.json();

        STATE.questionTypes = config.question_types;
        STATE.knowledgeModules = config.knowledge_modules;
        STATE.difficultyLevels = config.difficulty_levels;
        STATE.apiAvailable = config.api_available;

        renderTypeGrid();
        renderSelects();
        updateApiStatus();
    } catch (err) {
        console.error('加载配置失败:', err);
        DOM.apiStatus.textContent = '连接失败';
        DOM.apiStatus.className = 'status-badge disconnected';
    }

    // 获取公网 URL 并显示
    loadPublicUrl();
}

async function loadPublicUrl() {
    try {
        const resp = await fetch('/api/tunnel-url');
        const data = await resp.json();
        if (data.public_url) {
            const urlEl = document.getElementById('footerPublicUrl');
            const footerEl = document.getElementById('footerUrl');
            if (urlEl && footerEl) {
                urlEl.href = data.public_url;
                urlEl.textContent = data.public_url;
                footerEl.style.display = 'block';
            }
        }
    } catch (err) {
        // 静默失败，不影响主功能
    }
}

function renderTypeGrid() {
    DOM.typeGrid.innerHTML = '';
    for (const [key, val] of Object.entries(STATE.questionTypes)) {
        const btn = document.createElement('button');
        btn.className = 'type-btn';
        btn.dataset.type = key;
        btn.innerHTML = `
            <span class="btn-icon">${val.icon}</span>
            <span class="btn-label">
                ${val.label}
                <span class="btn-desc">${val.description}</span>
            </span>
        `;
        btn.addEventListener('click', () => selectType(key));
        DOM.typeGrid.appendChild(btn);
    }
}

function renderSelects() {
    DOM.moduleSelect.innerHTML = STATE.knowledgeModules.map(
        m => `<option value="${m}">${m}</option>`
    ).join('');

    DOM.difficultySelect.innerHTML = STATE.difficultyLevels.map(
        d => `<option value="${d}">${d}</option>`
    ).join('');
}

function updateApiStatus() {
    if (STATE.apiAvailable) {
        DOM.apiStatus.textContent = '✅ API 已连接';
        DOM.apiStatus.className = 'status-badge connected';
        DOM.generateBtn.disabled = false;
        DOM.apiHint.textContent = '';
    } else {
        DOM.apiStatus.textContent = '⚠️ 未配置 API Key';
        DOM.apiStatus.className = 'status-badge disconnected';
        DOM.generateBtn.disabled = true;
        DOM.apiHint.textContent = '请在 .env 文件中设置 DEEPSEEK_API_KEY';
    }
}


// ============================================================
// 响应式处理
// ============================================================
function handleResize() {
    STATE.isMobile = window.innerWidth <= 768;

    if (STATE.isMobile) {
        DOM.mobileNav.style.display = 'flex';
        // 确保有底部导航留白
        DOM.resultPanel.style.paddingBottom = '80px';
    } else {
        DOM.mobileNav.style.display = 'none';
        DOM.resultPanel.style.paddingBottom = '';
        // 桌面端显示所有面板
        DOM.configPanel.style.display = '';
        DOM.resultPanel.style.display = '';
        if (DOM.mainContainer) {
            DOM.mainContainer.classList.remove('mobile-show-config', 'mobile-show-result');
        }
    }
}


// ============================================================
// 移动端面板切换
// ============================================================
function switchMobilePanel(panel) {
    if (!STATE.isMobile) return;

    STATE.activePanel = panel;

    if (panel === 'config') {
        DOM.configPanel.style.display = 'flex';
        DOM.resultPanel.style.display = 'none';
        // 更新底部导航状态
        DOM.mobileNav.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        DOM.mobileNav.querySelector('[data-panel="config"]').classList.add('active');
    } else {
        DOM.configPanel.style.display = 'none';
        DOM.resultPanel.style.display = 'block';
        DOM.mobileNav.querySelectorAll('.mobile-nav-btn').forEach(b => b.classList.remove('active'));
        DOM.mobileNav.querySelector('[data-panel="result"]').classList.add('active');
        // 隐藏红点
        DOM.resultBadge.style.display = 'none';
    }
}


// ============================================================
// 事件绑定
// ============================================================
function bindEvents() {
    DOM.generateBtn.addEventListener('click', handleGenerate);
    DOM.copyBtn.addEventListener('click', handleCopy);
    DOM.printBtn.addEventListener('click', handlePrint);
    DOM.clearHistoryBtn.addEventListener('click', handleClearHistory);
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // 移动端底部导航
    DOM.mobileNav.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            switchMobilePanel(btn.dataset.panel);
        });
    });

    // Ctrl+Enter 生成
    DOM.topicInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleGenerate();
        }
    });

    // 全局键盘快捷键
    document.addEventListener('keydown', (e) => {
        // Ctrl+Shift+C 复制
        if (e.ctrlKey && e.shiftKey && e.key === 'C' && STATE.currentTemplate) {
            e.preventDefault();
            handleCopy();
        }
        // Ctrl+Shift+P 打印
        if (e.ctrlKey && e.shiftKey && e.key === 'P' && STATE.currentTemplate) {
            e.preventDefault();
            handlePrint();
        }
    });

    // 触屏设备双击结果区域标题栏快速返回
    DOM.resultContent.addEventListener('dblclick', (e) => {
        if (STATE.isMobile && e.target.closest('.result-toolbar')) {
            switchMobilePanel('config');
        }
    });
}


// ============================================================
// 题型选择
// ============================================================
function selectType(key) {
    STATE.selectedType = key;

    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.type-btn[data-type="${CSS.escape(key)}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const typeInfo = STATE.questionTypes[key];
    if (typeInfo && typeInfo.subtypes) {
        DOM.subtypeSelect.innerHTML = typeInfo.subtypes.map(
            s => `<option value="${s}">${s}</option>`
        ).join('');
    }

    updateGenerateBtn();
}

function updateGenerateBtn() {
    DOM.generateBtn.disabled = !STATE.selectedType || !STATE.apiAvailable;
}


// ============================================================
// 生成模板
// ============================================================
async function handleGenerate() {
    if (STATE.isGenerating) return;

    const topic = DOM.topicInput.value.trim();
    if (!topic) {
        DOM.topicInput.focus();
        DOM.topicInput.style.borderColor = 'var(--danger)';
        setTimeout(() => { DOM.topicInput.style.borderColor = ''; }, 2000);
        if (STATE.isMobile) {
            DOM.topicInput.scrollIntoView({ behavior: 'smooth' });
        }
        return;
    }

    if (!STATE.selectedType) {
        if (STATE.isMobile) {
            switchMobilePanel('config');
        }
        // 高亮提醒选择题型
        DOM.typeGrid.scrollIntoView({ behavior: 'smooth' });
        DOM.typeGrid.style.boxShadow = '0 0 0 3px var(--danger)';
        setTimeout(() => { DOM.typeGrid.style.boxShadow = ''; }, 2000);
        return;
    }

    STATE.isGenerating = true;
    DOM.generateBtn.disabled = true;
    DOM.generateBtn.textContent = '⏳ 生成中...';

    // 显示结果区域
    DOM.resultPlaceholder.style.display = 'none';
    DOM.resultContent.style.display = 'block';
    DOM.errorBox.style.display = 'none';
    DOM.templateContent.innerHTML = '';
    DOM.loadingSpinner.style.display = 'block';

    // 移动端自动切换到结果面板
    if (STATE.isMobile) {
        switchMobilePanel('result');
    }

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_type: STATE.selectedType,
                question_subtype: DOM.subtypeSelect.value,
                topic: topic,
                knowledge_module: DOM.moduleSelect.value,
                difficulty: DOM.difficultySelect.value
            })
        });

        // 检查响应是否为 JSON（隧道断线会返回 HTML）
        const contentType = response.headers.get('Content-Type') || '';
        const text = await response.text();

        if (!contentType.includes('application/json')) {
            // 响应不是 JSON，很可能是隧道断线返回的 HTML 错误页
            if (text.includes('no tunnel') || text.includes('Cannot GET') || text.includes('<html')) {
                showError('连接已断开（公网隧道可能已刷新），请重新打开/刷新本页面');
            } else {
                showError(`服务器返回异常: ${text.substring(0, 200)}`);
            }
            return;
        }

        const data = JSON.parse(text);

        if (data.success) {
            STATE.currentTemplate = data.template;
            renderTemplate(data.template);
            saveToHistory(topic, STATE.selectedType);

            // 移动端显示红点提醒
            if (STATE.isMobile && STATE.activePanel === 'config') {
                DOM.resultBadge.style.display = 'block';
            }
        } else {
            showError(data.error || '生成失败，请重试');
        }
    } catch (err) {
        showError(`网络错误: ${err.message}`);
    } finally {
        STATE.isGenerating = false;
        DOM.generateBtn.disabled = false;
        DOM.generateBtn.textContent = '✨ 生成答题模板';
        DOM.loadingSpinner.style.display = 'none';
    }
}

function showError(msg) {
    DOM.errorBox.style.display = 'block';
    DOM.errorBox.textContent = '❌ ' + msg;
    DOM.templateContent.innerHTML = '';
    // 滚动到错误提示
    DOM.errorBox.scrollIntoView({ behavior: 'smooth' });
}


// ============================================================
// 轻量 Markdown → HTML
// ============================================================
function parseMarkdown(text) {
    if (!text) return '';

    let html = escapeHtml(text);

    // 粗体 **text** 或 __text__
    html = html.replace(/\*\*([^*]+)\*\*/g, '<span class="md-bold">$1</span>');
    html = html.replace(/__([^_]+)__/g, '<span class="md-bold">$1</span>');

    // 斜体 *text*
    html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<span class="md-italic">$1</span>');

    // 引用块 > text（按行处理）
    html = html.replace(/^&gt;\s*(.+)$/gm, '<span class="md-quote">$1</span>');

    // 分隔线 --- 或 ***
    html = html.replace(/^(---|\*\*\*)\s*$/gm, '<span class="md-divider"></span>');

    // 有序列表（处理常见的 1. 2. 3. 或 ① ② ③）
    html = html.replace(/^(\d+[\.、])\s*(.+)$/gm, '<span class="md-ordered-item"><strong>$1</strong> $2</span>');

    // 标题 ## Heading
    html = html.replace(/^##\s+(.+)$/gm, '<span class="md-heading">$1</span>');
    html = html.replace(/^###\s+(.+)$/gm, '<span class="md-heading">$1</span>');

    return html;
}


// ============================================================
// 高亮填空占位符
// ============================================================
function highlightBlanks(text) {
    return text.replace(/【([^】]+)】/g, '<span class="highlight-blank">【$1】</span>');
}


// ============================================================
// 渲染模板
// ============================================================
function renderTemplate(template) {
    const sections = [];

    if (template.thinking_approach) {
        sections.push({
            icon: '💡',
            title: '答题思路',
            content: parseMarkdown(template.thinking_approach)
        });
    }

    if (template.framework) {
        sections.push({
            icon: '📋',
            title: '模板框架',
            content: highlightBlanks(parseMarkdown(template.framework))
        });
    }

    if (template.keywords) {
        sections.push({
            icon: '🏷️',
            title: '关键术语',
            content: parseMarkdown(template.keywords)
        });
    }

    if (template.example) {
        sections.push({
            icon: '📝',
            title: '完整示例',
            content: parseMarkdown(template.example)
        });
    }

    if (template.scoring_tips) {
        sections.push({
            icon: '⭐',
            title: '得分要点',
            content: parseMarkdown(template.scoring_tips)
        });
    }

    DOM.templateContent.innerHTML = sections.map(s => `
        <div class="template-section">
            <h4>${s.icon} ${s.title}</h4>
            <div class="content">${s.content}</div>
        </div>
    `).join('');

    // 滚动到结果顶部
    DOM.resultContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ============================================================
// 复制功能
// ============================================================
async function handleCopy() {
    if (!STATE.currentTemplate) return;

    const t = STATE.currentTemplate;
    const fullText = [
        '========================================',
        '  高中地理大题答题模板',
        '========================================',
        '',
        '【答题思路】',
        t.thinking_approach || '',
        '',
        '【模板框架】',
        t.framework || '',
        '',
        '【关键术语】',
        t.keywords || '',
        '',
        '【完整示例】',
        t.example || '',
        '',
        '【得分要点】',
        t.scoring_tips || '',
        '',
        '--- 由 AI 生成，仅供教学参考 ---'
    ].join('\n');

    try {
        await navigator.clipboard.writeText(fullText);
        const origText = DOM.copyBtn.textContent;
        DOM.copyBtn.textContent = '✅ 已复制';
        DOM.copyBtn.style.color = 'var(--success)';
        setTimeout(() => {
            DOM.copyBtn.textContent = origText;
            DOM.copyBtn.style.color = '';
        }, 2000);
    } catch {
        // 降级方案：使用传统方法
        const textarea = document.createElement('textarea');
        textarea.value = fullText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        const origText = DOM.copyBtn.textContent;
        DOM.copyBtn.textContent = '✅ 已复制';
        DOM.copyBtn.style.color = 'var(--success)';
        setTimeout(() => {
            DOM.copyBtn.textContent = origText;
            DOM.copyBtn.style.color = '';
        }, 2000);
    }
}


// ============================================================
// 打印功能
// ============================================================
function handlePrint() {
    window.print();
}


// ============================================================
// 历史记录（localStorage）
// ============================================================
const HISTORY_KEY = 'geography_template_history';
const MAX_HISTORY = 20;

function saveToHistory(topic, questionType) {
    try {
        let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        history.unshift({
            topic: topic,
            type: questionType,
            typeLabel: STATE.questionTypes[questionType]?.label || questionType,
            time: new Date().toLocaleString('zh-CN')
        });
        // 去重 + 限制数量
        const seen = new Set();
        history = history.filter(item => {
            const key = `${item.topic}|${item.type}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        }).slice(0, MAX_HISTORY);

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        renderHistory();
    } catch (e) {
        // localStorage 不可用时静默失败
    }
}

function renderHistory() {
    try {
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        if (history.length === 0) {
            DOM.historySection.style.display = 'none';
            return;
        }

        DOM.historySection.style.display = 'block';
        DOM.historyList.innerHTML = history.map((h, i) => `
            <div class="history-item" data-index="${i}" title="点击加载此题目">
                <div class="hi-type">${escapeHtml(h.typeLabel)}</div>
                <div class="hi-topic">${escapeHtml(h.topic)}</div>
                <div class="hi-time">${h.time}</div>
            </div>
        `).join('');

        DOM.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                const h = history[idx];
                DOM.topicInput.value = h.topic;
                selectType(h.type);
                // 移动端切换回配置面板
                if (STATE.isMobile) {
                    switchMobilePanel('config');
                }
                DOM.topicInput.scrollIntoView({ behavior: 'smooth' });
                DOM.topicInput.focus();
            });
        });
    } catch (e) {
        DOM.historySection.style.display = 'none';
    }
}

function handleClearHistory() {
    if (confirm('确定要清空所有历史记录吗？')) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistory();
    }
}


// ============================================================
// HTML 转义
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
