import { LitElement, html, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getEnvId, getStackDevicesForEnvironment, getEnvIdForStackDevice, getRepresentativeEntityId } from '../common/device-utils';
import { cardNameFieldSchema, migrateTitleToName } from '../common/card-name';
import { resolveStackEntities, getStackDropdownOptions } from '../common/entity-resolver';
import { t } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import { STACK_FRIENDLY_LABEL, type StackTranslationKey } from '../common/const';
import { DEFAULT_STACK_SECTIONS, STACK_SECTION_ORDER, type DockhandStackCardConfig } from './types';

const SECTION_LABEL_KEY = {
  status: 'section_status',
  containers: 'section_stack_containers',
  git_sync: 'section_git_sync'
} as const;

export class DockhandStackCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandStackCardConfig;
  @state() private _hass?: HomeAssistant;

  static styles = [editorFormStyles];

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandStackCardConfig): void {
    this._config = migrateTitleToName(config as Record<string, unknown>) as DockhandStackCardConfig;
  }

  /** Falls back to deriving the environment from the currently configured
   * stack device — needed for a config saved before
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
    const stackDevice = this._hass.devices?.[this._config.device_id];
    if (!stackDevice) return undefined;
    const envId = getEnvIdForStackDevice(stackDevice);
    if (envId === null) return undefined;
    return Object.values(this._hass.devices).find((d) => getEnvId(d) === envId)?.id;
  }

  private _schema(envDevices: ReturnType<typeof getEnvironmentDevices>, stackOptions: { value: string; label: string }[]): HaFormSchema[] {
    return [
      { name: 'environment_device_id', required: true, selector: { select: { mode: 'dropdown' as const, options: envDevices.map((d) => ({ value: d.deviceId, label: d.name })) } } },
      {
        name: 'device_id',
        required: true,
        disabled: stackOptions.length === 0,
        selector: { select: { mode: 'dropdown' as const, options: stackOptions } }
      },
      // Content is everything shaping how this stack is displayed — Name
      // and the settings link. Named and ordered to match every other
      // card's Content section. Represents from the stack's own device
      // (not the environment) — this card is about one specific stack.
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
            options: Object.fromEntries(STACK_SECTION_ORDER.map((section) => [section, t(this._hass, SECTION_LABEL_KEY[section])]))
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
    const stackDevices = envId !== null ? getStackDevicesForEnvironment(this._hass, envId) : [];
    const stackOptions = getStackDropdownOptions(this._hass, stackDevices);
    const noStacksFound = envId !== null && stackOptions.length === 0;

    return html`
      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, environment_device_id: envDeviceId, visible_sections: this._config.visible_sections ?? DEFAULT_STACK_SECTIONS }}
        .schema=${this._schema(envDevices, stackOptions)}
        .computeLabel=${this._computeLabel}
        .computeHelper=${(schema: HaFormSchema) => (schema.name === 'device_id' && noStacksFound ? t(this._hass, 'no_stacks_found') : '')}
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
        return t(this._hass, 'stack');
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
   * .warning/computeWarning mechanism — see DockhandContainerCardEditor's
   * identical comment for the full reasoning. Only surfaces disabled
   * entities, or missing ones from the always-applicable set
   * (status/containersInStack/updatesAvailable) — a "not_found" git_*
   * entity on a non-git stack isn't something enabling anything would
   * fix, so it's not a useful warning. */
  private _warning(): Record<string, string> {
    if (!this._hass || !this._config?.device_id) return {};
    const alwaysApplicable: StackTranslationKey[] = ['status', 'containersInStack', 'updatesAvailable'];
    const { unavailable } = resolveStackEntities(this._hass, this._config.device_id, [
      'status',
      'containersInStack',
      'updatesAvailable',
      'gitSyncStatus',
      'gitLastSync',
      'gitSyncError'
    ]);
    const relevant = unavailable.filter((u) => alwaysApplicable.includes(u.key) || u.reason === 'disabled');
    if (relevant.length === 0) return {};

    const names = relevant
      .map((u) => `${STACK_FRIENDLY_LABEL[u.key] ?? u.key}${u.reason === 'not_found' ? ' (requires a newer ha-dockhand release)' : ''}`)
      .join(', ');
    return { device_id: `This card would show more with these entities enabled: ${names}.` };
  }

  /** Plain passthrough — see DockhandContainerCardEditor's identical
   * comment for why environment_device_id changing doesn't need to clear
   * device_id here. */
  private _valueChanged(ev: CustomEvent<{ value: DockhandStackCardConfig }>): void {
    fireEvent(this, 'config-changed', { config: ev.detail.value });
  }
}

customElements.define('dockhand-stack-card-editor', DockhandStackCardEditor);
