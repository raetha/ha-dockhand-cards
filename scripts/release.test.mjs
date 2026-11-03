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

  it('requires [Unreleased], and a dated section only for a release', () => {
    expect(check(CHANGELOG, '1.1.0')).toEqual([]);
    expect(check(CHANGELOG, '1.2.0')).toEqual([]); // expected next version on dev
    expect(check(CHANGELOG, '1.1.0', true)).toEqual([]);
    expect(check(CHANGELOG, '1.2.0', true)).toHaveLength(1); // undated release
    expect(check(CHANGELOG.replace('## [Unreleased]', ''), '1.1.0')).toHaveLength(1);
  });

  it('versions test builds above the installed release', () => {
    expect(devVersion('1.5.0', 12, true)).toBe('1.5.1-dev.12');
    expect(devVersion('1.6.0', 13, false)).toBe('1.6.0-dev.13');
    expect(() => devVersion('1.6.0-beta', 1, true)).toThrow();
  });

  it('builds notes from a section, with a test-build intro', () => {
    expect(notes(CHANGELOG, '1.1.0')).toMatch(/^### Fixed\n\n- A fix\.\n\n\*\*Install\*\*/);
    expect(notes(CHANGELOG, 'Unreleased', 7)).toMatch(/^\*\*Test build 7\*\*/);
    expect(() => notes(CHANGELOG, '9.9.9')).toThrow();
  });
});
