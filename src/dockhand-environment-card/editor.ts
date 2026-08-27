import { LitElement, html, type TemplateResult } from 'lit';
import { state, property } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getRepresentativeEntityId } from '../common/device-utils';
import { cardNameFieldSchema, migrateTitleToName } from '../common/card-name';
import { resolveEnvironmentEntities } from '../common/entity-resolver';
import { REQUIRED_KEYS_BY_MODE, ENV_FRIENDLY_LABEL, type EnvTranslationKey } from '../common/const';
import { t, type TranslationKey } from '../common/i18n';
import { editorFormStyles } from '../common/editor-styles';
import { CUSTOM_SECTION_ORDER, DEFAULT_CUSTOM_SECTIONS, type CardMode, type DockhandEnvironmentCardConfig } from './types';

const MODE_KEYS = { compact: 'mode_compact', standard: 'mode_standard', detailed: 'mode_detailed', full: 'mode_full', custom: 'mode_custom' } as const;

const SECTION_LABEL_KEY: Record<string, TranslationKey> = {
  container_counts: 'section_container_counts',
  metrics: 'section_metrics',
  resources: 'section_resources',
  events_summary: 'section_events_summary',
  recent_events: 'section_recent_events',
  top_containers: 'section_top_containers',
  disk_usage: 'section_disk_usage',
  history_chart: 'section_history_chart'
};

export class DockhandEnvironmentCardEditor extends LitElement implements LovelaceCardEditor {
  @state() private _config?: DockhandEnvironmentCardConfig;
  @state() private _hass?: HomeAssistant;
  /** See DockhandVulnerabilityCardEditor's identical property for the
   * full reasoning — set only by the Overview card's per-environment
   * override detail view, never by HA itself. */
  @property({ type: Boolean }) cardIsEmbedded = false;
  /** Set only by Overview's per-section global-defaults view — a
   * title override is inherently per-instance (it names one specific
   * card), so it has no sensible meaning as a value shared across every
   * environment's generated card. Never set by HA itself, and distinct
   * from cardIsEmbedded: the per-environment override view sets
   * cardIsEmbedded alone (title still makes sense there, since it's
   * scoped to one environment's card), while the global-defaults view
   * sets both. */
  @property({ type: Boolean }) hideTitle = false;

