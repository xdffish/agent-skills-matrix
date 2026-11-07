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
              text: `${enabled ? 'Connecting' : 'Disconnecting'} ${skillName}...`
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
            this.sendMessage({
              type: 'setLoading',
              loading: true,
              text: `Removing ${skillName}...`
            });

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
          message: err?.message || 'Operation failed'
        });
        this.sendMessage({ type: 'setLoading', loading: false });
      }
    });
  }

  /**
   * Fetch current matrix data and push to Webview.
   */
  public async refresh() {
    if (!this._view) {
      return;
    }
    this.sendMessage({ type: 'setLoading', loading: true, text: 'Scanning skills matrix...' });
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
   * Generate cryptographic nonce for Content Security Policy.
   */
  private _getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Webview HTML markup loading compiled bundle with strict CSP.
   */
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
  <!-- Top Animated Loading Indicator -->
  <div id="loading-bar" class="loading-bar"></div>

  <div class="dashboard-header">
    <div class="top-bar">
      <div class="brand">
        <h1>Skills Matrix</h1>
        <span id="total-badge" class="count-chip">0 Skills</span>
      </div>
      <div class="action-buttons">
        <button id="add-skill-btn" class="btn btn-sm" title="Install New Skill">+ Add</button>
        <button id="refresh-btn" class="btn btn-secondary btn-sm" title="Refresh Skills">⟳</button>
      </div>
    </div>

    <!-- Toolbar: Search & Scope Filter -->
    <div class="toolbar">
      <div class="search-wrapper">
        <span class="search-icon">🔍</span>
        <input type="text" id="search-input" class="search-input" placeholder="Search skills or description...">
        <button id="clear-search-btn" class="clear-search">×</button>
      </div>
      <select id="scope-select" class="scope-select">
        <option value="all">All Scopes</option>
        <option value="global">Global (~/.agents)</option>
        <option value="project">Project</option>
      </select>
    </div>

    <!-- Agent Filter Pills -->
    <div id="agent-bar" class="agent-bar"></div>
  </div>

  <!-- Matrix Grid Table -->
  <div class="matrix-container">
    <table class="matrix-table">
      <thead>
        <tr id="matrix-head-row">
          <th class="col-skill">Skill</th>
        </tr>
      </thead>
      <tbody id="matrix-body">
        <tr>
          <td colspan="3" class="empty-state">
            <div>⚡ Connecting to standard npx skills engine...</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Add Skill Modal Drawer -->
  <div id="add-modal" class="modal-backdrop">
    <div class="modal-card">
      <div class="modal-header">
        <h2>Install New Skill Package</h2>
        <button id="modal-close-btn" class="modal-close">×</button>
      </div>
      <form id="add-skill-form">
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label" for="pkg-input">Package Name or Git URL</label>
            <input type="text" id="pkg-input" class="form-input" placeholder="e.g. vercel-labs/agent-skills or https://github.com/..." required>
          </div>
          <div class="form-group">
            <label class="form-label">Mount to Agents</label>
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

  <!-- Toast Container -->
  <div id="toast-container" class="toast-container"></div>

  <!-- Client Script -->
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
