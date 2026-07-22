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
    ['ha-relative-time', HaRelativeTime]
  ];
  for (const [tag, cls] of defs) {
    if (!customElements.get(tag)) customElements.define(tag, cls);
  }
}
