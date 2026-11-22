import type { HomeAssistant } from './ha-types';
import type { ContainerTranslationKey } from './const';
import { resolveContainerEntities, type ResolutionResult } from './entity-resolver';
import { numericState } from './format';
import type { CardTranslationKey } from './i18n-card';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Most severe first; each count is its own sensor, on an environment's
 * device and (ha-dockhand 2.2.0+) on each container's. */
export const SEVERITIES: { key: Severity; container: ContainerTranslationKey; label: CardTranslationKey }[] = [
  { key: 'critical', container: 'vulnerabilitiesCritical', label: 'severity_critical' },
  { key: 'high', container: 'vulnerabilitiesHigh', label: 'severity_high' },
  { key: 'medium', container: 'vulnerabilitiesMedium', label: 'severity_medium' },
  { key: 'low', container: 'vulnerabilitiesLow', label: 'severity_low' }
];

export const CONTAINER_VULNERABILITY_KEYS: ContainerTranslationKey[] = ['vulnerabilities', ...SEVERITIES.map((sev) => sev.container)];

export interface ContainerVulnerabilities {
  total?: number;
  severities: Partial<Record<Severity, number>>;
  /** Each count's sensor, to open from it. */
  entityIds: Partial<Record<Severity, string>>;
  totalEntityId?: string;
}

/** A container's counts from its sensors, or undefined when it has none
 * with a number: sensors off (they're disabled by default), Dockhand older
 * than 1.0.59, or an image not scanned yet. */
export function containerVulnerabilities(found: ResolutionResult<ContainerTranslationKey>['found']): ContainerVulnerabilities | undefined {
  const severities: ContainerVulnerabilities['severities'] = {};
  const entityIds: ContainerVulnerabilities['entityIds'] = {};
  for (const sev of SEVERITIES) {
    const n = numericState(found[sev.container]?.state.state);
    if (n === undefined) continue;
    severities[sev.key] = n;
    entityIds[sev.key] = found[sev.container]!.entityId;
  }
  const total = numericState(found.vulnerabilities?.state.state);
  if (total === undefined && Object.keys(severities).length === 0) return undefined;
  return { total, severities, entityIds, totalEntityId: total === undefined ? undefined : found.vulnerabilities!.entityId };
}

export function resolveContainerVulnerabilities(hass: HomeAssistant, deviceId: string): ContainerVulnerabilities | undefined {
  return containerVulnerabilities(resolveContainerEntities(hass, deviceId, CONTAINER_VULNERABILITY_KEYS).found);
}

/** The findings counted: the total sensor, else the severities added up. */
export function findings(v: ContainerVulnerabilities): number {
  return v.total ?? Object.values(v.severities).reduce((n, c) => n + c, 0);
}

/** The most severe severity with findings, if any. */
export function worstSeverity(v: ContainerVulnerabilities): Severity | undefined {
  return SEVERITIES.find((sev) => (v.severities[sev.key] ?? 0) > 0)?.key;
}

/** Most severe first, as Dockhand ranks them: critical, then high, medium,
 * low, then all findings; a container without counts last. 0 on a tie. */
export function compareVulnerabilities(a: ContainerVulnerabilities | undefined, b: ContainerVulnerabilities | undefined): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  for (const sev of SEVERITIES) {
    const diff = (b.severities[sev.key] ?? 0) - (a.severities[sev.key] ?? 0);
    if (diff !== 0) return diff;
  }
  return findings(b) - findings(a);
}
