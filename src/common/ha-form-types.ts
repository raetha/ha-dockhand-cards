// Minimal declarations for HA's <ha-form> schema shape, covering only what
// this repo's editors actually use — verified against HA frontend source
// (src/components/ha-form/types.ts, src/data/selector.ts) rather than
// pulling in the full HA frontend source tree as a dependency, matching
// the same approach ha-types.ts already takes for HomeAssistant/
// DeviceRegistryEntry. Extend this file if a future editor needs a
// selector/schema-type shape not covered here — re-verify against source
// rather than guessing the shape.

import type { EntityNameItem } from './ha-types';

export interface HaFormSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface HaFormSelector {
  select?: {
    options: readonly HaFormSelectOption[] | readonly string[];
    multiple?: boolean;
    /** Allows typing a value that isn't an option. */
    custom_value?: boolean;
    mode?: 'list' | 'dropdown' | 'box';
  };
  text?: Record<string, never>;
  icon?: Record<string, never>;
  boolean?: Record<string, never>;
  /** Verified directly against HA frontend source
   * (src/data/selector.ts's EntityNameSelector) — see common/card-name.ts
   * for the full reasoning behind using this rather than a plain text
   * field. */
  entity_name?: {
    entity_id?: string;
    default_name?: EntityNameItem | EntityNameItem[] | string;
  } | null;
}

/** ha-form's field conditions (HA 2026.8+, `conditions.ts`). */
export interface HaFormFieldCondition {
  field: string;
  operator?: 'eq' | 'not_eq' | 'in' | 'not_in' | 'exists' | 'not_exists';
  value?: unknown;
}

export interface HaFormSchema {
  name: string;
  type?: 'multi_select' | 'expandable' | 'grid';
  required?: boolean;
  disabled?: boolean;
  /** Applied only for display when the field is absent from `data` —
   * doesn't get written back unless the field is actually touched. */
  default?: unknown;
  /** Shown while every condition holds; the value is kept when hidden. */
  visible?: boolean | HaFormFieldCondition | HaFormFieldCondition[];
  selector?: HaFormSelector;
  /** Only meaningful together with type: 'multi_select'. */
  options?: Record<string, string> | readonly string[] | readonly (readonly [string, string])[];
  /** The rest below are only meaningful together with type: 'expandable'
   * — a native ha-form collapsible-section type, confirmed directly
   * against HA frontend source (src/components/ha-form/types.ts and
   * the actual Tile card editor's own usage) after this repo spent a
   * while hand-building <ha-expansion-panel> wrapping for content that
   * turns out to fit this natively. `icon` (an mdi: string, what this
   * repo's own icon convention already uses) and `iconPath` (a raw SVG
   * path, what HA's own first-party editors use via @mdi/js imports —
   * not used in this repo, `icon` covers the same need more simply) are
   * both real, alongside `title` (unlike a field's own label, not run
   * through computeLabel — the literal heading string, as-is) and
   * `expanded` (native default-open-state — no more hand-tracked
   * component state needed for this). `flatten: true` (which every
   * current use of this type sets, matching HA's own Tile card editor)
   * writes child field values directly onto the parent data object
   * rather than nesting them under this entry's own `name` key. */
  schema?: readonly HaFormSchema[];
  flatten?: boolean;
  title?: string;
  icon?: string;
  iconPath?: string;
  expanded?: boolean;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Only meaningful together with type: 'grid' — confirmed real against
   * HA frontend source (src/components/ha-form/ha-form-grid.ts):
   * `grid-template-columns: repeat(auto-fit, minmax(column_min_width ??
   * 200px, 1fr))`, so narrow fields (a boolean toggle, well under 200px)
   * naturally sit side by side without this repo needing its own layout
   * CSS for it. Like `expandable`, does not forward the `warning` prop
   * to its nested per-field `<ha-form>`s — the same constraint applies
   * here as there. */
  column_min_width?: string;
}
