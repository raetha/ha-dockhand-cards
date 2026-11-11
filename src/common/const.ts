import type { EditorTranslationKey } from './i18n-editor';

export const DOCKHAND_DOMAIN = 'dockhand';
/** Injected at build time from package.json's version (rollup.config.mjs's
 * replace plugin), so the console banner can't drift from the release.
 * Tests don't run through Rollup and see the placeholder; none asserts on
 * it. */
export const CARD_VERSION = '__CARD_VERSION__';

/**
 * translation_key values used by ha-dockhand entities, per the platform's
 * strings.json. This is the resolution contract between this repo and
 * ha-dockhand: entities are matched by (platform === 'dockhand') +
 * (translation_key === one of these) + (device_id === selected environment),
 * never by parsing unique_id, since unique_id format is documented in
 * ha-dockhand's architecture.md as an internal detail that can change
 * between releases. translation_key is the intentional, versioned public
 * surface (it drives strings.json/icons.json and is stable across
 * refactors).
 *
 * If ha-dockhand ever renames one of these, bump MIN_INTEGRATION_HINT below
 * and add a migration note to the README rather than silently breaking.
 */
export const ENV_TRANSLATION_KEYS = {
  online: 'online',
  cpuUsage: 'cpu_usage',
  memoryUsage: 'memory_usage',
  containers: 'containers',
  // ha-dockhand 2.0+: what were the containers and stacks sensors'
  // attributes, each its own sensor.
  containersRunning: 'containers_running',
  containersStopped: 'containers_stopped',
  containersPaused: 'containers_paused',
  containersRestarting: 'containers_restarting',
  containersUnhealthy: 'containers_unhealthy',
  pendingUpdates: 'pending_updates',
  installableUpdates: 'installable_updates',
  systemUpdates: 'system_updates',
  versionTagUpdates: 'version_tag_updates',
  stacks: 'stacks',
  stacksRunning: 'stacks_running',
  stacksPartial: 'stacks_partial',
  stacksStopped: 'stacks_stopped',
  memoryUsed: 'memory_used',
  memoryTotal: 'memory_total',
  imageCount: 'image_count',
  volumeCount: 'volume_count',
  networkCount: 'network_count',
  activityEvents: 'activity_events',
  activityEventsToday: 'activity_events_today',
  activityLogging: 'activity_logging',
  metricsCollection: 'metrics_collection',
  vulnerabilityScanning: 'vulnerability_scanning',
  vulnerabilityScanner: 'vulnerability_scanner',
  updateChecks: 'update_checks',
  autoUpdate: 'auto_update',
  vulnerabilities: 'vulnerabilities',
  vulnerabilitiesCritical: 'vulnerabilities_critical',
  vulnerabilitiesHigh: 'vulnerabilities_high',
  vulnerabilitiesMedium: 'vulnerabilities_medium',
  vulnerabilitiesLow: 'vulnerabilities_low',
  imagesScanned: 'images_scanned',
  connectionType: 'connection_type',
  diskUsage: 'disk_usage',
  diskUsageImages: 'disk_usage_images',
  diskUsageContainers: 'disk_usage_containers',
  diskUsageVolumes: 'disk_usage_volumes',
  diskUsageBuildCache: 'disk_usage_build_cache',
  checkUpdates: 'check_updates'
} as const;

export type EnvTranslationKey = keyof typeof ENV_TRANSLATION_KEYS;

// Per-container entities, resolved against container devices (not the
// environment device). Same translation_key contract as
// ENV_TRANSLATION_KEYS above.
export const CONTAINER_TRANSLATION_KEYS = {
  state: 'state',
  health: 'health',
  cpuPercent: 'container_cpu_percent',
  memoryUsage: 'container_memory_usage',
  memoryCache: 'container_memory_cache',
  memoryPercent: 'container_memory_percent',
  memoryLimit: 'container_memory_limit',
  networkRx: 'container_network_rx',
  networkTx: 'container_network_tx',
  blockRead: 'container_block_read',
  blockWrite: 'container_block_write'
} as const;

export type ContainerTranslationKey = keyof typeof CONTAINER_TRANSLATION_KEYS;

