import { loadEditor } from '../common/editor-loader';
import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import type { LovelaceCard, LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices } from '../common/device-utils';
import { resolveIncludedOrdered } from '../common/environment-scope';
import { hasPendingUpdates } from '../common/updates-visibility';
import type { DockhandEnvironmentCardConfig } from '../dockhand-environment-card/types';
import type { DockhandVulnerabilityCardConfig } from '../dockhand-vulnerability-card/types';
import type { DockhandStacksCardConfig } from '../dockhand-stacks-card/types';
import type { DockhandContainersCardConfig } from '../dockhand-containers-card/types';
import type { DockhandUpdatesCardConfig } from '../dockhand-updates-card/types';
import type { DockhandSchedulesCardConfig } from '../dockhand-schedules-card/types';
import { DEFAULT_SECTION_ORDER, enabledSections, getEnvironmentOrder, getEnvironmentOverrides, type DockhandOverviewCardConfig, type OverviewSection } from './types';
import { cardStyles } from './styles';

/** Resolves one generated child card's field: a per-environment override
 * wins if set, otherwise the section-wide global default if set,
 * otherwise the key is omitted entirely so the child card's own default
 * applies (see the comment above _renderColumn's config objects for why
 * omitting rather than passing `undefined` matters here). Extracted as
 * a shared helper specifically because the previous hand-copied version
 * of this exact ternary chain was written once for `visible_badges`/
 * `title` and never extended when `show_settings_link` became a second
 * override+global-default-capable field — silently leaving every
 * generated Stacks/Containers card's link-visibility permanently at its
 * own default regardless of what Overview's global setting or
 * per-environment override said, and leaving Environment/Vulnerability's
 * own show_settings_link with an override path but no global-default
 * one. A single call site per field, reused for every field that has
 * this exact override→global→omit shape, is what makes adding a 5th one
 * later just another call instead of another hand-copied ternary to
 * remember. */
export function mergeOverridableField<K extends string, T>(key: K, overrideValue: T | undefined, globalValue: T | undefined): { [P in K]?: T } {
  const value = overrideValue ?? globalValue;
  return value !== undefined ? ({ [key]: value } as { [P in K]?: T }) : {};
}

