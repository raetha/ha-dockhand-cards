#!/usr/bin/env node
// Release helpers for CI (.github/workflows/build.yml) and release pull requests.
//
//   node tools/release.mjs check                      changelog has [Unreleased] and a section
//                                                     for package.json's version
//   node tools/release.mjs version                    package.json's version
//   node tools/release.mjs dev-version <run> <tagged> the test build's version: the next patch
//                                                     once the current version is tagged
//                                                     (<tagged> = true|false), so HACS offers
//                                                     it as an update over the installed release
//   node tools/release.mjs notes <version> [--test-build <run>]
//                                                     release notes: that changelog section plus
//                                                     install text (version "Unreleased" for
//                                                     test builds)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO = 'https://github.com/raetha/ha-dockhand-cards';

/** Changelog sections by heading, e.g. "Unreleased" or "1.5.0". Older sections use an em dash
 * before the date; both separators are accepted. */
export function sections(changelog) {
  const out = new Map();
  let name = null;
  let lines = [];
  const flush = () => {
    if (name !== null) out.set(name, lines.join('\n').trim());
  };
  for (const line of changelog.split('\n')) {
    const heading = /^## \[([^\]]+)\](?:\s*[-—]\s*\S+)?\s*$/.exec(line);
    if (heading) {
      flush();
      name = heading[1];
      lines = [];
    } else if (/^\[[^\]]+\]:\s/.test(line)) {
      flush();
      name = null;
    } else if (name !== null) {
      lines.push(line);
    }
  }
  flush();
  return out;
}

/** Problems that should fail CI: no [Unreleased] section, or no section for the version. */
export function check(changelog, version) {
  const found = sections(changelog);
  const problems = [];
  if (!found.has('Unreleased')) problems.push('CHANGELOG.md has no "## [Unreleased]" section');
  if (!found.has(version)) problems.push(`CHANGELOG.md has no section for version ${version}`);
  return problems;
}

export function devVersion(version, run, tagged) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`not a plain X.Y.Z version: ${version}`);
  const base = tagged ? `${m[1]}.${m[2]}.${Number(m[3]) + 1}` : version;
  return `${base}-dev.${run}`;
}

export function notes(changelog, version, testBuild) {
  const body = sections(changelog).get(version);
  if (body === undefined) throw new Error(`CHANGELOG.md has no section for ${version}`);
  const install =
    `**Install** with HACS (search for Dockhand Cards, or add \`${REPO}\` as a custom ` +
    'repository of type Dashboard), then reload your browser. Needs the ' +
    '[ha-dockhand](https://github.com/raetha/ha-dockhand) integration.\n\n' +
    `More: [README](${REPO}#readme)`;
  const parts = [];
  if (testBuild !== undefined) {
    parts.push(
      `**Test build ${testBuild}** from \`dev\`, for trying what's coming. To get it, enable and turn on the ` +
        "Dockhand Cards **Pre-release** switch HACS adds (disabled by default); HACS then offers it " +
        'as an update. The changes since the last release:'
    );
  }
  parts.push(body || '_No changes listed yet._', install);
  return parts.join('\n\n') + '\n';
}

function main(argv) {
  const changelog = readFileSync(`${ROOT}/CHANGELOG.md`, 'utf8');
  const { version } = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8'));
  const [cmd, ...args] = argv;
  switch (cmd) {
    case 'check': {
      const problems = check(changelog, version);
      for (const p of problems) console.error(`::error file=CHANGELOG.md::${p}`);
      if (problems.length) process.exit(1);
      console.log(`CHANGELOG.md OK for ${version}`);
      break;
    }
    case 'version':
      console.log(version);
      break;
    case 'dev-version':
      console.log(devVersion(version, args[0], args[1] === 'true'));
      break;
    case 'notes': {
      const i = args.indexOf('--test-build');
      process.stdout.write(notes(changelog, args[0], i >= 0 ? args[i + 1] : undefined));
      break;
    }
    default:
      console.error('usage: release.mjs check | version | dev-version <run> <tagged> | notes <version> [--test-build <run>]');
      process.exit(2);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
