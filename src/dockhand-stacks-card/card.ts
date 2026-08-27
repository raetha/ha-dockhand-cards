import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getStackDevicesForEnvironment, getEnvId, getRepresentativeEntityId, type EnvironmentDeviceOption } from '../common/device-utils';
import { resolveCardName, migrateTitleToName, multiEnvCardNameFallback } from '../common/card-name';
import { resolveIncludedOrderedWithLegacy, groupRowsByEnvironment, resolveEffectiveGroupBy } from '../common/environment-scope';
import { resolveStackEntities, type ResolutionResult } from '../common/entity-resolver';
import { getDockhandBaseUrl } from '../common/format';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import type { StackTranslationKey } from '../common/const';
import { DEFAULT_STACKS_BADGES, type DockhandStacksCardConfig, type StacksGroupBy, type StacksSortBy } from './types';
import { cardStyles } from './styles';

// Matches Dockhand's own stackStatusTypes color list (src/routes/stacks/+page.svelte).
const STATUS_ICON: Record<string, { icon: string; cls: 'ok' | 'warn' | 'error' | 'neutral' }> = {
  running: { icon: 'mdi:play-circle', cls: 'ok' },
  partial: { icon: 'mdi:alert-circle', cls: 'warn' },
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
  running: 2,
  created: 3
};

function statusRank(status: string): number {
  return STATUS_RANK[status] ?? 4;
}

interface StackRow {
  name: string;
  type: string;
  status: string;
  environment: string;
  environmentDeviceId: string;
  found: ResolutionResult<StackTranslationKey>['found'];
}

function byNameThenEnvironment(a: StackRow, b: StackRow): number {
  const byName = a.name.localeCompare(b.name);
  return byName !== 0 ? byName : a.environment.localeCompare(b.environment);
}

export function sortStackRows(rows: StackRow[], sortBy: StacksSortBy): StackRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    if (sortBy === 'status') {
      const rankA = statusRank(a.status);
      const rankB = statusRank(b.status);
      if (rankA !== rankB) return rankA - rankB;
    }
    return byNameThenEnvironment(a, b);
  });
  return sorted;
}

function groupKeyAndLabel(row: StackRow, groupBy: 'status' | 'type'): { key: string; label: string } {
  if (groupBy === 'status') return { key: row.status, label: row.status.charAt(0).toUpperCase() + row.status.slice(1) };
  // 'type'
  return { key: row.type, label: row.type.charAt(0).toUpperCase() + row.type.slice(1) };
}

export function groupStackRows(rows: StackRow[], groupBy: StacksGroupBy | undefined, sortBy: StacksSortBy, envDevices: EnvironmentDeviceOption[] = []): { label: string | null; rows: StackRow[] }[] {
  if (!groupBy || groupBy === 'none') return [{ label: null, rows: sortStackRows(rows, sortBy) }];

  // 'environment' groups by iterating envDevices directly — already in
  // the right order (call resolveIncludedOrderedWithLegacy before this,
  // same as every other use of it) — rather than deriving a key per row
  // and re-sorting buckets against a separate order array afterward,
  // which can drift out of sync with the actual, already-correct order.
  // See environment-scope.ts's groupRowsByEnvironment for the full
  // reasoning — this is the same structural fix Schedules/Containers
  // both use, not a Stacks-specific patch.
  if (groupBy === 'environment') {
    return groupRowsByEnvironment(rows, envDevices, (bucketRows) => sortStackRows(bucketRows, sortBy));
  }

  const buckets = new Map<string, { label: string; rows: StackRow[] }>();
  for (const row of rows) {
    const { key, label } = groupKeyAndLabel(row, groupBy);
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

export class DockhandStacksCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

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
    await import('./editor');
    return document.createElement('dockhand-stacks-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandStacksCardConfig): void {
    this._config = { show_settings_link: true, sort_by: 'name', ...(migrateTitleToName(config as Record<string, unknown>) as DockhandStacksCardConfig) };
  }

  set config(config: DockhandStacksCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    if (!this._hass || !this._config) return 3;
    const { rows } = this._buildRows();
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

    const envDevices = resolveIncludedOrderedWithLegacy(getEnvironmentDevices(this._hass), this._config.environments_order, this._config.exclude_device_ids, this._config.device_id);

    const rows: StackRow[] = envDevices.flatMap((env) => {
      const envId = getEnvId(this._hass!.devices[env.deviceId]);
      const stackDevices = envId !== null ? getStackDevicesForEnvironment(this._hass!, envId) : [];
      return stackDevices
        .map((d) => {
          const { found } = resolveStackEntities(this._hass!, d.id, ['status', 'containersInStack', 'updatesAvailable']);
          if (!found.status) return null;
          const attrs = found.status.state.attributes;
          return {
            name: attrs.name || d.name_by_user || d.name || d.id,
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
          <span>No environment selected. Edit this card to pick one or more.</span>
        </div>
      </ha-card>`;
    }

    const representativeEntityId = getRepresentativeEntityId(this._hass, envDevices[0].deviceId);
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, multiEnvCardNameFallback(envDevices, 'Stacks'));
    const base = this._resolveBaseUrl(envDevices);
    const groups = groupStackRows(rows, resolveEffectiveGroupBy(this._config.group_by, envDevices, 'environment'), this._config.sort_by ?? 'name', envDevices);

    return html`
      <ha-card>
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
            ? html`<div class="card-message">No stacks found for the selected environment(s) yet.</div>`
            : groups.map(
                (group, i) => html`
                  ${i > 0 ? html`<div class="divider"></div>` : nothing}
                  ${group.label !== null ? html`<div class="group-header">${group.label}</div>` : nothing}
                  <div class="list">${group.rows.map((r) => this._renderRow(r))}</div>
                `
              )}
        </div>
      </ha-card>
    `;
  }

  private _renderRow(row: StackRow): TemplateResult {
    const found = row.found;
    const status = found.status!.state.state;
    const statusIcon = STATUS_ICON[status] ?? { icon: 'mdi:help-circle', cls: 'neutral' as const };
    const containerCount = found.containersInStack?.state.state;
    const containerCountId = found.containersInStack?.entityId;
    const updatesOn = found.updatesAvailable?.state.state === 'on';
    const updateCount = found.updatesAvailable?.state.attributes.update_count;
    const updatesId = found.updatesAvailable?.entityId;
    const id = found.status!.entityId;
    const visible = new Set(this._config?.visible_badges ?? DEFAULT_STACKS_BADGES);

    return html`
      <div class="row clickable" tabindex="0" role="button" @click=${() => this._moreInfo(id)} @keydown=${onKeydownActivate(() => this._moreInfo(id))}>
        <div class="row-left">
          <ha-icon class="row-icon ${statusIcon.cls}" icon=${statusIcon.icon}></ha-icon>
          <span class="item-name">${row.name}</span>
          ${visible.has('type') ? html`<span class="label-pill">${row.type}</span>` : nothing}
          ${visible.has('environment') ? html`<span class="label-pill">${row.environment}</span>` : nothing}
        </div>
        <div class="row-right">
          ${containerCount !== undefined && visible.has('container_count')
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:docker',
                text: `${containerCount}`,
                onClick: () => this._moreInfo(containerCountId)
              })
            : nothing}
          ${updatesOn && visible.has('updates')
            ? renderIcon({
                baseClass: 'row-icon',
                icon: 'mdi:arrow-up-circle',
                colorClass: 'warn',
                text: updateCount !== undefined ? `${updateCount}` : '',
                onClick: () => this._moreInfo(updatesId)
              })
            : nothing}
        </div>
      </div>
    `;
  }
}
