const esbuild = require('esbuild');

const isWatch = process.argv.includes('--watch');
const isProduction = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions[]} */
const configs = [
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
    console.log('👀 Watching for changes...');
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
