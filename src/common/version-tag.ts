import { html, type TemplateResult } from 'lit';
import type { HassEntity } from 'home-assistant-js-websocket';
import { t, tMaybe } from './i18n-card';
import { onKeydownActivate } from './icon';

/** A newer version tag ha-dockhand reports on a container update entity:
 * one that needs the container's pinned tag changed, so Install can't
 * reach it. */
export interface NewerVersionTag {
  tag: string;
  /** `major`, `minor` or `patch`, when ha-dockhand reports it. */
  bump?: string;
  /** How many newer versions there are, including `tag`. */
  count: number;
}

/** Undefined with ha-dockhand releases before 1.11.0, or when there's no
 * newer tag. */
export function newerVersionTag(update: HassEntity | undefined): NewerVersionTag | undefined {
  const attrs = update?.attributes;
  const tag = attrs?.newer_version;
  if (typeof tag !== 'string' || !tag) return undefined;
  const count = attrs?.newer_versions_count;
  return {
    tag,
    bump: typeof attrs?.newer_version_bump === 'string' ? attrs.newer_version_bump : undefined,
    count: typeof count === 'number' && count > 0 ? count : 1
  };
}

/** ha-dockhand only puts the newer tag in `latest_version` when nothing
 * installable is pending, so equal values mean the tag is the only update. */
export function isVersionTagOnly(latestVersion: string | undefined, newer: NewerVersionTag | undefined): boolean {
  return Boolean(newer) && latestVersion === newer!.tag;
}

type HassLanguage = Parameters<typeof t>[0];

/** The same lines Dockhand's own newer-version badge tooltip shows
 * (VersionUpdateBadge.svelte), as plain text for a native tooltip. Its
 * "click for release notes" line is left out: here a click opens the update
 * dialog, which only has notes for the tag when nothing else is pending. */
export function versionTagTooltip(hass: HassLanguage, newer: NewerVersionTag): string {
  const bump = newer.bump ? tMaybe(hass, `version_bump_${newer.bump}`) : undefined;
  const lines = [
    t(hass, 'newer_version_title'),
    bump ? t(hass, 'newer_version_move_to_bump', { version: newer.tag, bump }) : t(hass, 'newer_version_move_to', { version: newer.tag })
  ];
  if (newer.count > 1) lines.push(t(hass, 'newer_version_ahead', { count: newer.count }));
  lines.push(t(hass, 'newer_version_hint'));
  return lines.join('\n');
}

/** The tag pill both Updates and Containers rows use. Pass onClick only
 * where the pill isn't already inside something clickable that does the
 * same thing. */
export function renderVersionTagPill(hass: HassLanguage, newer: NewerVersionTag, onClick?: () => void): TemplateResult {
  const title = versionTagTooltip(hass, newer);
  // The text goes on a narrow row (RowFitController); the tooltip keeps it.
  const content = html`<ha-icon icon="mdi:tag-outline"></ha-icon><span class="pill-text">${newer.tag}</span>`;
  if (!onClick) return html`<span class="label-pill version-tag-pill" title=${title}>${content}</span>`;
  return html`<span
    class="label-pill version-tag-pill clickable"
    tabindex="0"
    role="button"
    title=${title}
    @click=${(e: Event) => {
      e.stopPropagation();
      onClick();
    }}
    @keydown=${onKeydownActivate(onClick)}
    >${content}</span
  >`;
}
