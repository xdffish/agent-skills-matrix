# Agent Skills Matrix

[![Version](https://img.shields.io/badge/version-0.5.4-blue.svg)](https://github.com/xdffish/agent-skills-matrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 中文介绍

**Agent Skills Matrix** 是一个用于查看和管理 AI Agent 技能的 VS Code 兼容扩展。它通过读取本机文件系统，集中展示公共技能、各 Agent 的技能以及当前项目中的技能。

主要功能：

- **公共技能矩阵**：查看公共技能池，并为已发现的 Agent 挂载或解除软链接。
- **Agent 专属视图**：查看私有技能、公共池挂载状态，以及扫描到的系统和插件技能。
- **当前项目**：只读浏览工作区 `.github/skills`、`.agents/skills` 和 `.claude/skills` 中的技能。
- **技能集市**：通过 `npx skills` 安装精选技能包，并选择目标 Agent。
- **双视图**：侧边栏提供紧凑视图，编辑器主区域提供更宽的管理面板。
- **搜索与中文说明**：按名称或描述搜索，鼠标悬停可查看完整说明。

扩展目前支持扫描 Antigravity、Cursor、Codex、Claude Code、WorkBuddy、Trae、Warp、Hermes Agent 和 GitHub Copilot 的预设目录。扫描到文件表示它存在于磁盘上，并不保证对应 Agent 或当前会话已经加载该技能；插件缓存中也可能包含未启用的版本。

### 安装

在 VS Code 或兼容编辑器中打开命令面板，选择 **Extensions: Install from VSIX...**，然后选择项目打包生成的 `agent-skills-matrix-0.5.4.vsix`。安装后可从左侧活动栏打开；点击侧栏标题栏按钮或状态栏的 **Skills Matrix**，可打开编辑器区域中的大面板。

项目技能视图目前仅支持本地工作区，Windows 特定路径和目录链接行为尚未在 Windows 实机验证。

---

Agent Skills Matrix is a VS Code-compatible extension for inspecting and managing skill directories across multiple AI agents. It reads filesystem state directly and uses `npx skills` for package installation.

## Features

- **Public skills matrix:** Inspect entries in `~/.agents/skills` and connect or disconnect them from detected agent directories. External links, broken links, and physical directories are shown separately.
- **Agent views:** Inspect private skills, public pool links, and discovered built-in or plugin skills. Supported plugin locations are scanned from local caches and shown read-only.
- **Current project:** Browse skills found in `.github/skills`, `.agents/skills`, and `.claude/skills` under each open local workspace folder. Project entries are read-only and retain their source path.
- **Marketplace:** Browse curated packages, install through `npx skills`, and choose target agents. If the installation adds no identifiable new skill, you can choose existing public skills to mount.
- **Compact sidebar and editor panel:** Use the Activity Bar for a compact view, or open the dashboard in the editor area from the sidebar title or status bar.
- **Search and descriptions:** Search by name or description, and hover over truncated descriptions to read them.

Detected files indicate what exists on disk; they do **not** prove that a particular agent or session has loaded or enabled a skill. Cached plugin entries may include inactive versions.

## Supported agent directories

The extension checks paths relative to the current user's home directory:

| Agent | Skills directory |
| --- | --- |
| Antigravity | `~/.gemini/config/skills` |
| Cursor | `~/.cursor/skills` |
| Codex | `~/.codex/skills` |
| Claude Code | `~/.claude/skills` |
| WorkBuddy | `~/.workbuddy/skills` |
| Trae | `~/.trae/skills` |
| Warp | `~/.warp/skills` |
| Hermes Agent | `~/.hermes/skills` |
| GitHub Copilot | `~/.github/skills` if present, otherwise `~/.copilot/skills` |

Discovery is limited to implemented paths and cache layouts; custom locations are not currently configurable. The project view currently supports local workspace folders only. Windows-specific paths and junction behavior have not been verified on a Windows machine.

## Installation

Install a packaged `agent-skills-matrix-0.5.4.vsix` using **Extensions: Install from VSIX...** in the editor's Command Palette, or use its CLI:

```bash
code --install-extension agent-skills-matrix-0.5.4.vsix
cursor --install-extension agent-skills-matrix-0.5.4.vsix
```

The package has also been installed locally with the Antigravity IDE CLI; compatibility with other Antigravity distributions has not been verified. Reload the editor window after an update.

## Usage

1. Open **Skills Matrix** from the Activity Bar.
2. Use the sidebar title action or status bar button to open the larger editor-area dashboard.
3. Switch between the current project, public pool, marketplace, and agent views. Antigravity and Cursor hosts default to their respective agent view; other hosts default to the current project.
4. Use the public matrix or an agent view to manage links. Review conflicts before changing them.

Promoting a private skill moves its directory to the public pool and creates a link. Converting a same-name physical copy requires matching contents and keeps a backup of the original directory. Removing a public skill deletes its public entry after confirmation; the operation may partially complete if unlinking fails. Keep independent backups of important skills.

## Development

```bash
npm install
npm run compile
npm run type-check
npm run vsce:package
```

`npm run watch` rebuilds on changes. `npm run test:cli` runs the CLI runner against the local environment.

## License

MIT © [defuxu](https://github.com/defuxu)
