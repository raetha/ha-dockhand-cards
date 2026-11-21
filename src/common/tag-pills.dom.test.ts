// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import { DockhandContainersCard } from '../dockhand-containers-card/card';
import { DockhandStacksCard } from '../dockhand-stacks-card/card';
import { DockhandContainerCard } from '../dockhand-container-card/card';
import { DockhandStackCard } from '../dockhand-stack-card/card';
import { containerTags, entityTags, renderTagPill } from './tag-pills';
import { makeDevice, makeEntity, makeHass, makeState } from './test-fixtures';
import type { HomeAssistant } from './ha-types';
import { mount as mountTag, type Lit } from './mount.test-helpers';

type CardElement = Lit;

const CARDS = {
  containers: ['tag-pills-containers-card', DockhandContainersCard],
  stacks: ['tag-pills-stacks-card', DockhandStacksCard],
  container: ['tag-pills-container-card', DockhandContainerCard],
  stack: ['tag-pills-stack-card', DockhandStackCard]
} as const;
for (const [tag, cls] of Object.values(CARDS)) {
  if (!customElements.get(tag)) customElements.define(tag, cls as unknown as CustomElementConstructor);
}

const TAGGED = { tags: ['media', 'critical', 'plain'], tag_colors: { media: '#3b82f6', critical: '#ef4444', plain: 'red;}' } };

describe('entityTags', () => {
  it('reads names in order, keeping only a well-formed colour', () => {
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: TAGGED }))).toEqual([
      { name: 'media', color: '#3b82f6' },
      { name: 'critical', color: '#ef4444' },
      { name: 'plain' }
    ]);
  });

  it('is empty without tags (an older ha-dockhand) or with malformed ones', () => {
    expect(entityTags(undefined)).toEqual([]);
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: {} }))).toEqual([]);
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: { tags: 'media' } }))).toEqual([]);
    expect(entityTags(makeState({ entity_id: 'sensor.x', state: 'running', attributes: { tags: ['', 3, 'ok'] } }))).toEqual([{ name: 'ok' }]);
  });
});

describe('renderTagPill', () => {
  it('colours a pill from its tag and leaves an uncoloured one plain', () => {
    const host = document.createElement('div');
    render([renderTagPill({ name: 'media', color: '#3b82f6' }), renderTagPill({ name: 'plain' })], host);
    const [coloured, plain] = host.querySelectorAll('.tag-pill');
    expect(coloured.textContent).toBe('media');
    expect(coloured.getAttribute('style')).toContain('#3b82f6');
    expect(plain.hasAttribute('style')).toBe(false);
  });
});

const env = makeDevice({ id: 'env-device', identifiers: [['dockhand', 'entry_env_1']], config_entry_id: 'entry', name: 'Nebula' });

function hassWith(kind: 'container' | 'stack', attributes: Record<string, unknown>): HomeAssistant {
  const device = makeDevice({ id: 'dev-web', identifiers: [['dockhand', `entry_${kind}_1_web`]], config_entry_id: 'entry', name: 'web', via_device_id: 'env-device' });
  const key = kind === 'container' ? 'state' : 'status';
  return makeHass({
    devices: [env, device],
    entities: [makeEntity({ entity_id: `sensor.web_${key}`, device_id: 'dev-web', translation_key: key })],
    states: [makeState({ entity_id: `sensor.web_${key}`, state: 'running', attributes: { ...attributes } })]
  });
}

const mount = (card: keyof typeof CARDS, hass: HomeAssistant, config: Record<string, unknown> = {}) =>
  mountTag<CardElement>(CARDS[card][0], { type: `custom:dockhand-${card}-card`, ...config }, hass);

function pills(el: CardElement): string[] {
  return [...el.shadowRoot!.querySelectorAll('.tag-pill')].map((p) => p.textContent ?? '');
}

describe.each([
  { list: 'containers' as const, single: 'container' as const, kind: 'container' as const },
  { list: 'stacks' as const, single: 'stack' as const, kind: 'stack' as const }
])('$kind tags', ({ list, single, kind }) => {
  it('show on list rows by default, and can be turned off', async () => {
    const hass = hassWith(kind, TAGGED);
    let el = await mount(list, hass, { device_id: 'env-device' });
    expect(pills(el)).toEqual(['media', 'critical', 'plain']);
    el.remove();
    el = await mount(list, hass, { device_id: 'env-device', visible_badges: ['updates'] });
    expect(pills(el)).toEqual([]);
    el.remove();
  });

  it('show under the single card header, and nothing without tags', async () => {
    let el = await mount(single, hassWith(kind, TAGGED), { device_id: 'dev-web' });
    expect(el.shadowRoot!.querySelector('.tag-row')).not.toBeNull();
    expect(pills(el)).toEqual(['media', 'critical', 'plain']);
    el.remove();
    el = await mount(single, hassWith(kind, {}), { device_id: 'dev-web' });
    expect(el.shadowRoot!.querySelector('.tag-row')).toBeNull();
    el.remove();
  });
});

