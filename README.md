# Agent Skills Matrix

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/defuxu/agent-skills-matrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Powered by npx skills](https://img.shields.io/badge/Engine-npx%20skills-0ea5e9.svg)](https://skills.sh)
[![Compatible with Cursor & VS Code](https://img.shields.io/badge/IDE-Cursor%20%7C%20VS%20Code-6366f1.svg)](https://code.visualstudio.com/)

**Agent Skills Matrix** is a multi-agent skill dispatching and orchestration control center for **Cursor**, **VS Code**, and modern AI programming agents. Powered by the open industry-standard `npx skills` engine, it provides a unified matrix view to inspect, toggle, install, and manage skills across all AI agents on your machine.

---

## 🌟 Why Agent Skills Matrix?

Existing tools either operate as proprietary desktop apps (creating messy duplicate copies and broken paths) or single-purpose plugins limited only to the current editor.

**Agent Skills Matrix solves this once and for all:**
* **True Multi-Agent Matrix View**: Cross-agent visibility across Antigravity, Codex, Cursor, Claude Code, GitHub Copilot, and more.
* **100% Industry Standard Compliant**: Powered directly by `npx skills` and the open central repository (`~/.agents/skills`), utilizing transparent filesystem symlinks with zero proprietary database locks.
* **Optimistic Instant Toggling**: Connect or disconnect skills to specific agents with a single click `[ON]` / `[OFF]`.
* **Built-in System Guards**: Active protection against accidental mutation or deletion of critical agent runtimes (e.g. Codex `.system` dependencies).
* **Native VS Code & Cursor Ergonomics**: Deep integration with your active theme, keyboard shortcuts, Activity Bar, and status bar.

---

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────┐
│              Agent Skills Matrix UI                    │
│   (Matrix Dashboard • Real-time Search • Add Drawer)   │
└───────────────────────────┬────────────────────────────┘
                            │ Typed IPC (postMessage)
┌───────────────────────────▼────────────────────────────┐
│         Extension Host Service (TypeScript)            │
│   (Security Guards • Agent Detector • Atomic Symlinks) │
└───────────────────────────┬────────────────────────────┘
                            │ CLI / JSON Stream
┌───────────────────────────▼────────────────────────────┐
│             Standard Engine (npx skills)               │
│  ~/.agents/skills  ⇄  Antigravity | Codex | Cursor ... │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. Multi-Agent Matrix Dashboard
View all installed skills in a clean tabular grid. Columns represent detected AI agents with distinct color badges, and rows represent skills. Click any pill to mount or unmount that skill for a specific agent.

| Supported Agent | Default Skills Directory | Status |
| :--- | :--- | :--- |
| **Antigravity** | `~/.gemini/config/skills` | Auto-detected |
| **Codex** | `~/.codex/skills` | Auto-detected |
| **Cursor** | `~/.cursor/skills` | Auto-detected |
| **Claude Code** | `~/.claude/skills` | Auto-detected |
| **GitHub Copilot** | `~/.github/skills` | Auto-detected |
| **Hermes Agent** | `~/.hermes/skills` | Auto-detected |
| **Warp** | `~/.warp/skills` | Auto-detected |
| **Zed** | `~/.zed/skills` | Auto-detected |

### 2. Real-time Search & Multi-criteria Filtering
* **Instant Search**: Match by skill name or keywords inside `SKILL.md` description frontmatter.
* **Agent Filtering**: Click any agent tag in the toolbar to filter only skills mounted to that agent.
* **Scope Selector**: Switch between Global (`~/.agents`) and workspace project skills.

### 3. One-Click Package Installation Drawer
Click `+ Add` to open the package installer:
* Enter any package name (e.g., `vercel-labs/agent-skills`) or Git repository URL.
* Select target agents via checkboxes.
* Automatically syncs and refreshes the matrix upon completion.

### 4. Active Safety Shield
Built-in protection layer prevents accidental mutation or removal of critical system runtimes such as `.system`, `codex-primary-runtime`, and host infrastructure modules.

---

## 📦 Installation & Usage

### Method 1: Install from `.vsix` package (Direct)
1. Download the latest `agent-skills-matrix-x.x.x.vsix` from Releases.
2. In VS Code or Cursor:
   * Press `Cmd + Shift + P` (or `Ctrl + Shift + P`)
   * Select **Extensions: Install from VSIX...**
   * Choose the `.vsix` file.
   * Or run in terminal:
     ```bash
     code --install-extension agent-skills-matrix-0.1.0.vsix
     ```

### Method 2: From Source
```bash
# Clone the repository
git clone https://github.com/defuxu/agent-skills-matrix.git
cd agent-skills-matrix

# Install dependencies
npm install

# Build extension and webview bundles
npm run compile

# Package as .vsix
npm run vsce:package
```

---

## ⚙️ Commands & Shortcuts

* **Open Skills Matrix**: `agent-skills-matrix.open` (Click the matrix icon in Activity Bar or status bar)
* **Refresh Matrix**: `agent-skills-matrix.refresh`

---

## 🛠️ Development & Contributing

* `npm run compile`: Builds extension, webview, and test bundles via `esbuild`.
* `npm run watch`: Watches for file modifications.
* `npm run type-check`: Runs TypeScript type check with strict mode.
* `npm run test:cli`: Executes live integration test against `npx skills`.
* `npm run vsce:package`: Generates production `.vsix` bundle.

---

## 📄 License

MIT © [defuxu](https://github.com/defuxu)
