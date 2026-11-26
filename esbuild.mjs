import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

const extension = {
  ...common,
  entryPoints: ['src/extension/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
};

const webview = {
  ...common,
  entryPoints: {
    graph: 'src/webview/graph/main.tsx',
    sidebar: 'src/webview/sidebar/main.tsx',
  },
  outdir: 'dist/webview',
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': production ? '"production"' : '"development"' },
  loader: { '.ttf': 'file' },
};

function copyAssets() {
  mkdirSync('dist/media', { recursive: true });
  cpSync('node_modules/@vscode/codicons/dist/codicon.css', 'dist/media/codicon.css');
  cpSync('node_modules/@vscode/codicons/dist/codicon.ttf', 'dist/media/codicon.ttf');
}

copyAssets();
if (watch) {
  const ctxs = await Promise.all([esbuild.context(extension), esbuild.context(webview)]);
  await Promise.all(ctxs.map((c) => c.watch()));
} else {
  await Promise.all([esbuild.build(extension), esbuild.build(webview)]);
}
