import {
  AgentDefinition,
  ExtensionToWebviewMsg,
  MatrixData,
  SkillItem,
  WebviewToExtensionMsg
} from '../types/skills';

// Acquire VS Code API
declare function acquireVsCodeApi(): {
  postMessage(msg: WebviewToExtensionMsg): void;
  getState(): any;
  setState(state: any): void;
};

const vscode = acquireVsCodeApi();

interface WebviewState {
  matrixData: MatrixData | null;
  searchQuery: string;
  selectedAgentFilter: string;
  scopeFilter: string;
}

let state: WebviewState = {
  matrixData: null,
  searchQuery: '',
  selectedAgentFilter: 'all',
  scopeFilter: 'all'
};

const pendingToggles = new Set<string>();

// DOM Elements
const totalBadge = document.getElementById('total-badge') as HTMLElement;
const refreshBtn = document.getElementById('refresh-btn') as HTMLButtonElement;
const addSkillBtn = document.getElementById('add-skill-btn') as HTMLButtonElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const clearSearchBtn = document.getElementById('clear-search-btn') as HTMLButtonElement;
const scopeSelect = document.getElementById('scope-select') as HTMLSelectElement;
const agentBar = document.getElementById('agent-bar') as HTMLElement;
const matrixHeadRow = document.getElementById('matrix-head-row') as HTMLElement;
const matrixBody = document.getElementById('matrix-body') as HTMLElement;
const loadingBar = document.getElementById('loading-bar') as HTMLElement;
const toastContainer = document.getElementById('toast-container') as HTMLElement;

// Modal Elements
const addModal = document.getElementById('add-modal') as HTMLElement;
const modalCloseBtn = document.getElementById('modal-close-btn') as HTMLButtonElement;
const modalCancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement;
const addSkillForm = document.getElementById('add-skill-form') as HTMLFormElement;
const pkgInput = document.getElementById('pkg-input') as HTMLInputElement;
const agentCheckboxesContainer = document.getElementById('agent-checkboxes') as HTMLElement;

// Initialize Event Listeners
function initEvents() {
  refreshBtn?.addEventListener('click', () => {
    vscode.postMessage({ type: 'refresh' });
  });

  searchInput?.addEventListener('input', e => {
    state.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
    if (clearSearchBtn) {
      clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    }
    renderTable();
  });

  clearSearchBtn?.addEventListener('click', () => {
    state.searchQuery = '';
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderTable();
  });

  scopeSelect?.addEventListener('change', e => {
    state.scopeFilter = (e.target as HTMLSelectElement).value;
    renderTable();
  });

  addSkillBtn?.addEventListener('click', () => {
    openAddModal();
  });

  modalCloseBtn?.addEventListener('click', () => {
    closeAddModal();
  });

  modalCancelBtn?.addEventListener('click', () => {
    closeAddModal();
  });

  addModal?.addEventListener('click', e => {
    if (e.target === addModal) {
      closeAddModal();
    }
  });

  addSkillForm?.addEventListener('submit', e => {
    e.preventDefault();
    const pkg = pkgInput.value.trim();
    if (!pkg) {
      showToast('error', 'Please enter a skill package name or URL');
      return;
    }

    const selectedAgents: string[] = [];
    const checkboxes = agentCheckboxesContainer.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
    checkboxes.forEach(cb => selectedAgents.push(cb.value));

    vscode.postMessage({
      type: 'installSkill',
      payload: {
        packageName: pkg,
        agents: selectedAgents,
        isGlobal: true
      }
    });

    closeAddModal();
    pkgInput.value = '';
  });
}

function openAddModal() {
  if (!state.matrixData) return;
  agentCheckboxesContainer.innerHTML = '';
  const detectedAgents = state.matrixData.agents.filter(a => a.isDetected);

  detectedAgents.forEach(agent => {
    const label = document.createElement('label');
    label.className = 'checkbox-label';
    label.innerHTML = `
      <input type="checkbox" value="${agent.id}" checked>
      <span style="color:${agent.color}">●</span>
      <span>${agent.name}</span>
    `;
    agentCheckboxesContainer.appendChild(label);
  });

  addModal.classList.add('open');
  pkgInput.focus();
}

function closeAddModal() {
  addModal.classList.remove('open');
}

