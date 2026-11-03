import { formatNumber, type FrontendLocaleData } from 'custom-card-helpers';

/** Anything carrying Home Assistant's locale settings — `hass` itself. */
export type LocaleSource = { locale?: FrontendLocaleData; language?: string } | undefined;

const ENGLISH_LOCALE = { language: 'en', number_format: 'language' } as unknown as FrontendLocaleData;

function localeOf(source: LocaleSource): FrontendLocaleData {
  return source?.locale ?? (source?.language ? ({ language: source.language, number_format: 'language' } as unknown as FrontendLocaleData) : ENGLISH_LOCALE);
}

/** A number with a fixed number of decimals, in the user's HA number format
 * (decimal comma, thousands separators, …). */
export function formatDecimal(value: number, source: LocaleSource, digits: number): string {
  return formatNumber(value, localeOf(source), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(value: number, source: LocaleSource, digits = 1): string {
  return `${formatDecimal(value, source, digits)}%`;
}

export function formatBytes(bytes: number | undefined | null, source?: LocaleSource): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${formatDecimal(value, source, exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** An entity state as a number, or undefined when it isn't one — HA reports
 * a sensor with no current value as the strings `unavailable`/`unknown`
 * (ha-dockhand's container stats sensors do this for every stopped
 * container), which Number() would turn into NaN. Callers treat undefined
 * as "nothing to show" rather than rendering NaN or an empty bar. */
export function numericState(state: string | undefined): number | undefined {
  if (state === undefined || state.trim() === '') return undefined;
  const n = Number(state);
  return Number.isFinite(n) ? n : undefined;
}

const BYTES_PER_UNIT: Record<string, number> = {
  bit: 1 / 8,
  kbit: 1e3 / 8,
  Mbit: 1e6 / 8,
  Gbit: 1e9 / 8,
  B: 1,
  kB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  PB: 1e15,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
  PiB: 1024 ** 5
};

/** A data-size entity's state in bytes. HA converts the state to the
 * entity's display unit (ha-dockhand suggests MiB, and a user can pick
 * another per entity), so the state alone isn't bytes — `unit_of_measurement`
 * says what it is. Undefined for a non-numeric state or an unrecognised unit,
 * rather than a figure off by some power of 1024. */
export function bytesState(stateObj: { state: string; attributes: Record<string, unknown> } | undefined): number | undefined {
  const value = numericState(stateObj?.state);
  if (value === undefined) return undefined;
  const unit = stateObj!.attributes.unit_of_measurement;
  const factor = unit === undefined ? 1 : typeof unit === 'string' ? BYTES_PER_UNIT[unit] : undefined;
  return factor === undefined ? undefined : value * factor;
}

/** A memory reading as separate pieces — `["8.1%", "· 41.5 MB", "/ 512.0 MB"]`
 * — for renderFitParts, which drops pieces from the end when the line is too
 * narrow. Each separator belongs to the piece after it, so a dropped piece
 * never leaves one dangling. No used figure means the percentage alone, and
 * no total means no "/ total" piece. */
export function memoryParts(percent: number, used: number | undefined, total: number | undefined, source?: LocaleSource): string[] {
  const parts = [formatPercent(percent, source)];
  if (used === undefined) return parts;
  parts.push(`· ${formatBytes(used, source)}`);
  if (total) parts.push(`/ ${formatBytes(total, source)}`);
  return parts;
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

/**
 * A short, human label for which Dockhand *instance* a device belongs to —
 * the host[:port] portion of that device's own configuration_url, i.e. the
 * same address the user configured in HA to reach that particular Dockhand
 * server. Every device ha-dockhand creates already carries this, so no
 * integration change or extra API call is needed to get it.
 *
 * Deliberately not env_id or an environment/device name: those are
 * per-Dockhand-instance-local and collide *by design* the moment there's
 * more than one instance (every instance numbers its own first environment
 * `1`; nothing stops two instances' environments sharing a name either).
 * configuration_url's host doesn't have that problem — two config entries
 * only ever share one host[:port] if they're genuinely pointed at the same
 * Dockhand server, which is a misconfiguration, not a normal multi-instance
 * setup. See ha-dockhand-cards#1 / docs/architecture.md §19 for the bug
 * class this sidesteps.
 */
export function getInstanceLabel(configurationUrl: string | null | undefined): string | null {
  const origin = getDockhandBaseUrl(configurationUrl);
  if (!origin) return null;
  try {
    return new URL(origin).host;
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

/** Compact relative time for a schedule's next run or an event — "in 4h" /
 * "2h ago" / "in 3d" / "now" in English, the natural short form in other
 * languages (Intl.RelativeTimeFormat). Deliberately coarse (single unit)
 * since this is a glance-able list-row value; the full timestamp is in the
 * entity's more-info dialog. English uses the narrow style, which is the
 * compact form this card always showed; several other languages render the
 * narrow style as a bare "-3 h", so they use the short style instead. */
export function formatRelativeTime(iso: string | null | undefined, source?: LocaleSource): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = then - Date.now();
  const abs = Math.abs(diffMs);
  const sign = diffMs >= 0 ? 1 : -1;

  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  const language = localeOf(source).language || 'en';
  let formatter: Intl.RelativeTimeFormat;
  try {
    formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto', style: language === 'en' || language.startsWith('en-') ? 'narrow' : 'short' });
  } catch {
    formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
  }
  if (abs < minute) return formatter.format(0, 'second');
  if (abs < hour) return formatter.format(sign * Math.round(abs / minute), 'minute');
  if (abs < day) return formatter.format(sign * Math.round(abs / hour), 'hour');
  return formatter.format(sign * Math.round(abs / day), 'day');
}