export class DockhandOverviewCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandOverviewCardConfig;
  @state() private _hass?: HomeAssistant;

  /** Pending requestAnimationFrame ID for the next equalisation pass,
   * stored so it can be cancelled if updated() fires again before the
   * previous rAF has had a chance to run — prevents redundant back-to-
   * back layout measurements when _hass updates arrive in quick
   * succession (every HA entity state push triggers updated()). */
  private _rafId?: number;
  /** ResizeObserver watching the .overview grid element so that
   * _equalizeColumnHeights() is re-run whenever the card's width
   * changes (e.g. viewport resize or column-count change). */
  private _resizeObserver?: ResizeObserver;
  /** The .overview element currently observed, used to avoid
   * re-subscribing on every updated() call when the element hasn't
   * changed. */
  private _observedOverview?: Element;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandOverviewCardConfig> {
    return {
      type: 'custom:dockhand-overview-card',
      show_environments: true,
      show_vulnerabilities: false,
      show_stacks: false,
      show_containers: false,
      show_updates: false,
      show_schedules: false,
      environment_mode: 'standard'
    };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await loadEditor();
    return document.createElement('dockhand-overview-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandOverviewCardConfig): void {
    this._config = {
      show_environments: true,
      show_vulnerabilities: false,
      show_stacks: false,
      show_containers: false,
      show_updates: false,
      show_schedules: false,
      environment_mode: 'standard',
      align_columns: true,
      ...config
    };
  }

  set config(config: DockhandOverviewCardConfig) {
    this.setConfig(config);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
    this._rafId = undefined;
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._observedOverview = undefined;
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 10;
    const count = getEnvironmentDevices(this._hass).filter((d) => !this._config?.exclude_device_ids?.includes(d.deviceId)).length;
    let perColumn = 0;
    if (this._config.show_environments) perColumn += this._config.environment_mode === 'full' ? 10 : this._config.environment_mode === 'detailed' ? 7 : 4;
    if (this._config.show_vulnerabilities) perColumn += 3;
    if (this._config.show_stacks) perColumn += 3;
    if (this._config.show_containers) perColumn += 3;
    if (this._config.show_updates) perColumn += 3;
    if (this._config.show_schedules) perColumn += 3;
    // Columns render side by side, not stacked, so overall height is
    // governed by the tallest column, not the sum — but with an unknown
    // number of columns per row (width-dependent), a single column's
    // height is the best estimate available for masonry purposes.
    return count > 0 ? Math.max(4, perColumn) : 4;
  }

  /** Defaults to full width — this card is explicitly meant to fill an
   * entire dashboard view, unlike every other card in this repo which
   * defaults to half-width/tile-like. */
  getGridOptions(): LovelaceGridOptions {
    return { columns: 'full', rows: 'auto', min_columns: 6, min_rows: 4 };
  }

  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);
    if (this._config?.align_columns !== false) {
      // Cancel any queued rAF before scheduling a new one — rapid-fire
      // _hass updates (one per HA entity state push) would otherwise
      // accumulate back-to-back layout passes for no net gain.
      if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
      // Defer measurement until after the browser has painted so that
      // child card heights are finalised (cards render async). A single
      // rAF is enough for our direct children; child-card internal
      // rendering is synchronous at this point given Lit's micro-task
      // scheduling.
      this._rafId = requestAnimationFrame(() => {
        this._rafId = undefined;
        this._equalizeColumnHeights();
        this._attachResizeObserver();
      });
    } else {
      // align_columns turned off — cancel any pending rAF, tear down the
      // observer, and clear stale references. The section-wrapper divs
      // themselves are removed by Lit's re-render, so no min-height
      // cleanup is needed here.
      if (this._rafId !== undefined) cancelAnimationFrame(this._rafId);
      this._rafId = undefined;
      this._resizeObserver?.disconnect();
      this._resizeObserver = undefined;
      this._observedOverview = undefined;
    }
  }

  /** Attach (or re-attach) a ResizeObserver on the .overview grid so
   * _equalizeColumnHeights() is re-run whenever the card width changes
   * (viewport resize, sidebar collapse, etc.). Skips reattachment when
   * the same element is already observed to avoid churn on every update. */
  private _attachResizeObserver(): void {
    const overview = this.shadowRoot?.querySelector('.overview');
    if (!overview || overview === this._observedOverview) return;
    this._resizeObserver?.disconnect();
    this._resizeObserver = new ResizeObserver(() => {
      // Reset and re-measure on every resize event — the column count
      // may have changed, so previous min-heights could be stale.
      this._equalizeColumnHeights();
    });
    this._resizeObserver.observe(overview);
    this._observedOverview = overview;
  }

  /** Equalise matching section slots across columns by setting each
   * .section-wrapper's min-height to the tallest natural height in its
   * row group. Operates only within visual rows — env-columns that share
   * the same grid row track — so single-column layouts (mobile, or an
   * overflow column sitting alone in the last row) never receive
   * min-height values and never show dead whitespace.
   *
   * Algorithm:
   *  1. Reset all .section-wrapper min-heights so measurements reflect
   *     natural content heights.
   *  2. Group .env-column elements into visual rows by their top edge
   *     (getBoundingClientRect().top, tolerance ±4 px for subpixel).
   *  3. Skip any row with fewer than 2 columns — nothing to align.
   *  4. Within each multi-column row, group that row's .section-wrapper
   *     elements by data-section and apply the row-local maximum height
   *     as min-height to every member. */
  private _equalizeColumnHeights(): void {
    const root = this.shadowRoot;
    if (!root) return;

    const wrappers = Array.from(root.querySelectorAll<HTMLElement>('.section-wrapper'));
    if (wrappers.length === 0) return;

    // Step 1: reset so we measure natural heights, not last-pass values.
    for (const w of wrappers) w.style.minHeight = '';

    // Step 2: group env-columns by visual row. getBoundingClientRect() is
    // called after the reset so column tops reflect the natural layout.
    const columns = Array.from(root.querySelectorAll<HTMLElement>('.env-column'));
    if (columns.length === 0) return;

    const rows: HTMLElement[][] = [];
    for (const col of columns) {
      const top = col.getBoundingClientRect().top;
      const existing = rows.find((r) => Math.abs(r[0].getBoundingClientRect().top - top) < 4);
      if (existing) {
        existing.push(col);
      } else {
        rows.push([col]);
      }
    }

    // Steps 3 & 4: equalise within each multi-column row only.
    for (const row of rows) {
      if (row.length < 2) continue;

      const rowWrappers = row.flatMap((col) => Array.from(col.querySelectorAll<HTMLElement>('.section-wrapper')));

      const bySection = new Map<string, HTMLElement[]>();
      for (const w of rowWrappers) {
        const s = w.dataset['section'];
        if (!s) continue;
        let group = bySection.get(s);
        if (!group) { group = []; bySection.set(s, group); }
        group.push(w);
      }

      for (const group of bySection.values()) {
        const maxH = Math.max(...group.map((w) => w.getBoundingClientRect().height));
        if (maxH > 0) {
          for (const w of group) w.style.minHeight = `${maxH}px`;
        }
      }
    }
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    // Overview doesn't expose "scope" as a user-facing concept — it
    // always behaves like the shared resolver's "selected" mode (opt-out
    // subset, custom order), just without ever calling it that or
    // routing through the scope-aware wrapper other cards' legacy
    // shapes need — Overview never had a legacy scope field to begin
    // with, so there's nothing here for that wrapper to cover. This is
    // also a genuine bug fix, not just a dedup: the removed inline
    // version's own comment claimed unlisted environments would sort
    // alphabetically among themselves because "getEnvironmentDevices
    // already sorts alphabetically" — it doesn't (confirmed against that
    // function's own source), so unlisted environments were actually
    // left in whatever order the device registry happened to iterate
    // them in, not alphabetical as claimed. resolveIncludedOrdered does
    // sort them alphabetically, for real.
    const devices = resolveIncludedOrdered(getEnvironmentDevices(this._hass), getEnvironmentOrder(this._config), this._config.exclude_device_ids);

    const alignColumns = this._config?.align_columns !== false;

    if (devices.length === 0) {
      return html`<div class="card-message">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>No Dockhand environments found.</span>
      </div>`;
    }

    if (
      !this._config.show_environments &&
      !this._config.show_vulnerabilities &&
      !this._config.show_stacks &&
      !this._config.show_containers &&
      !this._config.show_updates &&
      !this._config.show_schedules
    ) {
      return html`<div class="card-message">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>Every section is turned off — edit this card to enable at least one.</span>
      </div>`;
    }

    return html`
      <div class=${alignColumns ? 'overview' : 'overview no-align'}>
        ${devices.map((d) => this._renderColumn(d.deviceId, d.name, alignColumns))}
      </div>
    `;
  }

  /** Same "unlisted sorts after the ones that are ordered" approach as
   * resolveEnvironmentOrder (src/common/environment-scope.ts) uses for
   * environments, for sections within a column instead — a section not
   * present in the user's saved order (e.g. "updates", added after
   * they'd already arranged the others) sorts after the ordered ones, in
   * DEFAULT_SECTION_ORDER's own relative order rather than arbitrarily.
   * Not the same *function* since sections aren't keyed by device_id and
   * have no "environment device list" to resolve against — just the same
   * underlying idea, hand-rolled here rather than forced through a
   * shared helper that doesn't actually fit this shape. */
  private _orderedSections(): OverviewSection[] {
    const saved = this._config?.section_order;
    if (!saved) return DEFAULT_SECTION_ORDER;
    const known = new Set(saved);
    const rest = DEFAULT_SECTION_ORDER.filter((s) => !known.has(s));
    return [...saved, ...rest];
  }

  private _renderColumn(deviceId: string, name: string, alignColumns: boolean): TemplateResult {
    const override = getEnvironmentOverrides(this._config)?.[deviceId];

    // Deliberately NOT `title: override?.environment?.title` etc. for
    // every field — Environment/Vulnerability cards' own setConfig()
    // merges `{ show_settings_link: true, ...config }`, so an explicit
    // `show_settings_link: undefined` key here (present but unset,
    // whenever there's no override) would overwrite that default with
    // undefined via the spread, silently hiding the settings link for
    // every environment. Only including a key when the override actually
    // sets it — same as any other real "absence means use the default"
    // config coming from YAML — sidesteps that entirely.
    const envCfg: DockhandEnvironmentCardConfig = {
      type: 'custom:dockhand-environment-card',
      device_id: deviceId,
      mode: override?.environment?.mode ?? this._config?.environment_mode ?? 'standard',
      ...(override?.environment?.custom_sections !== undefined ? { custom_sections: override.environment.custom_sections } : this._config?.environment_custom_sections !== undefined ? { custom_sections: this._config.environment_custom_sections } : {}),
      ...(override?.environment?.name !== undefined ? { name: override.environment.name } : {}),
      ...mergeOverridableField('show_settings_link', override?.environment?.show_settings_link, this._config?.environment_show_settings_link)
    };
    const vulnCfg: DockhandVulnerabilityCardConfig = {
      type: 'custom:dockhand-vulnerability-card',
      device_id: deviceId,
      ...(override?.vulnerabilities?.name !== undefined ? { name: override.vulnerabilities.name } : {}),
      ...mergeOverridableField('show_settings_link', override?.vulnerabilities?.show_settings_link, this._config?.vulnerabilities_show_settings_link)
    };
    // Stacks is now multi-environment-capable (device_id became a legacy
    // field, kept only so an already-saved single-environment config
    // keeps working — see that card's own types.ts). Solo'd via
    // exclude_device_ids here rather than device_id: new code should use
    // the mechanism every other generated card already does, not the
    // path that exists solely to keep old configs working.
    const allEnvDeviceIds = getEnvironmentDevices(this._hass!).map((d) => d.deviceId);
    const stacksCfg: DockhandStacksCardConfig = {
      type: 'custom:dockhand-stacks-card',
      exclude_device_ids: allEnvDeviceIds.filter((id) => id !== deviceId),
      ...(override?.stacks?.name !== undefined ? { name: override.stacks.name } : {}),
      ...mergeOverridableField('visible_badges', override?.stacks?.visible_badges, this._config?.stacks_visible_badges),
      ...mergeOverridableField('show_settings_link', override?.stacks?.show_settings_link, this._config?.stacks_show_settings_link),
      ...mergeOverridableField('group_by', override?.stacks?.group_by, this._config?.stacks_group_by),
      ...mergeOverridableField('sort_by', override?.stacks?.sort_by, this._config?.stacks_sort_by)
    };
    // Containers is now multi-environment-capable too — same reasoning
    // as stacksCfg above.
    const containersCfg: DockhandContainersCardConfig = {
      type: 'custom:dockhand-containers-card',
      exclude_device_ids: allEnvDeviceIds.filter((id) => id !== deviceId),
      ...(override?.containers?.name !== undefined ? { name: override.containers.name } : {}),
      ...mergeOverridableField('visible_badges', override?.containers?.visible_badges, this._config?.containers_visible_badges),
      ...mergeOverridableField('show_settings_link', override?.containers?.show_settings_link, this._config?.containers_show_settings_link),
      ...mergeOverridableField('group_by', override?.containers?.group_by, this._config?.containers_group_by),
      ...mergeOverridableField('sort_by', override?.containers?.sort_by, this._config?.containers_sort_by)
    };
    // Updates is now multi-environment-capable too — same reasoning as
    // stacksCfg/containersCfg above.
    const updatesCfg: DockhandUpdatesCardConfig = {
      type: 'custom:dockhand-updates-card',
      exclude_device_ids: allEnvDeviceIds.filter((id) => id !== deviceId),
      ...(override?.updates?.name !== undefined ? { name: override.updates.name } : {})
    };
    const updatesHideOverride = override?.updates?.hide_when_no_updates;
    // Computed here so the Updates section renderer below can use it
    // without recomputing.
    const hideWhenNoUpdates = updatesHideOverride ?? this._config?.updates_hide_when_no_updates ?? false;
    // No device_id field to set (Schedules never had one) — solo'd to
    // this column's environment the same way the standalone editor's own
    // "solo" action works: every other environment excluded. include_global
    // forced off regardless of any override/global-default value — a
    // global (no-environment) schedule would otherwise repeat identically
    // in every column, since it isn't scoped to any one of them.
    // allEnvDeviceIds already computed above for stacksCfg — reused here.
    // Defaults to next_run only (excluding the environment badge) when
    // neither an override nor a global default has been set — matching
    // what the old show_environment_pill: false used to force
    // unconditionally, now expressed as visible_badges' own default
    // rather than a separate forced field. Not left to
    // resolveVisibleBadges' own default (['next_run', 'environment']
    // unless grouped by environment) — that default is right for the
    // standalone card, where nothing else already identifies which
    // environment a row belongs to, but wrong here, where the column
    // itself already does. The embedded editor's own multi_select never
    // offers 'environment' as a choice at all when cardIsEmbedded is
    // set (see Schedules' own editor.ts), so an explicit override or
    // global default could never actually contain it — this default is
    // the only place 'environment' needs to be kept out.
    const effectiveVisibleBadges = override?.schedules?.visible_badges ?? this._config?.schedules_visible_badges ?? ['next_run'];
    const scheduleCfg: DockhandSchedulesCardConfig = {
      type: 'custom:dockhand-schedules-card',
      exclude_device_ids: allEnvDeviceIds.filter((id) => id !== deviceId),
      include_global: false,
      visible_badges: effectiveVisibleBadges,
      ...(override?.schedules?.name !== undefined ? { name: override.schedules.name } : {}),
      ...mergeOverridableField('show_settings_link', override?.schedules?.show_settings_link, this._config?.schedules_show_settings_link),
      ...mergeOverridableField('show_stats', override?.schedules?.show_stats, this._config?.schedules_show_stats),
      ...mergeOverridableField('group_by', override?.schedules?.group_by, this._config?.schedules_group_by),
      ...mergeOverridableField('sort_by', override?.schedules?.sort_by, this._config?.schedules_sort_by)
    };

    const sections = this._config ? enabledSections(this._orderedSections(), this._config) : [];
    const sectionRenderers: Record<OverviewSection, () => TemplateResult | typeof nothing> = {
      environments: () =>
        this._config?.show_environments
          ? html`<dockhand-environment-card .hass=${this._hass} .config=${envCfg}></dockhand-environment-card>`
          : nothing,
      vulnerabilities: () =>
        this._config?.show_vulnerabilities
          ? html`<dockhand-vulnerability-card .hass=${this._hass} .config=${vulnCfg}></dockhand-vulnerability-card>`
          : nothing,
      stacks: () => (this._config?.show_stacks ? html`<dockhand-stacks-card .hass=${this._hass} .config=${stacksCfg}></dockhand-stacks-card>` : nothing),
      containers: () =>
        this._config?.show_containers
          ? html`<dockhand-containers-card .hass=${this._hass} .config=${containersCfg}></dockhand-containers-card>`
          : nothing,
      updates: () => {
        if (!this._config?.show_updates) return nothing;
        // Not delegated to the Updates card's own hide_when_no_updates
        // (native HA visibility, meant for a card HA directly manages) —
        // this nested instance is created inside this card's own shadow
        // DOM, so HA's visibility mechanism never reaches it (see
        // docs/ARCHITECTURE.md). Genuine zero-space collapse is achieved
        // here instead, simply by not including the element in this
        // template at all when there's nothing pending — this is a
        // plain grid column this card already controls, not HA's
        // sections grid, so there's no CSS span-validity issue to work
        // around the way there was for the standalone card.
        // hideWhenNoUpdates is computed above; reused here.
        if (hideWhenNoUpdates && this._hass && !hasPendingUpdates(this._hass, deviceId)) {
          return nothing;
        }
        return html`<dockhand-updates-card .hass=${this._hass} .config=${updatesCfg}></dockhand-updates-card>`;
      },
      schedules: () =>
        this._config?.show_schedules
          ? html`<dockhand-schedules-card .hass=${this._hass} .config=${scheduleCfg}></dockhand-schedules-card>`
          : nothing
    };

    // When align_columns is on, wrap every enabled section slot in a
    // .section-wrapper div — even when the section's content is
    // `nothing` — so _equalizeColumnHeights() has a stable DOM node for
    // every slot in every column to measure and equalise. The wrapper
    // for a hidden section starts at zero height and is stretched to
    // match the tallest column's corresponding section, acting as a
    // transparent spacer that keeps section boundaries lined up across
    // columns without CSS subgrid (which triggers a Chrome bug inflating
    // the second column track's width).
    const renderSection = (section: OverviewSection): TemplateResult | typeof nothing => {
      const content = sectionRenderers[section]();
      if (!alignColumns) return content;
      return html`<div class="section-wrapper" data-section=${section}>${content}</div>`;
    };

    return html`
      <div class="env-column">
        <div class="column-title">${name}</div>
        ${sections.map(renderSection)}
      </div>
    `;
  }
}
