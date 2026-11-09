import { loadEditor } from '../common/editor-loader';
import { LitElement, html, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getContainerDevicesForEnvironment, getEnvironmentDevices, getRepresentativeEntityId, type EnvironmentDeviceOption } from '../common/device-utils';
import { resolveIncludedOrderedWithLegacy, resolveEffectiveGroupBy } from '../common/environment-scope';
import { resolveCardName, migrateTitleToName, multiEnvCardNameFallback } from '../common/card-name';
import { resolveEnvironmentEntities, findPrimaryEntityByDomain } from '../common/entity-resolver';
import { getTotalPendingUpdates } from '../common/updates-visibility';
import { renderIcon, onKeydownActivate } from '../common/icon';
import { t } from '../common/i18n-card';
import { UPDATE_PENDING_VERSION } from '../common/const';
import { renderVersionTagPill, type NewerVersionTag } from '../common/version-tag';
import { heldShort, heldTooltip, pinnedDigestTooltip, updateStatus, type UpdateKind } from '../common/update-kind';
import type { DockhandUpdatesCardConfig } from './types';
import { cardStyles } from './styles';

const UPDATE_ROW_ICONS: Record<UpdateKind, string> = {
  installable: 'mdi:arrow-up-circle',
  tag: 'mdi:tag-arrow-up-outline',
  pinned: 'mdi:pin-outline',
  held: 'mdi:clock-outline'
};

export interface PendingUpdate {
  entityId: string;
  name: string;
  installedVersion?: string;
  latestVersion?: string;
  /** See newerVersionTag() in common/version-tag.ts. */
  newerVersion?: NewerVersionTag;
  /** See updateStatus() in common/update-kind.ts. */
  kind: UpdateKind;
  heldHours?: number;
}

interface EnvGroup {
  envDeviceId: string;
  envName: string;
  bulkButtonEntityId?: string;
  checkUpdatesEntityId?: string;
  updates: PendingUpdate[];
}

/** Alphabetical by name — the one sort this card offers (no group_by/
 * sort_by choice here; see docs/editor-design.md rule 1 and the
 * README's own Updates section for why). */
