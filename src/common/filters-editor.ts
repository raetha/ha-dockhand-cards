/**
 * The Filters section of a list card's editor: one row per filter, a
 * multi-select of values and an "is / is not" choice shown once values are
 * picked (ha-form's own `visible:` condition). The form works on flat
 * `filter_<key>` / `filter_<key>_match` fields; this module maps them to and
 * from the card's `filters:`.
 */
import { html, type TemplateResult } from 'lit';
import type { HaFormSchema } from './ha-form-types';
import type { HomeAssistant } from './ha-types';
import { t, type EditorTranslationKey } from './i18n-editor';
import { stateLabel, type StateKind } from './state-label';
import { NONE, readFilter, activeFilterCount, type FiltersConfig } from './filters';
import { getAllStackDevices, getStackName } from './device-utils';
import { entityTags } from './tag-pills';
import { CONTAINER_TRANSLATION_KEYS, STACK_TRANSLATION_KEYS } from './const';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: EditorTranslationKey;
  options: (hass: HomeAssistant | undefined) => FilterOption[];
  /** Values come from the data (stacks, tags), so typing one that doesn't
   * exist yet is allowed. */
  custom?: boolean;
}

const states = (kind: StateKind, values: string[]) => (hass: HomeAssistant | undefined) =>
  values.map((value) => ({ value, label: stateLabel(hass, kind, value) }));

const labelled = (entries: [string, EditorTranslationKey][]) => (hass: HomeAssistant | undefined) =>
  entries.map(([value, key]) => ({ value, label: t(hass, key) }));

/** Every stack name and Dockhand tag in Home Assistant, sorted. */
function stackOptions(hass: HomeAssistant | undefined): FilterOption[] {
  const names = new Set(getAllStackDevices(hass ?? ({} as HomeAssistant)).map(getStackName).filter((n): n is string => !!n));
  return [{ value: NONE, label: t(hass, 'filter_option_no_stack') }, ...[...names].sort().map((value) => ({ value, label: value }))];
}

const TAGGED: ReadonlySet<string> = new Set([CONTAINER_TRANSLATION_KEYS.state, STACK_TRANSLATION_KEYS.status]);

/** Every Dockhand tag on a container or stack, sorted. Only their State and
 * Status sensors carry Dockhand's tags: an image sensor's `tags` are its
 * image tags (`nginx:latest`), which no row has. */
function tagOptions(hass: HomeAssistant | undefined): FilterOption[] {
  const names = new Map<string, string>();
  for (const [entityId, entry] of Object.entries(hass?.entities ?? {})) {
    if (entry.platform !== 'dockhand' || !TAGGED.has(entry.translation_key ?? '')) continue;
    for (const tag of entityTags(hass?.states[entityId])) names.set(tag.name.toLowerCase(), tag.name);
  }
  const sorted = [...names.values()].sort((a, b) => a.localeCompare(b));
  return [{ value: NONE, label: t(hass, 'filter_option_no_tags') }, ...sorted.map((value) => ({ value, label: value }))];
}

const CONTAINER_STATE: FilterField = {
  key: 'state',
  label: 'filter_state',
  options: (hass) => [
    ...states('container_state', ['running', 'paused', 'restarting', 'created'])(hass),
    { value: 'exited_ok', label: t(hass, 'filter_option_exited_ok') },
    { value: 'exited_error', label: t(hass, 'filter_option_exited_error') },
    ...states('container_state', ['dead'])(hass)
  ]
};
const HEALTH: FilterField = {
  key: 'health',
  label: 'filter_health',
  options: (hass) => [...states('health', ['healthy', 'unhealthy', 'starting'])(hass), { value: NONE, label: t(hass, 'filter_option_no_health_check') }]
};
const STACK: FilterField = { key: 'stack', label: 'filter_stack', options: stackOptions, custom: true };
const TAGS: FilterField = { key: 'tags', label: 'filter_tags', options: tagOptions, custom: true };
const UPDATE_KINDS: [string, EditorTranslationKey][] = [
  ['installable', 'filter_option_installable'],
  ['tag', 'filter_option_newer_tag'],
  ['pinned', 'filter_option_pinned'],
  ['held', 'filter_option_held']
];

