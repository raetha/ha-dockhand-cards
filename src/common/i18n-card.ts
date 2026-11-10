/**
 * Card-runtime translations — every string the cards themselves render
 * (not the editors), so the card bundle doesn't carry the much larger
 * editor translation table. `{name}`-style placeholders are filled by
 * t()'s `vars` argument.
 *
 * Words that name an entity's state (container state, health, stack status,
 * …) are also here, as `<kind>_<raw state>` keys: see stateLabel() in
 * common/state-label.ts, which prefers Home Assistant's own translated state
 * when the integration provides one and falls back to these.
 *
 * English is here; the other languages are in src/i18n/<lang>.ts, loaded
 * on demand (i18n-loader.ts). See i18n-editor.ts for the editor-only keys.
 */

import { LANGUAGES, languagePack, loadLanguage, type LanguagePack } from './i18n-loader';

export type CardTranslationKey = keyof typeof en;

const en = {
  no_schedules_found: 'No schedules found.',
  settings_link_edit_environment: 'Edit environment in Dockhand',
  settings_link_unavailable: 'Can’t open Dockhand — the configured URL doesn’t look valid. Check the URL in the ha-dockhand integration’s settings.',
  settings_link_view_container: 'View container in Dockhand',
  settings_link_view_containers: 'View containers in Dockhand',
  settings_link_view_schedules: 'View schedules in Dockhand',
  settings_link_view_stack: 'View stack in Dockhand',
  settings_link_view_stacks: 'View stacks in Dockhand',
  settings_link_view_vulnerabilities: 'View vulnerabilities in Dockhand',
  control_start: 'Start',
  control_stop: 'Stop',
  control_restart: 'Restart',
  control_stop_confirm: 'Stop {name}?',
  control_restart_confirm: 'Restart {name}?',
  control_deploy: 'Redeploy',
  control_deploy_confirm: '{name}: {action}?',
  control_run_now: 'Run now',
  control_run_now_confirm: 'Run {name} now?',
  control_enable_schedule: 'Enable schedule',
  control_disable_schedule: 'Disable schedule',
  msg_select_container: 'Please select a Dockhand container — edit this card to pick one.',
  msg_select_stack: 'Please select a Dockhand stack — edit this card to pick one.',
  msg_select_environment: 'Please select a Dockhand environment — edit this card to pick one.',
  msg_container_not_found: 'Container device not found. It may have been removed — edit this card to pick another.',
  msg_stack_not_found: 'Stack device not found. It may have been removed — edit this card to pick another.',
  msg_environment_not_found: 'Environment device not found. It may have been removed — edit this card to pick another.',
  msg_container_state_missing: 'This container’s state sensor isn’t available yet.',
  msg_stack_status_missing: 'This stack’s status sensor isn’t available yet.',
  msg_no_environment_selected: 'No environment selected. Edit this card to pick one or more.',
  msg_environment_offline: 'Environment offline',
  msg_no_sections_selected: 'No sections selected — edit this card to choose what to show.',
  msg_no_environments_found: 'No Dockhand environments found.',
  msg_all_sections_off: 'Every section is turned off — edit this card to enable at least one.',
  msg_everything_up_to_date: 'Everything up to date.',
  msg_no_vulnerabilities: 'No vulnerabilities found',
  msg_no_vulnerability_data: 'No vulnerability scan data right now — the last fetch from Dockhand failed, or no scan has run for this environment yet.',
  msg_vulnerability_sensor_needed: 'This card needs the “Vulnerabilities” sensor enabled for this environment (it’s off by default — enable it in Home Assistant’s entity settings, and make sure vulnerability scanning is turned on for this environment in Dockhand itself).',
  msg_requires_newer_integration: 'Requires a recent ha-dockhand release.',
  msg_git_sync_failed: 'The last sync/deploy attempt failed.',
  name_container: 'Container',
  name_stack: 'Stack',
  name_environment: 'Environment',
  name_containers: 'Containers',
  name_stacks: 'Stacks',
  name_updates: 'Updates',
  name_schedules: 'Schedules',
  name_vulnerabilities: 'Vulnerabilities',
  label_cpu: 'CPU',
  label_memory: 'Memory',
  label_network_rx: 'Network RX',
  label_network_tx: 'Network TX',
  label_block_read: 'Block read',
  label_block_write: 'Block write',
  label_images: 'Images',
  label_containers: 'Containers',
  label_volumes: 'Volumes',
  label_networks: 'Networks',
  label_stacks: 'Stacks',
  label_build_cache: 'Build cache',
  label_disk_usage: 'Disk usage',
  label_events: 'Events',
  label_cpu_memory_history: 'CPU & Memory history',
  label_top_containers: 'Top containers by CPU',
  label_recent_events: 'Recent events',
  label_git_sync: 'Git sync',
  label_status: 'Status',
  label_last_sync: 'Last sync',
  label_commit: 'Commit',
  label_images_scanned: 'Images scanned',
  label_total: 'Total {count}',
  label_unknown: 'Unknown',
  events_today: '{count} today',
  events_total: '{count} total',
  total_findings: 'Total findings: {count}',
  update_available: 'Update available',
  update_available_versions: 'Update available: {from} → {to}',
  newer_version_title: 'Newer version available',
  newer_version_move_to: 'Move to {version}',
  newer_version_move_to_bump: 'Move to {version} ({bump})',
  newer_version_ahead: '{count} versions ahead of the tag you run.',
  newer_version_hint: "Change the container's image tag to move to it.",
  pinned_digest_title: 'Pinned to a digest',
  pinned_digest_hint: 'The tag moved to a new digest, but this image is pinned to the old one. Update the digest in the compose file to pull it.',
  update_held_title: 'Update held: {count} h left of the minimum image age',
  update_held_short: '{count} h left',
  update_held_due_title: 'Update held: the new image has reached the minimum image age. Dockhand offers it at its next update check.',
  update_held_due_short: 'At next check',
  version_bump_major: 'major',
  version_bump_minor: 'minor',
  version_bump_patch: 'patch',
  check_updates: 'Check for updates',
  checking: 'Checking…',
  update_all: 'Update all',
  updating: 'Updating…',
  pending_updates: 'Pending updates',
  pending_installable: 'Installable: {count}',
  pending_system: 'System: {count}',
  pending_version_tags: 'New version tags: {count}',
  stat_running: 'Running',
  stat_stopped: 'Stopped',
  stat_paused: 'Paused',
  stat_restarting: 'Restarting',
  stat_unhealthy: 'Unhealthy',
  containers_all_healthy: 'All containers healthy',
  containers_unhealthy: 'Unhealthy containers: {count}',
  containers_restarting: 'Restarting containers: {count}',
  conn_socket: 'Unix socket connection',
  conn_direct: 'Direct Docker connection',
  conn_hawser_standard: 'Hawser agent (standard mode)',
  conn_hawser_edge: 'Hawser agent (edge mode)',
  severity_critical: 'Critical',
  severity_high: 'High',
  severity_medium: 'Medium',
  severity_low: 'Low',
  container_state_created: 'Created',
  container_state_running: 'Running',
  container_state_paused: 'Paused',
  container_state_restarting: 'Restarting',
  container_state_removing: 'Removing',
  container_state_exited: 'Exited',
  container_state_dead: 'Dead',
  health_healthy: 'Healthy',
  health_unhealthy: 'Unhealthy',
  health_starting: 'Starting',
  stack_status_running: 'Running',
  stack_status_partial: 'Partial',
  stack_status_stopped: 'Stopped',
  stack_status_created: 'Created',
  stack_type_internal: 'Internal',
  stack_type_git: 'Git',
  stack_type_untracked: 'Untracked',
  schedule_status_success: 'Success',
  schedule_status_failed: 'Failed',
  schedule_status_warning: 'Warning',
  schedule_status_running: 'Running',
  schedule_status_queued: 'Queued',
  schedule_status_skipped: 'Skipped',
  schedule_status_error: 'Error',
  schedule_status_cancelled: 'Cancelled',
  schedule_status_stale: 'Stale',
  schedule_disabled: 'Disabled',
  schedule_never_run: 'Never run',
  schedule_global: 'Global',
  schedule_type_container_update: 'Container update',
  schedule_type_git_stack_sync: 'Git stack sync',
  schedule_type_system_cleanup: 'System cleanup',
  schedule_type_env_update_check: 'Environment update check',
  schedule_type_image_prune: 'Image prune',
  schedule_type_deploy_log_reconcile: 'Deploy log reconcile',
  schedule_type_env_report: 'State report',
  schedule_type_container_start: 'Container start',
  schedule_type_container_stop: 'Container stop',
  schedule_type_backup: 'Backup',
  schedule_type_repo_prune: 'Repo prune',
  schedule_type_repo_check: 'Repo check',
  schedule_type_repo_verify: 'Repo verify',
  schedule_type_stack_deploy: 'Stack deploy',
  event_create: 'Created',
  event_start: 'Started',
  event_stop: 'Stopped',
  event_die: 'Exited',
  event_kill: 'Killed',
  event_restart: 'Restarted',
  event_pause: 'Paused',
  event_unpause: 'Resumed',
  event_destroy: 'Removed',
  event_rename: 'Renamed',
  event_update: 'Updated',
  event_oom: 'Out of memory',
  event_health_status: 'Health changed',
  suggest_environment_overview: 'Environment overview',
  suggest_vulnerability_summary: 'Vulnerability summary',
  suggest_all_stacks: 'All stacks',
  suggest_all_containers: 'All containers',
  suggest_this_stack: 'This stack',
  suggest_stacks_in_environment: 'All stacks in this environment',
  suggest_this_container: 'This container',
  suggest_containers_in_environment: 'All containers in this environment',
  suggest_schedules_in_environment: 'Schedules in this environment',
  suggest_all_schedules: 'All schedules',
  git_sync_status_pending: 'Pending',
  git_sync_status_syncing: 'Syncing',
  git_sync_status_synced: 'Synced',
  git_sync_status_error: 'Error'
} as const;












