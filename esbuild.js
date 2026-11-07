const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions[]} */
const configs = [
  // 1. Extension Host Bundle (Node.js)
  {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: !isProduction,
    minify: isProduction,
    logLevel: 'info'
  },
  // 2. Webview Client Bundle (Browser IIFE)
  {
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    outfile: 'dist/webview.js',
    format: 'iife',
    platform: 'browser',
    target: ['es2022', 'chrome100'],
    sourcemap: !isProduction,
    minify: isProduction,
    logLevel: 'info'
  },
  // 3. CLI Integration Test Runner (Node.js)
  {
    entryPoints: ['src/test/testCliRunner.ts'],
    bundle: true,
    outfile: 'dist/test-cli.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    sourcemap: true,
    logLevel: 'info'
  }
];

async function main() {
  if (isWatch) {
    for (const config of configs) {
      const ctx = await esbuild.context(config);
      await ctx.watch();
    }
    console.log('👀 Watching for changes in Extension & Webview...');
  } else {
    for (const config of configs) {
      await esbuild.build(config);
    }
    console.log('✅ Build completed successfully.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
