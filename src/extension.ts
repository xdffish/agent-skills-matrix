import * as vscode from 'vscode';
import { SkillsCliService } from './services/skillsCliService';
import { MatrixWebviewProvider } from './views/matrixWebviewProvider';

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('Activating "agent-skills-matrix" extension...');

  const cliService = new SkillsCliService();
  const provider = new MatrixWebviewProvider(context.extensionUri, cliService);

  // Register Webview Provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      MatrixWebviewProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  // Register Refresh Command
  context.subscriptions.push(
    vscode.commands.registerCommand('agent-skills-matrix.refresh', async () => {
      await provider.refresh();
      vscode.window.showInformationMessage('Skills Matrix refreshed.');
    })
  );

  // Open the dashboard in the wide editor area instead of the narrow sidebar.
  context.subscriptions.push(
    vscode.commands.registerCommand('agent-skills-matrix.open', () => {
      vscode.commands.executeCommand('agent-skills-matrix.view.focus');
    })
  );

  // Register Status Bar Shortcut
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'agent-skills-matrix.open';
  statusBarItem.text = '$(circuit-board) Skills Matrix';
  statusBarItem.tooltip = 'Click to open Agent Skills Matrix Dashboard';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  console.log('"agent-skills-matrix" extension is now active!');
}

export function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
