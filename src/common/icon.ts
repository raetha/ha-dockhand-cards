import { html, nothing, type TemplateResult } from 'lit';
import type { HassEntity } from 'home-assistant-js-websocket';
import type { HomeAssistant } from './ha-types';
import { SETTINGS_LINK_UNAVAILABLE_ICON } from './format';
import { t, type TranslationKey } from './i18n';

/**
 * The shared Enter/Space-activates-like-a-click keydown handler, used
 * both internally by renderIcon() below and by every card's own
 * remaining hand-rolled clickable element that doesn't fit renderIcon()'s
 * own icon+optional-text shape.
 */
export function onKeydownActivate(onClick: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    }
  };
}

type RenderIconBaseOpts = {
  /** Whatever class gives this icon its own size/layout — the caller's
   * job entirely, not this function's. `renderIcon()` only ever adds
   * `.clickable`/`.link-unavailable` and a color modifier on top of it;
   * it never hard-codes a specific size/layout class of its own, since
   * a shared icon-rendering helper shouldn't need editing every time a
   * new context wants to use it. Every current caller passes one of:
   * `.header-icon` (a card's own header, either side — 32×32 clickable
   * footprint, the icon itself left at HA's own native 24px default;
   * also the shape for Environment's own connection-type icon, merged
   * in from what was once a separate `.conn-icon`), `.row-icon` (16px
   * — the shape for a compact icon+optional-text badge, positioned by
   * whichever ancestor row/group it sits in, not by this class itself
   * — a `.row-icon` badge nested inside an outer `.row-right` wrapper,
   * grouping several such badges together on a row's own right side,
   * is an established, already-shipped pattern — see Environment
   * card's own "Top containers by CPU" section for the precedent this
   * follows), `.card-badge` (a card's own fixed 28×28 header icon,
   * always static), or `.stat` (a small icon+count summary badge,
   * always static, its own color usually set per-instance via `color`
   * rather than a shared modifier, since each one's own semantic
   * meaning — running/stopped/paused/etc. — is specific to that one
   * usage, not a status shared across contexts).
   * Icon sizing for the 16px tier comes from the shared `.row
   * ha-icon`/`.row ha-state-icon` rule (any icon inside a `.row`
   * inherits it already), not from `.row-icon` itself.
   */
  baseClass: string;
  icon?: string;
  hass?: HomeAssistant;
  stateObj?: HassEntity;
  colorClass?: 'ok' | 'warn' | 'error' | 'accent' | 'neutral';
  /** A raw CSS color for a case that doesn't map to one of the four
   * shared modifiers (Environment's own feature icons, each with their
   * own fixed, non-semantic color straight from Dockhand's own dashboard
   * design, not a status color). At most one of colorClass/color. */
  color?: string;
  title?: string;
  /** Trailing text after the icon, inside the same clickable element —
   * a row's own "84%" next to a CPU icon, a count next to an update
   * icon. Omit for an icon-only element (every header-icon usage, and
   * some row-icon ones). */
  text?: string;
};

/**
 * The single shape behind every small icon across every card — clickable
 * (an entity's more-info dialog, or an external URL) or genuinely static
 * (a card's own header badge, a decorative connection-type indicator).
 * See `baseClass`'s own doc above for how sizing/layout is supplied.
 *
 * Keyboard activation (Enter/Space triggering the same thing a click
 * does) is wired up automatically here, internally, from `onClick` alone
 * — every card used to independently hand-roll its own private
 * `_onKeydown()` method to wire this up manually per call site, which is
 * exactly the kind of duplication that let one real call site (the
 * Dockhand link) silently ship without it at all: keyboard-focusable
 * (`tabindex="0"`) but not keyboard-*activatable*, since nothing was
 * listening for Enter/Space there. There is no longer a way to add a
 * clickable icon without also making it keyboard-accessible, since the
 * two are no longer two separate things a caller could forget to pair.
 *
 * `onClick` is required unless `disabled: true` or `static: true` is
 * set explicitly — a discriminated union, not just an optional field,
 * deliberately: every real usage is genuinely clickable, a known,
 * deliberately-muted state (the Dockhand link when its own URL
 * couldn't resolve), or genuinely, permanently non-interactive by
 * design (a card's own header badge) — never an ambiguous "present but
 * nothing to do, no explanation" state. `disabled` and `static` are
 * meaningfully different, not two names for the same thing: `disabled`
 * is a real, known state worth explaining (gets `.link-unavailable`
 * styling and a `title` tooltip, and still intercepts its own click,
 * since it's a meaningful state a parent's own click shouldn't also
 * fire for) — `static` never had click behavior as a concept at all,
 * so it intercepts nothing, letting a click pass through untouched to
 * whatever it happens to sit inside.
 *
 * A third, different "present but nothing to do" state did exist once
 * (Stacks' own container-count badge, shown but not clickable when its
 * own dedicated entity wasn't available on an older ha-dockhand
 * release) but has since been removed — the fallback that produced it
 * was dropped once relying on that dedicated entity always being
 * present became a safe assumption. `static` is not a reintroduction
 * of that case: that one was a data-availability gap on an otherwise
 * genuinely-clickable icon; `static` is for icons that were never
 * clickable in the first place, by design, regardless of data.
 */
