import { loadEditor } from '../common/editor-loader';
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getStackDevicesForEnvironment, getRepresentativeEntityId, type EnvironmentDeviceOption, getStackName } from '../common/device-utils';
import { resolveCardName, multiEnvCardNameFallback } from '../common/card-name';
import { resolveIncludedOrdered, groupRowsByEnvironment, resolveEffectiveGroupBy } from '../common/environment-scope';
import { resolveStackEntities, type ResolutionResult } from '../common/entity-resolver';
import { bytesState, formatBytes, formatPercent, getDockhandBaseUrl, numericState } from '../common/format';
import { t } from '../common/i18n-card';
import { stateLabel } from '../common/state-label';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import type { StackTranslationKey } from '../common/const';
import { DEFAULT_STACKS_BADGES, type DockhandStacksCardConfig, type StacksGroupBy, type StacksSortBy } from './types';
import { renderRowControls, renderActionsColumn, resolveDeviceControls, rowControlSlots } from '../common/device-controls';
import { applyFilters, type FilterExtractor } from '../common/filters';
import { renderFilteredNote, tagValues } from '../common/list-filters';
import { renderTagPills } from '../common/tag-pills';
import { cell, renderAlignedList, shownColumns } from '../common/aligned-list';
import { cardStyles } from './styles';
import { RowFitController } from '../common/row-fit';

// Matches Dockhand's own stackStatusTypes color list (src/routes/stacks/+page.svelte).
const STATUS_ICON: Record<string, { icon: string; cls: 'ok' | 'warn' | 'error' | 'neutral' }> = {
  running: { icon: 'mdi:play-circle', cls: 'ok' },
  partial: { icon: 'mdi:alert-circle', cls: 'warn' },
  restarting: { icon: 'mdi:restart', cls: 'warn' },
  stopped: { icon: 'mdi:stop-circle', cls: 'error' },
  created: { icon: 'mdi:circle-outline', cls: 'neutral' }
};

// Attention-first ordering for sort_by/group_by: 'status' — problems
// first, matching every other card's own status-priority convention
// (Schedules' STATUS_RANK, this repo's established pattern) rather than
// introducing a different one here.
const STATUS_RANK: Record<string, number> = {
  stopped: 0,
  partial: 1,
  restarting: 1,
  running: 2,
  created: 3
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 4;
}

interface StackRow {
  deviceId: string;
  name: string;
  type: string;
  status: string;
  environment: string;
  environmentDeviceId: string;
  found: ResolutionResult<StackTranslationKey>['found'];
}

const known = (state: string | undefined): string[] => (state && state !== 'unknown' && state !== 'unavailable' ? [state] : []);

const FILTERS: Record<string, FilterExtractor<StackRow>> = {
  status: (row) => known(row.status),
  // `type` is ha-dockhand's value (internal, git, untracked); the device
  // model, the fallback, is "Internal Stack" and so on.
  type: (row) => [row.type.toLowerCase().replace(/ stack$/, '')],
  updates: (row) => {
    const state = row.found.updatesAvailable?.state.state;
    return state === 'on' ? ['available'] : state === 'off' ? ['none'] : [];
  },
  git_sync: (row, hass) => known(resolveStackEntities(hass, row.deviceId, ['gitSyncStatus']).found.gitSyncStatus?.state.state),
  tags: (row) => tagValues(row.found.status?.state)
};

const PROBLEM_STATUSES = new Set(['stopped', 'partial', 'restarting']);

/** What Always show problems keeps in view: a stack that's stopped, only
 * partly running or restarting, or whose Git sync failed (the editor's
 * helper text says the same). */
export function isProblem(row: StackRow, hass: HomeAssistant): boolean {
  return PROBLEM_STATUSES.has(row.status) || resolveStackEntities(hass, row.deviceId, ['gitSyncStatus']).found.gitSyncStatus?.state.state === 'error';
}

function byNameThenEnvironment(a: StackRow, b: StackRow): number {
  const byName = a.name.localeCompare(b.name);
  return byName !== 0 ? byName : a.environment.localeCompare(b.environment);
}

/** The stack's container count, as its row shows it; -1 when unknown,
 * so those sort last. */
function containerCount(row: StackRow): number {
  return numericState(row.found.containersInStack?.state.state) ?? -1;
}

/** The stack's CPU percentage in whole percent, as the row shows it (so
 * rows showing the same number sort by name), or its memory in use in
 * bytes, as Dockhand's stacks list sorts it; -1 when it has none, so
 * those sort last. */
