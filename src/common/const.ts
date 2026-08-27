export const DOCKHAND_DOMAIN = 'dockhand';
/** Injected at build time from package.json's own version (see
 * rollup.config.mjs's replace plugin) — never hand-edit this string
 * directly. This used to be a plain hardcoded literal that nobody ever
 * updated alongside an actual release (it read '0.1.0' through the
 * entire 1.0.0 release and most of 1.1.0's development), which is
 * exactly the kind of "two places to remember" drift this repo has
 * caught and fixed elsewhere — the console banner every user sees on
 * load was simply wrong the whole time. `npm test`/`vitest` don't run
 * through Rollup, so this literal string is what test code actually
 * sees; that's fine, since no test asserts on the real version number. */
export const CARD_VERSION = '__CARD_VERSION__';

/**
 * translation_key values used by ha-dockhand entities, per the platform's
 * strings.json. This is the resolution contract between this repo and
 * ha-dockhand: entities are matched by (platform === 'dockhand') +
 * (translation_key === one of these) + (device_id === selected environment),
 * never by parsing unique_id, since unique_id format is documented in
 * ha-dockhand's ARCHITECTURE.md as an internal detail that can change
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
  stacks: 'stacks',
  imageCount: 'image_count',
  volumeCount: 'volume_count',
  networkCount: 'network_count',
  activityEvents: 'activity_events',
  activityLogging: 'activity_logging',
  metricsCollection: 'metrics_collection',
  vulnerabilityScanning: 'vulnerability_scanning',
  updateChecks: 'update_checks',
  autoUpdate: 'auto_update',
  vulnerabilities: 'vulnerabilities',
  connectionType: 'connection_type',
  diskUsage: 'disk_usage',
  envBulkUpdate: 'env_bulk_update',
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
  gitSyncStatus: 'git_stack_sync_status',
  gitLastSync: 'git_stack_last_sync',
  gitSyncError: 'git_stack_sync_error'
} as const;

export type StackTranslationKey = keyof typeof STACK_TRANSLATION_KEYS;

// Per-schedule entities, resolved against schedule devices. last_status is
// the comprehensive/primary entity (name, description, is_system, plus the
// scheduling fields duplicated from next_run) as of ha-dockhand 1.9.0 — see
// that repo's ARCHITECTURE.md and CHANGELOG for why. next_run stays the
// canonical source for the timestamp value itself.
export const SCHEDULE_TRANSLATION_KEYS = {
  nextRun: 'next_run',
  lastStatus: 'last_status'
} as const;

export type ScheduleTranslationKey = keyof typeof SCHEDULE_TRANSLATION_KEYS;

// Entities needed for each display mode. "compact" is a strict subset of
// "standard", which is a strict subset of "detailed" (detailed additionally
// needs per-container cpu/memory sensors on the Containers group device,
// resolved separately, and — once available — a recent_events attribute).
export const REQUIRED_KEYS_BY_MODE: Record<'compact' | 'standard' | 'detailed' | 'full' | 'custom', EnvTranslationKey[]> = {
  compact: ['online', 'containers'],
  standard: [
    'online',
    'cpuUsage',
    'memoryUsage',
    'containers',
    'stacks',
    'imageCount',
    'volumeCount',
    'networkCount',
    'activityEvents'
  ],
  detailed: [
    'online',
    'cpuUsage',
    'memoryUsage',
    'containers',
    'stacks',
    'imageCount',
    'volumeCount',
    'networkCount',
    'activityEvents'
  ],
  full: [
    'online',
    'cpuUsage',
    'memoryUsage',
    'containers',
    'stacks',
    'imageCount',
    'volumeCount',
    'networkCount',
    'activityEvents',
    'diskUsage'
  ],
  // Could show any combination of sections depending on custom_sections,
  // so resolves everything full mode does rather than trying to compute
  // a narrower set from the config — same reasoning as full: better to
  // resolve one unused entity than to add conditional resolution logic
  // for a case that's cheap to just always cover.
  custom: [
    'online',
    'cpuUsage',
    'memoryUsage',
    'containers',
    'stacks',
    'imageCount',
    'volumeCount',
    'networkCount',
    'activityEvents',
    'diskUsage'
  ]
};

// Optional keys: enhance the header's own feature-icon row when present, but
// the card never errors or shows a "missing entity" hint for these — they're
// off by default in ha-dockhand and plenty of setups legitimately won't
// have them enabled.
export const OPTIONAL_STATUS_KEYS: EnvTranslationKey[] = [
  'updateChecks',
  'autoUpdate',
  'vulnerabilityScanning',
  'activityLogging',
  'metricsCollection',
  'connectionType'
];

// Human-readable labels for the editor's "would show more with these
// enabled" hint. Deliberately editor-only, not rendered on the live card:
// a user configuring the card benefits from knowing what more they could
// enable, but shouldn't see that reminder permanently on a dashboard once
// they've decided not to enable something.
export const ENV_FRIENDLY_LABEL: Partial<Record<EnvTranslationKey, string>> = {
  online: 'Online status',
  cpuUsage: 'CPU usage',
  memoryUsage: 'Memory usage',
  containers: 'Container counts',
  stacks: 'Stack counts',
  imageCount: 'Image count',
  volumeCount: 'Volume count',
  networkCount: 'Network count',
  activityEvents: 'Activity events',
  diskUsage: 'Disk usage'
};

export const CONTAINER_FRIENDLY_LABEL: Partial<Record<ContainerTranslationKey, string>> = {
  cpuPercent: 'CPU usage',
  memoryPercent: 'Memory usage %',
  memoryUsage: 'Memory usage',
  memoryLimit: 'Memory limit',
  networkRx: 'Network RX',
  networkTx: 'Network TX',
  blockRead: 'Block read',
  blockWrite: 'Block write'
};

export const STACK_FRIENDLY_LABEL: Partial<Record<StackTranslationKey, string>> = {
  status: 'Stack status',
  containersInStack: 'Container count',
  updatesAvailable: 'Pending-updates badge',
  gitSyncStatus: 'Git sync status',
  gitLastSync: 'Git last sync time',
  gitSyncError: 'Git sync error banner'
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