export function renderIcon(
  opts: RenderIconBaseOpts &
    ({ onClick: () => void; disabled?: false; static?: false } | { onClick?: undefined; disabled: true; static?: false } | { onClick?: undefined; disabled?: false; static: true })
): TemplateResult {
  const iconEl = opts.stateObj
    ? html`<ha-state-icon .hass=${opts.hass} .stateObj=${opts.stateObj}></ha-state-icon>`
    : html`<ha-icon icon=${opts.icon}></ha-icon>`;
  const classes = [opts.baseClass, opts.colorClass, opts.disabled ? 'link-unavailable' : opts.static ? '' : 'clickable'].filter(Boolean).join(' ');
  const style = opts.color ? `color:${opts.color}` : nothing;
  const content = opts.text ? html`${iconEl}${opts.text}` : iconEl;

  if (opts.static) {
    return html`<span class=${classes} style=${style} title=${opts.title ?? ''}>${content}</span>`;
  }
  if (opts.disabled) {
    return html`<span class=${classes} style=${style} title=${opts.title ?? ''} @click=${(e: Event) => e.stopPropagation()}>${content}</span>`;
  }
  const onClick = opts.onClick;
  return html`<span
    class=${classes}
    style=${style}
    tabindex="0"
    role="button"
    title=${opts.title ?? ''}
    @click=${(e: Event) => {
      e.stopPropagation();
      onClick();
    }}
    @keydown=${onKeydownActivate(onClick)}
  >
    ${content}
  </span>`;
}

/**
 * The "open in Dockhand" header icon specifically, shared by every card
 * that has one (environment, vulnerability, stack, container, containers,
 * stacks, schedules — all 7). Each card only supplies its own tooltip text
 * and target URL (built from getDockhandBaseUrl() plus that card's own
 * path suffix, e.g. `${base}/schedules`) — a specialized wrapper around
 * renderIcon() rather than folded into it directly, since URL resolution,
 * translated tooltip keys, and the "link couldn't resolve" unavailable
 * state are genuinely specific to this one icon, not something every
 * renderIcon() consumer needs (Environment's own feature toggles, for
 * example, have no "broken URL" concept at all — they just conditionally
 * don't render).
 */
export function renderSettingsLink(opts: {
  hass: HomeAssistant | undefined;
  show: boolean | undefined;
  /** Fully-built target URL (e.g. `${base}/schedules`), or null when no
   * valid Dockhand base URL could be resolved — the two states render
   * differently (a real link vs. a muted "unavailable" icon), see
   * format.ts's SETTINGS_LINK_UNAVAILABLE_ICON for why that distinction
   * matters rather than just hiding the icon either way. */
  href: string | null;
  tooltipKey: TranslationKey;
  icon?: string;
}): TemplateResult | typeof nothing {
  if (!opts.show) return nothing;
  if (opts.href) {
    const href = opts.href;
    return renderIcon({
      baseClass: 'header-icon',
      icon: opts.icon ?? 'mdi:open-in-new',
      title: t(opts.hass, opts.tooltipKey),
      onClick: () => window.open(href, '_blank', 'noopener,noreferrer')
    });
  }
  return renderIcon({
    baseClass: 'header-icon',
    icon: SETTINGS_LINK_UNAVAILABLE_ICON,
    title: t(opts.hass, 'settings_link_unavailable'),
    disabled: true
  });
}