export const CONTAINERS_FILTER_FIELDS: FilterField[] = [
  CONTAINER_STATE,
  HEALTH,
  STACK,
  { key: 'update', label: 'filter_update', options: labelled([['up_to_date', 'filter_option_up_to_date'], ...UPDATE_KINDS]) },
  TAGS
];

export const STACKS_FILTER_FIELDS: FilterField[] = [
  { key: 'status', label: 'filter_status', options: states('stack_status', ['running', 'partial', 'restarting', 'stopped', 'created']) },
  { key: 'type', label: 'filter_type', options: states('stack_type', ['internal', 'git', 'untracked']) },
  {
    key: 'updates',
    label: 'filter_updates',
    options: labelled([
      ['available', 'filter_option_updates_available'],
      ['none', 'filter_option_updates_none']
    ])
  },
  { key: 'git_sync', label: 'filter_git_sync', options: states('git_sync_status', ['synced', 'syncing', 'pending', 'error']) },
  TAGS
];

export const UPDATES_FILTER_FIELDS: FilterField[] = [{ key: 'update', label: 'filter_update', options: labelled(UPDATE_KINDS) }, STACK, TAGS];

export const SCHEDULE_TYPES = [
  'container_update',
  'container_start',
  'container_stop',
  'git_stack_sync',
  'stack_deploy',
  'env_update_check',
  'image_prune',
  'system_cleanup',
  'backup',
  'repo_prune',
  'repo_check',
  'repo_verify',
  'deploy_log_reconcile',
  'env_report'
];

/** The Schedules card's filters; Where (environment or global) only on a
 * standalone card: in the Overview each column is one environment. */
export function schedulesFilterFields(embedded: boolean): FilterField[] {
  return [
    { key: 'type', label: 'filter_type', options: states('schedule_type', SCHEDULE_TYPES) },
    {
      key: 'last_result',
      label: 'filter_last_result',
      options: (hass) => [
        ...states('schedule_status', ['success', 'failed', 'warning', 'error', 'running', 'queued', 'skipped', 'cancelled', 'stale'])(hass),
        { value: NONE, label: t(hass, 'filter_option_never_run') }
      ]
    },
    {
      key: 'enabled',
      label: 'filter_enabled',
      options: labelled([
        ['enabled', 'filter_option_enabled'],
        ['disabled', 'filter_option_disabled']
      ])
    },
    {
      key: 'origin',
      label: 'filter_origin',
      options: labelled([
        ['system', 'filter_option_system'],
        ['user', 'filter_option_user']
      ])
    },
    ...(embedded
      ? []
      : [
          {
            key: 'scope',
            label: 'filter_scope' as const,
            options: labelled([
              ['environment', 'filter_option_scope_environment'],
              ['global', 'filter_option_scope_global']
            ])
          }
        ])
  ];
}

const valuesField = (key: string) => `filter_${key}`;
const matchField = (key: string) => `filter_${key}_match`;

/** The Filters section: collapsed, its title counting the filters in use.
 * With `problems`, it also offers Always show problems. */
export function filtersSchema(hass: HomeAssistant | undefined, fields: FilterField[], filters: FiltersConfig | undefined, problems = false): HaFormSchema[] {
  const count = activeFilterCount(
    fields.map((f) => f.key),
    filters
  );
  return [
    {
      name: 'filters',
      type: 'expandable',
      flatten: true,
      icon: 'mdi:filter-variant',
      title: count ? `${t(hass, 'filters_section')} · ${t(hass, 'filters_active', { count })}` : t(hass, 'filters_section'),
      schema: [
        ...fields.map((field) => ({
          name: '',
          type: 'grid' as const,
          schema: [
            {
              name: valuesField(field.key),
              selector: { select: { multiple: true, mode: 'dropdown' as const, custom_value: field.custom ?? false, options: field.options(hass) } }
            },
            {
              name: matchField(field.key),
              default: 'is',
              visible: { field: valuesField(field.key), operator: 'exists' as const },
              selector: {
                select: {
                  mode: 'dropdown' as const,
                  options: [
                    { value: 'is', label: t(hass, 'filter_match_is') },
                    { value: 'is_not', label: t(hass, 'filter_match_is_not') }
                  ]
                }
              }
            }
          ]
        })),
        ...(problems ? [{ name: 'always_show_problems', default: false, selector: { boolean: {} } }] : []),
        { name: 'show_filtered_count', default: true, selector: { boolean: {} } }
      ]
    }
  ];
}

