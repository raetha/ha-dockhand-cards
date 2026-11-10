import { loadEditor } from '../common/editor-loader';
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import {
  getEnvironmentDevices,
  getScheduleDevicesForEnvironment,
  getGlobalScheduleDevices,
  getRepresentativeEntityId,
  type EnvironmentDeviceOption
} from '../common/device-utils';
import { resolveCardName, multiEnvCardNameFallback } from '../common/card-name';
import { resolveScheduleEntities } from '../common/entity-resolver';
import { getDockhandBaseUrl, getInstanceLabel, formatRelativeTime } from '../common/format';
import { stateLabel } from '../common/state-label';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import { resolveIncludedOrdered, groupRowsByEnvironment, resolveEffectiveGroupBy } from '../common/environment-scope';
import { t } from '../common/i18n-card';
import type { DockhandSchedulesCardConfig, ScheduleSortBy, ScheduleGroupBy } from './types';
import { resolveVisibleBadges } from './types';
import { renderActionsColumn, renderScheduleControls, resolveScheduleControls } from '../common/device-controls';
import { NONE, applyFilters, type FilterExtractor } from '../common/filters';
import { renderFilteredNote } from '../common/list-filters';
import { cardStyles } from './styles';

// Status values per Dockhand's own ScheduleStatus type (db.ts) — the richer
// set (warning/error/cancelled/stale) is real, not hypothetical, so every
// value gets a mapping rather than falling back to a generic "unknown" look.
const STATUS_ICON: Record<string, { icon: string; cls: 'ok' | 'warn' | 'error' | 'info' | 'neutral' }> = {
  success: { icon: 'mdi:check-circle', cls: 'ok' },
  running: { icon: 'mdi:sync', cls: 'info' },
  queued: { icon: 'mdi:clock-outline', cls: 'neutral' },
  skipped: { icon: 'mdi:skip-next-circle-outline', cls: 'neutral' },
  warning: { icon: 'mdi:alert-circle', cls: 'warn' },
  failed: { icon: 'mdi:close-circle', cls: 'error' },
  error: { icon: 'mdi:close-circle', cls: 'error' },
  cancelled: { icon: 'mdi:cancel', cls: 'error' },
  stale: { icon: 'mdi:alert-circle-outline', cls: 'warn' }
};

// Attention-first ordering for sort_by: 'status'. Anything not listed here
// (a status Dockhand adds later) sorts alongside 'queued' — worth noticing
// but not assumed to be bad news, matching the STATUS_ICON fallback below.
const STATUS_RANK: Record<string, number> = {
  failed: 0,
  error: 0,
  cancelled: 0,
  stale: 1,
  warning: 1,
  running: 2,
  queued: 3,
  skipped: 3,
  success: 4
};

