import * as vscode from 'vscode';
import { SkillsCliService } from '../services/skillsCliService';
import {
  ExtensionToWebviewMsg,
  MatrixData,
  WebviewToExtensionMsg
} from '../types/skills';

export class MatrixWebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'agent-skills-matrix.view';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _cliService: SkillsCliService
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from Webview
    webviewView.webview.onDidReceiveMessage(async (data: WebviewToExtensionMsg) => {
      try {
        switch (data.type) {
          case 'ready':
          case 'refresh':
            await this.refresh();
            break;

          case 'toggleAgentSkill': {
            const { skillName, agentId, enabled, isGlobal } = data.payload;
            this.sendMessage({
              type: 'setLoading',
              loading: true,
              text: `Updating ${skillName} for ${agentId}...`
            });

            const res = await this._cliService.toggleAgentSkill(
              skillName,
              agentId,
              enabled,
              isGlobal
            );

            this.sendMessage({
              type: 'notify',
              status: res.success ? 'success' : 'error',
              message: res.message
            });

            await this.refresh();
            break;
          }

          case 'installSkill': {
            const { packageName, agents, isGlobal } = data.payload;
            this.sendMessage({
              type: 'setLoading',
              loading: true,
              text: `Installing ${packageName}...`
            });

            const res = await this._cliService.installSkill(
              packageName,
              agents,
              isGlobal
            );

            this.sendMessage({
              type: 'notify',
              status: 'success',
              message: res.message
            });

            await this.refresh();
            break;
          }

          case 'removeSkill': {
            const { skillName, isGlobal } = data.payload;
            const res = await this._cliService.removeSkill(skillName, isGlobal);
            this.sendMessage({
              type: 'notify',
              status: 'info',
              message: res.message
            });
            await this.refresh();
            break;
          }

          case 'openSkillPath': {
            if (data.payload.skillPath) {
              const uri = vscode.Uri.file(data.payload.skillPath);
              vscode.commands.executeCommand('revealInExplorer', uri);
            }
            break;
          }
        }
      } catch (err: any) {
        this.sendMessage({
          type: 'notify',
          status: 'error',
          message: err?.message || 'Unknown operation error'
        });
        this.sendMessage({ type: 'setLoading', loading: false });
      }
    });
  }

  /**
   * Fetch current data and push to Webview.
   */
  public async refresh() {
    if (!this._view) {
      return;
    }
    this.sendMessage({ type: 'setLoading', loading: true, text: 'Scanning skills...' });
    try {
      const data = await this._cliService.getMatrixData();
      this.sendMessage({ type: 'setData', data });
    } catch (err: any) {
      this.sendMessage({
        type: 'notify',
        status: 'error',
        message: `Failed to load skills: ${err?.message || err}`
      });
    } finally {
      this.sendMessage({ type: 'setLoading', loading: false });
    }
  }

  /**
   * Post message to Webview.
   */
  public sendMessage(message: ExtensionToWebviewMsg) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Webview HTML markup with native VS Code design tokens.
   */
  private _getHtmlForWebview(webview: vscode.Webview): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Skills Matrix</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-widget-border, #333333);
      --card-bg: var(--vscode-sideBar-background);
      --hover-bg: var(--vscode-list-hoverBackground);
      --btn-primary: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --badge-bg: var(--vscode-badge-background);
      --badge-fg: var(--vscode-badge-foreground);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      line-height: 1.4;
      padding: 12px;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .title {
      font-size: 14px;
      font-weight: 600;
    }

    .badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--badge-bg);
      color: var(--badge-fg);
      font-weight: normal;
    }

    .btn {
      background: var(--btn-primary);
      color: var(--btn-fg);
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .btn:hover {
      opacity: 0.9;
    }

    .stats-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      font-size: 11px;
      color: var(--muted);
    }

    .agent-pill-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
    }

    .agent-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .agent-tag .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .table-container {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--card-bg);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12px;
    }

    th, td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      font-weight: 500;
      white-space: nowrap;
    }

    tr:hover td {
      background: var(--hover-bg);
    }

    .skill-name {
      font-weight: 500;
      display: flex;
      flex-direction: column;
    }

    .skill-desc {
      font-size: 10px;
      color: var(--muted);
      margin-top: 2px;
      max-width: 200px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toggle-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
      user-select: none;
      font-weight: 600;
      text-align: center;
      transition: all 0.15s ease;
    }

    .toggle-badge.active {
      background: rgba(16, 185, 129, 0.2);
      color: #10B981;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .toggle-badge.inactive {
      background: rgba(148, 163, 184, 0.1);
      color: var(--muted);
      border: 1px solid transparent;
    }

    .toggle-badge:hover {
      transform: scale(1.05);
    }

    .loading-overlay {
      display: none;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
      font-size: 11px;
      color: #3B82F6;
    }

    .notification {
      display: none;
      padding: 6px 10px;
      border-radius: 4px;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .notification.success { background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid #10B981; }
    .notification.error { background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid #EF4444; }
    .notification.info { background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid #3B82F6; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <span class="title">Agent Skills Matrix</span>
      <span id="total-badge" class="badge">0 Skills</span>
    </div>
    <button id="refresh-btn" class="btn" title="Refresh Skills">⟳ Refresh</button>
  </div>

  <div id="loading" class="loading-overlay">
    <span>⏳ Loading and syncing skills...</span>
  </div>

  <div id="notification" class="notification"></div>

  <div class="stats-bar">
    <span id="detected-agents-count">Detected: 0 agents</span>
    <span>•</span>
    <span>Engine: npx skills</span>
  </div>

  <div id="agent-pills" class="agent-pill-list"></div>

  <div class="table-container">
    <table>
      <thead>
        <tr id="table-head-row">
          <th>Skill</th>
          <!-- Agent headers dynamically inserted -->
        </tr>
      </thead>
      <tbody id="table-body">
        <tr>
          <td colspan="4" style="text-align: center; color: var(--muted); padding: 24px;">
            Initializing Skills Matrix...
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentData = null;

    const refreshBtn = document.getElementById('refresh-btn');
    const loadingEl = document.getElementById('loading');
    const notificationEl = document.getElementById('notification');
    const totalBadge = document.getElementById('total-badge');
    const detectedAgentsEl = document.getElementById('detected-agents-count');
    const agentPillsEl = document.getElementById('agent-pills');
    const tableHeadRow = document.getElementById('table-head-row');
    const tableBody = document.getElementById('table-body');

    refreshBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    function showNotification(status, message) {
      notificationEl.className = 'notification ' + status;
      notificationEl.textContent = message;
      notificationEl.style.display = 'block';
      setTimeout(() => {
        notificationEl.style.display = 'none';
      }, 4000);
    }

    function renderMatrix(data) {
      currentData = data;
      totalBadge.textContent = data.totalSkills + ' Skills';
      detectedAgentsEl.textContent = 'Detected: ' + data.detectedAgentsCount + ' agents';

      // 1. Render Agent Pills
      agentPillsEl.innerHTML = '';
      data.agents.forEach(agent => {
        const pill = document.createElement('div');
        pill.className = 'agent-tag';
        pill.innerHTML = '<span class="dot" style="background:' + agent.color + '"></span>' +
                         '<span>' + agent.name + '</span>' +
                         (agent.isDetected ? ' <span style="opacity:0.6;font-size:9px;">✓</span>' : '');
        agentPillsEl.appendChild(pill);
      });

      // 2. Render Table Headers (Active detected agents)
      const visibleAgents = data.agents.filter(a => a.isDetected);
      tableHeadRow.innerHTML = '<th>Skill</th>';
      visibleAgents.forEach(agent => {
        const th = document.createElement('th');
        th.style.color = agent.color;
        th.textContent = agent.name;
        tableHeadRow.appendChild(th);
      });

      // 3. Render Table Rows
      tableBody.innerHTML = '';
      if (!data.skills || data.skills.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="' + (visibleAgents.length + 1) + '" style="text-align: center; color: var(--muted); padding: 20px;">No skills installed yet.</td></tr>';
        return;
      }

      data.skills.forEach(skill => {
        const tr = document.createElement('tr');

        // Skill cell
        const tdSkill = document.createElement('td');
        tdSkill.className = 'skill-name';
        tdSkill.innerHTML = '<span>' + skill.name + '</span>' +
                            (skill.description ? '<span class="skill-desc" title="' + skill.description + '">' + skill.description + '</span>' : '');
        tr.appendChild(tdSkill);

        // Agent toggle cells
        visibleAgents.forEach(agent => {
          const tdAgent = document.createElement('td');
          // Check if skill is active for this agent
          const isMounted = skill.agents.some(a => a.toLowerCase() === agent.name.toLowerCase() || a.toLowerCase() === agent.id.toLowerCase());

          const badge = document.createElement('span');
          badge.className = 'toggle-badge ' + (isMounted ? 'active' : 'inactive');
          badge.textContent = isMounted ? 'ON' : 'OFF';

          badge.addEventListener('click', () => {
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

          tdAgent.appendChild(badge);
          tr.appendChild(tdAgent);
        });

        tableBody.appendChild(tr);
      });
    }

    // Listen to messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      switch (message.type) {
        case 'setData':
          renderMatrix(message.data);
          break;
        case 'setLoading':
          loadingEl.style.display = message.loading ? 'flex' : 'none';
          if (message.text) {
            loadingEl.querySelector('span').textContent = message.text;
          }
          break;
        case 'notify':
          showNotification(message.status, message.message);
          break;
      }
    });

    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
