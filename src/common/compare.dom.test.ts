// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { compareText } from './compare';

describe('compareText', () => {
  afterEach(() => document.documentElement.removeAttribute('lang'));

  it('ignores case, as Home Assistant’s own lists do', () => {
    expect(['beta', 'Zeta', 'alpha', 'Gamma'].sort(compareText)).toEqual(['alpha', 'beta', 'Gamma', 'Zeta']);
    expect(compareText('Web', 'web')).toBe(0);
  });

  it('sorts in the language Home Assistant puts on the page, not the browser’s', () => {
    const words = ['zebra', 'äpple', 'apple'];
    document.documentElement.lang = 'sv';
    // Swedish puts ä after z.
    expect([...words].sort(compareText)).toEqual(['apple', 'zebra', 'äpple']);
    document.documentElement.lang = 'de';
    expect([...words].sort(compareText)).toEqual(['apple', 'äpple', 'zebra']);
  });

  it('falls back to the browser’s language for a tag Intl rejects', () => {
    document.documentElement.lang = 'not a language!';
    expect(['b', 'A'].sort(compareText)).toEqual(['A', 'b']);
  });
});
