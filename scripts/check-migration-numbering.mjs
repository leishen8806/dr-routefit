#!/usr/bin/env node
// CMP-1417: migration numbering gate (pure file check, no DB, no npm deps).
// migrate.mjs records applied migrations by FILE NAME, so nothing else stops two
// files from sharing a number. This script fails closed on:
//   AC-1 duplicate numeric prefix; AC-2 gap in numbering (explicit exemption file only);
//   AC-3 any change/delete/rename/add touching the frozen range 001-064 vs the base ref.
// Not covered here (separate card): per-owner number-segment check.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FROZEN_MAX = 64;
export const MAX_NUMBER = 999; // migration numbers are exactly 3 digits (NAME_RE)
const NAME_RE = /^(\d{3})_[A-Za-z0-9_.-]+\.sql$/;

export function checkNames(files) {
  const errors = [];
  const byNum = new Map();
  for (const f of [...files].sort()) {
    const m = NAME_RE.exec(f);
    if (!m) { errors.push(`bad name (expected NNN_name.sql): ${f}`); continue; }
    const n = Number(m[1]);
    if (!byNum.has(n)) byNum.set(n, []);
    byNum.get(n).push(f);
  }
  for (const [n, list] of byNum) {
    if (list.length > 1) errors.push(`duplicate number ${String(n).padStart(3, '0')}: ${list.join(' <-> ')}`);
  }
  return { errors, numbers: [...byNum.keys()].sort((a, b) => a - b) };
}

// exemptions: [{ from, to?, reason, approvedBy }] — each gap number must be covered.
export function parseExemptions(text) {
  const errors = [];
  let data;
  try { data = JSON.parse(text); } catch (e) { return { errors: [`exemption file is not valid JSON: ${e.message}`], ranges: [] }; }
  if (!Array.isArray(data)) return { errors: ['exemption file must be a JSON array'], ranges: [] };
  const ranges = [];
  data.forEach((x, i) => {
    const from = x?.from, to = x?.to ?? x?.from;
    const inRange = (v) => Number.isSafeInteger(v) && v >= 1 && v <= MAX_NUMBER;
    if (!inRange(from) || !inRange(to) || to < from) errors.push(`exemption[${i}]: from/to must be safe integers within 1..${MAX_NUMBER}, to>=from`);
    else if (typeof x.reason !== 'string' || !x.reason.trim() || !/^CMP-\d+$/.test(x.approvedBy ?? '')) errors.push(`exemption[${i}]: reason and approvedBy (CMP-xxxx) are required`);
    else ranges.push([from, to]);
  });
  return { errors, ranges };
}

export function checkGaps(numbers, ranges) {
  const errors = [];
  if (!numbers.length) return errors;
  const have = new Set(numbers);
  const max = numbers[numbers.length - 1];
  const covered = (n) => ranges.some(([a, b]) => n >= a && n <= b);
  const missing = [];
  for (let n = 1; n <= max; n++) if (!have.has(n) && !covered(n)) missing.push(String(n).padStart(3, '0'));
  if (missing.length) errors.push(`missing numbers (add the file or list them in the exemption file with reason + approvedBy): ${missing.join(', ')}`);
  // iterate existing numbers (bounded), never the exemption range itself
  for (const n of numbers) if (covered(n)) errors.push(`stale exemption: ${String(n).padStart(3, '0')} now exists`);
  return errors;
}

// changed: output of `git diff --name-status --no-renames` as lines "S\tpath"
export function checkFrozen(changedLines, migDirRel, frozenMax = FROZEN_MAX) {
  const errors = [];
  const prefix = migDirRel.replace(/\/+$/, '') + '/';
  for (const line of changedLines) {
    if (!line.trim()) continue;
    const [status, ...rest] = line.split('\t');
    const path = rest.join('\t');
    if (!path.startsWith(prefix)) continue;
    const m = /^(\d{3})_/.exec(path.slice(prefix.length));
    if (m && Number(m[1]) <= frozenMax) errors.push(`frozen migration touched (${status}): ${path}`);
  }
  return errors;
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { ok: r.status === 0, out: r.stdout ?? '', err: r.stderr ?? '' };
}

export function run(argv, cwd = process.cwd()) {
  const opt = { dir: 'services/routefit/db/migrations', exemptions: 'scripts/migration-numbering-exemptions.json', baseRef: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir') opt.dir = argv[++i];
    else if (argv[i] === '--exemptions') opt.exemptions = argv[++i];
    else if (argv[i] === '--base-ref') opt.baseRef = argv[++i];
    else return { code: 2, errors: [`unknown argument: ${argv[i]}`] };
  }
  const errors = [];
  const dirAbs = resolve(cwd, opt.dir);
  if (!existsSync(dirAbs)) return { code: 1, errors: [`migration dir not found: ${opt.dir}`] };
  const files = readdirSync(dirAbs).filter((f) => f.endsWith('.sql'));
  const names = checkNames(files);
  errors.push(...names.errors);

  const exAbs = resolve(cwd, opt.exemptions);
  if (!existsSync(exAbs)) errors.push(`exemption file not found: ${opt.exemptions} (must exist; use [] for none)`);
  const ex = existsSync(exAbs) ? parseExemptions(readFileSync(exAbs, 'utf8')) : { errors: [], ranges: [] };
  errors.push(...ex.errors);
  errors.push(...checkGaps(names.numbers, ex.ranges));

  if (!opt.baseRef) {
    errors.push('--base-ref is required (frozen-range check must not be skipped silently)');
  } else {
    const rev = git(['rev-parse', '--verify', '--quiet', `${opt.baseRef}^{commit}`], cwd);
    if (!rev.ok) errors.push(`base ref not resolvable: ${opt.baseRef} (checkout needs fetch-depth: 0)`);
    else {
      const mb = git(['merge-base', opt.baseRef, 'HEAD'], cwd);
      if (!mb.ok) errors.push(`no merge-base between ${opt.baseRef} and HEAD (shallow checkout?)`);
      else {
        const top = git(['rev-parse', '--show-toplevel'], cwd).out.trim();
        const rel = resolve(cwd, opt.dir).slice(resolve(top).length + 1).replace(/\\/g, '/');
        const d = git(['diff', '--name-status', '--no-renames', mb.out.trim(), '--', rel], cwd);
        if (!d.ok) errors.push(`git diff failed: ${d.err.trim()}`);
        else errors.push(...checkFrozen(d.out.split('\n'), rel));
      }
    }
  }
  return { code: errors.length ? 1 : 0, errors, count: files.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const r = run(process.argv.slice(2));
  if (r.code === 0) console.log(`migration numbering OK (${r.count} files)`);
  else { for (const e of r.errors) console.error(`FAIL: ${e}`); process.exitCode = r.code; }
}
