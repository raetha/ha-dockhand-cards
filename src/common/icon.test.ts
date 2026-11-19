// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, nothing, type TemplateResult } from 'lit';
import { renderSettingsLink, renderIcon, onKeydownActivate } from './icon';

function renderToDom(template: TemplateResult): HTMLElement {
  const container = document.createElement('div');
  render(template, container);
  return container;
}

describe('renderSettingsLink', () => {
  it('renders nothing when show is false or undefined', () => {
    expect(renderSettingsLink({ hass: undefined, show: false, href: 'https://dh.test/schedules', tooltipKey: 'settings_link_view_schedules' })).toBe(nothing);
    expect(renderSettingsLink({ hass: undefined, show: undefined, href: 'https://dh.test/schedules', tooltipKey: 'settings_link_view_schedules' })).toBe(nothing);
  });

  it('renders the link-unavailable state when shown but href is null', () => {
    const result = renderSettingsLink({ hass: undefined, show: true, href: null, tooltipKey: 'settings_link_view_schedules' }) as TemplateResult;
    const el = renderToDom(result);
    const span = el.querySelector('span')!;
    expect(span.className).toContain('link-unavailable');
    expect(span.className).not.toContain('clickable');
    expect(span.getAttribute('tabindex')).toBeNull();
  });

  it('renders a real, clickable link when shown and href is resolved', () => {
    const result = renderSettingsLink({ hass: undefined, show: true, href: 'https://dh.test/schedules', tooltipKey: 'settings_link_view_schedules' }) as TemplateResult;
    const el = renderToDom(result);
    const span = el.querySelector('span')!;
    expect(span.className).toContain('header-icon');
    expect(span.className).toContain('clickable');
    expect(span.getAttribute('tabindex')).toBe('0');
    expect(span.getAttribute('role')).toBe('button');
    expect(el.querySelector('ha-icon')?.getAttribute('icon')).toBe('mdi:open-in-new');
  });

  it('uses a custom icon when provided instead of the default', () => {
    const result = renderSettingsLink({
      hass: undefined,
      show: true,
      href: 'https://dh.test',
      tooltipKey: 'settings_link_view_schedules',
      icon: 'mdi:cog'
    }) as TemplateResult;
    const el = renderToDom(result);
    expect(el.querySelector('ha-icon')?.getAttribute('icon')).toBe('mdi:cog');
  });

  it('is keyboard-activatable via Enter, same as clicking it', () => {
    // renderIcon() wires Enter and Space from onClick, so anything
    // focusable can also be activated from the keyboard.
    const result = renderSettingsLink({ hass: undefined, show: true, href: 'https://dh.test/schedules', tooltipKey: 'settings_link_view_schedules' }) as TemplateResult;
    const el = renderToDom(result);
    const span = el.querySelector('span')!;
    // Real href navigation isn't exercised in jsdom; confirming the
    // handler exists and doesn't throw is the relevant assertion here.
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(openSpy).toHaveBeenCalledOnce();
    openSpy.mockRestore();
  });
});

