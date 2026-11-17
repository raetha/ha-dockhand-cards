import { check, devVersion, notes, sections } from './release.mjs';
import { describe, expect, it } from 'vitest';

const CHANGELOG = `# Changelog

## [Unreleased]

### Added

- New thing.

## [1.1.0] - 2026-10-19

### Fixed

- A fix.

## [1.0.0] — 2026-07-21

- First.

[Unreleased]: https://example.com/compare/v1.1.0...HEAD
[1.1.0]: https://example.com/compare/v1.0.0...v1.1.0
`;

describe('release tool', () => {
  it('reads sections with either date separator and stops at link references', () => {
    const s = sections(CHANGELOG);
    expect([...s.keys()]).toEqual(['Unreleased', '1.1.0', '1.0.0']);
    expect(s.get('1.0.0')).toBe('- First.');
  });

  it('keeps released sections frozen', () => {
    const dev = CHANGELOG.replace('- New thing.', '- New thing.\n- Another.');
    expect(check(dev, '1.2.0', false, CHANGELOG)).toEqual([]);
    const edited = CHANGELOG.replace('- First.', '- First.\n- Slipped in.');
    const problems = check(edited, '1.2.0', false, CHANGELOG);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('[1.0.0]');
  });

  it('requires [Unreleased], and a dated section only for a release', () => {
    expect(check(CHANGELOG, '1.1.0')).toEqual([]);
    expect(check(CHANGELOG, '1.2.0')).toEqual([]); // expected next version on dev
    expect(check(CHANGELOG, '1.1.0', true)).toEqual([]);
    expect(check(CHANGELOG, '1.2.0', true)).toHaveLength(1); // undated release
    expect(check(CHANGELOG.replace('## [Unreleased]', ''), '1.1.0')).toHaveLength(1);
  });

  it('versions test builds above the installed release', () => {
    expect(devVersion('1.5.0', '', true)).toBe('1.5.1-dev.1');
    expect(devVersion('1.6.0', '', false)).toBe('1.6.0-dev.1');
    expect(() => devVersion('1.6.0-beta', '', true)).toThrow();
  });

  it('numbers test builds by test build, not by workflow run', () => {
    expect(devVersion('2.0.0', '2.0.0-dev.43', false)).toBe('2.0.0-dev.44');
    expect(devVersion('2.0.0', 'v2.0.0-dev.9', false)).toBe('2.0.0-dev.10');
    expect(devVersion('2.1.0', '2.0.0-dev.43', false)).toBe('2.1.0-dev.1');
    expect(devVersion('2.0.0', '2.0.0-dev.43', true)).toBe('2.0.1-dev.1');
  });

  it('builds notes from a section, with a test-build intro', () => {
    expect(notes(CHANGELOG, '1.1.0')).toMatch(/^### Fixed\n\n- A fix\.\n\n\*\*Install\*\*/);
    expect(notes(CHANGELOG, 'Unreleased', 7)).toMatch(/^\*\*Test build 7\*\*/);
    expect(() => notes(CHANGELOG, '9.9.9')).toThrow();
  });

  it('points a test build\u2019s images and docs at dev, where they are until the release', () => {
    const img = '![x](https://raw.githubusercontent.com/raetha/ha-dockhand-cards/main/docs/images/x.png)';
    const changelog = CHANGELOG.replace('- New thing.', `- New thing.\n\n${img}`).replace('- A fix.', `- A fix.\n\n${img}`);
    expect(notes(changelog, 'Unreleased', 7)).toContain('/ha-dockhand-cards/dev/docs/images/x.png');
    const doc = CHANGELOG.replace('- New thing.', '- New thing, [docs](https://github.com/raetha/ha-dockhand-cards/blob/main/docs/x.md).');
    expect(notes(doc, 'Unreleased', 7)).toContain('/blob/dev/docs/x.md');
    expect(notes(changelog, '1.1.0')).toContain('/ha-dockhand-cards/main/docs/images/x.png');
  });
});
