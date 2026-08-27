export function formatBytes(bytes: number | undefined | null): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Matches Dockhand's own thresholds: >=90% red, >=70% amber, else green. */
export function barColorClass(percent: number): 'ok' | 'warn' | 'error' {
  if (percent >= 90) return 'error';
  if (percent >= 70) return 'warn';
  return 'ok';
}

/**
 * Derives Dockhand's base origin from any device's configuration_url (which
 * always points somewhere under that same origin — /settings, /images,
 * /containers, etc.) so a card can build a link to a *different* Dockhand
 * page than the one its own device's configuration_url points at, without
 * needing a separate base_url passed through from ha-dockhand.
 */
export function getDockhandBaseUrl(configurationUrl: string | null | undefined): string | null {
  if (!configurationUrl) return null;
  try {
    return new URL(configurationUrl).origin;
  } catch {
    return null;
  }
}

/** Shared by every card's header-icon settings link — shown instead of the normal
 * clickable link when show_settings_link is on but getDockhandBaseUrl
 * couldn't resolve a valid URL. Deliberately not the same as the toggle
 * being off (which hides the icon entirely): this state exists precisely
 * so "the setting is on but broken" doesn't look identical to "the
 * setting is off", which was a real, confirmed source of confusion —
 * a malformed configured URL silently produced the exact same
 * appearance as choosing not to show the link at all, with nothing to
 * suggest anything needed fixing. The tooltip text itself is a
 * translated string (t(hass, 'settings_link_unavailable')), not a
 * constant here — this repo's live cards didn't translate any
 * rendered text at all until this string, so there's nothing to keep
 * consistent with; the icon has no such need, since it's not text. */
export const SETTINGS_LINK_UNAVAILABLE_ICON = 'mdi:link-off';

/** Compact relative time for a schedule's next run or last execution —
 * "in 4h" / "2h ago" / "in 3d" / "just now". Deliberately coarse (single
 * unit, no seconds precision beyond "just now") since this is a glance-able
 * list-row value, not a precise timestamp — the full timestamp is always
 * available via the entity's more-info dialog for anyone who needs it. */
export function formatRelativeTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = then - Date.now();
  const future = diffMs >= 0;
  const abs = Math.abs(diffMs);

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (abs < minute) return 'just now';
  let value: number;
  let unit: string;
  if (abs < hour) {
    value = Math.round(abs / minute);
    unit = 'm';
  } else if (abs < day) {
    value = Math.round(abs / hour);
    unit = 'h';
  } else {
    value = Math.round(abs / day);
    unit = 'd';
  }
  return future ? `in ${value}${unit}` : `${value}${unit} ago`;
}