function humanizeType(type: string): string {
  const s = type.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface ScheduleRow {
  entityId: string;
  deviceId: string;
  name: string;
  type: string;
  environment?: string;
  environmentDeviceId?: string;
  /** Only ever set for a global row (environmentDeviceId undefined), and
   * only when this card's global schedules actually come from more than
   * one Dockhand instance — see _buildRows. There's nothing to disambiguate
   * when every global schedule belongs to the same (or the only) instance,
   * so this stays undefined rather than labeling rows that don't need it. */
  instanceLabel?: string;
  enabled: boolean;
  /** Dockhand's own schedule (is_system), when ha-dockhand says. */
  system?: boolean;
  status: string | null;
  nextRunIso: string | null;
}

const FILTERS: Record<string, FilterExtractor<ScheduleRow>> = {
  type: (row) => [row.type],
  last_result: (row) => [row.status ?? NONE],
  enabled: (row) => [row.enabled ? 'enabled' : 'disabled'],
  origin: (row) => (row.system === undefined ? [] : [row.system ? 'system' : 'user']),
  scope: (row) => [row.environmentDeviceId ? 'environment' : 'global']
};

/** Final tiebreak once the primary sort_by criterion (and, for next_run/
 * status, the existing name-based secondary one) can't distinguish two
 * rows — most concretely, two schedules with the exact same name in
 * different environments (e.g. each environment has a git stack literally
 * called "myapp"). Falls back to environment name explicitly rather than
 * leaving ties in the order resolveIncludedOrdered produced (Array.sort is
 * stable), which would follow the environment drag order even when rows
 * aren't grouped by environment.
 * Global schedules (environment: undefined) sort to '', ahead of any
 * named environment — consistent with groupKeyAndLabel's own "Global
 * sorts first" rule below, rather than an arbitrary, unrelated tiebreak
 * decision. */
function byNameThenEnvironment(a: ScheduleRow, b: ScheduleRow): number {
  const nameDiff = a.name.localeCompare(b.name);
  if (nameDiff !== 0) return nameDiff;
  return (a.environment ?? '').localeCompare(b.environment ?? '');
}

export function sortScheduleRows(rows: ScheduleRow[], sortBy: ScheduleSortBy): ScheduleRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortBy === 'next_run') {
      // Disabled/no-next-run rows sort last, regardless of direction.
      if (a.nextRunIso === null && b.nextRunIso === null) return byNameThenEnvironment(a, b);
      if (a.nextRunIso === null) return 1;
      if (b.nextRunIso === null) return -1;
      const diff = new Date(a.nextRunIso).getTime() - new Date(b.nextRunIso).getTime();
      return diff !== 0 ? diff : byNameThenEnvironment(a, b);
    }
    if (sortBy === 'status') {
      const rankA = a.status ? (STATUS_RANK[a.status] ?? 3) : 5;
      const rankB = b.status ? (STATUS_RANK[b.status] ?? 3) : 5;
      if (rankA !== rankB) return rankA - rankB;
      return byNameThenEnvironment(a, b);
    }
    return byNameThenEnvironment(a, b);
  });
  return sorted;
}

/** Pure decision logic behind ScheduleRow.instanceLabel: given every global
 * schedule device's own id and via_device_id (its parent schedules_hub),
 * plus a way to read a hub device's configuration_url, returns a Map of
 * schedule-device-id -> instance label — populated only when the global
 * schedules actually span more than one hub (see ScheduleRow.instanceLabel
 * for why an unambiguous single-instance case stays unlabeled). Exported
 * for testability, same reasoning as sortScheduleRows/groupScheduleRows:
 * _buildRows itself is too tightly coupled to live hass.devices/entity
 * resolution to test directly (see docs/backlog.md's Updates-card note on
 * this repo's standing testability bar).
 */
export function resolveGlobalInstanceLabels(
  globalDevices: { id: string; via_device_id: string | null }[],
  getHubConfigurationUrl: (hubId: string) => string | null | undefined
): Map<string, string> {
  const hubIdByDeviceId = new Map<string, string>();
  for (const device of globalDevices) {
    if (device.via_device_id) hubIdByDeviceId.set(device.id, device.via_device_id);
  }
  if (new Set(hubIdByDeviceId.values()).size <= 1) return new Map();

  const labels = new Map<string, string>();
  for (const [deviceId, hubId] of hubIdByDeviceId) {
    const label = getInstanceLabel(getHubConfigurationUrl(hubId));
    if (label) labels.set(deviceId, label);
  }
  return labels;
}

/** Text for the group headers groupScheduleRows produces. The default is
 * plain English; the card passes translated versions. */
export interface ScheduleGroupLabels {
  type: (type: string) => string;
  status: (status: string) => string;
  disabled: string;
  neverRun: string;
  global: string;
}

const ENGLISH_GROUP_LABELS: ScheduleGroupLabels = {
  type: humanizeType,
  status: humanizeType,
  disabled: 'Disabled',
  neverRun: 'Never run',
  global: 'Global'
};

