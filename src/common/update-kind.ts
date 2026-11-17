import { html, type TemplateResult } from 'lit';
import type { HassEntity } from 'home-assistant-js-websocket';
import { t } from './i18n-card';
import { isVersionTagOnly, newerVersionTag, versionTagTooltip, type NewerVersionTag } from './version-tag';

/** What a container's ha-dockhand update entity has to show, following how
 * Dockhand's own containers list shows it:
 * - `installable`: an update Install can apply (orange arrow).
 * - `tag`: only a newer version tag; the container's image tag has to be
 *   changed (grey tag).
 * - `pinned`: the image is pinned to a digest (`image:tag@sha256:…`) and its
 *   tag has moved on; the pin has to be changed. Wants attention, so orange,
 *   but there's nothing to install (pin).
 * - `held`: an update Dockhand is holding until the new image reaches its
 *   minimum image age. Nothing to do yet, so grey (clock).
 * The last three are on with nothing for Install to do.
 */
export type UpdateKind = 'installable' | 'tag' | 'pinned' | 'held';

export interface UpdateStatus {
  kind: UpdateKind;
  /** See newerVersionTag(). Can come with any kind. */
  newerVersion?: NewerVersionTag;
  /** Hours left, for `held`; 0 once the wait is over, until Dockhand's next
   * update check offers it as a normal update. */
  heldHours?: number;
}

/** Undefined when there's nothing to show. `pinned` and `held` need
 * ha-dockhand 1.11.0 or later (and Dockhand 1.0.54 / 1.0.52 or later). */
export function updateStatus(update: HassEntity | undefined): UpdateStatus | undefined {
  if (update?.state !== 'on') return undefined;
  const attrs = update.attributes;
  const newerVersion = newerVersionTag(update);
  if (isVersionTagOnly(attrs.latest_version, newerVersion)) return { kind: 'tag', newerVersion };
  if (attrs.pinned_digest_moved === true) return { kind: 'pinned', newerVersion };
  const hours = attrs.update_held_hours;
  if (typeof hours === 'number' && hours >= 0) return { kind: 'held', newerVersion, heldHours: hours };
  return { kind: 'installable', newerVersion };
}

type HassLanguage = Parameters<typeof t>[0];

export function pinnedDigestTooltip(hass: HassLanguage): string {
  return `${t(hass, 'pinned_digest_title')}\n${t(hass, 'pinned_digest_hint')}`;
}

export function heldTooltip(hass: HassLanguage, hours: number): string {
  return hours > 0 ? t(hass, 'update_held_title', { count: hours }) : t(hass, 'update_held_due_title');
}

/** The short form the Updates card puts at the end of the row. */
export function heldShort(hass: HassLanguage, hours: number): string {
  return hours > 0 ? t(hass, 'update_held_short', { count: hours }) : t(hass, 'update_held_due_short');
}

/** Icon, color variable and tooltip for a status, shared by every card that
 * marks a container's update. */
export function updateKindIcon(hass: HassLanguage, status: UpdateStatus): { icon: string; color: string; title: string } {
  switch (status.kind) {
    case 'tag':
      return {
        icon: 'mdi:tag-arrow-up-outline',
        color: 'var(--secondary-text-color)',
        title: status.newerVersion ? versionTagTooltip(hass, status.newerVersion) : t(hass, 'update_available')
      };
    case 'pinned':
      return { icon: 'mdi:pin-outline', color: 'var(--dockhand-status-warn-color)', title: pinnedDigestTooltip(hass) };
    case 'held':
      return { icon: 'mdi:clock-outline', color: 'var(--secondary-text-color)', title: heldTooltip(hass, status.heldHours ?? 0) };
    default:
      return { icon: 'mdi:arrow-up-circle', color: 'var(--dockhand-status-warn-color)', title: t(hass, 'update_available') };
  }
}

/** The icon on its own, for a pill or a row that isn't itself the click
 * target. */
/** With `onClick`, a click on the icon itself does that instead of
 * whatever the element around it does (a Stack card container pill opens
 * the container's state; its update icon opens the update, to install it). */
export function renderUpdateKindIcon(hass: HassLanguage, status: UpdateStatus, onClick?: () => void): TemplateResult {
  const { icon, color, title } = updateKindIcon(hass, status);
  if (!onClick) return html`<ha-icon icon=${icon} style="color:${color}" title=${title}></ha-icon>`;
  // .clickable: its own hover highlight, and none on the element around it.
  return html`<ha-icon
    class="update-icon clickable"
    icon=${icon}
    style="color:${color}"
    title=${title}
    @click=${(e: Event) => {
      e.stopPropagation();
      onClick();
    }}
  ></ha-icon>`;
}
