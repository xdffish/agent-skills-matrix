import {
  ExtensionToWebviewMsg,
  LocalPrivateSkillItem,
  MatrixData,
  PublicSkillItem,
  WebviewToExtensionMsg
} from '../types/skills';
import { MARKETPLACE_CATALOG, MarketplaceSkill } from '../types/marketplace';

declare function acquireVsCodeApi(): {
  postMessage(msg: WebviewToExtensionMsg): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

interface WebviewState {
  currentPerspective: string; // 'public', 'marketplace', or agent.id
  searchQuery: string;
  partition2Filter: 'all' | 'enabled' | 'disabled';
  marketCategory: string;
  matrixData: MatrixData | null;
}

let state: WebviewState = {
  currentPerspective: 'public',
  searchQuery: '',
  partition2Filter: 'all',
  marketCategory: 'all',
  matrixData: null
};

// DOM references
const headerBadge = document.getElementById('header-status-badge') as HTMLElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const addSkillBtn = document.getElementById('add-skill-btn') as HTMLButtonElement;
const skillsShBtn = document.getElementById('skills-sh-btn') as HTMLButtonElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const clearSearchBtn = document.getElementById('clear-search-btn') as HTMLButtonElement;
const viewTabsBar = document.getElementById('view-tabs') as HTMLElement;
const mainContent = document.getElementById('main-content') as HTMLElement;
const loadingBar = document.getElementById('loading-bar') as HTMLElement;
const toastContainer = document.getElementById('toast-container') as HTMLElement;

// Add Modal references
const addModal = document.getElementById('add-modal') as HTMLElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;
const modalCancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement;
const addSkillForm = document.getElementById('add-skill-form') as HTMLFormElement;
const pkgInput = document.getElementById('pkg-input') as HTMLInputElement;
const agentCheckboxes = document.getElementById('agent-checkboxes') as HTMLElement;

function init() {
  refreshBtn?.addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  skillsShBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'openExternalUrl', payload: { url: 'https://skills.sh' } });
  });

  searchInput?.addEventListener('input', e => {
    state.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
    if (clearSearchBtn) clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    render();
  });

  clearSearchBtn?.addEventListener('click', () => {
    state.searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    render();
  });

  addSkillBtn?.addEventListener('click', () => openAddModal());
  modalCloseBtn?.addEventListener('click', closeAddModal);
  modalCancelBtn?.addEventListener('click', closeAddModal);
  addModal?.addEventListener('click', e => { if (e.target === addModal) closeAddModal(); });

  addSkillForm?.addEventListener('submit', e => {
    e.preventDefault();
    const pkg = pkgInput.value.trim();
    if (!pkg) return;
    const selected: string[] = [];
    agentCheckboxes.querySelectorAll<HTMLInputElement>('input:checked').forEach(cb => selected.push(cb.value));
    vscode.postMessage({ type: 'installSkill', payload: { packageName: pkg, agents: selected } });
    closeAddModal();
    pkgInput.value = '';
  });
}

function openAddModal(prefillPkg?: string) {
  if (!state.matrixData) return;
  agentCheckboxes.innerHTML = '';
  state.matrixData.agents.filter(a => a.isDetected).forEach(agent => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `
      <input type="checkbox" value="${agent.id}" checked>
      <span style="color:${agent.color}">●</span>
      <span>${agent.name}</span>
    `;
    agentCheckboxes.appendChild(label);
  });
  if (prefillPkg) {
    pkgInput.value = prefillPkg;
  }
  addModal.classList.add('open');
  pkgInput.focus();
}

function closeAddModal() { addModal.classList.remove('open'); }

function showToast(status: 'info' | 'success' | 'warning' | 'error', message: string) {
  const t = document.createElement('div');
  t.className = `toast ${status}`;
  t.innerHTML = `<span>${status === 'success' ? '✓' : status === 'error' ? '✕' : 'ℹ'}</span><span>${message}</span>`;
  toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 200);
  }, 3500);
}