// A container in stack `app`: its own `media` and `critical`, and the stack's
// `critical` and `db` (github.com/raetha/ha-dockhand-cards/issues/108).
function hassInStack(): HomeAssistant {
  const stack = makeDevice({ id: 'dev-app', identifiers: [['dockhand', 'entry_stack_1_app']], config_entry_id: 'entry', name: 'app', via_device_id: 'env-device' });
  const web = makeDevice({ id: 'dev-web', identifiers: [['dockhand', 'entry_container_1_web']], config_entry_id: 'entry', name: 'web', via_device_id: 'dev-app' });
  const lone = makeDevice({ id: 'dev-lone', identifiers: [['dockhand', 'entry_container_1_lone']], config_entry_id: 'entry', name: 'lone', via_device_id: 'env-device' });
  return makeHass({
    devices: [env, stack, web, lone],
    entities: [
      makeEntity({ entity_id: 'sensor.app_status', device_id: 'dev-app', translation_key: 'status' }),
      makeEntity({ entity_id: 'sensor.web_state', device_id: 'dev-web', translation_key: 'state' }),
      makeEntity({ entity_id: 'sensor.lone_state', device_id: 'dev-lone', translation_key: 'state' })
    ],
    states: [
      makeState({ entity_id: 'sensor.app_status', state: 'running', attributes: { tags: ['Critical', 'db'], tag_colors: { Critical: '#ef4444', db: '#22c55e' } } }),
      makeState({ entity_id: 'sensor.web_state', state: 'running', attributes: { tags: ['media', 'critical'], tag_colors: { media: '#3b82f6', critical: '#ef4444' } } }),
      makeState({ entity_id: 'sensor.lone_state', state: 'running', attributes: { tags: [], tag_colors: {} } })
    ]
  });
}

describe("a stack's tags on its containers", () => {
  it('come after the container’s own, a tag on both staying the container’s', () => {
    const hass = hassInStack();
    expect(containerTags(hass, 'dev-web', hass.states['sensor.web_state'])).toEqual([
      { name: 'media', color: '#3b82f6' },
      { name: 'critical', color: '#ef4444', stack: 'app', own: true },
      { name: 'db', color: '#22c55e', stack: 'app' }
    ]);
    expect(containerTags(hass, 'dev-lone', hass.states['sensor.lone_state'])).toEqual([]);
    expect(containerTags(hass, undefined, hass.states['sensor.web_state'])).toHaveLength(2);
  });

  it('draw filled, outlined, or filled and outlined, saying where they come from', () => {
    const hass = hassInStack();
    const host = document.createElement('div');
    render(containerTags(hass, 'dev-web', hass.states['sensor.web_state']).map((tag) => renderTagPill(tag, hass)), host);
    const [own, both, stack] = host.querySelectorAll('.tag-pill');
    expect(own.className).toBe('label-pill tag-pill');
    expect(own.hasAttribute('title')).toBe(false);
    expect(both.className).toBe('label-pill tag-pill also-stack');
    expect(both.getAttribute('title')).toBe('Also on stack app');
    expect(both.getAttribute('style')).toContain('background');
    expect(stack.className).toBe('label-pill tag-pill from-stack');
    expect(stack.getAttribute('title')).toBe('From stack app');
    expect(stack.getAttribute('style')).not.toContain('background');
  });

  it('show on the Containers and Container cards, and the tag filter matches them', async () => {
    const hass = hassInStack();
    let el = await mount('containers', hass, { device_id: 'env-device' });
    expect(pills(el)).toEqual(['media', 'critical', 'db']);
    expect(el.shadowRoot!.querySelectorAll('.tag-pill.from-stack')).toHaveLength(1);
    el.remove();
    el = await mount('container', hass, { device_id: 'dev-web' });
    expect(pills(el)).toEqual(['media', 'critical', 'db']);
    el.remove();
    el = await mount('containers', hass, { device_id: 'env-device', filters: { tags: ['db'] } });
    expect(el.shadowRoot!.querySelectorAll('.row-left')).toHaveLength(1);
    el.remove();
    el = await mount('stacks', hass, { device_id: 'env-device' });
    expect(pills(el)).toEqual(['Critical', 'db']);
    expect(el.shadowRoot!.querySelectorAll('.tag-pill.from-stack, .tag-pill.also-stack')).toHaveLength(0);
    el.remove();
  });
});
