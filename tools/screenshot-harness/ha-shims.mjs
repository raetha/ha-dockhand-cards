// Minimal shims for Home Assistant's own frontend components, which
// aren't available outside a real HA frontend bundle. Only implements
// enough behavior for these cards to render visually — not a general
// HA frontend replacement.

let iconPaths = {};
export async function loadIconPaths() {
  const res = await fetch('./icon-paths.json');
  iconPaths = await res.json();
}

function iconSvg(mdiName, size = 24, color = 'currentColor') {
  const name = (mdiName || '').replace(/^mdi:/, '');
  const path = iconPaths[name];
  if (!path) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24"></svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"><path d="${path}"></path></svg>`;
}

class HaIcon extends HTMLElement {
  static get observedAttributes() {
    return ['icon'];
  }
  connectedCallback() {
    queueMicrotask(() => this.render());
  }
  attributeChangedCallback() {
    queueMicrotask(() => this.render());
  }
  render() {
    if (!this.isConnected) return;
    const size = getComputedStyle(this).getPropertyValue('--mdc-icon-size').trim() || '24px';
    this.style.display = 'inline-flex';
    this.style.alignItems = 'center';
    this.style.justifyContent = 'center';
    this.style.width = size;
    this.style.height = size;
    this.innerHTML = iconSvg(this.getAttribute('icon'), parseInt(size), 'currentColor');
  }
}

class HaStateIcon extends HTMLElement {
  set stateObj(state) {
    this._stateObj = state;
    queueMicrotask(() => this.render());
  }
  get stateObj() {
    return this._stateObj;
  }
  set hass(h) {
    this._hass = h;
  }
  connectedCallback() {
    queueMicrotask(() => this.render());
  }
  render() {
    if (!this.isConnected) return;
    const state = this._stateObj;
    // Real ha-state-icon resolves via icon translations (icons.json's
    // per-state mapping) + hass. We don't have that pipeline here, so
    // the mock data includes an explicit `icon` attribute as a shortcut.
    const icon = state?.attributes?.icon || 'mdi:help-circle-outline';
    const size = getComputedStyle(this).getPropertyValue('--mdc-icon-size').trim() || '24px';
    this.style.display = 'inline-flex';
    this.style.width = size;
    this.style.height = size;
    this.innerHTML = iconSvg(icon, parseInt(size), 'currentColor');
  }
}

class HaCard extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block';
    this.style.background = 'var(--card-background-color, #1c1c1c)';
    this.style.borderRadius = 'var(--ha-card-border-radius, 12px)';
    this.style.boxShadow = 'var(--ha-card-box-shadow, 0 2px 6px rgba(0,0,0,0.3))';
    this.style.border = 'var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #333))';
    this.style.padding = '16px';
    this.style.color = 'var(--primary-text-color, #e1e1e1)';
    this.style.overflow = 'hidden';
  }
}

class HaSwitch extends HTMLElement {
  connectedCallback() {
    const checked = this.hasAttribute('checked') || this.checked;
    this.style.display = 'inline-block';
    this.style.width = '34px';
    this.style.height = '18px';
    this.style.borderRadius = '9px';
    this.style.background = checked ? 'var(--dockhand-accent-color, #0ea5e9)' : 'var(--divider-color, #444)';
    this.style.position = 'relative';
    queueMicrotask(() => {
      if (!this.isConnected) return;
      this.innerHTML = `<span style="position:absolute;top:2px;${checked ? 'right:2px' : 'left:2px'};width:14px;height:14px;border-radius:50%;background:white;"></span>`;
    });
  }
}

class HaFormfield extends HTMLElement {
  connectedCallback() {
    this.style.display = 'flex';
    this.style.alignItems = 'center';
    this.style.gap = '8px';
  }
}

class HaExpansionPanel extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block';
    this.style.border = '1px solid var(--divider-color, #444)';
    this.style.borderRadius = '8px';
    this.style.padding = '8px';
  }
}

class HaSelect extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block';
  }
}
class HaInput extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block';
  }
}
class HaSortable extends HTMLElement {
  connectedCallback() {
    this.style.display = 'block';
  }
}

class HaIconButton extends HTMLElement {
  connectedCallback() {
    this.style.display = 'inline-flex';
    this.style.alignItems = 'center';
    this.style.justifyContent = 'center';
    // Real ha-icon-button reads --ha-icon-button-size (default 48px) —
    // this shim previously hard-coded 40px regardless, which meant any
    // CSS setting that custom property had zero visible effect in a
    // screenshot even though it worked correctly in real HA. Read via
    // getComputedStyle so an ancestor rule (e.g. .row-action-btn) is
    // respected the same way it would be for the real component.
    const size = getComputedStyle(this).getPropertyValue('--ha-icon-button-size').trim() || '48px';
    this.style.width = size;
    this.style.height = size;
    this.style.cursor = 'pointer';
    this.style.color = 'inherit';
  }
}

// Modeled directly against the real component's own source (ha-button.ts
// from home-assistant/frontend, and the underlying @home-assistant/
// webawesome button component, both fetched and read directly this
// session) rather than guessed at — accurate enough to genuinely verify
// layout/sizing/appearance decisions against, not just a placeholder
// shape. Still not pixel-identical to the real Web Awesome-based
// component (no real CSS parts/shadow-DOM slotting), but every behavior
// below is confirmed real, not approximated.
const HA_BUTTON_VARIANT_COLOR = {
  brand: '#03a9f4',
  neutral: '#6b7280',
  success: '#4caf50',
  warning: '#ff9800',
  danger: '#f44336'
};
class HaButton extends HTMLElement {
  static get observedAttributes() {
    return ['size', 'appearance', 'variant', 'disabled'];
  }
  connectedCallback() {
    this._render();
  }
  attributeChangedCallback() {
    if (this.isConnected) this._render();
  }
  set loading(value) {
    this._loading = value;
    this._render();
  }
  _render() {
    const variant = this.getAttribute('variant') || 'brand';
    const appearance = this.getAttribute('appearance') || 'accent';
    const size = this.getAttribute('size') || 'm';
    const color = HA_BUTTON_VARIANT_COLOR[variant] || HA_BUTTON_VARIANT_COLOR.brand;
    // Real: :host([size="xs"]) .button { height: var(--ha-button-height, var(--button-height, 24px)) }
    const heightBySize = { xs: '24px', s: '32px', m: '40px', l: '48px', xl: '56px' };
    const height = heightBySize[size] || heightBySize.m;
    // Real: hasIcon && !hasText && !hasOtherElements -> isIconButton,
    // styled width: var(--wa-form-control-height); aspect-ratio: 1.
    const startSlotIcon = this.querySelector('[slot="start"]');
    const hasVisibleText = [...this.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0);
    const isIconButton = !!startSlotIcon && !hasVisibleText;
    const disabled = this.hasAttribute('disabled');

    this.style.display = 'inline-flex';
    this.style.alignItems = 'center';
    this.style.justifyContent = 'center';
    this.style.gap = '6px';
    this.style.height = height;
    this.style.boxSizing = 'border-box';
    if (isIconButton) {
      // Real: aspect-ratio: 1, so width tracks height exactly.
      this.style.width = height;
      this.style.padding = '0';
      // Real: slotted icons at xs get --mdc-icon-size: 16px automatically.
      if (size === 'xs' && startSlotIcon) startSlotIcon.style.setProperty('--mdc-icon-size', '16px');
    } else {
      this.style.width = 'auto';
      this.style.padding = '0 12px';
    }
    this.style.borderRadius = '9999px';
    this.style.fontSize = '0.85em';
    this.style.fontWeight = '500';
    // Real: disabled prevents user interaction entirely — most browsers
    // also suppress hover/title tooltips on a genuinely disabled
    // control, which this models via pointer-events:none rather than
    // just a visual dimming, since that distinction is the actual thing
    // being evaluated here.
    this.style.cursor = disabled ? 'default' : 'pointer';
    this.style.pointerEvents = disabled ? 'none' : 'auto';
    this.style.opacity = disabled ? '0.5' : this._loading ? '0.7' : '1';
    if (appearance === 'accent' || appearance === 'filled') {
      this.style.background = color;
      this.style.color = '#fff';
      this.style.border = 'none';
    } else if (appearance === 'outlined') {
      this.style.background = 'transparent';
      this.style.color = color;
      this.style.border = `1px solid ${color}`;
    } else if (appearance === 'plain') {
      // Real: :host([appearance~="plain"]) .button { background-color: transparent }
      this.style.background = 'transparent';
      this.style.color = 'var(--primary-text-color)';
      this.style.border = 'none';
      // Not part of the real component itself — this shim has no real
      // shadow DOM/parts to apply an external ::part(base) rule against,
      // so this reproduces this session's own real, external CSS
      // override (shared-styles.ts) directly here instead, purely so a
      // screenshot reflects the intended final result. The actual
      // ::part(base) mechanism itself is confirmed only by reading the
      // real component's own source (it exposes part="base"), not
      // verified end-to-end through this harness.
      const variantOverrideColor = { success: 'var(--dockhand-status-ok-color)', warning: 'var(--dockhand-status-warn-color)', danger: 'var(--dockhand-status-error-color)' }[variant];
      if (variantOverrideColor) this.style.color = variantOverrideColor;
    } else {
      this.style.background = 'rgba(255,255,255,0.08)';
      this.style.color = color;
      this.style.border = 'none';
    }
  }
}

// A real (if read-only) render of ha-form's own schema/data model — the
// missing piece that made the editor harness not worth building until now:
// every editor's actual field content lives inside <ha-form>, not in the
// editor's own template directly, so without this the harness would only
// ever show empty space where every field should be. Deliberately
// non-interactive (no value-changed wiring, disabled inputs) since this
// only needs to *look* right for a screenshot, not actually be editable —
// matches this whole harness's own scope (real rendered output against
// fixed mock data, not a live/interactive preview). Covers exactly the
// selector/schema shapes this repo's own ha-form-types.ts declares
// (select, boolean, text, multi_select) — extend alongside that file if a
// new shape is ever added there, not preemptively.
class HaForm extends HTMLElement {
  set hass(h) {
    this._hass = h;
    this._render();
  }
  set data(d) {
    this._data = d;
    this._render();
  }
  set schema(s) {
    this._schema = s;
    this._render();
  }
  set computeLabel(fn) {
    this._computeLabel = fn;
    this._render();
  }
  set computeHelper(fn) {
    this._computeHelper = fn;
    this._render();
  }
  set warning(w) {
    this._warning = w;
    this._render();
  }
  connectedCallback() {
    this._render();
  }
  _render() {
    if (!this.isConnected || !this._schema) return;
    this.style.display = 'block';
    const label = (field) => (this._computeLabel ? this._computeLabel(field) : field.name);
    const helper = (field) => (this._computeHelper ? this._computeHelper(field) : '');
    const warning = (field) => this._warning?.[field.name];

    const renderField = (field) => {
      if (field.type === 'expandable') {
        const nestedData = field.flatten ? this._data : this._data?.[field.name];
        const rows = (field.schema || []).map((sub) => renderField({ ...sub, __data: nestedData })).join('');
        return `
          <div class="shim-expansion-panel">
            <div class="shim-expansion-header">
              ${field.icon ? `<ha-icon icon="${field.icon}"></ha-icon>` : ''}
              <span>${field.title || field.name}</span>
            </div>
            <div class="shim-expansion-content">${rows}</div>
          </div>
        `;
      }
      if (field.type === 'grid') {
        const nestedData = field.flatten !== false ? this._data : this._data?.[field.name];
        const cells = (field.schema || []).map((sub) => `<div class="shim-grid-cell">${renderField({ ...sub, __data: nestedData })}</div>`).join('');
        return `<div class="shim-grid">${cells}</div>`;
      }
      const dataSource = field.__data !== undefined ? field.__data : this._data;
      const value = dataSource?.[field.name];
      let widget;
      if (field.type === 'multi_select') {
        const opts = field.options || {};
        widget = `<div class="shim-multiselect">${Object.entries(opts)
          .map(([k, v]) => {
            const checked = Array.isArray(value) && value.includes(k);
            return `<label class="shim-checkbox-row"><input type="checkbox" ${checked ? 'checked' : ''} disabled><span>${v}</span></label>`;
          })
          .join('')}</div>`;
      } else if (field.selector?.boolean !== undefined) {
        const checked = value ?? field.default ?? false;
        widget = `<ha-switch ${checked ? 'checked' : ''}></ha-switch>`;
      } else if (field.selector?.text !== undefined) {
        widget = `<input class="shim-textfield" type="text" value="${value ?? ''}" placeholder="" disabled>`;
      } else if (field.selector?.select) {
        const opts = field.selector.select.options || [];
        widget = `<select class="shim-select" disabled>${opts.map((o) => `<option ${o.value === value ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
      } else if (field.selector?.entity_name !== undefined) {
        // Not a simulation of HA's real Composed/Custom picker (see
        // docs/EDITOR_DESIGN.md on why that's not attempted here) — just
        // enough to confirm the field renders and shows the right
        // default, using the same disabled-textfield look as a plain
        // text field so a placeholder doesn't look like a broken widget.
        const shown = value ?? field.selector.entity_name?.default_name;
        const display = typeof shown === 'string' ? shown : shown ? '(composed name)' : '';
        widget = `<input class="shim-textfield" type="text" value="${display}" placeholder="" disabled>`;
      } else {
        widget = '';
      }
      const helperText = helper(field);
      const warningText = warning(field);
      return `
        <div class="shim-form-row">
          <div class="shim-form-label-col">
            <div class="shim-form-label">${label(field)}${field.required ? ' *' : ''}</div>
            ${helperText ? `<div class="shim-form-helper">${helperText}</div>` : ''}
          </div>
          <div class="shim-form-widget-col">${widget}</div>
          ${warningText ? `<div class="shim-form-warning">⚠ ${warningText}</div>` : ''}
        </div>
      `;
    };

    this.innerHTML = this._schema.map(renderField).join('');
  }
}

class HaRelativeTime extends HTMLElement {
  set datetime(value) {
    this._datetime = value;
    queueMicrotask(() => this.render());
  }
  get datetime() {
    return this._datetime;
  }
  set hass(h) {
    this._hass = h;
  }
  connectedCallback() {
    queueMicrotask(() => this.render());
  }
  render() {
    if (!this.isConnected || !this._datetime) return;
    const diffMs = Date.now() - this._datetime.getTime();
    const mins = Math.round(diffMs / 60000);
    const hours = Math.round(diffMs / 3600000);
    const days = Math.round(diffMs / 86400000);
    let text;
    if (mins < 1) text = 'just now';
    else if (mins < 60) text = `${mins} minute${mins === 1 ? '' : 's'} ago`;
    else if (hours < 24) text = `${hours} hour${hours === 1 ? '' : 's'} ago`;
    else text = `${days} day${days === 1 ? '' : 's'} ago`;
    this.textContent = text;
  }
}

export function registerShims() {
  const defs = [
    ['ha-icon', HaIcon],
    ['ha-state-icon', HaStateIcon],
    ['ha-card', HaCard],
    ['ha-switch', HaSwitch],
    ['ha-formfield', HaFormfield],
    ['ha-expansion-panel', HaExpansionPanel],
    ['ha-select', HaSelect],
    ['ha-input', HaInput],
    ['ha-sortable', HaSortable],
    ['ha-relative-time', HaRelativeTime],
    ['ha-icon-button', HaIconButton],
    ['ha-button', HaButton],
    ['ha-form', HaForm]
  ];
  for (const [tag, cls] of defs) {
    if (!customElements.get(tag)) customElements.define(tag, cls);
  }
}
