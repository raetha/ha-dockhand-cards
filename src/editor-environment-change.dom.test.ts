// @vitest-environment jsdom
/** The Container and Stack card editors clear the chosen container or stack
 * when the environment changes: it belongs to the old one. */
import { describe, it, expect } from 'vitest';
import './render.dom.test-elements';
import { mount } from './common/mount.test-helpers';

async function edit(tag: string, config: Record<string, unknown>, change: Record<string, unknown>): Promise<Record<string, unknown>> {
  const el = await mount(tag, config);
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
