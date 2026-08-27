import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import {
  getEnvironmentDevices,
  getEnvId,
  getScheduleDevicesForEnvironment,
  getGlobalScheduleDevices,
  getRepresentativeEntityId,
  type EnvironmentDeviceOption
} from '../common/device-utils';
import { resolveCardName, multiEnvCardNameFallback } from '../common/card-name';
import { resolveScheduleEntities } from '../common/entity-resolver';
import { getDockhandBaseUrl, formatRelativeTime } from '../common/format';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import { resolveIncludedOrdered, groupRowsByEnvironment, resolveEffectiveGroupBy } from '../common/environment-scope';
import { t } from '../common/i18n';
import type { DockhandSchedulesCardConfig, ScheduleSortBy, ScheduleGroupBy } from './types';
import { resolveVisibleBadges } from './types';
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
  name: string;
  type: string;
  environment?: string;
  environmentDeviceId?: string;
  enabled: boolean;
  status: string | null;
  nextRunIso: string | null;
}

/** Final tiebreak once the primary sort_by criterion (and, for next_run/
 * status, the existing name-based secondary one) can't distinguish two
 * rows — most concretely, two schedules with the exact same name in
 * different environments (e.g. each environment has a git stack literally
 * called "myapp"). Falls back to environment name explicitly rather than
 * leaving it to whatever incidental order rows happened to arrive in from
 * resolveIncludedOrdered (Array.sort is stable, so ties used to silently
 * preserve environment resolution order — either alphabetical, or the
 * custom drag order — even though group_by wasn't 'environment' at all
 * and the person had no reason to expect environment order to matter).
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

function groupKeyAndLabel(row: ScheduleRow, groupBy: 'type' | 'status'): { key: string; label: string } {
  if (groupBy === 'type') return { key: row.type, label: humanizeType(row.type) };
  // status
  if (!row.enabled) return { key: 'disabled', label: 'Disabled' };
  if (!row.status) return { key: 'never_run', label: 'Never run' };
  return { key: row.status, label: humanizeType(row.status) };
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
  envDevices: EnvironmentDeviceOption[] = []
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
    const globalGroup = globalRows.length > 0 ? [{ label: 'Global', rows: sortScheduleRows(globalRows, sortBy) }] : [];
    return [...globalGroup, ...envGroups];
  }

  const buckets = new Map<string, { label: string; rows: ScheduleRow[] }>();
  for (const row of rows) {
    const { key, label } = groupKeyAndLabel(row, groupBy);
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
    await import('./editor');
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
      const envId = getEnvId(this._hass!.devices[env.deviceId]);
      const devices = envId !== null ? getScheduleDevicesForEnvironment(this._hass!, envId) : [];
      return devices.map((device) => ({ device, environmentDeviceId: env.deviceId as string | undefined }));
    });

    // Global schedules (system cleanup, destination maintenance) don't
    // belong to any single environment — always available now, gated only
    // on include_global itself (defaulting to true, same opt-out
    // philosophy as environments_order/exclude_device_ids), not on a
    // scope value the way it used to be.
    if (this._config.include_global !== false) {
      scheduleDevices.push(...getGlobalScheduleDevices(this._hass).map((device) => ({ device, environmentDeviceId: undefined })));
    }

    const rows: ScheduleRow[] = [];
    for (const { device, environmentDeviceId } of scheduleDevices) {
      const { found } = resolveScheduleEntities(this._hass, device.id, ['lastStatus', 'nextRun']);
      if (!found.lastStatus) continue;
      const attrs = found.lastStatus.state.attributes;
      rows.push({
        entityId: found.lastStatus.entityId,
        name: attrs.name || device.name_by_user || device.name || device.id,
        type: attrs.schedule_type || 'schedule',
        environment: attrs.environment,
        environmentDeviceId,
        enabled: attrs.enabled !== false,
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
    const title = resolveCardName(this._hass, representativeEntityId, this._config.name, multiEnvCardNameFallback(envDevices, 'Schedules'));
    // envDevices (already correctly ordered — see _buildRows) passes
    // straight through to groupScheduleRows now, which groups by
    // iterating it directly rather than deriving a key per row and
    // re-sorting buckets against a separate order array afterward. Two
    // earlier versions of this call site got progressively closer but
    // still wrong — one converted environments_order into a name-keyed
    // array (right when written, wrong once grouping switched to device
    // ids), the next passed the device-id array directly but through a
    // separate re-sort step that could still drift out of sync. This is
    // the structural fix: there's no second order-bearing value left to
    // drift from envDevices' own order at all.
    const groups = groupScheduleRows(rows, resolveEffectiveGroupBy(this._config.group_by, envDevices, 'environment'), this._config.sort_by ?? 'status', envDevices);

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
                ${groups.map(
                  (g, i) => html`
                    ${i > 0 ? html`<div class="divider"></div>` : nothing}
                    ${g.label ? html`<div class="group-header">${g.label} (${g.rows.length})</div>` : nothing}
                    <div class="list">${g.rows.map((r) => this._renderRow(r))}</div>
                  `
                )}
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
    // actually happened, and leaving it uncounted (as an earlier version
    // of this row did) understated the total that ran at all.
    const skipped = rows.filter((r) => r.enabled && r.status === 'skipped').length;
    const disabled = rows.filter((r) => !r.enabled).length;

    return html`
      <div class="row stats-row">
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:check-circle', color: 'var(--dockhand-status-ok-color)', text: `${success}`, title: 'Success', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:close-circle', color: 'var(--dockhand-status-error-color)', text: `${failed}`, title: 'Failed', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:alert-circle', color: 'var(--dockhand-status-warn-color)', text: `${warning}`, title: 'Warning', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:sync', color: 'var(--dockhand-status-info-color)', text: `${running}`, title: 'Running', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:clock-outline', color: 'var(--secondary-text-color)', text: `${queued}`, title: 'Queued', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:skip-next-circle-outline', color: 'var(--secondary-text-color)', text: `${skipped}`, title: 'Skipped', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:cancel', color: 'var(--secondary-text-color)', text: `${disabled}`, title: 'Disabled', static: true })}
        <span class="stat">Total ${rows.length}</span>
      </div>
    `;
  }

  private _renderRow(row: ScheduleRow): TemplateResult {
    const statusIcon = !row.enabled
      ? { icon: 'mdi:cancel', cls: 'neutral' as const }
      : row.status
        ? (STATUS_ICON[row.status] ?? { icon: 'mdi:help-circle', cls: 'neutral' as const })
        : { icon: 'mdi:minus-circle-outline', cls: 'neutral' as const };

    const visibleBadges = resolveVisibleBadges(this._config?.visible_badges, this._config?.group_by);
    const showEnvironment = visibleBadges.includes('environment');
    const nextRunText = !row.enabled ? 'disabled' : row.status === 'running' ? 'running' : formatRelativeTime(row.nextRunIso);

    return html`
      <div class="row clickable" tabindex="0" role="button" @click=${() => this._moreInfo(row.entityId)} @keydown=${onKeydownActivate(() => this._moreInfo(row.entityId))}>
        <div class="row-left">
          <ha-icon class="row-icon ${statusIcon.cls}" icon=${statusIcon.icon}></ha-icon>
          <span class="item-name">${row.name}</span>
          ${showEnvironment && row.environment ? html`<span class="label-pill">${row.environment}</span>` : nothing}
        </div>
        ${visibleBadges.includes('next_run') && nextRunText ? html`<span class="row-right">${nextRunText}</span>` : nothing}
      </div>
    `;
  }
}
