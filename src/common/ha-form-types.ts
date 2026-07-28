// Minimal declarations for HA's <ha-form> schema shape, covering only what
// this repo's editors actually use — verified against HA frontend source
// (src/components/ha-form/types.ts, src/data/selector.ts) rather than
// pulling in the full HA frontend source tree as a dependency, matching
// the same approach ha-types.ts already takes for HomeAssistant/
// DeviceRegistryEntry. Extend this file if a future editor needs a
// selector/schema-type shape not covered here — re-verify against source
// rather than guessing the shape.

export interface HaFormSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface HaFormSelector {
  select?: {
    options: readonly HaFormSelectOption[] | readonly string[];
    multiple?: boolean;
    mode?: 'list' | 'dropdown' | 'box';
  };
  text?: Record<string, never>;
  boolean?: Record<string, never>;
}

export type HaFormConditionOperator = 'eq' | 'not_eq' | 'in' | 'not_in' | 'exists' | 'not_exists';

export interface HaFormFieldCondition {
  field: string;
  operator?: HaFormConditionOperator;
  value?: unknown;
}

export type HaFormCondition = HaFormFieldCondition;

export interface HaFormSchema {
  name: string;
  type?: 'multi_select';
  required?: boolean;
  disabled?: boolean;
  /** Applied only for display when the field is absent from `data` —
   * doesn't get written back unless the field is actually touched. */
  default?: unknown;
  /** Real HA feature (merged into HA frontend 2026-07-17), but not used
   * anywhere in this repo yet — verified directly against HA core's own
   * frontend pin that it isn't in any released HA version as of this
   * writing (2026.7.4, the latest release, still predates it). Every
   * conditionally-shown field in this repo's editors (e.g. Environment
   * card's custom_sections, Updates card's device_id) is instead included
   * or omitted from the schema array in plain JS, which needs no
   * unreleased HA functionality and produces the same visible behavior.
   * Switch those over to `visible:` once it's actually shipped in a
   * released HA version this repo's floor covers — don't use it before
   * then even though the type/declaration exists here already. */
  visible?: boolean | HaFormCondition | HaFormCondition[];
  selector?: HaFormSelector;
  /** Only meaningful together with type: 'multi_select'. */
  options?: Record<string, string> | readonly string[] | readonly (readonly [string, string])[];
}
