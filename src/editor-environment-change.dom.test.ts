// @vitest-environment jsdom
/** The Container and Stack card editors clear the chosen container or stack
 * when the environment changes: it belongs to the old one. */
import { describe, it, expect, afterEach } from 'vitest';
import { buildMockHass } from '../scripts/screenshot-harness/mock-data.mjs';
import './render.dom.test-elements';
import type { HomeAssistant } from './common/ha-types';

type Editor = HTMLElement & { hass: HomeAssistant; setConfig(config: Record<string, unknown>): void; updateComplete: Promise<boolean> };

const mounted: HTMLElement[] = [];
afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
});

async function edit(tag: string, config: Record<string, unknown>, change: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { devices, entities, states } = buildMockHass();
  const el = document.createElement(tag) as Editor;
  el.hass = { devices, entities, states, language: 'en', locale: { language: 'en' } } as unknown as HomeAssistant;
  el.setConfig(config);
  document.body.appendChild(el);
  mounted.push(el);
  await el.updateComplete;
  let saved: Record<string, unknown> = {};
  el.addEventListener('config-changed', (ev) => (saved = (ev as CustomEvent).detail.config));
  el.shadowRoot!.querySelector('ha-form')!.dispatchEvent(new CustomEvent('value-changed', { detail: { value: { ...config, ...change } } }));
  return saved;
}

describe('choosing another environment', () => {
  it('clears the stack', async () => {
    const config = { type: 'custom:dockhand-stack-card', environment_device_id: 'env_1', device_id: 'stack_1_core' };
    expect((await edit('dockhand-stack-card-editor', config, { environment_device_id: 'env_2' })).device_id).toBe('');
    expect((await edit('dockhand-stack-card-editor', config, { name: 'Core' })).device_id).toBe('stack_1_core');
  });

  it('clears the container', async () => {
    const config = { type: 'custom:dockhand-container-card', environment_device_id: 'env_1', device_id: 'container_1_web' };
    expect((await edit('dockhand-container-card-editor', config, { environment_device_id: 'env_2' })).device_id).toBe('');
    expect((await edit('dockhand-container-card-editor', config, { name: 'Web' })).device_id).toBe('container_1_web');
  });
});