/** The form's data for these filters. No values is `undefined`, not `[]`,
 * so the "is / is not" choice stays hidden. */
export function filtersFormData(fields: FilterField[], filters: FiltersConfig | undefined): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    const rule = readFilter(filters?.[field.key]);
    data[valuesField(field.key)] = rule?.values;
    data[matchField(field.key)] = rule?.exclude ? 'is_not' : 'is';
  }
  return data;
}

/** The card's `filters:` from the form's data, keeping any filter this
 * editor doesn't show (a newer release's, or Where in the Overview);
 * undefined once nothing is filtered. */
export function filtersFromForm(fields: FilterField[], data: Record<string, unknown>, previous: FiltersConfig | undefined): FiltersConfig | undefined {
  const filters: FiltersConfig = { ...(previous ?? {}) };
  for (const field of fields) {
    const values = data[valuesField(field.key)];
    const list = Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string' && v !== '') : [];
    if (list.length === 0) delete filters[field.key];
    else filters[field.key] = data[matchField(field.key)] === 'is_not' ? { not: list } : list;
  }
  return Object.keys(filters).length ? filters : undefined;
}

/** The label for a filter field in the form. */
export function filterFieldLabel(hass: HomeAssistant | undefined, fields: FilterField[], name: string): string | undefined {
  if (name === 'show_filtered_count') return t(hass, 'show_filtered_count');
  if (name === 'always_show_problems') return t(hass, 'always_show_problems');
  const field = fields.find((f) => valuesField(f.key) === name || matchField(f.key) === name);
  if (!field) return undefined;
  return name === valuesField(field.key) ? t(hass, field.label) : t(hass, 'filter_match');
}

/** The Filters form for a list card's editor. `onChange` gets the card's new
 * `filters`, `show_filtered_count` and `always_show_problems`. `problems`,
 * the helper text saying what this card counts as a problem, offers Always
 * show problems. */
export function renderFiltersForm(
  hass: HomeAssistant,
  fields: FilterField[],
  config: { filters?: FiltersConfig; show_filtered_count?: boolean; always_show_problems?: boolean },
  onChange: (patch: { filters: FiltersConfig | undefined; show_filtered_count: boolean | undefined; always_show_problems?: boolean | undefined }) => void,
  problems?: EditorTranslationKey
): TemplateResult {
  const computeLabel = (schema: HaFormSchema): string => filterFieldLabel(hass, fields, schema.name) ?? schema.name;
  const computeHelper = (schema: HaFormSchema): string | undefined => (schema.name === 'always_show_problems' && problems ? t(hass, problems) : undefined);
  const changed = (ev: CustomEvent<{ value: Record<string, unknown> }>): void => {
    ev.stopPropagation();
    const value = ev.detail.value;
    const show = value.show_filtered_count;
    onChange({
      filters: filtersFromForm(fields, value, config.filters),
      show_filtered_count: show === false ? false : undefined,
      ...(problems ? { always_show_problems: value.always_show_problems === true ? true : undefined } : {})
    });
  };
  return html`
    <ha-form
      .hass=${hass}
      .data=${{
        ...filtersFormData(fields, config.filters),
        show_filtered_count: config.show_filtered_count ?? true,
        ...(problems ? { always_show_problems: config.always_show_problems ?? false } : {})
      }}
      .schema=${filtersSchema(hass, fields, config.filters, Boolean(problems))}
      .computeLabel=${computeLabel}
      .computeHelper=${computeHelper}
      @value-changed=${changed}
    ></ha-form>
  `;
}
