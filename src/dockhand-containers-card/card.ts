import { loadEditor } from '../common/editor-loader';
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getContainerDevicesForEnvironment, getRepresentativeEntityId, type EnvironmentDeviceOption, getContainerName } from '../common/device-utils';
import { resolveCardName, multiEnvCardNameFallback } from '../common/card-name';
import { resolveIncludedOrdered, groupRowsByEnvironment, resolveEffectiveGroupBy } from '../common/environment-scope';
import { resolveContainerEntities, findPrimaryEntityByDomain, type ResolutionResult } from '../common/entity-resolver';
import { formatPercent, getDockhandBaseUrl, numericState } from '../common/format';
import { t } from '../common/i18n-card';
import { stateLabel } from '../common/state-label';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import type { ContainerTranslationKey } from '../common/const';
import { CONTAINER_STATE, HEALTH_ICON, HEALTH_STATUS_CLASS, UNKNOWN_CONTAINER_STATE } from '../common/const';
import { versionTagTooltip, type NewerVersionTag } from '../common/version-tag';
import { updateKindIcon, updateStatus, type UpdateStatus } from '../common/update-kind';
import { DEFAULT_CONTAINERS_BADGES, type DockhandContainersCardConfig, type ContainersGroupBy, type ContainersSortBy } from './types';
import { renderRowControls, renderActionsColumn, resolveDeviceControls, rowControlSlots } from '../common/device-controls';
import { applyFilters } from '../common/filters';
import { containerFilters, containerStateValues, renderFilteredNote } from '../common/list-filters';
import { containerTags, renderTagPills } from '../common/tag-pills';
import { cell, renderAlignedList, shownColumns } from '../common/aligned-list';
import { cardStyles } from './styles';
import { RowFitController } from '../common/row-fit';

// Attention-first ordering for sort_by/group_by: 'status' — matching
// every other card's own status-priority convention.
const STATUS_RANK: Record<string, number> = {
  dead: 0,
  restarting: 1,
  exited: 1,
  paused: 2,
  created: 3,
  running: 4
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 5;
}

interface ContainerRow {
  deviceId: string;
  name: string;
  status: string;
  environment: string;
  environmentDeviceId: string;
  found: ResolutionResult<ContainerTranslationKey>['found'];
  updateEntityId: string | null;
  /** See newerVersionTag() in common/version-tag.ts. */
  newerVersion?: NewerVersionTag;
  /** See updateStatus() in common/update-kind.ts. */
  updateStatus?: UpdateStatus;
}

const FILTERS = containerFilters<ContainerRow>((row) => row.deviceId);

const PROBLEM_STATES = new Set(['exited_error', 'dead', 'restarting']);

/** What Always show problems keeps in view: a container that exited with an
 * error, died or keeps restarting, or is unhealthy (the editor's helper
 * text says the same). A clean exit (code 0) isn't a problem. */
export function isProblem(row: ContainerRow): boolean {
  return containerStateValues(row.found.state?.state).some((value) => PROBLEM_STATES.has(value)) || row.found.health?.state.state === 'unhealthy';
}

function byNameThenEnvironment(a: ContainerRow, b: ContainerRow): number {
  const byName = a.name.localeCompare(b.name);
  return byName !== 0 ? byName : a.environment.localeCompare(b.environment);
}

/** The row's CPU or memory percentage as the row shows it, in whole
 * percent, so rows showing the same number sort by name; -1 when it has
 * none, so those sort last. */
function usage(row: ContainerRow, sortBy: 'cpu' | 'memory'): number {
  const entry = sortBy === 'cpu' ? row.found.cpuPercent : row.found.memoryPercent;
  const value = numericState(entry?.state.state);
  return value === undefined ? -1 : Math.round(value);
}

export function sortContainerRows(rows: ContainerRow[], sortBy: ContainersSortBy): ContainerRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortBy === 'status') {
      const rankA = statusRank(a.status);
      const rankB = statusRank(b.status);
      if (rankA !== rankB) return rankA - rankB;
    } else if (sortBy === 'cpu' || sortBy === 'memory') {
      const diff = usage(b, sortBy) - usage(a, sortBy);
      if (diff !== 0) return diff;
    }
    return byNameThenEnvironment(a, b);
  });
  return sorted;
}