  static styles = [editorFormStyles];

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandEnvironmentCardConfig): void {
    this._config = migrateTitleToName(config as Record<string, unknown>) as DockhandEnvironmentCardConfig;
  }

  private _mainSchema(devices: ReturnType<typeof getEnvironmentDevices>, selectedMode: CardMode): HaFormSchema[] {
    const sectionOptions: Record<string, string> = {};
    for (const section of CUSTOM_SECTION_ORDER) {
      sectionOptions[section] = t(this._hass, SECTION_LABEL_KEY[section]);
    }
    const representativeEntityId = this._config?.device_id && this._hass ? getRepresentativeEntityId(this._hass, this._config.device_id) : undefined;

    return [
      ...(this.cardIsEmbedded
        ? []
        : [
            {
              name: 'device_id',
              required: true,
              selector: { select: { mode: 'dropdown' as const, options: devices.map((d) => ({ value: d.deviceId, label: d.name })) } }
            }
          ]),
      {
        name: 'mode',
        required: true,
        default: 'standard',
        selector: {
          select: { mode: 'dropdown', options: (Object.keys(MODE_KEYS) as CardMode[]).map((value) => ({ value, label: t(this._hass, MODE_KEYS[value]) })) }
        }
      },
      // Root, directly below mode — not in Content. Picking "Custom"
      // mode needs this picker to appear immediately as the obvious next
      // step; buried inside a collapsed Content section, someone who
      // doesn't already know to expand it has no visible way to actually
      // choose which sections show. Conditionally included rather than
      // expressed via the schema's own `visible:` condition — that's
      // real, but only landed in HA's dev branch on 2026-07-17 and isn't
      // in any released version yet (verified directly against HA
      // core's actual frontend pin — even 2026.7.4, the latest release
      // as of this writing, predates it). Omitting the field entirely
      // achieves the identical visible behavior without depending on
      // unreleased HA functionality — revisit once `visible:` actually
      // ships.
      ...(selectedMode === 'custom' ? [{ name: 'custom_sections', type: 'multi_select' as const, options: sectionOptions }] : []),
      // Content covers everything else shaping how this environment
      // displays. `mode`/`custom_sections` both stay at root, not in
      // here — `mode`'s own reason is that ha-form-expandable doesn't
      // forward the `.warning` prop to its nested <ha-form> at all (only
      // hass/data/schema/disabled/computeLabel/computeHelper/
      // localizeValue are), and this card's own warning (which entities
      // a given mode needs) is attached to `mode` specifically — moving
      // it into Content would have silently broken that feature, not
      // just changed where the field sits. `custom_sections`' reason is
      // the discoverability one above; worth remembering these are two
      // different, unrelated reasons even though both fields ended up
      // at root the same way.
      {
        name: 'content',
        type: 'expandable',
        flatten: true,
        icon: 'mdi:text-short',
        title: t(this._hass, 'content_section_heading'),
        schema: [
          ...(this.hideTitle ? [] : [cardNameFieldSchema(representativeEntityId, [{ type: 'device' }])]),
          { name: 'show_settings_link', default: true, selector: { boolean: {} } }
        ]
      }
    ];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const devices = getEnvironmentDevices(this._hass);
    const selectedMode = this._config.mode ?? 'standard';

    if (!this.cardIsEmbedded && devices.length === 0) {
      return html`<div class="row">${t(this._hass, 'no_environments_found')}</div>`;
    }

    return html`
      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, custom_sections: this._config.custom_sections ?? DEFAULT_CUSTOM_SECTIONS }}
        .schema=${this._mainSchema(devices, selectedMode)}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        .warning=${this._warning(selectedMode)}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case 'device_id':
        return t(this._hass, 'environment');
      case 'mode':
        return t(this._hass, 'display_mode');
      case 'name':
        return t(this._hass, 'title_override');
      case 'custom_sections':
        return t(this._hass, 'custom_sections_label');
      case 'show_settings_link':
        return t(this._hass, 'show_settings_link');
      default:
        return schema.name;
    }
  };

  /** Trimmed to genuinely non-obvious prerequisites only (a sensor
   * that's off by default, a feature that needs a newer ha-dockhand,
   * HA's own recorder) — compact/standard have neither, so they get no
   * hint at all. What each mode visually adds is better learned by
   * actually switching between them in the live preview than by
   * reading a paragraph describing it first. */
  private _computeHelper = (schema: HaFormSchema): string => {
    if (schema.name !== 'mode') return '';
    switch (this._config?.mode ?? 'standard') {
      case 'detailed':
        return t(this._hass, 'mode_hint_detailed');
      case 'full':
        return t(this._hass, 'mode_hint_full');
      case 'custom':
        return t(this._hass, 'mode_hint_custom');
      default:
        return '';
    }
  };

  /** custom_sections falls back to DEFAULT_CUSTOM_SECTIONS the same way
   * the card itself does — done via the `data` passed into <ha-form>
   * above, not a schema-level `default` (that only applies when the
   * field is absent from `data` entirely, and here the fallback also
   * needs to apply whenever mode isn't 'custom', before the field would
   * ever be shown). Only real cleanup needed on the way back out: drop
   * custom_sections whenever mode isn't 'custom', matching the card's
   * own set-membership check (a stale list left over from a previous
   * Custom-mode session shouldn't linger once mode has moved away from
   * it) — same behavior the original hand-written _modeChanged had. */
  private _valueChanged(ev: CustomEvent<{ value: DockhandEnvironmentCardConfig }>): void {
    const next = { ...ev.detail.value };
    if (next.mode !== 'custom') {
      delete next.custom_sections;
    }
    this._config = next;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  /** Attached to the 'mode' field (not device_id — device_id can be
   * hidden entirely when cardIsEmbedded is true, but mode is always
   * present) via ha-form's own native .warning/computeWarning mechanism
   * — see DockhandContainerCardEditor's identical comment for the full
   * reasoning. */
  private _warning(mode: CardMode): Record<string, string> {
    if (!this._hass || !this._config?.device_id) return {};
    const requiredKeys = REQUIRED_KEYS_BY_MODE[mode] ?? REQUIRED_KEYS_BY_MODE.standard;
    const { unavailable } = resolveEnvironmentEntities(this._hass, this._config.device_id, requiredKeys);
    if (unavailable.length === 0) return {};

    const names = unavailable
      .map((u: { key: EnvTranslationKey; reason: string }) => `${ENV_FRIENDLY_LABEL[u.key] ?? u.key}${u.reason === 'not_found' ? ' (requires a newer ha-dockhand release)' : ''}`)
      .join(', ');
    return { mode: `This card would show more with these entities enabled: ${names}.` };
  }
}

customElements.define('dockhand-environment-card-editor', DockhandEnvironmentCardEditor);