function usage(row: StackRow, sortBy: 'cpu' | 'memory'): number {
  const value = sortBy === 'cpu' ? numericState(row.found.cpuPercent?.state.state) : bytesState(row.found.memoryUsage?.state);
  return value === undefined ? -1 : Math.round(value);
}

export function sortStackRows(rows: StackRow[], sortBy: StacksSortBy): StackRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortBy === 'status') {
      const rankA = statusRank(a.status);
      const rankB = statusRank(b.status);
      if (rankA !== rankB) return rankA - rankB;
    } else if (sortBy === 'containers') {
      const diff = containerCount(b) - containerCount(a);
      if (diff !== 0) return diff;
    } else if (sortBy === 'cpu' || sortBy === 'memory') {
      const diff = usage(b, sortBy) - usage(a, sortBy);
      if (diff !== 0) return diff;
    }
    return byNameThenEnvironment(a, b);
  });
  return sorted;
}

function capitalize(_groupBy: 'status' | 'type', value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function groupKeyAndLabel(row: StackRow, groupBy: 'status' | 'type', label: (groupBy: 'status' | 'type', value: string) => string): { key: string; label: string } {
  const value = groupBy === 'status' ? row.status : row.type;
  return { key: value, label: label(groupBy, value) };
}

export function groupStackRows(
  rows: StackRow[],
  groupBy: StacksGroupBy | undefined,
  sortBy: StacksSortBy,
  envDevices: EnvironmentDeviceOption[] = [],
  labelFor: (groupBy: 'status' | 'type', value: string) => string = capitalize
): { label: string | null; rows: StackRow[] }[] {
  if (!groupBy || groupBy === 'none') return [{ label: null, rows: sortStackRows(rows, sortBy) }];

  // 'environment' groups in envDevices' own order (already resolved by
  // resolveIncludedOrdered), like groupRowsByEnvironment in
  // environment-scope.ts, which the Schedules and Containers cards use.
  if (groupBy === 'environment') {
    return groupRowsByEnvironment(rows, envDevices, (bucketRows) => sortStackRows(bucketRows, sortBy));
  }

  const buckets = new Map<string, { label: string; rows: StackRow[] }>();
  for (const row of rows) {
    const { key, label } = groupKeyAndLabel(row, groupBy, labelFor);
    if (!buckets.has(key)) buckets.set(key, { label, rows: [] });
    buckets.get(key)!.rows.push(row);
  }

  const entries = [...buckets.entries()];
  entries.sort(([keyA, bucketA], [keyB, bucketB]) => {
    if (groupBy === 'status') return statusRank(keyA) - statusRank(keyB);
    // 'type' — no inherent order, so alphabetical by label (not key,
    // though for 'type' they're the same thing) is the only sensible
    // default.
    return bucketA.label.localeCompare(bucketB.label);
  });

  return entries.map(([, bucket]) => ({ label: bucket.label, rows: sortStackRows(bucket.rows, sortBy) }));
}

/** Memory in use rather than a percentage, as Dockhand's stacks list shows
 * it: Dockhand reports no percentage for a stack, and its limit is the
 * largest single container's, not the stack's. If Dockhand ever reports a
 * stack's percentage, show that, as the Containers card does. */
function stackMemory(row: StackRow): number | undefined {
  return bytesState(row.found.memoryUsage?.state);
}

/** Right-hand row details in their order on a row; each shown one is a
 * column. Type, environment and tags stay with the name, on its left. */
const COLUMN_ORDER = ['updates', 'container_count', 'cpu', 'memory'] as const;
type ColumnKey = (typeof COLUMN_ORDER)[number] | 'controls';

function hasDetail(row: StackRow, key: (typeof COLUMN_ORDER)[number]): boolean {
  const found = row.found;
  switch (key) {
    case 'updates':
      return found.updatesAvailable?.state.state === 'on';
    case 'container_count':
      return found.containersInStack?.state.state !== undefined;
    case 'cpu':
      return numericState(found.cpuPercent?.state.state) !== undefined;
    case 'memory':
      return stackMemory(row) !== undefined;
  }
}

export class DockhandStacksCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  constructor() {
    super();
    new RowFitController(this);
  }

  @state() private _config?: DockhandStacksCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandStacksCardConfig> {
    return { type: 'custom:dockhand-stacks-card' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await loadEditor();
    return document.createElement('dockhand-stacks-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandStacksCardConfig): void {
    this._config = { show_settings_link: true, sort_by: 'name', ...config };
  }

  set config(config: DockhandStacksCardConfig) {
    this.setConfig(config);
  }

  private _problems(): ((row: StackRow) => boolean) | undefined {
    const hass = this._hass;
    return this._config?.always_show_problems && hass ? (row) => isProblem(row, hass) : undefined;
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 3;
    const { rows } = applyFilters(this._buildRows().rows, this._hass, FILTERS, this._config.filters, this._problems());
    return Math.max(2, Math.ceil(rows.length / 2) + 1);
  }

  getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 2 };
  }

  private _moreInfo(entityId: string | null | undefined): void {
    if (!entityId) return;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  private _resolveBaseUrl(envDevices: EnvironmentDeviceOption[]): string | null {
    for (const env of envDevices) {
      const device = this._hass!.devices[env.deviceId];
      const base = device ? getDockhandBaseUrl(device.configuration_url) : null;
      if (base) return base;
    }
    return null;
  }

  private _buildRows(): { rows: StackRow[]; envDevices: EnvironmentDeviceOption[] } {
    if (!this._hass || !this._config) return { rows: [], envDevices: [] };

    const envDevices = resolveIncludedOrdered(getEnvironmentDevices(this._hass), this._config.environments_order, this._config.exclude_device_ids);

    const rows: StackRow[] = envDevices.flatMap((env) => {
      const envDevice = this._hass!.devices[env.deviceId];
      const stackDevices = envDevice ? getStackDevicesForEnvironment(this._hass!, envDevice) : [];
      return stackDevices
        .map((d) => {
          const { found } = resolveStackEntities(this._hass!, d.id, ['status', 'containersInStack', 'updatesAvailable', 'pendingUpdates', 'cpuPercent', 'memoryUsage']);
          if (!found.status) return null;
          const attrs = found.status.state.attributes;
          return {
            deviceId: d.id,
            name: getStackName(d) || d.name_by_user || d.name || d.id,
            type: attrs.type || d.model || 'Stack',
            status: found.status.state.state,
            environment: env.name,
            environmentDeviceId: env.deviceId,
            found
          };
        })
        .filter((r): r is StackRow => r !== null);
    });

    return { rows, envDevices };
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const { rows, envDevices } = this._buildRows();
    if (envDevices.length === 0) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>${t(this._hass, 'msg_no_environment_selected')}</span>
        </div>
      </ha-card>`;
    }

    const representativeEntityId = getRepresentativeEntityId(this._hass, envDevices[0].deviceId);
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, multiEnvCardNameFallback(envDevices, t(this._hass, 'name_stacks')));
    const base = this._resolveBaseUrl(envDevices);
    const { rows: shown, hidden } = applyFilters(rows, this._hass, FILTERS, this._config.filters, this._problems());
    const groups = groupStackRows(shown, resolveEffectiveGroupBy(this._config.group_by, envDevices, 'environment'), this._config.sort_by ?? 'name', envDevices, (by, value) =>
      stateLabel(this._hass, by === 'status' ? 'stack_status' : 'stack_type', value)
    );
    this._slots = this._showsControls() ? rowControlSlots(this._hass, shown.map((r) => r.deviceId)) : 2;

    return html`
      <ha-card style=${`--row-control-slots: ${this._slots}`}>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:layers', static: true })}
              <span class="truncate">${name}</span>
            </div>
            <div class="header-right">
              ${renderSettingsLink({
                hass: this._hass,
                show: this._config?.show_settings_link,
                href: base ? `${base}/stacks` : null,
                tooltipKey: 'settings_link_view_stacks'
              })}
            </div>
          </div>
          <div class="divider"></div>
          ${rows.length === 0
            ? html`<div class="card-message">${t(this._hass, 'msg_no_stacks_yet')}</div>`
            : shown.length === 0
              ? html`<div class="card-message">${t(this._hass, 'msg_no_filter_matches')}</div>`
              : this._renderList(groups)}
          ${renderFilteredNote(this._hass, hidden, this._config.show_filtered_count)}
        </div>
      </ha-card>
    `;
  }

  /** Control slots per row in this render (rowControlSlots). */
  private _slots = 2;

  /** Off unless chosen under Row details, so a stray tap on a list doesn't
   * stop anything. */
  private _showsControls(): boolean {
    return (this._config?.visible_badges ?? DEFAULT_STACKS_BADGES).includes('controls');
  }

  /** A row's controls column (_showsControls). */
  private _renderControls(row: StackRow): TemplateResult | typeof nothing {
    if (!this._showsControls() || !this._hass) return nothing;
    const controls = resolveDeviceControls(this._hass, row.deviceId, true);
    return renderActionsColumn(controls ? renderRowControls(this, this._hass, controls, row.name, this._slots) : null);
  }

  /** The row details shown, in their order on a row: each is a column of
   * the list, so the details line up down the card. A detail that's
   * hidden, or that no row has, has no column. */
  private _columns(rows: StackRow[]): ColumnKey[] {
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_STACKS_BADGES);
    const columns: ColumnKey[] = shownColumns(COLUMN_ORDER, (key) => visible.has(key), rows, hasDetail);
    return visible.has('controls') ? [...columns, 'controls'] : columns;
  }

  /** One grid for every group, so the columns line up across groups too. */
  private _renderList(groups: { label: string | null; rows: StackRow[] }[]): TemplateResult {
    const columns = this._columns(groups.flatMap((g) => g.rows));
    return renderAlignedList(
      columns.length,
      groups.map(
        (group, i) => html`
          ${i > 0 ? html`<div class="divider"></div>` : nothing}
          ${group.label !== null ? html`<div class="group-header">${group.label}</div>` : nothing}
          ${group.rows.map((r) => this._renderRow(r, columns))}
        `
      )
    );
  }

  private _renderRow(row: StackRow, columns: ColumnKey[]): TemplateResult {
    const found = row.found;
    const status = found.status!.state.state;
    const statusIcon = STATUS_ICON[status] ?? { icon: 'mdi:help-circle', cls: 'neutral' as const };
    const id = found.status!.entityId;
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_STACKS_BADGES);

    return html`
      <div class="row clickable" @click=${() => this._moreInfo(id)}>
        <div class="row-left row-target" tabindex="0" role="button" @keydown=${onKeydownActivate(() => this._moreInfo(id))}>
          <ha-icon class="row-icon ${statusIcon.cls}" icon=${statusIcon.icon} title=${stateLabel(this._hass, 'stack_status', status, found.status!.state)}></ha-icon>
          <span class="item-name">${row.name}</span>
          ${visible.has('type') ? html`<span class="label-pill name-label">${stateLabel(this._hass, 'stack_type', row.type)}</span>` : nothing}
          ${visible.has('environment') ? html`<span class="label-pill name-label">${row.environment}</span>` : nothing}
          ${visible.has('tags') ? renderTagPills(found.status?.state) : nothing}
        </div>
        ${columns.map((key) => this._renderCell(key, row))}
      </div>
    `;
  }

  /** A row's cell for a column, empty when the row has nothing for it, so
   * the next columns stay lined up. */
  private _renderCell(key: ColumnKey, row: StackRow): TemplateResult | typeof nothing {
    const found = row.found;
    switch (key) {
      case 'updates': {
        const updateCount = numericState(found.pendingUpdates?.state.state);
        return cell(
          found.updatesAvailable?.state.state === 'on'
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:arrow-up-circle',
                colorClass: 'warn',
                text: updateCount !== undefined ? `${updateCount}` : '',
                title: t(this._hass, 'update_available'),
                onClick: () => this._moreInfo(found.updatesAvailable?.entityId)
              })
            : nothing
        );
      }
      case 'container_count': {
        const containerCount = found.containersInStack?.state.state;
        return cell(
          containerCount !== undefined
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:docker',
                text: `${containerCount}`,
                title: t(this._hass, 'label_containers'),
                onClick: () => this._moreInfo(found.containersInStack?.entityId)
              })
            : nothing
        );
      }
      case 'cpu': {
        const cpu = numericState(found.cpuPercent?.state.state);
        return cell(
          cpu !== undefined
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:cpu-64-bit',
                text: formatPercent(cpu, this._hass, 0),
                onClick: () => this._moreInfo(found.cpuPercent?.entityId)
              })
            : nothing
        );
      }
      case 'memory': {
        const mem = stackMemory(row);
        return cell(
          mem !== undefined
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:memory',
                // Whole units: a row has little room, and it's a glance.
                text: formatBytes(mem, this._hass, 0),
                onClick: () => this._moreInfo(found.memoryUsage?.entityId)
              })
            : nothing
        );
      }
      case 'controls':
        return this._renderControls(row);
    }
  }
}
