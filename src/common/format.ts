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