function capitalize(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function groupContainerRows(
  rows: ContainerRow[],
  groupBy: ContainersGroupBy | undefined,
  sortBy: ContainersSortBy,
  envDevices: EnvironmentDeviceOption[] = [],
  statusLabel: (status: string) => string = capitalize
): { label: string | null; rows: ContainerRow[] }[] {
  if (!groupBy || groupBy === 'none') return [{ label: null, rows: sortContainerRows(rows, sortBy) }];

  // 'environment' groups by iterating envDevices directly — see Stacks'
  // identical fix (groupStackRows) for the full reasoning; same
  // structural bug, same fix, both cards.
  if (groupBy === 'environment') {
    return groupRowsByEnvironment(rows, envDevices, (bucketRows) => sortContainerRows(bucketRows, sortBy));
  }

  const buckets = new Map<string, { label: string; rows: ContainerRow[] }>();
  for (const row of rows) {
    const key = row.status;
    if (!buckets.has(key)) buckets.set(key, { label: statusLabel(key), rows: [] });
    buckets.get(key)!.rows.push(row);
  }

  const entries = [...buckets.entries()];
  entries.sort(([keyA], [keyB]) => statusRank(keyA) - statusRank(keyB));

  return entries.map(([, bucket]) => ({ label: bucket.label, rows: sortContainerRows(bucket.rows, sortBy) }));
}

/** Right-hand row details in their order on a row; each shown one is a
 * column. Environment and tags stay with the name, on its left. */
const COLUMN_ORDER = ['updates', 'health', 'cpu', 'memory'] as const;
type ColumnKey = (typeof COLUMN_ORDER)[number] | 'controls';

function hasDetail(row: ContainerRow, key: Exclude<ColumnKey, 'controls'>): boolean {
  const found = row.found;
  switch (key) {
    case 'updates':
      return Boolean(row.newerVersion || (row.updateStatus && row.updateStatus.kind !== 'tag'));
    case 'health':
      return ['healthy', 'unhealthy', 'starting'].includes(found.health?.state.state ?? '');
    case 'cpu':
      return numericState(found.cpuPercent?.state.state) !== undefined;
    case 'memory':
      return numericState(found.memoryPercent?.state.state) !== undefined;
  }
}

export class DockhandContainersCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  constructor() {
    super();
    new RowFitController(this);
  }

  @state() private _config?: DockhandContainersCardConfig;
  @state() private _hass?: HomeAssistant;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandContainersCardConfig> {
    return { type: 'custom:dockhand-containers-card' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await loadEditor();
    return document.createElement('dockhand-containers-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandContainersCardConfig): void {
    this._config = { show_settings_link: true, sort_by: 'name', ...config };
  }

  set config(config: DockhandContainersCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 3;
    const { rows } = applyFilters(this._buildRows().rows, this._hass, FILTERS, this._config.filters, this._config.always_show_problems ? isProblem : undefined);
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

  /** A newer tag on its own is just the pill; anything else gets its icon
   * here, in the update icon's place. */
  private _renderUpdateIcon(row: ContainerRow): TemplateResult {
    const { icon, title } = updateKindIcon(this._hass, row.updateStatus!);
    const kind = row.updateStatus!.kind;
    return renderIcon({
      baseClass: 'row-icon',
      icon,
      colorClass: kind === 'held' ? 'neutral' : 'warn',
      title,
      onClick: () => this._moreInfo(row.updateEntityId)
    });
  }

  private _buildRows(): { rows: ContainerRow[]; envDevices: EnvironmentDeviceOption[] } {
    if (!this._hass || !this._config) return { rows: [], envDevices: [] };

    const envDevices = resolveIncludedOrdered(getEnvironmentDevices(this._hass), this._config.environments_order, this._config.exclude_device_ids);

    const rows: ContainerRow[] = envDevices.flatMap((env) => {
      const envDevice = this._hass!.devices[env.deviceId];
      const containerDevices = envDevice ? getContainerDevicesForEnvironment(this._hass!, envDevice) : [];
      return containerDevices
        .map((d): ContainerRow | null => {
          const { found } = resolveContainerEntities(this._hass!, d.id, ['state', 'health', 'cpuPercent', 'memoryPercent']);
          if (!found.state) return null;
          const update = findPrimaryEntityByDomain(this._hass!, d.id, 'update');
          const status = updateStatus(update?.state);
          return {
            deviceId: d.id,
            name: getContainerName(d) || d.name_by_user || d.name || d.id,
            status: found.state.state.state,
            environment: env.name,
            environmentDeviceId: env.deviceId,
            found,
            updateEntityId: status && update ? update.entityId : null,
            newerVersion: status?.newerVersion,
            updateStatus: status
          };
        })
        .filter((r): r is ContainerRow => r !== null);
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
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, multiEnvCardNameFallback(envDevices, t(this._hass, 'name_containers')));
    const base = this._resolveBaseUrl(envDevices);
    const { rows: shown, hidden } = applyFilters(rows, this._hass, FILTERS, this._config.filters, this._config.always_show_problems ? isProblem : undefined);
    const groups = groupContainerRows(shown, resolveEffectiveGroupBy(this._config.group_by, envDevices, 'environment'), this._config.sort_by ?? 'name', envDevices, (status) =>
      stateLabel(this._hass, 'container_state', status)
    );
    this._slots = this._showsControls() ? rowControlSlots(this._hass, shown.map((r) => r.deviceId)) : 2;

    return html`
      <ha-card style=${`--row-control-slots: ${this._slots}`}>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:docker', static: true })}
              <span class="truncate">${name}</span>
            </div>
            <div class="header-right">
              ${renderSettingsLink({
                hass: this._hass,
                show: this._config?.show_settings_link,
                href: base ? `${base}/containers` : null,
                tooltipKey: 'settings_link_view_containers'
              })}
            </div>
          </div>
          <div class="divider"></div>
          ${rows.length === 0
            ? html`<div class="card-message">${t(this._hass, 'msg_no_containers_yet')}</div>`
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
    return (this._config?.visible_badges ?? DEFAULT_CONTAINERS_BADGES).includes('controls');
  }

  /** A row's controls column (_showsControls). */
  private _renderControls(row: ContainerRow): TemplateResult | typeof nothing {
    if (!this._showsControls() || !this._hass) return nothing;
    const controls = resolveDeviceControls(this._hass, row.deviceId, true);
    return renderActionsColumn(controls ? renderRowControls(this, this._hass, controls, row.name, this._slots) : null);
  }

  /** The row details shown, in their order on a row: each is a column of
   * the list, as wide as its widest value, so the details line up down the
   * card. A detail that's hidden, or that no row has (stats turned off, no
   * newer version anywhere), has no column, so no empty space. */
  private _columns(rows: ContainerRow[]): ColumnKey[] {
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_CONTAINERS_BADGES);
    const columns: ColumnKey[] = shownColumns(COLUMN_ORDER, (key) => visible.has(key), rows, hasDetail);
    return visible.has('controls') ? [...columns, 'controls'] : columns;
  }

  /** One grid for every group, so the columns line up across groups too;
   * rows take its columns (subgrid), and group headers and dividers span
   * them. */
  private _renderList(groups: ReturnType<typeof groupContainerRows>): TemplateResult {
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

  private _renderRow(row: ContainerRow, columns: ColumnKey[]): TemplateResult {
    const found = row.found;
    const st = found.state!.state.state;
    const stateIcon = CONTAINER_STATE[st] ?? UNKNOWN_CONTAINER_STATE;
    const health = found.health?.state.state;
    const healthId = found.health?.entityId;
    const cpu = numericState(found.cpuPercent?.state.state);
    const cpuId = found.cpuPercent?.entityId;
    const mem = numericState(found.memoryPercent?.state.state);
    const memId = found.memoryPercent?.entityId;
    const id = found.state!.entityId;
    // Every row has a cell for every column, empty when it has nothing
    // for it, so the next columns stay lined up.
    const column = (key: ColumnKey): TemplateResult => {
      switch (key) {
        case 'updates':
          // At most two icons, in Dockhand's order: a newer version tag
          // (the tag is in its tooltip: a pill's text would widen the column
          // for every row), then the update, right-aligned.
          return html`<div class="cell end">
            ${row.newerVersion
              ? renderIcon({
                  baseClass: 'row-icon',
                  icon: 'mdi:tag-arrow-up-outline',
                  colorClass: 'warn',
                  title: versionTagTooltip(this._hass, row.newerVersion),
                  onClick: () => this._moreInfo(row.updateEntityId)
                })
              : nothing}
            ${row.updateStatus && row.updateStatus.kind !== 'tag' ? this._renderUpdateIcon(row) : nothing}
          </div>`;
        case 'health':
          return cell(
            health === 'healthy' || health === 'unhealthy' || health === 'starting'
              ? renderIcon({
                  baseClass: 'row-icon',
                  icon: HEALTH_ICON[health] ?? 'mdi:heart-outline',
                  colorClass: HEALTH_STATUS_CLASS[health] as 'ok' | 'warn' | 'error' | undefined,
                  title: stateLabel(this._hass, 'health', health, found.health?.state),
                  onClick: () => this._moreInfo(healthId)
                })
              : nothing
          );
        case 'cpu':
          return cell(cpu !== undefined ? renderIcon({ baseClass: 'row-icon', icon: 'mdi:cpu-64-bit', text: formatPercent(cpu, this._hass, 0), onClick: () => this._moreInfo(cpuId) }) : nothing);
        case 'memory':
          return cell(mem !== undefined ? renderIcon({ baseClass: 'row-icon', icon: 'mdi:memory', text: formatPercent(mem, this._hass, 0), onClick: () => this._moreInfo(memId) }) : nothing);
        case 'controls':
          return this._renderControls(row) as TemplateResult;
      }
    };
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_CONTAINERS_BADGES);

    return html`
      <div class="row clickable" @click=${() => this._moreInfo(id)}>
        <div class="row-left row-target" tabindex="0" role="button" @keydown=${onKeydownActivate(() => this._moreInfo(id))}>
          <ha-icon class="row-icon ${stateIcon.cls}" icon=${stateIcon.icon} title=${stateLabel(this._hass, 'container_state', st, found.state!.state)}></ha-icon>
          <span class="item-name">${row.name}</span>
          ${visible.has('environment') ? html`<span class="label-pill name-label">${row.environment}</span>` : nothing}
          ${visible.has('tags') ? renderTagPills(containerTags(this._hass!, row.deviceId, found.state!.state), this._hass) : nothing}
        </div>
        ${columns.map(column)}
      </div>
    `;
  }
}