function groupKeyAndLabel(row: ScheduleRow, groupBy: 'type' | 'status', labels: ScheduleGroupLabels): { key: string; label: string } {
  if (groupBy === 'type') return { key: row.type, label: labels.type(row.type) };
  // status
  if (!row.enabled) return { key: 'disabled', label: labels.disabled };
  if (!row.status) return { key: 'never_run', label: labels.neverRun };
  return { key: row.status, label: labels.status(row.status) };
}

// Group ordering for group_by: 'status' — attention-first, same idea as
// STATUS_RANK, extended with the two buckets that aren't a real Dockhand
// status value (disabled schedules, ones that have simply never executed
// yet). 'type' grouping sorts alphabetically instead — there's no
// equivalent "urgency" ordering for that dimension.
function statusGroupRank(key: string): number {
  if (key === 'disabled') return 6;
  if (key === 'never_run') return 5;
  return STATUS_RANK[key] ?? 3;
}

export function groupScheduleRows(
  rows: ScheduleRow[],
  groupBy: ScheduleGroupBy | undefined,
  sortBy: ScheduleSortBy,
  envDevices: EnvironmentDeviceOption[] = [],
  labels: ScheduleGroupLabels = ENGLISH_GROUP_LABELS
): { label: string | null; rows: ScheduleRow[] }[] {
  if (!groupBy || groupBy === 'none') return [{ label: null, rows: sortScheduleRows(rows, sortBy) }];

  if (groupBy === 'environment') {
    // Same structural fix as Stacks/Containers got — groups by iterating
    // envDevices directly (already in the right order) rather than
    // deriving a key per row and re-sorting buckets against a separate
    // order array. See environment-scope.ts's groupRowsByEnvironment for
    // the full reasoning; this was the exact bug reported and fixed this
    // session, twice, before landing on this structural fix instead of a
    // third patch. Global schedules (row.environmentDeviceId undefined —
    // see _buildRows) aren't covered by groupRowsByEnvironment at all
    // (it only ever groups by a real device id), so they're pulled out
    // and handled as their own bucket, prepended — sorting first, always,
    // same as before: not a real environment with a position in
    // envDevices to slot into, and "first" is a more predictable,
    // discoverable default than mixing it alphabetically among whichever
    // environments happen to sort near "Global".
    const globalRows = rows.filter((r) => r.environmentDeviceId === undefined);
    const envGroups = groupRowsByEnvironment(rows, envDevices, (bucketRows) => sortScheduleRows(bucketRows, sortBy));
    const globalGroup = globalRows.length > 0 ? [{ label: labels.global, rows: sortScheduleRows(globalRows, sortBy) }] : [];
    return [...globalGroup, ...envGroups];
  }

  const buckets = new Map<string, { label: string; rows: ScheduleRow[] }>();
  for (const row of rows) {
    const { key, label } = groupKeyAndLabel(row, groupBy, labels);
    if (!buckets.has(key)) buckets.set(key, { label, rows: [] });
    buckets.get(key)!.rows.push(row);
  }

  const entries = [...buckets.entries()];
  entries.sort(([keyA, bucketA], [keyB, bucketB]) => {
    if (groupBy === 'status') return statusGroupRank(keyA) - statusGroupRank(keyB);
    // 'type' — no inherent order, alphabetical by label is the only
    // sensible default.
    return bucketA.label.localeCompare(bucketB.label);
  });

  return entries.map(([, bucket]) => ({ label: bucket.label, rows: sortScheduleRows(bucket.rows, sortBy) }));
}