function renderTabs() {
  if (!state.matrixData) return;
  const { publicSkills, agents, agentDetails } = state.matrixData;
  viewTabsBar.innerHTML = '';

  // 1. Public Pool Tab
  const pubTab = document.createElement('div');
  pubTab.className = `tab-btn ${state.currentPerspective === 'public' ? 'active' : ''}`;
  pubTab.innerHTML = `
    <span>🌐 公共技能库</span>
    <span class="tab-badge">${publicSkills.length}</span>
  `;
  pubTab.addEventListener('click', () => {
    state.currentPerspective = 'public';
    renderTabs();
    render();
  });
  viewTabsBar.appendChild(pubTab);

  // 2. Marketplace Tab
  const marketTab = document.createElement('div');
  marketTab.className = `tab-btn ${state.currentPerspective === 'marketplace' ? 'active' : ''}`;
  marketTab.innerHTML = `
    <span>🛒 技能集市</span>
    <span class="tab-badge">${MARKETPLACE_CATALOG.length}</span>
  `;
  marketTab.addEventListener('click', () => {
    state.currentPerspective = 'marketplace';
    renderTabs();
    render();
  });
  viewTabsBar.appendChild(marketTab);

  // 3. Individual Agent Tabs
  agents.filter(a => a.isDetected).forEach(agent => {
    const detail = agentDetails[agent.id];
    const totalActive = detail ? detail.totalActiveCount : 0;
    const tab = document.createElement('div');
    tab.className = `tab-btn ${state.currentPerspective === agent.id ? 'active' : ''}`;
    tab.innerHTML = `
      <span class="tab-dot" style="background:${agent.color}"></span>
      <span>${agent.name}</span>
      <span class="tab-badge">${totalActive}</span>
    `;
    tab.addEventListener('click', () => {
      state.currentPerspective = agent.id;
      renderTabs();
      render();
    });
    viewTabsBar.appendChild(tab);
  });
}

function render() {
  if (!state.matrixData) return;
  if (state.currentPerspective === 'public') {
    renderPublicView();
  } else if (state.currentPerspective === 'marketplace') {
    renderMarketplaceView();
  } else {
    renderDedicatedAgentView(state.currentPerspective);
  }
}

