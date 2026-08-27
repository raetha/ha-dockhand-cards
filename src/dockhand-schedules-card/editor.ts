import { LitElement, html, type TemplateResult } from 'lit';
import { state, property } from 'lit/decorators.js';
import { fireEvent, type LovelaceCardEditor } from 'custom-card-helpers';
import type { HaFormSchema } from '../common/ha-form-types';

import type { HomeAssistant } from '../common/ha-types';
import { getEnvironmentDevices, getRepresentativeEntityId } from '../common/device-utils';
import { cardNameFieldSchema } from '../common/card-name';
import { t } from '../common/i18n';
import { sortableRowStyles, editorFormStyles } from '../common/editor-styles';
import { renderEnvironmentOrderSection, resolveIncludedOrdered } from '../common/environment-scope';
import { type DockhandSchedulesCardConfig, type ScheduleGroupBy, resolveVisibleBadges } from './types';

export class DockhandSchedulesCardEditor extends LitElement implements LovelaceCardEditor {
  static styles = [sortableRowStyles, editorFormStyles];

  @state() private _config?: DockhandSchedulesCardConfig;
  @state() private _hass?: HomeAssistant;
  /** Set by an embedding editor (the Overview card's global-defaults and
   * per-environment override views) that already owns environment
   * scoping for every card it generates — this card's own Environments
   * section, and the include_global toggle that travels with it (both
   * meaningless once Overview forces every generated instance to one
   * solo'd environment with include_global: false — see Overview's own
   * card.ts), would be redundant/confusing there. Named to match
   * cardIsEmbedded on every other embeddable editor in this repo even
   * though this card never had a device_id-based picker to begin with —
   * same property name, same embedding mechanism
   * (EmbeddableCardEditor/_mountGlobalEditor in Overview's editor.ts),
   * just a different thing being hidden underneath it. Never set by HA
   * itself when this editor is used standalone via getConfigElement(),
   * so default false preserves existing behavior. */
  @property({ type: Boolean }) cardIsEmbedded = false;
  /** See DockhandEnvironmentCardEditor's identical property for the full
   * reasoning. */
  @property({ type: Boolean }) hideTitle = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  setConfig(config: DockhandSchedulesCardConfig): void {
    this._config = {
      show_settings_link: true,
      show_stats: true,
      sort_by: 'status',
      ...config
    };
  }

  // Restructured to follow HA's own Tile card editor precedent (checked
  // directly against HA frontend source, not assumed): a card's own
  // "what is this of" field(s) sit unwrapped at root — for Tile, just
  // `entity`; for this card, `include_global` and the Environments
  // section, since both govern *which* schedules this card is even
  // about, the same role Tile's `entity` field plays alone. Everything
  // that shapes how the included schedules are *displayed* — what used
  // to be split across a second <ha-form>, a "Row details" panel, and an
  // "Appearance" panel — now lives in one native `type: 'expandable'`
  // "Content" section, matching Tile's own Content section combining
  // name/icon/color/state-display/layout into one panel rather than
  // several. No more hand-built <ha-expansion-panel> for this content:
  // the native expandable type turns out to support everything it was
  // built to work around (icon: confirmed real via HA source, this repo
  // just hadn't found it yet) — hand-building stays reserved for the
  // Environments section specifically, which still doesn't fit any
  // schema field (drag-reorder, per-row icon actions).