export class DockhandSchedulesCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandSchedulesCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandSchedulesCardConfig> {
    return { type: 'custom:dockhand-schedules-card' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await loadEditor();
    return document.createElement('dockhand-schedules-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandSchedulesCardConfig): void {
    this._config = {
      show_settings_link: true,
      show_stats: true,
      sort_by: 'status',
      ...config
    };
  }

  set config(config: DockhandSchedulesCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    return 4;
  }

  getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 2 };
  }

  private _moreInfo(entityId: string | null | undefined): void {
    if (!entityId) return;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  /** Any environment device or the schedules hub can supply Dockhand's base
   * origin — schedules aren't split across per-instance URLs, ha-dockhand's
   * own _schedules_url() always points at the same single Dockhand
   * instance's /schedules page regardless of which environment a given
   * schedule belongs to. */
  private _resolveBaseUrl(envDevices: EnvironmentDeviceOption[]): string | null {
    if (!this._hass) return null;
    for (const env of envDevices) {
      const url = getDockhandBaseUrl(this._hass.devices[env.deviceId]?.configuration_url);
      if (url) return url;
    }
    return null;
  }

  private _buildRows(): { rows: ScheduleRow[]; envDevices: EnvironmentDeviceOption[] } {
    if (!this._hass || !this._config) return { rows: [], envDevices: [] };

    const envDevices = resolveIncludedOrdered(getEnvironmentDevices(this._hass), this._config.environments_order, this._config.exclude_device_ids);

    // Pairs each schedule device with its parent environment's own
    // device id (known here, from which environment's own
    // getScheduleDevicesForEnvironment() call produced it) — carried
    // through to each row below for correct environmentOrder lookup when
    // grouping/sorting by environment. Deliberately not re-derived later
    // from the schedule entity's own `environment` attribute (a display
    // name, not a device id, and the wrong thing to match array indices
    // against — see groupScheduleRows' own comment on the bug this once
    // caused).
    const scheduleDevices = envDevices.flatMap((env) => {
      const envDevice = this._hass!.devices[env.deviceId];
      const devices = envDevice ? getScheduleDevicesForEnvironment(this._hass!, envDevice) : [];
      return devices.map((device) => ({ device, environmentDeviceId: env.deviceId as string | undefined }));
    });

    // Global schedules (system cleanup, destination maintenance) don't
    // belong to any single environment: shown unless include_global is
    // false (opt-out, like exclude_device_ids).
    const globalDevices = this._config.include_global !== false ? getGlobalScheduleDevices(this._hass) : [];
    for (const device of globalDevices) {
      scheduleDevices.push({ device, environmentDeviceId: undefined });
    }
    // See resolveGlobalInstanceLabels — only populated (per schedule device
    // id) when the global schedules actually span more than one instance.
    const globalInstanceLabels = resolveGlobalInstanceLabels(
      globalDevices.map((d) => ({ id: d.id, via_device_id: d.via_device_id })),
      (hubId) => this._hass!.devices[hubId]?.configuration_url
    );

    const rows: ScheduleRow[] = [];
    for (const { device, environmentDeviceId } of scheduleDevices) {
      const { found } = resolveScheduleEntities(this._hass, device.id, ['lastStatus', 'nextRun']);
      if (!found.lastStatus) continue;
      const attrs = found.lastStatus.state.attributes;
      const instanceLabel = environmentDeviceId === undefined ? globalInstanceLabels.get(device.id) : undefined;
      rows.push({
        entityId: found.lastStatus.entityId,
        deviceId: device.id,
        name: attrs.name || device.name_by_user || device.name || device.id,
        type: attrs.schedule_type || 'schedule',
        environment: attrs.environment,
        environmentDeviceId,
        instanceLabel,
        enabled: attrs.enabled !== false,
        system: typeof attrs.is_system === 'boolean' ? attrs.is_system : undefined,
        status: found.lastStatus.state.state === 'unknown' ? null : found.lastStatus.state.state,
        nextRunIso: found.nextRun && found.nextRun.state.state !== 'unknown' ? found.nextRun.state.state : null
      });
    }
    return { rows, envDevices };
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const { rows, envDevices } = this._buildRows();
    const base = this._resolveBaseUrl(envDevices);
    // First included environment, not "the" environment — this card can
    // show several. Composed mode (Area/Device/Floor) resolves against
    // whichever one happens to be first in display order; Custom mode
    // (a plain string) doesn't need an entity at all. See
    // common/card-name.ts for the shared resolver every card's Name
    // field now uses the same way.
    const representativeEntityId = envDevices[0] ? getRepresentativeEntityId(this._hass, envDevices[0].deviceId) : undefined;
    const title = resolveCardName(this._hass, representativeEntityId, this._config.name, multiEnvCardNameFallback(envDevices, t(this._hass, 'name_schedules')));
    // envDevices (already ordered — see _buildRows) is the only order:
    // groupScheduleRows groups by iterating it, so no second order array
    // can drift from it.
    const { rows: shown, hidden } = applyFilters(rows, this._hass, FILTERS, this._config.filters);
    const groups = groupScheduleRows(shown, resolveEffectiveGroupBy(this._config.group_by, envDevices, 'environment'), this._config.sort_by ?? 'status', envDevices, {
      type: (type) => stateLabel(this._hass, 'schedule_type', type),
      status: (status) => stateLabel(this._hass, 'schedule_status', status),
      disabled: t(this._hass, 'schedule_disabled'),
      neverRun: t(this._hass, 'schedule_never_run'),
      global: t(this._hass, 'schedule_global')
    });

    return html`
      <ha-card>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:calendar-clock', static: true })}
              <span class="truncate">${title}</span>
            </div>
            <div class="header-right">
              ${renderSettingsLink({
                hass: this._hass,
                show: this._config.show_settings_link,
                href: base ? `${base}/schedules` : null,
                tooltipKey: 'settings_link_view_schedules'
              })}
            </div>
          </div>
          <div class="divider"></div>
          ${this._config.show_stats ? this._renderStats(rows) : nothing}
          ${rows.length === 0
            ? html`<div class="card-message">
                <ha-icon icon="mdi:calendar-blank-outline"></ha-icon>
                <span>${t(this._hass, 'no_schedules_found')}</span>
              </div>`
            : html`
                ${this._config.show_stats ? html`<div class="divider"></div>` : nothing}
                ${shown.length === 0 ? html`<div class="card-message">${t(this._hass, 'msg_no_filter_matches')}</div>` : nothing}
                ${groups.map(
                  (g, i) => html`
                    ${i > 0 ? html`<div class="divider"></div>` : nothing}
                    ${g.label ? html`<div class="group-header">${g.label} (${g.rows.length})</div>` : nothing}
                    <div class="list">${g.rows.map((r) => this._renderRow(r))}</div>
                  `
                )}
                ${renderFilteredNote(this._hass, hidden, this._config.show_filtered_count)}
              `}
        </div>
      </ha-card>
    `;
  }

  private _renderStats(rows: ScheduleRow[]): TemplateResult {
    const success = rows.filter((r) => r.enabled && r.status === 'success').length;
    const failed = rows.filter((r) => r.enabled && ['failed', 'error', 'cancelled', 'stale'].includes(r.status ?? '')).length;
    // 'warning' is deliberately its own bucket, not folded into `failed` —
    // same distinction STATUS_ICON already makes at the row level (warn,
    // amber, vs error, red): a warning is worth checking, not necessarily
    // bad news, and burying it inside the failure count would overstate
    // how many things actually went wrong.
    const warning = rows.filter((r) => r.enabled && r.status === 'warning').length;
    const running = rows.filter((r) => r.enabled && r.status === 'running').length;
    // Almost always momentary (a schedule sits here for seconds at most,
    // between being triggered and actually starting) — counted anyway for
    // the same reason `skipped` was: a Dockhand status this card doesn't
    // account for isn't "probably nothing," it's a real state that was
    // silently invisible until it's added.
    const queued = rows.filter((r) => r.enabled && r.status === 'queued').length;
    // Git sync tasks land here often — "checked, nothing changed" isn't a
    // failure, but folding it into `success` would overstate how much
    // actually happened, and leaving it uncounted would understate the
    // total that ran at all.
    const skipped = rows.filter((r) => r.enabled && r.status === 'skipped').length;
    const disabled = rows.filter((r) => !r.enabled).length;

    return html`
      <div class="row stats-row">
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:check-circle', color: 'var(--dockhand-status-ok-color)', text: `${success}`, title: t(this._hass, 'schedule_status_success'), static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:close-circle', color: 'var(--dockhand-status-error-color)', text: `${failed}`, title: t(this._hass, 'schedule_status_failed'), static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:alert-circle', color: 'var(--dockhand-status-warn-color)', text: `${warning}`, title: t(this._hass, 'schedule_status_warning'), static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:sync', color: 'var(--dockhand-status-info-color)', text: `${running}`, title: t(this._hass, 'schedule_status_running'), static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:clock-outline', color: 'var(--secondary-text-color)', text: `${queued}`, title: t(this._hass, 'schedule_status_queued'), static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:skip-next-circle-outline', color: 'var(--secondary-text-color)', text: `${skipped}`, title: t(this._hass, 'schedule_status_skipped'), static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:cancel', color: 'var(--secondary-text-color)', text: `${disabled}`, title: t(this._hass, 'schedule_disabled'), static: true })}
        <span class="stat">${t(this._hass, 'label_total', { count: rows.length })}</span>
      </div>
    `;
  }

  private _renderRow(row: ScheduleRow): TemplateResult {
    const statusIcon = !row.enabled
      ? { icon: 'mdi:cancel', cls: 'neutral' as const }
      : row.status
        ? (STATUS_ICON[row.status] ?? { icon: 'mdi:help-circle', cls: 'neutral' as const })
        : { icon: 'mdi:minus-circle-outline', cls: 'neutral' as const };

    // group_by's own default, as the grouping and the editor use.
    const visibleBadges = resolveVisibleBadges(this._config?.visible_badges, this._config?.group_by ?? 'environment');
    const showEnvironment = visibleBadges.includes('environment');
    // The 'environment' badge is hidden by default once group_by:
    // 'environment' groups rows into per-environment sections already —
    // redundant for those rows, but *not* for the "Global" section, which
    // (deliberately, see groupScheduleRows) never splits by instance. So an
    // instanceLabel still shows in that default-grouped case even though
    // showEnvironment is false; it only follows showEnvironment's lead when
    // the person has explicitly picked their own visible_badges, since at
    // that point hiding 'environment' is a stated preference, not just
    // grouping already having covered it.
    const showInstanceLabel = this._config?.visible_badges ? showEnvironment : true;
    const nextRunText = !row.enabled
      ? t(this._hass, 'schedule_disabled')
      : row.status === 'running'
        ? t(this._hass, 'schedule_status_running')
        : formatRelativeTime(row.nextRunIso, this._hass);

    const controls = this._config?.show_controls && this._hass ? resolveScheduleControls(this._hass, row.deviceId) : null;
    const showNextRun = visibleBadges.includes('next_run') && nextRunText;

    return html`
      <div class="row clickable" @click=${() => this._moreInfo(row.entityId)}>
        <div class="row-left row-target" tabindex="0" role="button" @keydown=${onKeydownActivate(() => this._moreInfo(row.entityId))}>
          <ha-icon
            class="row-icon ${statusIcon.cls}"
            icon=${statusIcon.icon}
            title=${!row.enabled ? t(this._hass, 'schedule_disabled') : row.status ? stateLabel(this._hass, 'schedule_status', row.status) : t(this._hass, 'schedule_never_run')}
          ></ha-icon>
          <span class="item-name">${row.name}</span>
          ${showEnvironment && row.environment ? html`<span class="label-pill">${row.environment}</span>` : nothing}
          ${showInstanceLabel && row.instanceLabel ? html`<span class="label-pill">${row.instanceLabel}</span>` : nothing}
        </div>
        ${showNextRun ? html`<div class="row-right"><span>${nextRunText}</span></div>` : nothing}
        ${this._config?.show_controls ? renderActionsColumn(controls ? renderScheduleControls(this, this._hass, controls, row.name) : null) : nothing}
      </div>
    `;
  }
}