function showToast(status: 'info' | 'success' | 'warning' | 'error', message: string) {
  const toast = document.createElement('div');
  toast.className = `toast ${status}`;
  toast.innerHTML = `
    <span>${status === 'success' ? '✓' : status === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

function renderAgentBar(agents: AgentDefinition[], skills: SkillItem[]) {
  agentBar.innerHTML = '';

  // "All" Chip
  const allChip = document.createElement('div');
  allChip.className = `agent-chip ${state.selectedAgentFilter === 'all' ? 'selected' : ''}`;
  allChip.innerHTML = `
    <span class="dot" style="background:#94A3B8"></span>
    <span>All (${skills.length})</span>
  `;
  allChip.addEventListener('click', () => {
    state.selectedAgentFilter = 'all';
    renderAgentBar(agents, skills);
    renderTable();
  });
  agentBar.appendChild(allChip);

  // Individual detected agents
  const detected = agents.filter(a => a.isDetected);
  detected.forEach(agent => {
    const count = skills.filter(s =>
      s.agents.some(sa => sa.toLowerCase() === agent.name.toLowerCase() || sa.toLowerCase() === agent.id.toLowerCase())
    ).length;

    const chip = document.createElement('div');
    chip.className = `agent-chip ${state.selectedAgentFilter === agent.id ? 'selected' : ''}`;
    chip.innerHTML = `
      <span class="dot" style="background:${agent.color}"></span>
      <span>${agent.name} (${count})</span>
    `;
    chip.addEventListener('click', () => {
      state.selectedAgentFilter = state.selectedAgentFilter === agent.id ? 'all' : agent.id;
      renderAgentBar(agents, skills);
      renderTable();
    });
    agentBar.appendChild(chip);
  });
}

function renderTable() {
  if (!state.matrixData) return;
  const { skills, agents } = state.matrixData;
  const detectedAgents = agents.filter(a => a.isDetected);

  // 1. Filter skills
  let filtered = skills.filter(skill => {
    // Search filter
    if (state.searchQuery) {
      const matchName = skill.name.toLowerCase().includes(state.searchQuery);
      const matchDesc = (skill.description || '').toLowerCase().includes(state.searchQuery);
      if (!matchName && !matchDesc) return false;
    }
    // Scope filter
    if (state.scopeFilter !== 'all' && skill.scope !== state.scopeFilter) {
      return false;
    }
    // Agent filter
    if (state.selectedAgentFilter !== 'all') {
      const targetAgent = agents.find(a => a.id === state.selectedAgentFilter);
      if (targetAgent) {
        const isMounted = skill.agents.some(
          a => a.toLowerCase() === targetAgent.name.toLowerCase() || a.toLowerCase() === targetAgent.id.toLowerCase()
        );
        if (!isMounted) return false;
      }
    }
    return true;
  });

  totalBadge.textContent = `${filtered.length} / ${skills.length} Skills`;

  // 2. Render Header Row
  matrixHeadRow.innerHTML = `
    <th class="col-skill">Skill (${filtered.length})</th>
  `;
  detectedAgents.forEach(agent => {
    const th = document.createElement('th');
    th.className = 'col-agent';
    th.innerHTML = `<span style="color:${agent.color}">●</span> ${agent.name}`;
    matrixHeadRow.appendChild(th);
  });

  const actionTh = document.createElement('th');
  actionTh.className = 'col-action';
  actionTh.textContent = 'Action';
  matrixHeadRow.appendChild(actionTh);

  // 3. Render Body Rows
  matrixBody.innerHTML = '';
  if (filtered.length === 0) {
    matrixBody.innerHTML = `
      <tr>
        <td colspan="${detectedAgents.length + 2}" class="empty-state">
          <div>🔍 No skills match your filter criteria</div>
          <p>Try clearing your search query or switching scope filters.</p>
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(skill => {
    const tr = document.createElement('tr');

    // Skill Info Column
    const tdSkill = document.createElement('td');
    tdSkill.className = 'col-skill';

    const info = document.createElement('div');
    info.className = 'skill-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'skill-title-row';

    const title = document.createElement('span');
    title.className = 'skill-title';
    title.textContent = skill.name;
    title.title = skill.path ? `Reveal: ${skill.path}` : skill.name;
    title.addEventListener('click', () => {
      if (skill.path) {
        vscode.postMessage({
          type: 'openSkillPath',
          payload: { skillPath: skill.path }
        });
      }
    });

    const scopeBadge = document.createElement('span');
    scopeBadge.className = 'tag-scope';
    scopeBadge.textContent = skill.scope;

    titleRow.appendChild(title);
    titleRow.appendChild(scopeBadge);
    info.appendChild(titleRow);

    if (skill.description) {
      const desc = document.createElement('div');
      desc.className = 'skill-desc-text';
      desc.textContent = skill.description;
      desc.title = skill.description;
      info.appendChild(desc);
    }

    tdSkill.appendChild(info);
    tr.appendChild(tdSkill);

    // Agent Matrix Cells
    detectedAgents.forEach(agent => {
      const tdAgent = document.createElement('td');
      tdAgent.className = 'col-agent';

      const toggleKey = `${skill.name}:${agent.id}`;
      const isPending = pendingToggles.has(toggleKey);

      const isMounted = skill.agents.some(
        a => a.toLowerCase() === agent.name.toLowerCase() || a.toLowerCase() === agent.id.toLowerCase()
      );

      const pill = document.createElement('div');
      pill.className = `toggle-pill ${isMounted ? 'active' : 'inactive'} ${isPending ? 'loading' : ''}`;
      pill.textContent = isPending ? '...' : isMounted ? 'ON' : 'OFF';

      pill.addEventListener('click', () => {
        if (isPending) return;

        // Optimistic UI update
        pendingToggles.add(toggleKey);
        pill.className = `toggle-pill ${!isMounted ? 'active' : 'inactive'} loading`;
        pill.textContent = '...';

        vscode.postMessage({
          type: 'toggleAgentSkill',
          payload: {
            skillName: skill.name,
            agentId: agent.id,
            enabled: !isMounted,
            isGlobal: skill.scope === 'global'
          }
        });
      });

      tdAgent.appendChild(pill);
      tr.appendChild(tdAgent);
    });

    // Action Column (Remove Skill)
    const tdAction = document.createElement('td');
    tdAction.className = 'col-action';

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-icon-btn';
    deleteBtn.innerHTML = '🗑';
    deleteBtn.title = `Remove ${skill.name}`;
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Are you sure you want to completely remove "${skill.name}"?`)) {
        vscode.postMessage({
          type: 'removeSkill',
          payload: {
            skillName: skill.name,
            isGlobal: skill.scope === 'global'
          }
        });
      }
    });

    tdAction.appendChild(deleteBtn);
    tr.appendChild(tdAction);

    matrixBody.appendChild(tr);
  });
}

// Extension Message Listener
window.addEventListener('message', (event: MessageEvent<ExtensionToWebviewMsg>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'setData':
      state.matrixData = msg.data;
      pendingToggles.clear();
      renderAgentBar(msg.data.agents, msg.data.skills);
      renderTable();
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

// Start lifecycle
document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  vscode.postMessage({ type: 'ready' });
});