export function sortPendingUpdates(updates: PendingUpdate[]): PendingUpdate[] {
  return [...updates].sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether an environment gets its own group at all — not just "has
 * pending updates." An environment with a working bulk-update button but
 * nothing currently pending still shows, so the button stays visible/
 * discoverable rather than the whole environment disappearing the
 * moment nothing needs updating; one with neither a button nor any
 * pending updates is correctly left out, not shown as an empty group. */
export function shouldShowEnvironmentGroup(updates: PendingUpdate[], hasBulkButton: boolean): boolean {
  return updates.length > 0 || hasBulkButton;
}

export class DockhandUpdatesCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandUpdatesCardConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _triggering = false;
  @state() private _checking = false;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(): Partial<DockhandUpdatesCardConfig> {
    return { type: 'custom:dockhand-updates-card' };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await loadEditor();
    return document.createElement('dockhand-updates-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandUpdatesCardConfig): void {
    this._config = migrateTitleToName(config as Record<string, unknown>) as DockhandUpdatesCardConfig;
  }

  set config(config: DockhandUpdatesCardConfig) {
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

  private _buildGroups(): { groups: EnvGroup[]; checkUpdatesEntityIds: string[]; envDevices: EnvironmentDeviceOption[] } {
    if (!this._hass || !this._config) return { groups: [], checkUpdatesEntityIds: [], envDevices: [] };

    const envDevices: EnvironmentDeviceOption[] = resolveIncludedOrderedWithLegacy(
      getEnvironmentDevices(this._hass),
      this._config.environments_order,
      this._config.exclude_device_ids,
      this._config.device_id,
      this._config.scope
    );

    const groups: EnvGroup[] = [];
    const checkUpdatesEntityIds: string[] = [];
    for (const env of envDevices) {
      const envDevice = this._hass.devices[env.deviceId];
      if (!envDevice) continue;

      const { found } = resolveEnvironmentEntities(this._hass, env.deviceId, ['envBulkUpdate', 'checkUpdates']);
      if (found.checkUpdates) checkUpdatesEntityIds.push(found.checkUpdates.entityId);
      // ha-dockhand 2.0+ keeps Update all while update entities are on and
      // makes it unavailable while nothing in the environment can be
      // updated, so only an available one counts; earlier versions remove it.
      const bulkButton = found.envBulkUpdate?.state.state === 'unavailable' ? undefined : found.envBulkUpdate;

      const containerDevices = getContainerDevicesForEnvironment(this._hass, envDevice);
      const updates: PendingUpdate[] = [];

      for (const c of containerDevices) {
        const entry = findPrimaryEntityByDomain(this._hass, c.id, 'update');
        const status = updateStatus(entry?.state);
        if (!entry || !status) continue;
        updates.push({
          entityId: entry.entityId,
          name: entry.state.attributes.name || c.name_by_user || c.name || c.id,
          installedVersion: entry.state.attributes.installed_version,
          latestVersion: entry.state.attributes.latest_version,
          newerVersion: status.newerVersion,
          kind: status.kind,
          heldHours: status.heldHours
        });
      }
      const sortedUpdates = sortPendingUpdates(updates);

      if (shouldShowEnvironmentGroup(sortedUpdates, Boolean(bulkButton))) {
        groups.push({
          envDeviceId: env.deviceId,
          envName: env.name,
          bulkButtonEntityId: bulkButton?.entityId,
          checkUpdatesEntityId: found.checkUpdates?.entityId,
          updates: sortedUpdates
        });
      }
    }
    return { groups, checkUpdatesEntityIds, envDevices };
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    const { groups, checkUpdatesEntityIds, envDevices } = this._buildGroups();
    if (envDevices.length === 0) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>${t(this._hass, 'msg_no_environment_selected')}</span>
        </div>
      </ha-card>`;
    }
    // Deliberately not groups.reduce((sum, g) => sum + g.updates.length, 0)
    // (a second, independent tally of the same per-container row list) —
    // reads the same pending_updates_total attribute, for the same
    // environments, that this card's own hide-when-empty visibility
    // condition is built from (see common/updates-visibility.ts). If
    // this number and the actual row count these groups produce below
    // ever disagree, that's a real, worth-reporting mismatch between
    // ha-dockhand's own aggregate and its own per-container update
    // entities — not something to paper over here by re-deriving the
    // count locally instead.
    const envDeviceIds = envDevices.map((e) => e.deviceId);
    const totalUpdates = getTotalPendingUpdates(this._hass, envDeviceIds);

    const bulkButtonIds = groups.map((g) => g.bulkButtonEntityId).filter((id): id is string => Boolean(id));
    const representativeEntityId = getRepresentativeEntityId(this._hass, envDeviceIds[0]);
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, multiEnvCardNameFallback(envDevices, t(this._hass, 'name_updates')));
    // Based on how many environments are actually included, not the
    // card's old scope field — a single included environment (whether
    // that's because only one exists, or because everything else was
    // explicitly excluded) makes the group header redundant the same
    // way scope: 'environment' always did; more than one still needs it
    // even if, at this exact moment, only one happens to have anything
    // pending (a real bug this already fixed once: it used to require
    // groups.length > 1, so a single populated group silently dropped
    // the one piece of context that says *where* the update lives).
    // Same shared suppression Stacks/Containers/Schedules now all use
    // (see resolveEffectiveGroupBy in common/environment-scope.ts) —
    // 'environment' collapses to 'none' when there's only one
    // environment to group, since grouping by the one thing every row
    // already shares produces a single, pointless header.
    const effectiveGroupBy = resolveEffectiveGroupBy(this._config.group_by, envDevices, 'environment');
    const showGroupHeaders = effectiveGroupBy !== 'none';
    // Flattened, not grouped: every pending update across every
    // included environment in one sorted list, discarding which group
    // each came from.
    const flatUpdates = effectiveGroupBy === 'none' ? sortPendingUpdates(groups.flatMap((g) => g.updates)) : null;

    return html`
      <ha-card>
        <div class="body">
          <div class="card-header">
            <div class="header-left">
              ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:arrow-up-circle', static: true })}
              <span class="truncate">${name}${totalUpdates > 0 ? ` (${totalUpdates})` : ''}</span>
            </div>
            <div class="header-right">
            ${checkUpdatesEntityIds.length > 0
              ? renderIcon({
                  baseClass: 'header-icon',
                  busy: this._checking,
                  icon: 'mdi:refresh',
                  title: this._checking ? t(this._hass, 'checking') : t(this._hass, 'check_updates'),
                  ...(this._checking ? { disabled: true } : { onClick: () => this._triggerCheckUpdates(checkUpdatesEntityIds) })
                })
              : nothing}
            ${bulkButtonIds.length > 0
              ? renderIcon({
                  baseClass: 'header-icon filled',
                  busy: this._triggering,
                  icon: 'mdi:arrow-up-circle',
                  text: t(this._hass, 'update_all'),
                  title: this._triggering ? t(this._hass, 'updating') : t(this._hass, 'update_all'),
                  ...(this._triggering ? { disabled: true } : { onClick: () => this._triggerBulkUpdate(bulkButtonIds) })
                })
              : nothing}
            </div>
          </div>
          <div class="divider"></div>
          ${groups.every((g) => g.updates.length === 0)
            ? html`<div class="card-message">
                <ha-icon icon="mdi:check-circle-outline"></ha-icon>
                <span>${t(this._hass, 'msg_everything_up_to_date')}</span>
              </div>`
            : flatUpdates
              ? html`<div class="list">${flatUpdates.map((u) => this._renderUpdateRow(u))}</div>`
              : groups.map(
                  (g, i) => html`
                    ${i > 0 ? html`<div class="divider"></div>` : nothing}
                    ${showGroupHeaders ? html`<div class="group-header">${g.envName}</div>` : nothing}
                    <div class="list">${g.updates.map((u) => this._renderUpdateRow(u))}</div>
                  `
                )}
        </div>
      </ha-card>
    `;
  }

  private _renderUpdateRow(u: PendingUpdate): TemplateResult {
    // The tag pill only alongside something else: when the tag is the only
    // update, the version text already names it. The pill leads the right
    // side so the version text after it stays aligned down the list.
    const pill = u.newerVersion && u.kind !== 'tag' ? renderVersionTagPill(this._hass, u.newerVersion) : nothing;
    let versionText: string | typeof nothing = nothing;
    let title: string | undefined;
    if (u.kind === 'held') {
      versionText = heldShort(this._hass, u.heldHours ?? 0);
      title = heldTooltip(this._hass, u.heldHours ?? 0);
    } else if (u.kind === 'pinned') {
      versionText = t(this._hass, 'pinned_digest_title');
      title = pinnedDigestTooltip(this._hass);
    } else if (u.latestVersion === UPDATE_PENDING_VERSION) {
      versionText = t(this._hass, 'update_available');
    } else if (u.installedVersion && u.latestVersion) {
      versionText = `${u.installedVersion} → ${u.latestVersion}`;
    }
    return html`
      <div class="row update-row clickable" tabindex="0" role="button" @click=${() => this._moreInfo(u.entityId)} @keydown=${onKeydownActivate(() => this._moreInfo(u.entityId))}>
        <div class="row-left">
          <ha-icon class="update-icon ${u.kind}" icon=${UPDATE_ROW_ICONS[u.kind]} title=${title ?? nothing}></ha-icon>
          <span class="item-name">${u.name}</span>
        </div>
        ${pill === nothing && versionText === nothing ? nothing : html`<span class="row-right" title=${title ?? nothing}>${pill}${versionText}</span>`}
      </div>
    `;
  }

  private async _triggerBulkUpdate(entityIds: string[]): Promise<void> {
    if (!this._hass || this._triggering) return;
    this._triggering = true;
    try {
      await this._hass.callService('button', 'press', {}, { entity_id: entityIds });
    } catch {
      // hass.callService has already shown HA's error toast for this.
    } finally {
      this._triggering = false;
    }
  }

  private async _triggerCheckUpdates(entityIds: string[]): Promise<void> {
    if (!this._hass || this._checking || entityIds.length === 0) return;
    this._checking = true;
    try {
      // Press every environment's button — as of ha-dockhand's
      // DockhandUpdateCoordinator.async_check_environment(), each
      // environment's "Check for updates" button genuinely only checks
      // its own environment, so this is real, non-redundant work per
      // button, not duplicated effort. (An earlier version of this card
      // pressed only the first entity, since at the time every button
      // triggered a full all-environments refresh regardless of which
      // one was pressed — that's no longer how it works, ha-dockhand
      // fixed the underlying design rather than the card working around
      // it.)
      await this._hass.callService('button', 'press', {}, { entity_id: entityIds });
    } catch {
      // hass.callService has already shown HA's error toast for this.
    } finally {
      this._checking = false;
    }
  }
}
