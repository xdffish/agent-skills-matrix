/**
 * Curated open-source skills marketplace catalog
 */

export interface MarketplaceSkill {
  id: string;
  name: string;
  packageRef: string;
  author: string;
  category: 'popular' | 'dev' | 'design' | 'productivity' | 'cloud' | 'agent';
  categoryLabel: string;
  icon: string;
  titleZh: string;
  descriptionZh: string;
  officialUrl?: string;
  githubUrl?: string;
  stars?: string;
}

export const MARKETPLACE_CATALOG: MarketplaceSkill[] = [
  {
    id: 'vercel-agent-skills',
    name: 'vercel-agent-skills',
    packageRef: 'vercel-labs/agent-skills',
    author: 'Vercel Labs',
    category: 'popular',
    categoryLabel: '热门精选',
    icon: '▲',
    titleZh: 'Vercel 官方全套 Agent 核心技能包',
    descriptionZh: '包含前端优化、代码重构、PR审查、文档生成与现代 Web 最佳实践套件。',
    githubUrl: 'https://github.com/vercel-labs/agent-skills',
    stars: '12.8k'
  },
  {
    id: 'agent-reach',
    name: 'agent-reach',
    packageRef: 'https://github.com/Panniantong/Agent-Reach.git',
    author: 'Panniantong',
    category: 'popular',
    categoryLabel: '热门精选',
    icon: '🌐',
    titleZh: '免 Key 全网数据抓取与多平台解析中间件',
    descriptionZh: '本地直接运行，支持 GitHub、YouTube 字幕、社交平台、股票行情与网页正文高精提取。',
    githubUrl: 'https://github.com/Panniantong/Agent-Reach',
    stars: '6.4k'
  },
  {
    id: 'baoyu-skills',
    name: 'baoyu-skills',
    packageRef: 'https://github.com/baoyu-io/baoyu-skills.git',
    author: '宝玉',
    category: 'design',
    categoryLabel: '视觉与设计',
    icon: '🎨',
    titleZh: '宝玉 AI 视觉自媒体全套创作套件',
    descriptionZh: '一键将文章转化为小红书排版图文、公众号精美封面、SVG 技术架构图与演讲幻灯片。',
    githubUrl: 'https://github.com/baoyu-io/baoyu-skills',
    stars: '5.2k'
  },
  {
    id: 'playwright-skills',
    name: 'playwright-skills',
    packageRef: 'microsoft/playwright-agent-skills',
    author: 'Microsoft',
    category: 'dev',
    categoryLabel: '编程开发',
    icon: '🎭',
    titleZh: 'Playwright 浏览器自动化与 E2E 测试大师',
    descriptionZh: '驱动真实无头浏览器进行页面渲染测试、性能分析、网络请求捕获与跨端自动化。',
    githubUrl: 'https://github.com/microsoft/playwright',
    stars: '68k'
  },
  {
    id: 'tailwind-designer',
    name: 'tailwind-designer',
    packageRef: 'tailwindlabs/tailwindcss-skills',
    author: 'Tailwind Labs',
    category: 'design',
    categoryLabel: '视觉与设计',
    icon: '🌊',
    titleZh: 'Tailwind CSS 现代化前端 UI 架构设计',
    descriptionZh: '遵循 Tailwind v4 规范，快速构建响应式、符合色彩规范与暗色模式的高颜值组件。',
    githubUrl: 'https://github.com/tailwindlabs/tailwindcss',
    stars: '82k'
  },
  {
    id: 'cloudflare-workers',
    name: 'cloudflare-workers',
    packageRef: 'cloudflare/workers-skills',
    author: 'Cloudflare',
    category: 'cloud',
    categoryLabel: '云服务与运维',
    icon: '☁️',
    titleZh: 'Cloudflare 全球边缘计算与全栈架构套件',
    descriptionZh: '覆盖 Workers, KV, D1 SQL, R2 对象存储, AI Vectorize 与零信任 SASE 配置。',
    githubUrl: 'https://github.com/cloudflare/workers-sdk',
    stars: '15.3k'
  },
  {
    id: 'docker-devops',
    name: 'docker-devops',
    packageRef: 'docker/docker-agent-skills',
    author: 'Docker',
    category: 'cloud',
    categoryLabel: '云服务与运维',
    icon: '🐳',
    titleZh: 'Docker 容器化编排与生产级镜像优化',
    descriptionZh: '多阶段构建、Dockerfile 极速瘦身、Docker Compose 服务集群编排与健康检查。',
    githubUrl: 'https://github.com/docker/docker-ce',
    stars: '70k'
  },
  {
    id: 'supabase-fullstack',
    name: 'supabase-fullstack',
    packageRef: 'supabase/supabase-agent-skills',
    author: 'Supabase',
    category: 'dev',
    categoryLabel: '编程开发',
    icon: '⚡',
    titleZh: 'Supabase PostgreSQL 数据库与全栈开发',
    descriptionZh: 'PostgreSQL 架构设计、Row-Level-Security 行级权限安全、实时订阅与 Edge Functions。',
    githubUrl: 'https://github.com/supabase/supabase',
    stars: '75k'
  },
  {
    id: 'smithery-mcp-hub',
    name: 'smithery-mcp-hub',
    packageRef: 'smithery-ai/smithery-cli',
    author: 'Smithery',
    category: 'agent',
    categoryLabel: 'AI 与智能体',
    icon: '🔌',
    titleZh: 'Smithery 全网 MCP 协议服务器一键发现与挂载',
    descriptionZh: '快速发现并连接上千个基于 Model Context Protocol 的第三方能力服务与 API。',
    githubUrl: 'https://smithery.ai',
    stars: '4.8k'
  },
  {
    id: 'orca-desktop',
    name: 'orca-desktop',
    packageRef: 'stablyai/orca',
    author: 'Orca Team',
    category: 'agent',
    categoryLabel: 'AI 与智能体',
    icon: '🐋',
    titleZh: 'Orca 多工作树与跨 Agent 终端编排控制器',
    descriptionZh: '支持 Git Worktree 隔离开发环境、多智能体并行调度与桌面浏览器自动化。',
    githubUrl: 'https://github.com/stablyai/orca',
    stars: '3.9k'
  },
  {
    id: 'git-wizard',
    name: 'git-wizard',
    packageRef: 'git-workflow/agent-skills',
    author: 'Git Community',
    category: 'productivity',
    categoryLabel: '效率与办公',
    icon: '🌿',
    titleZh: 'Git 极客工作流与版本回溯重构工具',
    descriptionZh: '原子化 Commit 拆分、复杂冲突智能合并、语义化变更日志生成与安全 Rebase。',
    stars: '8.1k'
  },
  {
    id: 'nextjs-architect',
    name: 'nextjs-architect',
    packageRef: 'nextjs/nextjs-skills',
    author: 'Next.js Team',
    category: 'dev',
    categoryLabel: '编程开发',
    icon: '⚡',
    titleZh: 'Next.js 15 App Router 与服务端组件最佳实践',
    descriptionZh: '深入 React Server Components、流式 SSR、Server Actions 与极致 Core Web Vitals 调优。',
    githubUrl: 'https://nextjs.org',
    stars: '124k'
  }
];