describe('renderIcon', () => {
  it('renders a fixed icon with a color-modifier class, at the header-icon size tier', () => {
    const el = renderToDom(renderIcon({ baseClass: 'header-icon', icon: 'mdi:package-up', colorClass: 'warn', title: 'Update available', onClick: () => {} }));
    const span = el.querySelector('span')!;
    expect(span.className).toContain('header-icon');
    expect(span.className).toContain('warn');
    expect(span.className).toContain('clickable');
    expect(el.querySelector('ha-icon')?.getAttribute('icon')).toBe('mdi:package-up');
  });

  it('renders at the row-icon size tier when baseClass is row-icon', () => {
    const el = renderToDom(renderIcon({ baseClass: 'row-icon', icon: 'mdi:cpu-64-bit', text: '42%', onClick: () => {} }));
    const span = el.querySelector('span')!;
    expect(span.className).toContain('row-icon');
    expect(span.textContent).toContain('42%');
  });

  it('renders a real hass entity via ha-state-icon instead of a fixed icon', () => {
    const stateObj = { entity_id: 'binary_sensor.x', state: 'on', attributes: {} } as never;
    const el = renderToDom(renderIcon({ baseClass: 'header-icon', hass: undefined, stateObj, title: 'Feature', onClick: () => {} }));
    expect(el.querySelector('ha-state-icon')).not.toBeNull();
    expect(el.querySelector('ha-icon')).toBeNull();
  });

  it('calls onClick and stops propagation when clicked', () => {
    const onClick = vi.fn();
    const el = renderToDom(renderIcon({ baseClass: 'header-icon', icon: 'mdi:cog', title: 'x', onClick }));
    const span = el.querySelector('span')!;
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(evt, 'stopPropagation');
    span.dispatchEvent(evt);
    expect(onClick).toHaveBeenCalledOnce();
    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('calls onClick on Enter and on Space, automatically, without a separate onKeydown param', () => {
    const onClick = vi.fn();
    const el = renderToDom(renderIcon({ baseClass: 'header-icon', icon: 'mdi:cog', title: 'x', onClick }));
    const span = el.querySelector('span')!;
    span.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    span.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not call onClick on an unrelated key', () => {
    const onClick = vi.fn();
    const el = renderToDom(renderIcon({ baseClass: 'header-icon', icon: 'mdi:cog', title: 'x', onClick }));
    el.querySelector('span')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stops keydown propagation on Enter/Space, so a nested icon inside a clickable parent row does not also trigger the parent row\u2019s own keydown handler', () => {
    // Without stopPropagation(), Enter on the icon would also reach the
    // row's own keydown handler and open two more-info dialogs.
    const onClick = vi.fn();
    const el = renderToDom(renderIcon({ baseClass: 'row-icon', icon: 'mdi:cpu-64-bit', title: 'x', onClick }));
    const span = el.querySelector('span')!;
    const evt = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(evt, 'stopPropagation');
    span.dispatchEvent(evt);
    expect(stopSpy).toHaveBeenCalledOnce();
  });

  it('disabled renders non-interactive but still stops propagation on click, with no keydown handler', () => {
    const el = renderToDom(renderIcon({ baseClass: 'header-icon', icon: 'mdi:link-off', title: 'unavailable', disabled: true }));
    const span = el.querySelector('span')!;
    expect(span.className).toContain('link-unavailable');
    expect(span.getAttribute('tabindex')).toBeNull();
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(evt, 'stopPropagation');
    span.dispatchEvent(evt);
    expect(stopSpy).toHaveBeenCalledOnce();
  });

  // An icon that's neither clickable, disabled nor static can't be
  // written: renderIcon()'s type requires one of onClick, disabled: true
  // or static: true, so it's a compile error rather than a test.

  it('static renders with no tabindex/role/clickable class, and no click handler at all', () => {
    const el = renderToDom(renderIcon({ baseClass: 'card-badge', icon: 'mdi:docker', static: true }));
    const span = el.querySelector('span')!;
    expect(span.className).not.toContain('clickable');
    expect(span.className).not.toContain('link-unavailable');
    expect(span.getAttribute('tabindex')).toBeNull();
    expect(span.getAttribute('role')).toBeNull();
  });

  it('static does not stop propagation on click, unlike disabled — a click passes through untouched to whatever it sits inside', () => {
    // Distinct from `disabled` deliberately: disabled is a known,
    // meaningful muted state that still intercepts its own click;
    // static never had click behavior as a concept at all, so nothing
    // here should swallow a click meant for a parent (e.g. a static
    // .row-icon label sitting inside an otherwise-clickable .row).
    const el = renderToDom(renderIcon({ baseClass: 'row-icon', icon: 'mdi:cpu-64-bit', text: 'CPU', static: true }));
    const span = el.querySelector('span')!;
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    const stopSpy = vi.spyOn(evt, 'stopPropagation');
    span.dispatchEvent(evt);
    expect(stopSpy).not.toHaveBeenCalled();
  });

  it('static supports a raw color and trailing text, same as the interactive/disabled variants', () => {
    const el = renderToDom(renderIcon({ baseClass: 'stat', icon: 'mdi:play', color: 'var(--dockhand-status-ok-color)', text: '3', title: 'Running', static: true }));
    const span = el.querySelector('span')!;
    expect(span.getAttribute('style')).toContain('var(--dockhand-status-ok-color)');
    expect(span.textContent).toContain('3');
    expect(span.getAttribute('title')).toBe('Running');
  });
});

describe('onKeydownActivate', () => {
  it('calls onClick on Enter and on Space', () => {
    const onClick = vi.fn();
    const handler = onKeydownActivate(onClick);
    handler(new KeyboardEvent('keydown', { key: 'Enter' }));
    handler(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not call onClick on an unrelated key', () => {
    const onClick = vi.fn();
    onKeydownActivate(onClick)(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('calls preventDefault and stopPropagation on Enter/Space, but not on an unrelated key', () => {
    const onClick = vi.fn();
    const handler = onKeydownActivate(onClick);

    const activateEvt = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true });
    const preventSpy = vi.spyOn(activateEvt, 'preventDefault');
    const stopSpy = vi.spyOn(activateEvt, 'stopPropagation');
    handler(activateEvt);
    expect(preventSpy).toHaveBeenCalledOnce();
    expect(stopSpy).toHaveBeenCalledOnce();

    const otherEvt = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true, bubbles: true });
    const otherPreventSpy = vi.spyOn(otherEvt, 'preventDefault');
    handler(otherEvt);
    expect(otherPreventSpy).not.toHaveBeenCalled();
  });
});