/** For tests that check every locale against English. */
export const CARD_LOCALE_CODES = ['en', ...LANGUAGES];
export const CARD_TRANSLATION_KEYS = Object.keys(en) as CardTranslationKey[];

type HassLanguage = { language?: string; locale?: { language?: string } } | undefined;

/** The language Home Assistant is showing its UI in. */
export function cardLanguage(hass: HassLanguage): string {
  return hass?.locale?.language ?? hass?.language ?? 'en';
}

function fill(text: string, vars: Record<string, string | number> | undefined): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** Looks up a card-runtime translated string for the current HA language,
 * falling back to English for an unsupported language or missing key. */
export function t(hass: HassLanguage, key: CardTranslationKey, vars?: Record<string, string | number>): string {
  return fill(languageStrings(cardLanguage(hass))?.card[key] ?? en[key], vars);
}

/** A language's strings, starting to load them (English until they're
 * here; the card redraws on its next update) when they haven't yet. */
export function languageStrings(lang: string): LanguagePack | undefined {
  const pack = languagePack(lang);
  if (!pack && lang !== 'en') void loadLanguage(lang);
  return pack;
}

/** Like t() for a key built at runtime (e.g. from an entity's raw state);
 * undefined when no such key exists. */
export function tMaybe(hass: HassLanguage, key: string, vars?: Record<string, string | number>): string | undefined {
  if (!(key in en)) return undefined;
  return t(hass, key as CardTranslationKey, vars);
}
