import * as vscode from 'vscode';
import { SkillsCliService } from '../services/skillsCliService';
import {
  ExtensionToWebviewMsg,
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

    webviewView.webview.onDidReceiveMessage(async (data: WebviewToExtensionMsg) => {
      try {
        switch (data.type) {
          case 'ready':
          case 'refresh':
            await this.refresh();
            break;

          case 'toggleAgentSkill': {
            const { skillName, agentId, enabled } = data.payload;
            this.sendMessage({
              type: 'setLoading',
              loading: true,
              text: `${enabled ? 'Linking' : 'Unlinking'} ${skillName}...`
            });
            const res = await this._cliService.toggleAgentSkill(skillName, agentId, enabled);
            this.sendMessage({ type: 'notify', status: res.success ? 'success' : 'error', message: res.message });
            await this.refresh();
            break;
          }

          case 'mountAllAgents': {
            const { skillName } = data.payload;
            this.sendMessage({ type: 'setLoading', loading: true, text: `Mounting ${skillName} to all agents...` });
            const res = await this._cliService.mountAllAgents(skillName);
            this.sendMessage({ type: 'notify', status: 'success', message: res.message });
            await this.refresh();
            break;
          }

          case 'promotePrivateSkill': {
            const { skillName, agentId } = data.payload;
            this.sendMessage({ type: 'setLoading', loading: true, text: `Promoting ${skillName} to Central Pool...` });
            const res = await this._cliService.promotePrivateSkill(skillName, agentId);
            this.sendMessage({ type: 'notify', status: 'success', message: res.message });
            await this.refresh();
            break;
          }

          case 'deduplicatePrivateSkill': {
            const { skillName, agentId } = data.payload;
            this.sendMessage({ type: 'setLoading', loading: true, text: `Deduplicating ${skillName}...` });
            const res = await this._cliService.deduplicatePrivateSkill(skillName, agentId);
            this.sendMessage({ type: 'notify', status: 'success', message: res.message });
            await this.refresh();
            break;
          }

          case 'normalizeAllAgentSkills': {
            const { agentId } = data.payload;
            const choice = await vscode.window.showInformationMessage(
              `确认将当前 Agent 的所有私有实体技能自动执行「独苗入库 + 冗余转软链」规范化吗？`,
              { modal: true },
              '开始规范化',
              '取消'
            );
            if (choice !== '开始规范化') return;

            this.sendMessage({ type: 'setLoading', loading: true, text: `Normalizing all skills for ${agentId}...` });
            const res = await this._cliService.normalizeAllAgentSkills(agentId);
            this.sendMessage({ type: 'notify', status: 'success', message: res.message });
            await this.refresh();
            break;
          }

          case 'deletePrivateSkill': {
            const { skillName, agentId } = data.payload;
            const choice = await vscode.window.showWarningMessage(
              `⚠️ 警告：该技能「${skillName}」在当前 Agent 目录下为实体文件。删除后将彻底物理销毁！确认删除吗？`,
              { modal: true },
              '彻底删除',
              '取消'
            );
            if (choice !== '彻底删除') return;

            this.sendMessage({ type: 'setLoading', loading: true, text: `Deleting ${skillName}...` });
            const res = await this._cliService.deletePrivateSkill(skillName, agentId);
            this.sendMessage({ type: 'notify', status: 'info', message: res.message });
            await this.refresh();
            break;
          }

          case 'cleanBrokenSymlinks': {
            const { agentId } = data.payload;
            const res = await this._cliService.cleanBrokenSymlinks(agentId);
            this.sendMessage({ type: 'notify', status: 'info', message: res.message });
            await this.refresh();
            break;
          }

          case 'removePublicSkill': {
            const { skillName } = data.payload;
            const choice = await vscode.window.showWarningMessage(
              `⚠️ 警告：确认将「${skillName}」从公共池完全物理删除并解除所有 Agent 挂载吗？`,
              { modal: true },
              '确认删除',
              '取消'
            );
            if (choice !== '确认删除') return;

            this.sendMessage({ type: 'setLoading', loading: true, text: `Removing ${skillName} from Central Pool...` });
            const res = await this._cliService.removePublicSkill(skillName);
            this.sendMessage({ type: 'notify', status: 'info', message: res.message });
            await this.refresh();
            break;
          }

          case 'installSkill': {
            const { packageName, agents } = data.payload;
            this.sendMessage({ type: 'setLoading', loading: true, text: `Installing ${packageName}...` });
            const res = await this._cliService.installSkill(packageName, agents);
            this.sendMessage({ type: 'notify', status: 'success', message: res.message });
            await this.refresh();
            break;
          }

          case 'openSkillFile': {
            if (data.payload.skillPath) {
              const uri = vscode.Uri.file(data.payload.skillPath);
              vscode.commands.executeCommand('vscode.open', uri);
            }
            break;
          }

          case 'fixYamlSyntax': {
            const { skillPath } = data.payload;
            const res = this._cliService.fixYamlSyntax(skillPath);
            this.sendMessage({ type: 'notify', status: 'success', message: res.message });
            await this.refresh();
            break;
          }

          case 'openExternalUrl': {
            if (data.payload.url) {
              vscode.env.openExternal(vscode.Uri.parse(data.payload.url));
            }
            break;
          }
        }
      } catch (err: any) {
        this.sendMessage({
          type: 'notify',
          status: 'error',
          message: err?.message || 'Operation failed'
        });
        this.sendMessage({ type: 'setLoading', loading: false });
      }
    });
  }

  public async refresh() {
    if (!this._view) return;
    this.sendMessage({ type: 'setLoading', loading: true, text: 'Scanning skills & agents...' });
    try {
      const data = await this._cliService.getMatrixData();
      this.sendMessage({ type: 'setData', data });
    } catch (err: any) {
      this.sendMessage({
        type: 'notify',
        status: 'error',
        message: `Failed to load: ${err?.message || err}`
      });
    } finally {
      this.sendMessage({ type: 'setLoading', loading: false });
    }
  }

  public sendMessage(message: ExtensionToWebviewMsg) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.css')
    );
    const nonce = this._getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Skills Matrix</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="loading-bar" class="loading-bar"></div>

  <!-- Header & Top Nav -->
  <div class="dashboard-header">
    <div class="top-bar">
      <div class="brand">
        <h1>Skills Matrix</h1>
        <span id="header-status-badge" class="count-chip">Loading...</span>
      </div>
      <div class="action-buttons">
        <button id="skills-sh-btn" class="btn btn-secondary btn-sm" title="浏览 skills.sh 官网技能市场">🌐 skills.sh ↗</button>
        <button id="add-skill-btn" class="btn btn-sm" title="Install New Skill">+ Install</button>
        <button id="refresh-btn" class="btn btn-secondary btn-sm" title="Refresh">⟳</button>
      </div>
    </div>

    <!-- Perspective View Navigation Tabs -->
    <div id="view-tabs" class="view-tabs-bar">
      <!-- Injected dynamically: Public Pool + Dedicated Agents -->
    </div>

    <!-- Search Toolbar -->
    <div class="toolbar">
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="search-input" class="search-input" placeholder="Search skills or description...">
        <button id="clear-search-btn" class="clear-search">×</button>
      </div>
      <div id="quick-filter-container">
        <!-- Injected filter dropdown or badges -->
      </div>
    </div>
  </div>

  <!-- Dynamic Main Content: Public Matrix View OR Dedicated Agent View -->
  <main id="main-content" class="main-content"></main>

  <!-- Add Skill Modal Drawer -->
  <div id="add-modal" class="modal-backdrop">
    <div class="modal-card">
      <div class="modal-header">
        <h2>Install Skill to Central Pool</h2>
        <button id="modal-close-btn" class="modal-close">×</button>
      </div>
      <form id="add-skill-form">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="pkg-input">Package / GitHub Repo / URL</label>
            <input type="text" id="pkg-input" class="form-input" placeholder="e.g. vercel-labs/agent-skills or owner/repo" required>
          </div>
          <div class="form-group">
            <label class="form-label">Auto-mount to Agents</label>
            <div id="agent-checkboxes" class="agent-checkbox-grid"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
          <button type="submit" class="btn">Install Package</button>
        </div>
      </form>
    </div>
  </div>

  <div id="toast-container" class="toast-container"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