  private _rootSchema(): HaFormSchema[] {
    return [
      // Renders before the Environments section (see render() below) —
      // matching Stacks/Containers' own layout for the same three-
      // component design, not the reverse order this briefly had.
      ...(this.cardIsEmbedded ? [] : [{ name: 'include_global', default: true, selector: { boolean: {} } }]),
      // Moved out of Content — unlike show_stats/show_settings_link/
      // visible_badges (reasonable defaults few people will want to
      // touch), group_by/sort_by are something a person is likely to
      // want to set the moment they add this card to a dashboard, not
      // leave at the default. Requiring an extra click into a collapsed
      // panel for that isn't the "less used options in an accordion"
      // trade this repo's own rule 0 is built on — these aren't the
      // less-used options.
      {
        name: 'group_by',
        default: this.cardIsEmbedded ? 'none' : 'environment',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'none', label: t(this._hass, 'group_by_none') },
              ...(this.cardIsEmbedded ? [] : [{ value: 'environment', label: t(this._hass, 'group_by_environment') }]),
              { value: 'type', label: t(this._hass, 'group_by_type_option') },
              { value: 'status', label: t(this._hass, 'group_by_status') }
            ]
          }
        }
      },
      // Always shown, not conditional on group_by — checked directly
      // against groupScheduleRows()'s own logic: every group's rows get
      // sortScheduleRows() applied regardless of groupBy, so sort_by
      // always has a real, visible effect within whatever groups exist
      // (or the one implicit group, when group_by: 'none'). The one case
      // where a specific *option* becomes a no-op — sort_by: 'status'
      // while group_by: 'status', since every row in a status bucket
      // already shares that status — isn't worth hiding or disabling the
      // whole control over; it's a single redundant choice, not the
      // control losing its purpose. If a future group_by value ever does
      // fully nullify sort_by, disable the control (`disabled: true`)
      // rather than hide it.
      {
        name: 'sort_by',
        default: 'status',
        selector: {
          select: {
            mode: 'dropdown' as const,
            options: [
              { value: 'name', label: t(this._hass, 'sort_by_name') },
              { value: 'next_run', label: t(this._hass, 'sort_by_next_run') },
              { value: 'status', label: t(this._hass, 'sort_by_status') }
            ]
          }
        }
      }
    ];
  }

  private _contentSchema(): HaFormSchema[] {
    // First included environment, not "the" environment — this card can
    // show several. Composed mode (Area/Device/Floor) resolves against
    // whichever one happens to be first in display order; Custom mode
    // (a plain string) doesn't need an entity at all. See
    // common/card-name.ts for the shared field/resolver every card's
    // Name field now uses the same way.
    const envDevices = this._hass ? resolveIncludedOrdered(getEnvironmentDevices(this._hass), this._config?.environments_order, this._config?.exclude_device_ids) : [];
    const representativeEntityId = envDevices[0] && this._hass ? getRepresentativeEntityId(this._hass, envDevices[0].deviceId) : undefined;

    return [
      {
        name: 'content',
        type: 'expandable',
        flatten: true,
        icon: 'mdi:text-short',
        title: t(this._hass, 'content_section_heading'),
        expanded: false,
        // Order follows the card's own visual top-to-bottom order (rule
        // 1): the name is the very first thing on the card, then the
        // settings link and stats row both sit in the header area, then
        // visible_badges governs what's shown *within* each row — the
        // last, most granular thing this section covers. group_by/
        // sort_by used to sit here too — moved to root (_rootSchema
        // above), since they're something a person is likely to want to
        // set right away, not a reasonable-default-most-won't-touch
        // field the rest of this section is for.
        schema: [
          ...(this.hideTitle ? [] : [cardNameFieldSchema(representativeEntityId, 'Schedules')]),
          {
            name: '',
            type: 'grid',
            schema: [
              { name: 'show_settings_link', default: true, selector: { boolean: {} } },
              { name: 'show_stats', default: true, selector: { boolean: {} } }
            ]
          },
          // Checkboxes under one shared heading (computeLabel's own
          // 'visible_badges' case), matching Stacks/Containers'
          // established convention for this exact shape of thing — more
          // than one optional per-row detail (next-run time and the
          // environment pill) — rather than two standalone toggles. See
          // docs/EDITOR_DESIGN.md rule 5.
          // 'environment' option omitted (not merely unchecked) when
          // embedded — same reasoning as include_global: once every
          // generated card is solo'd to one environment, the option
          // wouldn't do anything meaningful if picked.
          {
            name: 'visible_badges',
            type: 'multi_select',
            options: {
              next_run: t(this._hass, 'badge_next_run'),
              ...(this.cardIsEmbedded ? {} : { environment: t(this._hass, 'badge_environment') })
            }
          }
        ]
      }
    ];
  }

  protected render(): TemplateResult {
    if (!this._hass || !this._config) return html``;

    const groupBy: ScheduleGroupBy = this._config.group_by ?? (this.cardIsEmbedded ? 'none' : 'environment');
    const rootSchema = this._rootSchema();

    return html`
      ${rootSchema.length > 0
        ? html`
            <ha-form
              .hass=${this._hass}
              .data=${{ ...this._config, group_by: this._config.group_by ?? (this.cardIsEmbedded ? 'none' : 'environment') }}
              .schema=${rootSchema}
              .computeLabel=${this._computeLabel}
              @value-changed=${this._valueChanged}
            ></ha-form>
          `
        : html``}

      <!--
        No scope field, no device_id field — an earlier version of this
        editor had both (all/selected/environment/global), conditionally
        showing/hiding a device picker depending on which was chosen. This
        section is now always shown (except when embedded — see
        renderEnvironmentOrderSection's own hidden param), always fully
        interactive (reorder + exclude + solo), and covers every one of
        those cases on its own: "all" is nothing excluded, "one
        environment" is solo-ing it (one click, via the target icon per
        row — actually faster than the old two-step scope-then-device
        picker), "some" is excluding a few, "none" is excluding all of
        them. Renders after include_global/group_by/sort_by above, not
        before — matching Stacks/Containers' own layout for the same
        three-component design (Environments + group_by + sort_by), for
        consistency across every card that has all three. Also means the
        Environments section's own drag-enabled/disabled state (see
        allowReorder below) already reflects whatever group_by choice was
        just made above it, rather than a person seeing greyed-out drag
        handles before they've had a chance to set group_by to
        'environment' in the first place. See environment-scope.ts's
        renderEnvironmentOrderSection for the shared implementation this
        and the Overview/Updates cards' own versions of this same control
        are built from. Heading reuses label_environments (already
        translated everywhere, already reads "Environments") rather than
        a new key.
      -->
      ${renderEnvironmentOrderSection({
        hass: this._hass,
        headingKey: 'label_environments',
        hintKey: 'order_list_hint',
        icon: 'mdi:web',
        hidden: this.cardIsEmbedded,
        order: this._config.environments_order,
        excluded: this._config.exclude_device_ids,
        showExcludeToggle: true,
        // Drag order only actually affects anything when grouped by
        // environment (groupScheduleRows sorts *other* groupings by
        // status rank or alphabetically, never by environmentOrder) — so
        // the handle stays visible (still useful to see the current
        // order) but disabled otherwise, rather than functional but
        // silently inert.
        allowReorder: groupBy === 'environment',
        onMoved: (order) => this._updateConfig({ environments_order: order }),
        onToggleExcluded: (deviceId, nowExcluded) => {
          const current = this._config?.exclude_device_ids ?? [];
          const next = nowExcluded ? [...current, deviceId] : current.filter((id) => id !== deviceId);
          this._updateConfig({ exclude_device_ids: next });
        },
        onSolo: (deviceId) => {
          const all = getEnvironmentDevices(this._hass!).map((d) => d.deviceId);
          this._updateConfig({ exclude_device_ids: all.filter((id) => id !== deviceId) });
        },
        onSelectAll: () => this._updateConfig({ exclude_device_ids: [] }),
        onClearAll: () => this._updateConfig({ exclude_device_ids: getEnvironmentDevices(this._hass!).map((d) => d.deviceId) })
      })}

      <ha-form
        .hass=${this._hass}
        .data=${{ ...this._config, group_by: groupBy, visible_badges: resolveVisibleBadges(this._config.visible_badges, groupBy) }}
        .schema=${this._contentSchema()}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _updateConfig(patch: Partial<DockhandSchedulesCardConfig>): void {
    if (!this._config) return;
    this._config = { ...this._config, ...patch };
    fireEvent(this, 'config-changed', { config: this._config });
  }

  private _computeLabel = (schema: HaFormSchema): string => {
    switch (schema.name) {
      case 'include_global':
        return t(this._hass, 'include_global_schedules');
      case 'name':
        return t(this._hass, 'title_override');
      case 'show_settings_link':
        return t(this._hass, 'show_settings_link');
      case 'show_stats':
        return t(this._hass, 'show_stats');
      case 'visible_badges':
        return t(this._hass, 'visible_badges_label');
      case 'group_by':
        return t(this._hass, 'group_by_label');
      case 'sort_by':
        return t(this._hass, 'sort_by_label');
      default:
        return schema.name;
    }
  };

  private _valueChanged(ev: CustomEvent<{ value: DockhandSchedulesCardConfig }>): void {
    this._config = { ...ev.detail.value };
    fireEvent(this, 'config-changed', { config: this._config });
  }
}

customElements.define('dockhand-schedules-card-editor', DockhandSchedulesCardEditor);
