#!/usr/bin/env node
/**
 * scripts/publish-widget.mjs
 *
 * Build and publish the embeddable RAG widget package to npm.
 *
 * Usage:
 *   node scripts/publish-widget.mjs              # dry-run (prints commands only)
 *   node scripts/publish-widget.mjs --publish     # real publish
 *   node scripts/publish-widget.mjs --publish --tag next   # publish with dist-tag
 *
 * Prerequisites:
 *   - pnpm install already run
 *   - npm login (or NPM_TOKEN env var set for CI)
 *   - packages/widget/package.json has the correct name, version, files fields
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const WIDGET_DIR = resolve(ROOT, 'packages', 'widget');
const WIDGET_PKG = resolve(WIDGET_DIR, 'package.json');

// ── CLI flags ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const doPublish = args.includes('--publish');
const tag = (() => {
  const idx = args.indexOf('--tag');
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : 'latest';
})();

// ── Colours ────────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
};

function log(msg) {
  process.stdout.write(`${msg}\n`);
}

function step(label, fn) {
  log(`\n${c.cyan}▸${c.reset} ${c.bold}${label}${c.reset}`);
  return fn();
}

function run(cmd, opts = {}) {
  log(`  ${c.dim}$ ${cmd}${c.reset}`);
  if (doPublish || opts.always) {
    execSync(cmd, { stdio: 'inherit', cwd: opts.cwd ?? ROOT });
  } else {
    log(`  ${c.yellow}[dry-run] skipped${c.reset}`);
  }
}

// ── Pre-flight checks ──────────────────────────────────────────────────────
step('Pre-flight checks', () => {
  if (!existsSync(WIDGET_PKG)) {
    log(`${c.red}✖ Cannot find ${WIDGET_PKG}${c.reset}`);
    process.exit(1);
  }

  const pkg = JSON.parse(readFileSync(WIDGET_PKG, 'utf-8'));
  log(`  Package : ${c.bold}${pkg.name}${c.reset}`);
  log(`  Version : ${c.bold}${pkg.version}${c.reset}`);
  log(`  Tag     : ${c.bold}${tag}${c.reset}`);
  log(`  Mode    : ${doPublish ? `${c.green}PUBLISH${c.reset}` : `${c.yellow}DRY RUN${c.reset}`}`);

  if (!pkg.name) {
    log(`${c.red}✖ package.json is missing "name"${c.reset}`);
    process.exit(1);
  }
  if (!pkg.version) {
    log(`${c.red}✖ package.json is missing "version"${c.reset}`);
    process.exit(1);
  }
  if (!pkg.files || pkg.files.length === 0) {
    log(`${c.yellow}⚠  No "files" field — entire package will be published${c.reset}`);
  }

  // Check npm auth in publish mode
  if (doPublish) {
    try {
      execSync('npm whoami', { stdio: 'pipe' });
      const user = execSync('npm whoami', { encoding: 'utf-8' }).trim();
      log(`  npm user: ${c.bold}${user}${c.reset}`);
    } catch {
      if (process.env.NPM_TOKEN) {
        log(`  ${c.dim}Using NPM_TOKEN from environment${c.reset}`);
      } else {
        log(`${c.red}✖ Not logged in to npm. Run "npm login" or set NPM_TOKEN.${c.reset}`);
        process.exit(1);
      }
    }
  }
});

// ── Install dependencies ───────────────────────────────────────────────────
step('Install widget dependencies', () => {
  run('pnpm install --frozen-lockfile', { always: true, cwd: ROOT });
});

// ── Type-check ─────────────────────────────────────────────────────────────
step('TypeScript type-check', () => {
  run(`pnpm --filter @rag-starter-kit/widget exec tsc --noEmit`, { always: true });
});

// ── Build ──────────────────────────────────────────────────────────────────
step('Build widget package (tsup)', () => {
  run(`pnpm --filter @rag-starter-kit/widget run build`, { always: true });
});

// ── Verify dist ────────────────────────────────────────────────────────────
step('Verify dist output', () => {
  const distDir = resolve(WIDGET_DIR, 'dist');
  if (!existsSync(distDir)) {
    log(`${c.red}✖ dist/ directory not found — build may have failed${c.reset}`);
    process.exit(1);
  }
  log(`  ${c.green}✔${c.reset} dist/ exists`);
});

// ── Publish ────────────────────────────────────────────────────────────────
step(`Publish to npm (tag: ${tag})`, () => {
  const npmToken = process.env.NPM_TOKEN;
  const tokenFlag = npmToken ? `--//registry.npmjs.org/:_authToken=${npmToken}` : '';
  const tokenSetup = tokenFlag ? `npm config set ${tokenFlag} && ` : '';
  run(`${tokenSetup}npm publish --access public --tag ${tag}`, { cwd: WIDGET_DIR });
});

// ── Done ───────────────────────────────────────────────────────────────────
log(`\n${c.green}${c.bold}✔ Done!${c.reset}`);
if (!doPublish) {
  log(
    `\n${c.yellow}This was a dry-run. To publish for real, run:${c.reset}\n  ${c.bold}node scripts/publish-widget.mjs --publish${c.reset}\n`
  );
}