// Per-stack entities, resolved against stack devices. The git_* keys only
// exist on git-tracked stacks — ha-dockhand simply doesn't create them
// otherwise, which resolveEntities already treats as "not_found" and the
// stack card treats as "this stack isn't git-tracked", not an error.
export const STACK_TRANSLATION_KEYS = {
  status: 'status',
  containersInStack: 'containers_in_stack',
  updatesAvailable: 'stack_updates_available',
  pendingUpdates: 'stack_pending_updates',
  gitSyncStatus: 'git_stack_sync_status',
  gitLastSync: 'git_stack_last_sync',
  gitSyncError: 'git_stack_sync_error',
  // Dockhand's own stack totals (ha-dockhand 1.11.0+ with Dockhand 1.0.52+,
  // only while its "Enable container and stack stats" option is on). No memory
  // percentage — Dockhand doesn't report one for a stack.
  cpuPercent: 'stack_cpu_percent',
  memoryUsage: 'stack_memory_usage',
  memoryLimit: 'stack_memory_limit',
  networkRx: 'stack_network_rx',
  networkTx: 'stack_network_tx',
  blockRead: 'stack_block_read',
  blockWrite: 'stack_block_write',
  runningContainers: 'stack_running_containers'
} as const;

export type StackTranslationKey = keyof typeof STACK_TRANSLATION_KEYS;

// Per-schedule entities, resolved against schedule devices. last_status is
// the comprehensive/primary entity (name, description, is_system, plus the
// scheduling fields duplicated from next_run) as of ha-dockhand 1.9.0 — see
// that repo's architecture.md and CHANGELOG for why. next_run stays the
// canonical source for the timestamp value itself.
export const SCHEDULE_TRANSLATION_KEYS = {
  nextRun: 'next_run',
  lastStatus: 'last_status',
  // ha-dockhand 2.0+, only for schedule types Dockhand can run or pause.
  run: 'schedule_run',
  enabled: 'schedule_enabled'
} as const;

export type ScheduleTranslationKey = keyof typeof SCHEDULE_TRANSLATION_KEYS;

// Entities needed for each display mode. "compact" is a strict subset of
// "standard", which is a strict subset of "detailed" (detailed additionally
// needs per-container cpu/memory sensors on the Containers group device,
// resolved separately, and — once available — a recent_events attribute).
const CONTAINER_SECTION_KEYS: EnvTranslationKey[] = [
  'containers',
  'containersRunning',
  'containersStopped',
  'containersPaused',
  'containersRestarting',
  'containersUnhealthy',
  'pendingUpdates',
  'installableUpdates',
  'systemUpdates',
  'versionTagUpdates'
];
const STANDARD_KEYS: EnvTranslationKey[] = [
  'online',
  'cpuUsage',
  'memoryUsage',
  'memoryUsed',
  'memoryTotal',
  ...CONTAINER_SECTION_KEYS,
  'stacks',
  'stacksRunning',
  'stacksPartial',
  'stacksStopped',
  'imageCount',
  'volumeCount',
  'networkCount',
  'activityEvents',
  'activityEventsToday'
];
const FULL_KEYS: EnvTranslationKey[] = [
  ...STANDARD_KEYS,
  'diskUsage',
  'diskUsageImages',
  'diskUsageContainers',
  'diskUsageVolumes',
  'diskUsageBuildCache'
];

// Entities each display mode draws from. "compact" is a strict subset of
// "standard", which is a strict subset of "full". Custom could show any
// section, so it resolves everything full does.
export const REQUIRED_KEYS_BY_MODE: Record<'compact' | 'standard' | 'detailed' | 'full' | 'custom', EnvTranslationKey[]> = {
  compact: ['online', ...CONTAINER_SECTION_KEYS],
  standard: STANDARD_KEYS,
  detailed: STANDARD_KEYS,
  full: FULL_KEYS,
  custom: FULL_KEYS
};

// Optional keys: enhance the header's own feature-icon row when present, but
// the card never errors or shows a "missing entity" hint for these — they're
// off by default in ha-dockhand and plenty of setups legitimately won't
// have them enabled.
export const OPTIONAL_STATUS_KEYS: EnvTranslationKey[] = [
  'updateChecks',
  'autoUpdate',
  'vulnerabilityScanning',
  'vulnerabilityScanner',
  'activityLogging',
  'metricsCollection',
  'connectionType'
];

