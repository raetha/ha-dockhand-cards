// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { DomChanges } from './dom-changes';

describe('DomChanges', () => {
  it('reports the first call, then only changes made since the last', async () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<span>one</span>';
    const dom = new DomChanges();
    expect(dom.changed(host)).toBe(true);
    expect(dom.changed(host)).toBe(false);
    root.querySelector('span')!.textContent = 'two';
    expect(dom.changed(host)).toBe(true);
    // The measuring controller's own class changes don't count.
    root.querySelector('span')!.classList.add('compact');
    dom.forget();
    expect(dom.changed(host)).toBe(false);
    dom.disconnect();
    expect(dom.changed(host)).toBe(true);
  });

  it('always reports a change before there is a shadow root', () => {
    expect(new DomChanges().changed(document.createElement('div'))).toBe(true);
  });
});