// -------------------------------------------------------------
// Perspective 1: Public Matrix View
// -------------------------------------------------------------
function renderPublicView() {
  const { publicSkills, agents } = state.matrixData!;
  const detectedAgents = agents.filter(a => a.isDetected);

  const filtered = publicSkills.filter(s => {
    if (!state.searchQuery) return true;
    return s.name.toLowerCase().includes(state.searchQuery) ||
           (s.description || '').toLowerCase().includes(state.searchQuery);
  });

  headerBadge.textContent = `${filtered.length} / ${publicSkills.length} 公共技能`;

  let html = `
    <div class="matrix-container">
      <table class="matrix-table">
        <thead>
          <tr>
            <th class="col-skill">公共技能 (~/.agents/skills)</th>
  `;

  detectedAgents.forEach(a => {
    html += `<th class="col-agent" style="color:${a.color}">● ${a.name}</th>`;
  });
  html += `<th class="col-action">快捷批处理 / 管理</th></tr></thead><tbody>`;

  if (filtered.length === 0) {
    html += `<tr><td colspan="${detectedAgents.length + 2}" class="empty-state">没有匹配的公共技能</td></tr></tbody></table></div>`;
    mainContent.innerHTML = html;
    return;
  }

  filtered.forEach(skill => {
    html += `
      <tr>
        <td class="col-skill">
          <div class="skill-info">
            <div class="skill-title-row">
              <span class="skill-title" data-path="${skill.path}">${skill.name}</span>
              ${skill.hasYamlError ? `<span class="badge-tag badge-warning" title="${skill.yamlErrorMsg || 'YAML format warning'}">⚠️ YAML语法</span>` : ''}
              ${skill.isSymlinkInCentral ? `<span class="badge-tag badge-info" title="${skill.centralTarget}">外部软链</span>` : ''}
            </div>
            ${skill.description ? `<span class="skill-desc-text" title="${skill.description}">${skill.description}</span>` : ''}
          </div>
        </td>
    `;

    detectedAgents.forEach(a => {
      const st = skill.agentStates[a.id] || 'off';
      if (st === 'linked') {
        html += `<td class="col-agent"><span class="toggle-pill linked" data-action="toggle" data-skill="${skill.name}" data-agent="${a.id}" data-enable="false" title="已挂载软链，点击停用">ON</span></td>`;
      } else if (st === 'physical') {
        html += `<td class="col-agent"><span class="toggle-pill physical" title="当前为Agent私有实体文件夹，点击切换至该Agent视图进行治理" data-action="goto-agent" data-agent="${a.id}">🟠实体</span></td>`;
      } else if (st === 'broken') {
        html += `<td class="col-agent"><span class="toggle-pill broken" title="失效死链">⚠️死链</span></td>`;
      } else {
        html += `<td class="col-agent"><span class="toggle-pill off" data-action="toggle" data-skill="${skill.name}" data-agent="${a.id}" data-enable="true" title="未挂载，点击一键软链开启">OFF</span></td>`;
      }
    });

    html += `
        <td class="col-action">
          <button class="btn btn-secondary btn-sm" data-action="mount-all" data-skill="${skill.name}" title="一键全选挂载给所有已激活的 Agent">⚡全选</button>
          ${skill.hasYamlError ? `<button class="btn btn-warning btn-sm" data-action="fix-yaml" data-path="${skill.path}" data-skill="${skill.name}" title="自动修复 SKILL.md 中的 YAML 语法">🔧修复</button>` : ''}
          <button class="btn btn-danger btn-sm" data-action="delete-public" data-skill="${skill.name}" title="彻底从全机公共池与所有 Agent 中移除">🗑</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  mainContent.innerHTML = html;
  bindPublicEvents();
}

function bindPublicEvents() {
  mainContent.querySelectorAll<HTMLElement>('.skill-title').forEach(el => {
    el.addEventListener('click', () => {
      const p = el.getAttribute('data-path');
      if (p) vscode.postMessage({ type: 'openSkillFile', payload: { skillPath: `${p}/SKILL.md` } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="toggle"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      const agentId = el.getAttribute('data-agent')!;
      const enable = el.getAttribute('data-enable') === 'true';
      vscode.postMessage({ type: 'toggleAgentSkill', payload: { skillName, agentId, enabled: enable } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="goto-agent"]').forEach(el => {
    el.addEventListener('click', () => {
      const agentId = el.getAttribute('data-agent')!;
      state.currentPerspective = agentId;
      renderTabs();
      render();
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="mount-all"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      vscode.postMessage({ type: 'mountAllAgents', payload: { skillName } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="fix-yaml"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillPath = el.getAttribute('data-path')!;
      const skillName = el.getAttribute('data-skill')!;
      vscode.postMessage({ type: 'fixYamlSyntax', payload: { skillPath, skillName } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="delete-public"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      vscode.postMessage({ type: 'removePublicSkill', payload: { skillName } });
    });
  });
}

// -------------------------------------------------------------
// Perspective: Marketplace Gallery View
// -------------------------------------------------------------
function renderMarketplaceView() {
  const publicSkills = state.matrixData?.publicSkills || [];
  const categories = [
    { id: 'all', label: '全部' },
    { id: 'popular', label: '🔥 热门精选' },
    { id: 'dev', label: '🛠 编程开发' },
    { id: 'design', label: '🎨 视觉与设计' },
    { id: 'productivity', label: '⚡ 效率办公' },
    { id: 'cloud', label: '☁️ 云原生与运维' },
    { id: 'agent', label: '🤖 AI 与智能体' }
  ];

  const filtered = MARKETPLACE_CATALOG.filter(item => {
    if (state.marketCategory !== 'all' && item.category !== state.marketCategory) {
      return false;
    }
    if (!state.searchQuery) return true;
    const q = state.searchQuery;
    return (
      item.name.toLowerCase().includes(q) ||
      item.titleZh.toLowerCase().includes(q) ||
      item.descriptionZh.toLowerCase().includes(q) ||
      item.author.toLowerCase().includes(q) ||
      item.packageRef.toLowerCase().includes(q)
    );
  });

  headerBadge.textContent = `${filtered.length} / ${MARKETPLACE_CATALOG.length} 精选技能`;

  let html = `
    <div class="market-container">
      <div class="market-hero">
        <div>
          <div class="market-hero-title">
            <span>🛒 Agent Skills 开源精选集市</span>
            <span class="badge-tag badge-info">官方 & 社区聚合</span>
          </div>
          <div class="market-hero-desc">浏览与安装全网优质开源技能包，一键收录至公共库 (~/.agents/skills) 并挂载至各 Agent</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-secondary btn-sm" data-action="open-url" data-url="https://skills.sh" title="打开 skills.sh 官网全网技能库">
            🌐 浏览 skills.sh 官网 ↗
          </button>
        </div>
      </div>

      <div class="market-category-bar">
  `;

  categories.forEach(cat => {
    const isActive = state.marketCategory === cat.id;
    html += `
      <button class="filter-pill-btn ${isActive ? 'active' : ''}" data-cat="${cat.id}">
        ${cat.label}
      </button>
    `;
  });

  html += `</div>`;

  if (filtered.length === 0) {
    html += `<div class="empty-state">没有找到匹配的精选技能。您可以点击右上角【+ Install】直接输入任意 npm / GitHub 仓库地址进行安装。</div></div>`;
    mainContent.innerHTML = html;
    bindMarketEvents();
    return;
  }

  html += `<div class="market-grid">`;

  filtered.forEach(item => {
    const isInstalled = publicSkills.some(
      p => p.name.toLowerCase() === item.name.toLowerCase() ||
           p.name.toLowerCase() === item.id.toLowerCase() ||
           item.packageRef.toLowerCase().endsWith('/' + p.name.toLowerCase())
    );

    html += `
      <div class="market-card">
        <div>
          <div class="market-card-top">
            <div class="market-card-icon">${item.icon}</div>
            <div class="market-card-info">
              <div class="market-card-title">${item.titleZh}</div>
              <div class="market-card-author">
                <span>by ${item.author}</span>
                <span class="badge-tag" style="padding:1px 5px; font-size:9px;">${item.categoryLabel}</span>
              </div>
            </div>
          </div>
          <div class="market-card-desc" style="margin-top:8px;" title="${item.descriptionZh}">
            ${item.descriptionZh}
          </div>
        </div>

        <div class="market-card-footer">
          <div class="market-card-meta">
            ${item.stars ? `<span>⭐ ${item.stars}</span>` : ''}
            <span style="font-family:monospace; opacity:0.75;" title="包名引用: ${item.packageRef}">${item.packageRef.length > 20 ? item.packageRef.substring(0, 18) + '…' : item.packageRef}</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            ${item.githubUrl ? `
              <button class="btn btn-secondary btn-sm" data-action="open-url" data-url="${item.githubUrl}" title="查看源码与仓库" style="padding:2px 7px;">
                ↗
              </button>
            ` : ''}
            ${isInstalled ? `
              <button class="btn btn-secondary btn-sm" style="color:var(--success-color, #10B981); cursor:default;" title="该技能已存在于本机公共技能库中">
                ✓ 已收录
              </button>
            ` : `
              <button class="btn btn-primary btn-sm" data-action="install-market" data-pkg="${item.packageRef}" title="一键收录至公共库并选择挂载 Agent">
                📥 一键安装
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  mainContent.innerHTML = html;
  bindMarketEvents();
}

function bindMarketEvents() {
  mainContent.querySelectorAll<HTMLElement>('.filter-pill-btn[data-cat]').forEach(el => {
    el.addEventListener('click', () => {
      state.marketCategory = el.getAttribute('data-cat') || 'all';
      render();
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="open-url"]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = el.getAttribute('data-url');
      if (url) vscode.postMessage({ type: 'openExternalUrl', payload: { url } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="install-market"]').forEach(el => {
    el.addEventListener('click', () => {
      const pkg = el.getAttribute('data-pkg');
      if (pkg) {
        openAddModal(pkg);
      }
    });
  });
}

// -------------------------------------------------------------
// Perspective 2: Dedicated Agent View
// -------------------------------------------------------------
function renderDedicatedAgentView(agentId: string) {
  const detail = state.matrixData?.agentDetails[agentId];
  if (!detail) {
    mainContent.innerHTML = `<div class="empty-state">未探测到 Agent: ${agentId}</div>`;
    return;
  }
  const { agent, privateSkills, builtinSkills, linkedCount, brokenCount, totalActiveCount } = detail;
  const { publicSkills } = state.matrixData!;

  headerBadge.textContent = `${agent.name} 专属工作台 (${totalActiveCount} 个活跃技能)`;

  let html = `
    <div class="agent-view-container">
      <!-- Agent Meta Banner -->
      <div class="agent-meta-banner">
        <div class="agent-meta-info">
          <div><strong style="color:${agent.color}">● ${agent.name}</strong> • 活跃技能总数: <strong>${totalActiveCount}</strong></div>
          <div class="agent-meta-path">物理目录: ${agent.fullSkillsDir}</div>
        </div>
        <div class="action-buttons">
          ${brokenCount > 0 ? `<button class="btn btn-warning btn-sm" data-action="clean-broken" data-agent="${agent.id}">🧹 清理 ${brokenCount} 个失效死链</button>` : ''}
          ${privateSkills.length > 0 ? `<button class="btn btn-success btn-sm" data-action="normalize-all" data-agent="${agent.id}">⚡ 一键规范化全部私有技能</button>` : ''}
        </div>
      </div>
  `;

  // -----------------------------------------------------------
  // Partition 1: Private Physical Skills (if present)
  // -----------------------------------------------------------
  if (privateSkills.length > 0) {
    html += `
      <div class="section-card">
        <div class="section-header" data-action="toggle-section" title="点击折叠/展开本分区">
          <div class="section-title-wrap">
            <span class="section-collapse-indicator">▾</span>
            <span style="color:#F59E0B">🟠</span>
            <span class="section-title">分区一：私有实体技能治理 (${privateSkills.length})</span>
          </div>
          <span style="font-size:11px;color:var(--muted)">直接存储在本地物理目录，建议收编或转软链 (点击折叠)</span>
        </div>
        <div class="section-body">
    `;

    privateSkills.forEach(item => {
      html += `
        <div class="agent-skill-row">
          <div class="skill-main-info">
            <div class="skill-title-row">
              <span class="skill-title" data-path="${item.path}">📁 ${item.name}</span>
              ${item.kind === 'unique_physical' ? `<span class="badge-tag badge-warning">独苗: 公共池未收录</span>` : ''}
              ${item.kind === 'duplicate_physical' ? `<span class="badge-tag badge-info">冗余副本: 公共池已有</span>` : ''}
              ${item.kind === 'broken_symlink' ? `<span class="badge-tag badge-danger">失效死链</span>` : ''}
            </div>
            ${item.description ? `<span class="skill-desc-text">${item.description}</span>` : ''}
          </div>
          <div class="skill-row-actions">
            ${item.kind === 'unique_physical' ? `
              <button class="btn btn-success btn-sm" data-action="promote-private" data-skill="${item.name}" data-agent="${agent.id}">📥 收编入公共池</button>
              <button class="btn btn-danger btn-sm" data-action="delete-private" data-skill="${item.name}" data-agent="${agent.id}" data-kind="unique">🗑 删除独苗</button>
            ` : ''}
            ${item.kind === 'duplicate_physical' ? `
              <button class="btn btn-info btn-sm" data-action="dedup-private" data-skill="${item.name}" data-agent="${agent.id}">🔄 转为公共软链</button>
              <button class="btn btn-danger btn-sm" data-action="delete-private" data-skill="${item.name}" data-agent="${agent.id}" data-kind="dup">🗑 删此副本</button>
            ` : ''}
            ${item.kind === 'broken_symlink' ? `
              <button class="btn btn-danger btn-sm" data-action="delete-private" data-skill="${item.name}" data-agent="${agent.id}" data-kind="broken">🧹 清理死链</button>
            ` : ''}
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  // -----------------------------------------------------------
  // Partition 2: Public Pool Selection for this Agent
  // -----------------------------------------------------------
  const unlinkedCount = publicSkills.length - linkedCount;
  const filteredPublic = publicSkills.filter(s => {
    const isMounted = s.agentStates[agent.id] === 'linked';
    if (state.partition2Filter === 'enabled' && !isMounted) return false;
    if (state.partition2Filter === 'disabled' && isMounted) return false;
    if (!state.searchQuery) return true;
    return s.name.toLowerCase().includes(state.searchQuery) ||
           (s.description || '').toLowerCase().includes(state.searchQuery);
  });

  html += `
    <div class="section-card">
      <div class="section-header" data-action="toggle-section" title="点击折叠/展开本分区">
        <div class="section-title-wrap">
          <span class="section-collapse-indicator">▾</span>
          <span style="color:#10B981">🟢</span>
          <span class="section-title">分区二：公共技能池装配与开关 (已挂载 ${linkedCount} / 共 ${publicSkills.length})</span>
        </div>
        <div class="partition2-filter-group" data-stop-propagation="true">
          <button class="filter-pill-btn ${state.partition2Filter === 'all' ? 'active' : ''}" data-p2-filter="all">全部 (${publicSkills.length})</button>
          <button class="filter-pill-btn ${state.partition2Filter === 'enabled' ? 'active' : ''}" data-p2-filter="enabled">🟢 已启用 (${linkedCount})</button>
          <button class="filter-pill-btn ${state.partition2Filter === 'disabled' ? 'active' : ''}" data-p2-filter="disabled">⚪ 未启用 (${unlinkedCount})</button>
        </div>
      </div>
      <div class="section-body">
  `;

  if (filteredPublic.length === 0) {
    html += `
      <div class="empty-state">
        <div>🔍 没有符合条件的技能</div>
        <p>${state.partition2Filter === 'enabled' ? '当前 Agent 暂无已启用的公共技能' : state.partition2Filter === 'disabled' ? '当前公共技能已全部挂载启用' : '无匹配技能'}</p>
      </div>
    `;
  } else {
    filteredPublic.forEach(skill => {
      const isMounted = skill.agentStates[agent.id] === 'linked';
      html += `
        <div class="agent-skill-row">
          <div class="skill-main-info">
            <div class="skill-title-row">
              <span class="skill-title" data-path="${skill.path}">${isMounted ? '🔗' : '⚪'} ${skill.name}</span>
              <span class="badge-tag ${isMounted ? 'badge-info' : ''}">${isMounted ? '已软链' : '未挂载'}</span>
            </div>
            ${skill.description ? `<span class="skill-desc-text">${skill.description}</span>` : ''}
          </div>
          <div class="skill-row-actions">
            <span class="toggle-pill ${isMounted ? 'linked' : 'off'}" data-action="toggle" data-skill="${skill.name}" data-agent="${agent.id}" data-enable="${!isMounted}">
              ${isMounted ? '🟢 已启用' : '⚪ 未启用'}
            </span>
            <button class="btn btn-danger btn-sm" data-action="delete-public" data-skill="${skill.name}" title="从公共池彻底移除该技能">🗑 全局删除</button>
          </div>
        </div>
      `;
    });
  }

  html += `</div></div>`;

  // -----------------------------------------------------------
  // Partition 3: Built-in & Plugins (Read-only)
  // -----------------------------------------------------------
  if (builtinSkills.length > 0) {
    html += `
      <div class="section-card collapsed">
        <div class="section-header" data-action="toggle-section" title="点击折叠/展开本分区">
          <div class="section-title-wrap">
            <span class="section-collapse-indicator">▾</span>
            <span>🔒</span>
            <span class="section-title">分区三：宿主系统内置与插件托管技能 (${builtinSkills.length})</span>
          </div>
          <span style="font-size:11px;color:var(--muted)">系统核心/插件扩展，只读防呆 (点击展开)</span>
        </div>
        <div class="section-body">
    `;

    builtinSkills.forEach(b => {
      html += `
        <div class="agent-skill-row">
          <div class="skill-main-info">
            <div class="skill-title-row">
              <span class="skill-title" data-path="${b.path}">🔒 ${b.name}</span>
              <span class="badge-tag badge-warning">${b.badgeText}</span>
            </div>
            ${b.description ? `<span class="skill-desc-text">${b.description}</span>` : ''}
          </div>
          <div class="skill-row-actions">
            <button class="btn btn-secondary btn-sm" data-action="view-source" data-path="${b.path}">📖 查看源码</button>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
  }

  html += `</div>`;
  mainContent.innerHTML = html;
  bindAgentEvents(agent.id);
}

function bindAgentEvents(agentId: string) {
  mainContent.querySelectorAll<HTMLElement>('.partition2-filter-group').forEach(group => {
    group.addEventListener('click', (e) => e.stopPropagation());
  });

  mainContent.querySelectorAll<HTMLElement>('[data-p2-filter]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.partition2Filter = btn.getAttribute('data-p2-filter') as any;
      render();
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="toggle-section"]').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.section-card');
      if (card) {
        card.classList.toggle('collapsed');
      }
    });
  });

  mainContent.querySelectorAll<HTMLElement>('.skill-title, [data-action="view-source"]').forEach(el => {
    el.addEventListener('click', () => {
      const p = el.getAttribute('data-path');
      if (p) vscode.postMessage({ type: 'openSkillFile', payload: { skillPath: `${p}/SKILL.md` } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="toggle"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      const enable = el.getAttribute('data-enable') === 'true';
      vscode.postMessage({ type: 'toggleAgentSkill', payload: { skillName, agentId, enabled: enable } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="promote-private"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      vscode.postMessage({ type: 'promotePrivateSkill', payload: { skillName, agentId } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="dedup-private"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      vscode.postMessage({ type: 'deduplicatePrivateSkill', payload: { skillName, agentId } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="normalize-all"]').forEach(el => {
    el.addEventListener('click', () => {
      vscode.postMessage({ type: 'normalizeAllAgentSkills', payload: { agentId } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="clean-broken"]').forEach(el => {
    el.addEventListener('click', () => {
      vscode.postMessage({ type: 'cleanBrokenSymlinks', payload: { agentId } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="delete-private"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      const kind = (el.getAttribute('data-kind') || 'unique_physical') as any;
      vscode.postMessage({ type: 'deletePrivateSkill', payload: { skillName, agentId, kind } });
    });
  });

  mainContent.querySelectorAll<HTMLElement>('[data-action="delete-public"]').forEach(el => {
    el.addEventListener('click', () => {
      const skillName = el.getAttribute('data-skill')!;
      vscode.postMessage({ type: 'removePublicSkill', payload: { skillName } });
    });
  });
}

// Extension message listener
window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMsg>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'setData':
      state.matrixData = msg.data;
      renderTabs();
      render();
      break;
    case 'setLoading':
      if (msg.loading) {
        loadingBar.classList.add('active');
      } else {
        loadingBar.classList.remove('active');
      }
      break;
    case 'notify':
      showToast(msg.status, msg.message);
      break;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  init();
  vscode.postMessage({ type: 'ready' });
});