// Human-readable labels for the editor's "would show more with these
// enabled" hint. Deliberately editor-only, not rendered on the live card:
// a user configuring the card benefits from knowing what more they could
// enable, but shouldn't see that reminder permanently on a dashboard once
// they've decided not to enable something.
export const ENV_FRIENDLY_LABEL: Partial<Record<EnvTranslationKey, EditorTranslationKey>> = {
  online: 'entity_online_status',
  cpuUsage: 'entity_cpu_usage',
  memoryUsage: 'entity_memory_usage',
  containers: 'entity_container_counts',
  containersRunning: 'entity_containers_running',
  containersStopped: 'entity_containers_stopped',
  containersPaused: 'entity_containers_paused',
  containersRestarting: 'entity_containers_restarting',
  containersUnhealthy: 'entity_containers_unhealthy',
  pendingUpdates: 'entity_pending_updates',
  installableUpdates: 'entity_installable_updates',
  systemUpdates: 'entity_system_updates',
  versionTagUpdates: 'entity_version_tag_updates',
  memoryUsed: 'entity_memory_used',
  memoryTotal: 'entity_memory_total',
  stacks: 'entity_stack_counts',
  stacksRunning: 'entity_stacks_running',
  stacksPartial: 'entity_stacks_partial',
  stacksStopped: 'entity_stacks_stopped',
  activityEventsToday: 'entity_activity_events_today',
  diskUsageImages: 'entity_disk_usage_images',
  diskUsageContainers: 'entity_disk_usage_containers',
  diskUsageVolumes: 'entity_disk_usage_volumes',
  diskUsageBuildCache: 'entity_disk_usage_build_cache',
  vulnerabilitiesCritical: 'entity_vulnerabilities_critical',
  vulnerabilitiesHigh: 'entity_vulnerabilities_high',
  vulnerabilitiesMedium: 'entity_vulnerabilities_medium',
  vulnerabilitiesLow: 'entity_vulnerabilities_low',
  imagesScanned: 'entity_images_scanned',
  imageCount: 'entity_image_count',
  volumeCount: 'entity_volume_count',
  networkCount: 'entity_network_count',
  activityEvents: 'entity_activity_events',
  diskUsage: 'entity_disk_usage'
};

export const CONTAINER_FRIENDLY_LABEL: Partial<Record<ContainerTranslationKey, EditorTranslationKey>> = {
  cpuPercent: 'entity_cpu_usage',
  memoryPercent: 'entity_memory_usage_percent',
  memoryUsage: 'entity_memory_usage',
  memoryLimit: 'entity_memory_limit',
  networkRx: 'entity_network_rx',
  networkTx: 'entity_network_tx',
  blockRead: 'entity_block_read',
  blockWrite: 'entity_block_write'
};

export const STACK_FRIENDLY_LABEL: Partial<Record<StackTranslationKey, EditorTranslationKey>> = {
  status: 'entity_stack_status',
  containersInStack: 'entity_container_count',
  updatesAvailable: 'entity_pending_updates_badge',
  gitSyncStatus: 'entity_git_sync_status',
  gitLastSync: 'entity_git_last_sync',
  gitSyncError: 'entity_git_sync_error',
  cpuPercent: 'entity_cpu_usage',
  memoryUsage: 'entity_memory_usage',
  memoryLimit: 'entity_memory_limit',
  networkRx: 'entity_network_rx',
  networkTx: 'entity_network_tx',
  blockRead: 'entity_block_read',
  blockWrite: 'entity_block_write'
};

// Dockhand's own container health values — shared between Container
// (singular) and Containers (plural, the list card), both of which
// render a health indicator from the same underlying entity states.
export const HEALTH_ICON: Record<string, string> = {
  healthy: 'mdi:heart',
  unhealthy: 'mdi:heart-broken',
  starting: 'mdi:heart-outline'
};

/** Maps Dockhand's own health values to the shared .status-chip/.value-
 * label's canonical color modifier names (common/shared-styles.ts) —
 * kept separate from the health value itself, which is still shown as
 * visible text (a `title` attribute) and used as HEALTH_ICON's own
 * lookup key verbatim. */
export const HEALTH_STATUS_CLASS: Record<string, string> = {
  healthy: 'ok',
  unhealthy: 'error',
  starting: 'warn'
};

/** Maps Stack's own raw status value to .hero-word's own canonical
 * color modifier names (common/shared-styles.ts) — same pattern as
 * HEALTH_STATUS_CLASS above. */
export const STACK_STATUS_CLASS: Record<string, string> = {
  running: 'ok',
  partial: 'warn',
  restarting: 'warn',
  stopped: 'error',
  created: 'neutral'
};

/** Maps Container's own raw state value to .hero-word's own canonical
 * color modifier names (common/shared-styles.ts) — same pattern as
 * HEALTH_STATUS_CLASS above. */
export const CONTAINER_STATE_CLASS: Record<string, string> = {
  running: 'ok',
  paused: 'warn',
  restarting: 'error',
  exited: 'neutral',
  dead: 'neutral'
};

/** Default header badges for the Container and Stack cards, used when their
 * `icon` config option is unset. */
export const DEFAULT_CONTAINER_ICON = 'mdi:docker';
export const DEFAULT_STACK_ICON = 'mdi:layers';

/** ha-dockhand's `latest_version` when an update is pending but Dockhand gave
 * no version or tag for it — shown as "Update available", never verbatim. */
export const UPDATE_PENDING_VERSION = 'update-pending';
