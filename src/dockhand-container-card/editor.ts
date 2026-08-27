import { LitElement, html, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getEnvId, getContainerDevicesForEnvironment, getEnvIdForContainerDevice, getRepresentativeEntityId } from '../common/device-utils';
import { cardNameFieldSchema, migrateTitleToName } from '../common/card-name';
import { resolveContainerEntities, getContainerDropdownOptions } from '../common/entity-resolver';
import { t } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import { CONTAINER_FRIENDLY_LABEL } from '../common/const';
import { DEFAULT_CONTAINER_SECTIONS, CONTAINER_SECTION_ORDER, type DockhandContainerCardConfig } from './types';

const SECTION_LABEL_KEY = {
  state: 'section_state',
  metrics: 'section_metrics',
  io: 'section_io'
} as const;

export class DockhandContainerCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandContainerCardConfig;
  @state() private _hass?: HomeAssistant;

  static styles = [editorFormStyles];

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandContainerCardConfig): void {
    this._config = migrateTitleToName(config as Record<string, unknown>) as DockhandContainerCardConfig;
  }

  /** Falls back to deriving the environment from the currently configured
   * container device — needed for a config saved before
   * environment_device_id existed, hand-written YAML that only ever set
   * device_id, or a persisted environment_device_id that's since gone
   * stale (the referenced environment was removed from HA — unlike the
   * scratch @state this replaced, which only ever held a value freshly
   * verified against the live device list, a value read back from saved
   * config needs that same verification done explicitly, not assumed).
   * Once the editor renders once, ha-form's own value-changed persists a
   * current environment_device_id going forward, so this fallback only
   * ever matters on the very first render of an existing config. */
  private _resolvedEnvDeviceId(): string | undefined {
    const saved = this._config?.environment_device_id;
    if (saved && this._hass?.devices[saved]) return saved;
    if (!this._config?.device_id || !this._hass) return undefined;
    const containerDevice = this._hass.devices?.[this._config.device_id];
    if (!containerDevice) return undefined;
    const envId = getEnvIdForContainerDevice(containerDevice);
    if (envId === null) return undefined;
    return Object.values(this._hass.devices).find((d) => getEnvId(d) === envId)?.id;
  }

  private _schema(envDevices: ReturnType<typeof getEnvironmentDevices>, containerOptions: { value: string; label: string }[]): HaFormSchema[] {
    return [
      { name: 'environment_device_id', required: true, selector: { select: { mode: 'dropdown' as const, options: envDevices.map((d) => ({ value: d.deviceId, label: d.name })) } } },
      {
        name: 'device_id',
        required: true,
        disabled: containerOptions.length === 0,
        selector: { select: { mode: 'dropdown' as const, options: containerOptions } }
      },
      // Content is everything shaping how this container is displayed —
      // Name and the settings link. Named and ordered to match every
      // other card's Content section. Represents from the container's
      // own device (not the environment) — this card is about one
      // specific container.
      {
        name: 'content',
        type: 'expandable',
        flatten: true,
        icon: 'mdi:text-short',
        title: t(this._hass, 'content_section_heading'),
        schema: [
          cardNameFieldSchema(this._config?.device_id && this._hass ? getRepresentativeEntityId(this._hass, this._config.device_id) : undefined, [{ type: 'device' }]),
          { name: 'show_settings_link', default: true, selector: { boolean: {} } },
          {
            name: 'visible_sections',
            type: 'multi_select',
            options: Object.fromEntries(CONTAINER_SECTION_ORDER.map((section) => [section, t(this._hass, SECTION_LABEL_KEY[section])]))
          }
        ]
      }
    ];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const envDevices = getEnvironmentDevices(this._hass);
    if (envDevices.length === 0) {
      return html`<div class="row">${t(this._hass, 'no_environments_found')}</div>`;
    }

    const envDeviceId = this._resolvedEnvDeviceId();
    const envId = envDeviceId ? getEnvId(this._hass.devices[envDeviceId]) : null;
    const containerDevices = envId !== null ? getContainerDevicesForEnvironment(this._hass, envId) : [];
    const containerOptions = getContainerDropdownOptions(this._hass, containerDevices);
    const noContainersFound = envId !== null && containerDevices.length === 0;

    return html`
      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, environment_device_id: envDeviceId, visible_sections: this._config.visible_sections ?? DEFAULT_CONTAINER_SECTIONS }}
        .schema=${this._schema(envDevices, containerOptions)}
        .computeLabel=${this._computeLabel}
        .computeHelper=${(schema: HaFormSchema) => (schema.name === 'device_id' && noContainersFound ? t(this._hass, 'no_containers_found') : '')}
        .warning=${this._warning()}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case 'environment_device_id':
        return t(this._hass, 'environment');
      case 'device_id':
        return t(this._hass, 'container');
      case 'name':
        return t(this._hass, 'title_override');
      case 'show_settings_link':
        return t(this._hass, 'show_settings_link');
      case 'visible_sections':
        return t(this._hass, 'visible_sections_label');
      default:
        return schema.name;
    }
  };

  /** Attached to the device_id field via ha-form's own native
   * .warning/computeWarning mechanism (a real HA feature, confirmed
   * against source, present since well before our HA floor — unlike
   * `visible:`, this one's actually shipped) rather than a hand-built
   * .hint-box below the form, matching how HA's own editors surface a
   * field-specific caveat: a real <ha-alert> renders right at the field
   * it's about, not a disconnected box at the bottom of an unrelated
   * form. Only checks the genuinely opt-in diagnostic sensors — "state"
   * is handled by the card's own core error message, and "health" only
   * exists when the container has a Docker healthcheck configured at
   * all, which isn't something enabling an entity would fix. */
  private _warning(): Record<string, string> {
    if (!this._hass || !this._config?.device_id) return {};
    const { unavailable } = resolveContainerEntities(this._hass, this._config.device_id, [
      'cpuPercent',
      'memoryUsage',
      'memoryPercent',
      'memoryLimit',
      'networkRx',
      'networkTx',
      'blockRead',
      'blockWrite'
    ]);
    const disabledOnly = unavailable.filter((u) => u.reason === 'disabled');
    if (disabledOnly.length === 0) return {};

    const names = disabledOnly.map((u) => CONTAINER_FRIENDLY_LABEL[u.key] ?? u.key).join(', ');
    return { device_id: `This card would show more with these entities enabled: ${names}.` };
  }

  /** Plain passthrough — same as every other converted editor.
   * environment_device_id changing doesn't touch device_id here, matching
   * the previous hand-rendered picker's actual behavior: switching
   * environment only ever re-scoped which containers the dropdown
   * offered, it never silently cleared or rewrote a previously-chosen
   * device_id on its own. If the two end up mismatched (environment
   * changed, container not yet re-picked), the container schema options
   * are already scoped to the new environment on the very next render,
   * so the stale value simply won't appear as a valid choice until the
   * user picks again — no separate cleanup needed. */
  private _valueChanged(ev: CustomEvent<{ value: DockhandContainerCardConfig }>): void {
    fireEvent(this, 'config-changed', { config: ev.detail.value });
  }
}

customElements.define('dockhand-container-card-editor', DockhandContainerCardEditor);
