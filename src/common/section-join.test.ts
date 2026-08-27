import { describe, it, expect } from 'vitest';
import { html, nothing } from 'lit';
import { render } from 'lit';
import { joinWithDividers, mergeSections } from './section-join';

function renderToDom(template: ReturnType<typeof joinWithDividers>): HTMLElement {
  const container = document.createElement('div');
  render(template, container);
  return container;
}

describe('joinWithDividers', () => {
  it('renders no dividers for a single section', () => {
    const el = renderToDom(joinWithDividers([html`<div class="a">one</div>`]));
    expect(el.querySelectorAll('.divider').length).toBe(0);
  });

  it('renders one divider between two real sections', () => {
    const el = renderToDom(joinWithDividers([html`<div class="a">one</div>`, html`<div class="b">two</div>`]));
    expect(el.querySelectorAll('.divider').length).toBe(1);
  });

  it('renders no divider before the first or after the last section', () => {
    const el = renderToDom(joinWithDividers([html`<div class="a">one</div>`, html`<div class="b">two</div>`, html`<div class="c">three</div>`]));
    const children = [...el.children];
    expect(children[0].className).toBe('a');
    expect(children[children.length - 1].className).toBe('c');
  });

  it('skips nothing entries entirely — no divider around an empty section', () => {
    const el = renderToDom(joinWithDividers([html`<div class="a">one</div>`, nothing, html`<div class="b">two</div>`]));
    expect(el.querySelectorAll('.divider').length).toBe(1);
  });

  it('renders nothing at all when every section is empty', () => {
    const el = renderToDom(joinWithDividers([nothing, nothing]));
    expect(el.children.length).toBe(0);
  });

  it('correctly handles whichever section is genuinely first, regardless of its own identity', () => {
    // Regression case for the real bug: a section that isn't always
    // first in a card's own fixed order (e.g. Environment's own Custom
    // mode) must not carry its own leading divider when it happens to
    // render first.
    const el = renderToDom(joinWithDividers([nothing, html`<div class="metrics">metrics</div>`, html`<div class="resources">resources</div>`]));
    const children = [...el.children];
    expect(children[0].className).toBe('metrics');
    expect(children.filter((c) => c.className === 'divider').length).toBe(1);
  });
});

describe('mergeSections', () => {
  it('renders no divider between two merged sections, even when both render content', () => {
    const el = renderToDom(mergeSections(html`<div class="a">one</div>`, html`<div class="b">two</div>`) as ReturnType<typeof joinWithDividers>);
    expect(el.querySelectorAll('.divider').length).toBe(0);
    expect(el.children.length).toBe(2);
  });

  it('reduces to nothing when every constituent section is nothing', () => {
    const result = mergeSections(nothing, nothing);
    expect(result).toBe(nothing);
  });

  it('composes correctly as a single entry in joinWithDividers — no extra divider when the merged group is genuinely empty', () => {
    const merged = mergeSections(nothing, nothing);
    const el = renderToDom(joinWithDividers([html`<div class="a">one</div>`, merged, html`<div class="b">two</div>`]));
    expect(el.querySelectorAll('.divider').length).toBe(1);
  });

  it('composes correctly as a single entry in joinWithDividers — one divider before the merged group when it has content', () => {
    const merged = mergeSections(html`<div class="metrics">metrics</div>`, html`<div class="grid">grid</div>`);
    const el = renderToDom(joinWithDividers([html`<div class="a">one</div>`, merged]));
    expect(el.querySelectorAll('.divider').length).toBe(1);
    expect(el.querySelectorAll('.metrics, .grid').length).toBe(2);
  });
});
