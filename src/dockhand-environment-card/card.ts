import { LitElement, html, svg, nothing, type TemplateResult } from 'lit';
import { state } from 'lit/decorators.js';
import { arc } from 'd3-shape';
import { fireEvent, type LovelaceCard, type LovelaceCardEditor } from 'custom-card-helpers';
import { computeDonutSegments, boundaryAngles } from '../common/donut-geometry';

import type { HomeAssistant, LovelaceGridOptions } from '../common/ha-types';
import { getEnvironmentDevices, getRepresentativeEntityId } from '../common/device-utils';
import { resolveCardName, migrateTitleToName } from '../common/card-name';
import {
  resolveEnvironmentEntities,
  type ResolutionResult,
  type TopContainerEntry
} from '../common/entity-resolver';
import { REQUIRED_KEYS_BY_MODE, OPTIONAL_STATUS_KEYS, type EnvTranslationKey } from '../common/const';
import { barColorClass, formatBytes, formatRelativeTime, getDockhandBaseUrl } from '../common/format';
import { renderSettingsLink, renderIcon, onKeydownActivate } from '../common/icon';
import { getLabelColors } from '../common/label-colors';
import { joinWithDividers, mergeSections } from '../common/section-join';
import { CUSTOM_SECTION_ORDER, DEFAULT_CUSTOM_SECTIONS, type CardMode, type CustomSection, type DockhandEnvironmentCardConfig } from './types';
import { cardStyles } from './styles';

const CONN_ICON: Record<string, { icon: string; color: string; title: string }> = {
  socket: { icon: 'mdi:power-plug', color: '#22d3ee', title: 'Unix socket connection' },
  direct: { icon: 'mdi:docker', color: '#3b82f6', title: 'Direct Docker connection' },
  'hawser-standard': { icon: 'mdi:transit-connection-variant', color: '#a855f7', title: 'Hawser agent (standard mode)' },
  'hawser-edge': { icon: 'mdi:undo-variant', color: '#22c55e', title: 'Hawser agent (edge mode)' }
};

// Mirrors Dockhand's own action -> icon mapping in dashboard-recent-events.svelte.
const EVENT_ICON: Record<string, string> = {
  create: 'mdi:plus',
  start: 'mdi:play',
  stop: 'mdi:stop',
  die: 'mdi:skull',
  kill: 'mdi:flash',
  restart: 'mdi:restart',
  pause: 'mdi:pause',
  unpause: 'mdi:play-circle',
  destroy: 'mdi:delete',
  rename: 'mdi:pencil',
  update: 'mdi:pencil',
  oom: 'mdi:alert',
  health_status: 'mdi:heart-pulse'
};

// Mirrors Dockhand's own getActionColor() exactly, including which
// actions group together. Keyed on the same bare-word action strings as
// EVENT_ICON — see eventLookupKey() below for how health_status (whose
// real stored value is a compound string, not a bare word) gets mapped
// to this table's 'health_status' key.
const EVENT_COLOR: Record<string, string> = {
  create: '#34d399',
  start: '#34d399',
  unpause: '#34d399',
  stop: '#fb7185',
  die: '#fb7185',
  kill: '#fb7185',
  destroy: '#fb7185',
  oom: '#fb7185',
  restart: '#fbbf24',
  pause: '#fbbf24',
  update: '#fbbf24',
  rename: '#fbbf24',
  health_status: '#38bdf8'
};
const EVENT_COLOR_DEFAULT = '#94a3b8';

/** Resolves an event's raw action string to the key EVENT_ICON/EVENT_COLOR
 * are keyed by. Every action except health_status is already a bare word
 * and matches directly. health_status is the one deliberate exception:
 * Dockhand's own stored value is a compound string like
 * "health_status: healthy" or "health_status: unhealthy" (verified in
 * Dockhand's subprocess-manager.ts), which doesn't match a plain
 * dictionary lookup on 'health_status' — including, apparently, in
 * Dockhand's own frontend, whose switch/case does a strict-equality
 * match and so never actually hits its 'health_status' case either. This
 * intentionally does NOT replicate that — health events colored the same
 * generic gray as an unrecognized action is a real loss (a container
 * going unhealthy should stand out), and matching a probable oversight
 * exactly has less value than matching Dockhand's evident intent. If
 * Dockhand fixes this upstream later, this still produces the same
 * result either way. */
export function eventLookupKey(action: string): string {
  return action.startsWith('health_status') ? 'health_status' : action;
}

interface RecentEvent {
  container_name?: string;
  action?: string;
  timestamp?: string;
}

interface HistoryPoint {
  value: number;
  /** Epoch milliseconds — stored as a number rather than a Date so the
   * @state()-tracked arrays stay simple, plain-data values. */
  timestampMs: number;
}

export class DockhandEnvironmentCard extends LitElement implements LovelaceCard {
  static styles = cardStyles;

  @state() private _config?: DockhandEnvironmentCardConfig;
  @state() private _hass?: HomeAssistant;
  @state() private _cpuHistory: HistoryPoint[] = [];
  @state() private _memHistory: HistoryPoint[] = [];
  @state() private _hoverPoint: { chart: 'cpu' | 'mem'; xFraction: number; point: HistoryPoint } | null = null;
  private _historyFetchedFor: string | null = null;
  private _historyEntityIds: [string | undefined, string | undefined] = [undefined, undefined];
  private _historyRefreshTimer: number | null = null;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  static getStubConfig(hass: HomeAssistant): Partial<DockhandEnvironmentCardConfig> {
    const devices = getEnvironmentDevices(hass);
    return {
      type: 'custom:dockhand-environment-card',
      device_id: devices[0]?.deviceId ?? '',
      mode: 'standard'
    };
  }

  static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor');
    return document.createElement('dockhand-environment-card-editor') as unknown as LovelaceCardEditor;
  }

  setConfig(config: DockhandEnvironmentCardConfig): void {
    this._config = { mode: 'standard', show_settings_link: true, ...(migrateTitleToName(config as Record<string, unknown>) as DockhandEnvironmentCardConfig) };
  }

  /** Alias so this element can be embedded declaratively (`.config=${cfg}`)
   * by another card, e.g. the overview card — lit-html property bindings
   * can only set properties, not call methods. */
  set config(config: DockhandEnvironmentCardConfig) {
    this.setConfig(config);
  }

  getCardSize(): number {
    switch (this._config?.mode) {
      case 'compact':
        return 2;
      case 'detailed':
        return 7;
      case 'full':
        return 10;
      default:
        return 4;
    }
  }

  /** Enables resizing in HA's "sections" dashboard view. Full mode is
   * widest by default since it uses a two-column internal layout above a
   * certain width (see styles.ts) — matching Dockhand's own wider card for
   * that view — the others default to half-width, tile-card-like. */
  getGridOptions(): LovelaceGridOptions {
    switch (this._config?.mode) {
      case 'compact':
        return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 2 };
      case 'detailed':
        return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 5 };
      case 'full':
        return { columns: 12, rows: 'auto', min_columns: 8, min_rows: 6 };
      default:
        return { columns: 12, rows: 'auto', min_columns: 6, min_rows: 3 };
    }
  }

  protected updated(): void {
    if (!this._hass || !this._config) return;
    const needsHistory =
      this._config.mode === 'full' ||
      (this._config.mode === 'custom' && (this._config.custom_sections ?? DEFAULT_CUSTOM_SECTIONS).includes('history_chart'));
    if (!needsHistory) return;
    const resolution = resolveEnvironmentEntities(this._hass, this._config.device_id, ['cpuUsage', 'memoryUsage']);
    const cpuId = resolution.found.cpuUsage?.entityId;
    const memId = resolution.found.memoryUsage?.entityId;
    if (!cpuId && !memId) return;

    this._historyEntityIds = [cpuId, memId];
    const key = `${cpuId ?? ''}|${memId ?? ''}`;
    if (this._historyFetchedFor === key) return;
    this._historyFetchedFor = key;
    this._fetchHistory(cpuId, memId);

    // Dockhand's own chart is a short (15-minute), continuously-refreshed
    // live window (see _fetchHistory), not a long historical trend view —
    // a one-time fetch would go stale within minutes and start showing a
    // window that's no longer actually "the last 15 minutes". Refresh on
    // a timer to keep it current, same idea as Dockhand's own streaming
    // endpoint. Set up once (guarded by the flag), not recreated on every
    // render — updated() runs after every render, and this needs to
    // survive across many of those.
    if (!this._historyRefreshTimer) {
      this._historyRefreshTimer = window.setInterval(() => {
        const [c, m] = this._historyEntityIds;
        if (c || m) this._fetchHistory(c, m);
      }, 60000);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._historyRefreshTimer) {
      window.clearInterval(this._historyRefreshTimer);
      this._historyRefreshTimer = null;
    }
  }

  /** Fetches the last 15 minutes of recorder history for the CPU/memory
   * sensors, for the full-mode sparklines — matches Dockhand's own window
   * exactly, traced from `METRICS_HISTORY_WINDOW_MS` in its
   * `stats/stream/+server.ts` (explicitly commented there as "Target time
   * window for metrics history charts (15 minutes)"), not assumed. This is
   * Dockhand's own live, continuously-refreshed window, not a long
   * historical trend view, hence the short duration and the periodic
   * refresh in updated() — a 15-minute window fetched once would look
   * stale within a few minutes rather than genuinely "the last 15
   * minutes". Best-effort: a failed fetch (recorder not configured, entity
   * has no history yet, etc.) just leaves the sparkline section out — see
   * _renderHistoryCharts — rather than erroring the whole card. */
  private async _fetchHistory(cpuId: string | undefined, memId: string | undefined): Promise<void> {
    if (!this._hass) return;
    const ids = [cpuId, memId].filter((id): id is string => Boolean(id));
    if (ids.length === 0) return;

    try {
      const start = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const result = await this._hass.callApi<Array<Array<{ state: string; last_changed?: string }>>>(
        'GET',
        `history/period/${start}?filter_entity_id=${ids.join(',')}&minimal_response&no_attributes`
      );
      const toPoints = (series: Array<{ state: string; last_changed?: string }> | undefined): HistoryPoint[] =>
        (series ?? [])
          .map((p) => ({
            value: Number(p.state),
            timestampMs: p.last_changed ? new Date(p.last_changed).getTime() : NaN
          }))
          .filter((p): p is HistoryPoint => Number.isFinite(p.value) && Number.isFinite(p.timestampMs));

      if (ids.length === 2) {
        this._cpuHistory = toPoints(result[0]);
        this._memHistory = toPoints(result[1]);
      } else if (cpuId) {
        this._cpuHistory = toPoints(result[0]);
        this._memHistory = [];
      } else {
        this._memHistory = toPoints(result[0]);
        this._cpuHistory = [];
      }
    } catch {
      // No recorder history yet, or the history API isn't available in
      // this HA setup — leave whatever we already had (likely empty),
      // the sparkline section just won't render. Not a card error.
    }
  }

  /** Filled area chart, matching Dockhand's own layerchart Area component
   * visually (a stroked line with a semi-transparent fill down to the
   * baseline) rather than a bare line — same data, closer look. */
  /** Filled area chart with a hover tooltip (date/time + value) — a
   * deliberate addition beyond what Dockhand's own chart does, since
   * hover tooltips are pretty standard for this kind of chart elsewhere
   * and a nice upgrade to have. Finds the nearest data point by mouse
   * x-fraction across the rendered SVG width (works regardless of the
   * SVG's own internal viewBox scale, since offsetX/clientWidth is a
   * fraction of the rendered box either way). */
  private _sparkline(chart: 'cpu' | 'mem', points: HistoryPoint[], color: string): TemplateResult | typeof nothing {
    if (points.length < 2) return nothing;
    const w = 280;
    const h = 36;
    const max = 100; // these are always 0-100% sensors
    const stepX = w / (points.length - 1);
    const coords = points.map((p, i) => [i * stepX, h - (Math.min(p.value, max) / max) * h] as const);
    const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `0,${h} ${line} ${w},${h}`;

    const onMove = (e: MouseEvent) => {
      const target = e.currentTarget as SVGSVGElement;
      const rect = target.getBoundingClientRect();
      const xFraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const index = Math.round(xFraction * (points.length - 1));
      this._hoverPoint = { chart, xFraction: index / (points.length - 1), point: points[index] };
    };
    const onLeave = () => {
      if (this._hoverPoint?.chart === chart) this._hoverPoint = null;
    };

    const hoverX = this._hoverPoint?.chart === chart ? this._hoverPoint.xFraction * w : null;

    return html`
      <div class="sparkline-wrap">
        <svg viewBox="0 0 ${w} ${h}" class="sparkline" preserveAspectRatio="none" @mousemove=${onMove} @mouseleave=${onLeave}>
          <polygon points=${area} fill=${color} opacity="0.3" />
          <polyline points=${line} fill="none" stroke=${color} stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          ${hoverX !== null
            ? html`<line x1=${hoverX} y1="0" x2=${hoverX} y2=${h} stroke=${color} stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />`
            : nothing}
        </svg>
        ${this._hoverPoint?.chart === chart ? this._renderTooltip(this._hoverPoint.point, this._hoverPoint.xFraction, color) : nothing}
      </div>
    `;
  }

  private _renderTooltip(point: HistoryPoint, xFraction: number, color: string): TemplateResult {
    const date = new Date(point.timestampMs);
    const timeLabel = date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    // Flip to the left side of the cursor past the midpoint so the
    // tooltip doesn't run off the edge of the card for points near the
    // right end of the chart.
    const side = xFraction > 0.5 ? 'right' : 'left';
    return html`
      <div class="chart-tooltip ${side}" style="left:${(xFraction * 100).toFixed(2)}%">
        <div class="chart-tooltip-time">${timeLabel}</div>
        <div class="chart-tooltip-value"><span class="chart-tooltip-dot" style="background:${color}"></span>${point.value.toFixed(1)}%</div>
      </div>
    `;
  }

  /** Matches Dockhand's dashboard-cpu-memory-charts.svelte: "CPU & Memory
   * history" header with a CPU icon, each metric as a label-left/
   * value-right row above its chart, CPU in emerald, Memory in blue
   * (Dockhand's own fixed colors for this specific chart, not the
   * severity-based bar colors used elsewhere), Memory's value also
   * showing the formatted byte figure alongside the percentage. */
  private _renderHistoryCharts(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult | typeof nothing {
    const hasCpu = this._cpuHistory.length >= 2;
    const hasMem = this._memHistory.length >= 2;
    if (!hasCpu && !hasMem) return nothing;

    // Header values deliberately read the live sensor state (same source
    // the CPU/Memory bars elsewhere on this card use), not the history
    // fetch's own last data point — the history fetch only refreshes
    // every 60s and carries the recorder's own write latency on top of
    // that, so using it for a "current value" label could show a
    // noticeably different number than the bars for the same metric at
    // the same moment. The sparkline's shape still correctly comes from
    // the history data below — that's a trend line, where a little lag
    // is expected and fine; a current-value label is not.
    const cpuNow = s.cpuUsage ? Number(s.cpuUsage.state.state) : undefined;
    const memNow = s.memoryUsage ? Number(s.memoryUsage.state.state) : undefined;
    const memBytes = s.memoryUsage?.state.attributes.memory_used_bytes;

    return html`
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:cpu-64-bit"></ha-icon> CPU &amp; Memory history</div>
        ${hasCpu && cpuNow !== undefined
          ? html`
              <div class="stacked-pair">
                <div class="row">
                  <span>CPU</span>
                  <span class="chart-value">${cpuNow.toFixed(1)}%</span>
                </div>
                ${this._sparkline('cpu', this._cpuHistory, '#10b981')}
              </div>
            `
          : nothing}
        ${hasMem && memNow !== undefined
          ? html`
              <div class="stacked-pair">
                <div class="row">
                  <span>Memory</span>
                  <span class="chart-value"
                    >${memNow.toFixed(1)}%${typeof memBytes === 'number' ? ` (${formatBytes(memBytes)})` : ''}</span
                  >
                </div>
                ${this._sparkline('mem', this._memHistory, '#3b82f6')}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderDiskUsage(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult | typeof nothing {
    if (!s.diskUsage) return nothing;
    const a = s.diskUsage.state.attributes;
    // Colors and order match Dockhand's own dashboard-disk-usage.svelte exactly.
    const items: { label: string; bytes: number; color: string }[] = [
      { label: 'Images', bytes: Number(a.images_size_bytes) || 0, color: '#0ea5e9' },
      { label: 'Containers', bytes: Number(a.containers_size_bytes) || 0, color: '#10b981' },
      { label: 'Volumes', bytes: Number(a.volumes_size_bytes) || 0, color: '#f59e0b' },
      { label: 'Build cache', bytes: Number(a.build_cache_size_bytes) || 0, color: '#8b5cf6' }
    ].filter((i) => i.bytes > 0);
    if (items.length === 0) return nothing;

    const total = items.reduce((sum, i) => sum + i.bytes, 0);
    const id = s.diskUsage.entityId;

    // Donut chart via d3-shape's own arc generator (innerRadius,
    // outerRadius, cornerRadius) rather than a hand-rolled path — after
    // three real bugs in a row in this repo's own hand-derived version,
    // this delegates the genuinely hard part (a corner rounded
    // correctly across two different radii, which needs different
    // treatment at each one, not the same radius applied identically)
    // to a battle-tested implementation instead of re-deriving it a
    // fourth time. innerRadius 0.5 (50% hole) matches Dockhand's own
    // dashboard-disk-usage.svelte (confirmed directly from their
    // source, which itself uses the layerchart library's own Pie/Arc
    // components — layerchart's own Arc is a thin wrapper over
    // d3-shape's, the same library used here).
    //
    // No padAngle here — d3's own padAngle is angular, the same
    // wedge-shaped-gap limitation Dockhand's own version has (confirmed
    // from their source: narrower at the ring's own inner edge, wider
    // at the outer, since the same angle sweeps a shorter physical
    // distance closer to the center). The gap is a separate, later
    // step: a thin "eraser" line at each boundary's own angle, in the
    // card's own background color, at a genuinely constant pixel width
    // regardless of radius — much lower-risk geometry (a straight line,
    // not a curve) than continuing to bake a constant-pixel gap into
    // the wedge shape itself.
    const SIZE = 64;
    const CENTER = SIZE / 2;
    const OUTER_R = CENTER - 1; // 1px margin so the arc's own edge doesn't clip against the viewBox
    const INNER_R = OUTER_R * 0.5;
    const CORNER_R = 3; // Dockhand's own is 2px; a little more here per direct request
    const GAP_PX = 2;

    const donutItems = items.map((item) => ({ color: item.color, bytes: item.bytes }));
    const segments = computeDonutSegments(donutItems);
    const boundaries = boundaryAngles(segments);

    const arcGenerator = arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(INNER_R)
      .outerRadius(OUTER_R)
      .cornerRadius(CORNER_R);

    // Same 12-o'clock-clockwise convention as every other angular chart
    // in this repo (the CPU/memory history sparklines) — d3-shape's own
    // arc generator already defaults to this exact convention (angle 0
    // at 12 o'clock, positive angles clockwise), so no conversion is
    // needed between this repo's own angle math and d3's.
    function spokePoints(angle: number): { x1: number; y1: number; x2: number; y2: number } {
      // Extends slightly past both the inner and outer radius so the
      // spoke fully covers through a rounded corner's own curve at
      // each end, not just the straight run between the two radii.
      const margin = CORNER_R + 1;
      const r1 = Math.max(0, INNER_R - margin);
      const r2 = OUTER_R + margin;
      return {
        x1: CENTER + r1 * Math.sin(angle),
        y1: CENTER - r1 * Math.cos(angle),
        x2: CENTER + r2 * Math.sin(angle),
        y2: CENTER - r2 * Math.cos(angle)
      };
    }

    return html`
      <div
        class="section clickable"
        tabindex="0"
        role="button"
        @click=${() => this._moreInfo(id)}
        @keydown=${onKeydownActivate(() => this._moreInfo(id))}
      >
        <div class="section-title">
          <ha-icon icon="mdi:harddisk"></ha-icon>
          <span>Disk usage</span>
          <span class="section-title-value">${formatBytes(total)}</span>
        </div>
        <div class="row-left disk-chart-row">
          <svg class="disk-donut" viewBox="0 0 ${SIZE} ${SIZE}">
            <g transform="translate(${CENTER}, ${CENTER})">
              ${segments.map((seg) => svg`<path d=${arcGenerator(seg) ?? ''} fill=${seg.color}></path>`)}
            </g>
            ${boundaries.map((angle) => {
              const { x1, y1, x2, y2 } = spokePoints(angle);
              return svg`<line
                x1=${x1}
                y1=${y1}
                x2=${x2}
                y2=${y2}
                stroke="var(--card-background-color, #1c1c1c)"
                stroke-width=${GAP_PX}
                stroke-linecap="round"
              ></line>`;
            })}
          </svg>
          <div class="disk-legend">
            ${items.map(
              (item) => html`
                <div class="row">
                  <span class="row-left">
                    <span class="disk-dot" style="background:${item.color}"></span>
                    <span class="item-name">${item.label}</span>
                  </span>
                  <span class="row-right">${formatBytes(item.bytes)}</span>
                </div>
              `
            )}
          </div>
        </div>
      </div>
    `;
  }

  private _renderFullLayout(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult {
    return html`
      <div class="full-container">
        <div class="full-layout">
          <div class="full-left">${joinWithDividers([...this._renderStandardBody(s), ...this._renderDetailedExtras(s)])}</div>
          <div class="full-right">${joinWithDividers([this._renderHistoryCharts(s), this._renderDiskUsage(s)])}</div>
        </div>
      </div>
    `;
  }

  private _moreInfo(entityId: string | null | undefined): void {
    if (!entityId) return;
    fireEvent(this, 'hass-more-info', { entityId });
  }

  protected render(): TemplateResult {
    if (!this._config || !this._hass) return html``;

    if (!this._config.device_id) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Please select a Dockhand environment — edit this card to pick one.</span>
        </div>
      </ha-card>`;
    }

    const device = this._hass.devices?.[this._config.device_id];
    if (!device) {
      return html`<ha-card>
        <div class="card-message error">
          <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
          <span>Environment device not found. It may have been removed — edit this card to pick another.</span>
        </div>
      </ha-card>`;
    }

    const mode: CardMode = this._config.mode ?? 'standard';
    const requiredKeys = REQUIRED_KEYS_BY_MODE[mode] ?? REQUIRED_KEYS_BY_MODE.standard;
    const allKeys = [...new Set([...requiredKeys, ...OPTIONAL_STATUS_KEYS])];
    const resolution = resolveEnvironmentEntities(this._hass, this._config.device_id, allKeys);
    const s = resolution.found;

    const representativeEntityId = getRepresentativeEntityId(this._hass, this._config.device_id);
    const name = resolveCardName(this._hass, representativeEntityId, this._config.name, device.name_by_user || device.name || 'Environment');
    const online = s.online?.state.state === 'on';
    const isUnavailableCore = !s.online;
    const labels: string[] = Array.isArray(s.online?.state.attributes.labels) ? s.online!.state.attributes.labels : [];

    return html`
      <ha-card>
        <div class="body">
          ${this._renderHeader(name, device, s)}
          ${labels.length > 0
            ? html`<div class="label-row">
                ${labels.map((l) => {
                  const { color, bgColor } = getLabelColors(l);
                  return html`<span class="label-pill" style="color: ${color}; background: ${bgColor};">${l}</span>`;
                })}
              </div>`
            : nothing}
          <div class="divider"></div>
          ${isUnavailableCore
            ? html`<div class="card-message error">
                <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
                <span>
                  No Dockhand entities found for this environment yet. If you just added the
                  integration, wait for the first refresh; otherwise check that this device still
                  belongs to ha-dockhand.
                </span>
              </div>`
            : !online
              ? this._renderOffline()
              : mode === 'compact'
                ? this._renderCompactBody(s)
                : mode === 'full'
                  ? this._renderFullLayout(s)
                  : mode === 'custom'
                    ? this._renderCustomBody(s)
                    : joinWithDividers([...this._renderStandardBody(s), ...(mode === 'detailed' ? this._renderDetailedExtras(s) : [])])}
        </div>
      </ha-card>
    `;
  }

  private _renderHeader(
    name: string,
    device: { id: string; configuration_url: string | null; hw_version: string | null },
    s: ResolutionResult<EnvTranslationKey>['found']
  ): TemplateResult {
    // Only used to validate that configuration_url actually parses
    // (getDockhandBaseUrl catches an invalid URL and returns null, same
    // defense-in-depth every other card already has) — the click target
    // below is still the full device.configuration_url, not this value,
    // since base is deliberately just the origin and this URL already
    // has ha-dockhand's own deep-link path/query baked in (edit this
    // specific environment's settings, not a generic page). Using base
    // itself as the click target would silently strip that path.
    const base = getDockhandBaseUrl(device.configuration_url);
    // Prefer the real connection_type entity (ha-dockhand 1.8.0+) so the
    // icon follows the entity's own icon (including any user override) and
    // stays in sync with ha-dockhand's own corrected iconography. Falls
    // back to the hardcoded table keyed off the device's hw_version only
    // when running against an older ha-dockhand release that predates the
    // entity — never both at once.
    const connEntity = s.connectionType;
    const connFallback = !connEntity && device.hw_version ? CONN_ICON[device.hw_version] : undefined;
    const onlineId = s.online?.entityId;

    return html`
      <div class="card-header">
        <div class="header-left">
          <!-- Dockhand's own tile shows the user's per-environment custom
           * icon here (EnvironmentIcon component — Lucide icon name or a
           * custom upload, user-configurable per environment in Dockhand).
           * There's no clean mapping from arbitrary Lucide icon names to
           * MDI (different icon sets, no shared naming convention), and
           * ha-dockhand doesn't currently expose the icon choice as
           * attribute data anyway — documented as a real, deliberately
           * deferred gap in docs/BACKLOG.md, not an oversight. This is a
           * fixed generic icon, not an attempt at the per-environment one —
           * mdi:web specifically because that's Dockhand's own actual
           * default (icon: data.icon || 'globe' when an environment is
           * created without picking one, which resolves to Lucide's Globe
           * icon — verified in Dockhand's source, not assumed), so a user
           * who never customized their environment's icon sees the same
           * shape here as they would in Dockhand itself. -->
          ${renderIcon({ baseClass: 'card-badge', icon: 'mdi:web', static: true })}
          ${connEntity
            ? renderIcon({
                baseClass: 'header-icon',
                hass: this._hass,
                stateObj: connEntity.state,
                color: CONN_ICON[connEntity.state.state]?.color ?? 'inherit',
                title: connEntity.state.attributes.friendly_name ?? '',
                onClick: () => this._moreInfo(connEntity.entityId)
              })
            : connFallback
              ? renderIcon({
                  baseClass: 'header-icon',
                  icon: connFallback.icon,
                  color: connFallback.color,
                  title: connFallback.title,
                  static: true
                })
              : nothing}
          <div class="stacked-pair">
            <span
              class="truncate ${onlineId ? 'clickable' : ''}"
              tabindex=${onlineId ? 0 : -1}
              role=${onlineId ? 'button' : nothing}
              @click=${() => this._moreInfo(onlineId)}
              @keydown=${onKeydownActivate(() => this._moreInfo(onlineId))}
              >${name}</span
            >
            ${s.online?.state.attributes.connection_host
              ? html`<span class="card-subheader truncate"
                  >${s.online.state.attributes.connection_host}${s.online.state.attributes.connection_port
                    ? `:${s.online.state.attributes.connection_port}`
                    : ''}</span
                >`
              : nothing}
          </div>
        </div>
        <div class="header-right">
          ${s.autoUpdate?.state.state === 'on'
            ? this._statusIcon(s.autoUpdate, 'var(--dockhand-status-ok-color)')
            : s.updateChecks?.state.state === 'on'
              ? this._statusIcon(s.updateChecks, 'var(--dockhand-status-ok-color)')
              : nothing}
          ${this._statusIcon(s.vulnerabilityScanning, 'var(--dockhand-status-ok-color)')}
          ${this._statusIcon(s.activityLogging, 'var(--dockhand-status-warn-color)')}
          ${this._statusIcon(s.metricsCollection, 'var(--dockhand-status-info-color)')}
          ${renderSettingsLink({
            hass: this._hass,
            show: this._config?.show_settings_link,
            href: base ? device.configuration_url : null,
            tooltipKey: 'settings_link_edit_environment',
            icon: 'mdi:cog'
          })}
        </div>
      </div>
    `;
  }

  /** Renders a header status icon bound to the real entity (so it reflects
   * any icon override the user set on that entity), or nothing if that
   * entity isn't on. Color is fixed per status type, matching Dockhand's
   * own dashboard-header.svelte exactly (these colors don't vary by
   * state — presence/absence of the icon is the status signal, same as
   * Dockhand's `{#if}` gating). Only the "is this feature on" gate stays
   * here — genuinely specific to Environment's own feature-toggle
   * entities, not something every renderIcon() consumer needs. */
  private _statusIcon(
    entry: ResolutionResult<EnvTranslationKey>['found'][EnvTranslationKey],
    colorVar: string
  ): TemplateResult | typeof nothing {
    if (!entry || entry.state.state !== 'on') return nothing;
    return renderIcon({
      baseClass: 'header-icon',
      hass: this._hass,
      stateObj: entry.state,
      color: colorVar,
      title: entry.state.attributes.friendly_name ?? '',
      onClick: () => this._moreInfo(entry.entityId)
    });
  }

  private _renderOffline(): TemplateResult {
    return html`
      <div class="card-message">
        <ha-icon icon="mdi:wifi-off"></ha-icon>
        <span>Environment offline</span>
      </div>
    `;
  }

  private _renderCompactBody(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult | typeof nothing {
    return this._renderContainerSection(s);
  }

  private _renderStandardBody(s: ResolutionResult<EnvTranslationKey>['found']): (TemplateResult | typeof nothing)[] {
    return [this._renderContainerSection(s), mergeSections(this._renderMetricsSection(s), this._renderResourceGrid(s)), this._renderEventsRow(s)];
  }

  private _renderContainerSection(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult | typeof nothing {
    if (!s.containers) return nothing;
    const c = s.containers.state.attributes;
    const total = s.containers.state.state ?? '—';
    const unhealthy = Number(c.unhealthy ?? 0);
    const restarting = Number(c.restarting ?? 0);
    const id = s.containers.entityId;

    const healthClass = unhealthy > 0 ? 'warn' : restarting > 0 ? 'error' : 'ok';
    const healthIcon = unhealthy > 0 ? 'mdi:alert' : restarting > 0 ? 'mdi:refresh' : 'mdi:check-circle';
    const healthText =
      unhealthy > 0
        ? `${unhealthy} container${unhealthy === 1 ? '' : 's'} unhealthy`
        : restarting > 0
          ? `${restarting} container${restarting === 1 ? '' : 's'} restarting`
          : 'All containers healthy';

    return html`
      <div
        class="row stats-row clickable"
        tabindex="0"
        role="button"
        @click=${() => this._moreInfo(id)}
        @keydown=${onKeydownActivate(() => this._moreInfo(id))}
      >
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:play', color: 'var(--dockhand-status-ok-color)', text: `${c.running ?? 0}`, title: 'Running', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:stop', color: 'var(--secondary-text-color)', text: `${c.stopped ?? 0}`, title: 'Stopped', static: true })}
        ${renderIcon({ baseClass: 'stat', icon: 'mdi:pause', color: 'var(--dockhand-status-warn-color)', text: `${c.paused ?? 0}`, title: 'Paused', static: true })}
        ${renderIcon({
          baseClass: 'stat',
          icon: 'mdi:refresh',
          color: restarting > 0 ? 'var(--dockhand-status-error-color)' : 'var(--dockhand-status-ok-color)',
          text: `${restarting}`,
          title: 'Restarting',
          static: true
        })}
        ${renderIcon({
          baseClass: 'stat',
          icon: 'mdi:alert',
          color: unhealthy > 0 ? 'var(--dockhand-status-error-color)' : 'var(--dockhand-status-ok-color)',
          text: `${unhealthy}`,
          title: 'Unhealthy',
          static: true
        })}
        ${renderIcon({
          baseClass: 'stat',
          icon: 'mdi:arrow-up-circle',
          color: (c.pending_updates ?? 0) > 0 ? 'var(--dockhand-status-warn-color)' : 'var(--secondary-text-color)',
          text: `${c.pending_updates ?? 0}`,
          title: 'Pending updates',
          static: true
        })}
        <span class="stat">Total ${total}</span>
      </div>

      <div
        class="status-banner ${healthClass} clickable"
        tabindex="0"
        role="button"
        @click=${() => this._moreInfo(id)}
        @keydown=${onKeydownActivate(() => this._moreInfo(id))}
      >
        <ha-icon icon=${healthIcon}></ha-icon>
        <span>${healthText}</span>
      </div>
    `;
  }

  private _renderMetricsSection(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult | typeof nothing {
    if (!s.cpuUsage && !s.memoryUsage) return nothing;
    const cpu = s.cpuUsage ? Number(s.cpuUsage.state.state) : undefined;
    const mem = s.memoryUsage ? Number(s.memoryUsage.state.state) : undefined;
    if (cpu === undefined && mem === undefined) return nothing;
    const memUsed = s.memoryUsage?.state.attributes.memory_used_bytes;
    const cpuId = s.cpuUsage?.entityId;
    const memId = s.memoryUsage?.entityId;

    return html`
      <div class="section">
        ${cpu !== undefined
          ? html`
              <div
                class="stacked-pair clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(cpuId)}
                @keydown=${onKeydownActivate(() => this._moreInfo(cpuId))}
              >
                <div class="row">
                  ${renderIcon({ baseClass: 'row-icon', hass: this._hass, stateObj: s.cpuUsage!.state, text: 'CPU', static: true })}
                  <span class="row-right">${cpu.toFixed(1)}%</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill ${barColorClass(cpu)}" style="width:${Math.min(cpu, 100)}%"></div>
                </div>
              </div>
            `
          : nothing}
        ${mem !== undefined
          ? html`
              <div
                class="stacked-pair clickable"
                tabindex="0"
                role="button"
                @click=${() => this._moreInfo(memId)}
                @keydown=${onKeydownActivate(() => this._moreInfo(memId))}
              >
                <div class="row">
                  ${renderIcon({ baseClass: 'row-icon', hass: this._hass, stateObj: s.memoryUsage!.state, text: 'Memory', static: true })}
                  <span class="row-right">${mem.toFixed(1)}% (${formatBytes(memUsed)})</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill ${barColorClass(mem)}" style="width:${Math.min(mem, 100)}%"></div>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _renderResourceGrid(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult | typeof nothing {
    const items: { label: string; entry: ResolutionResult<EnvTranslationKey>['found'][EnvTranslationKey] }[] = [
      { label: 'Images', entry: s.imageCount },
      { label: 'Stacks', entry: s.stacks },
      { label: 'Volumes', entry: s.volumeCount },
      { label: 'Networks', entry: s.networkCount }
    ];
    const available = items.filter((i) => i.entry);
    if (available.length === 0) return nothing;

    return html`
      <div class="grid-2">
        ${available.map((item) => {
          const entry = item.entry!;
          const isStacks = item.label === 'Stacks';
          const stackAttrs = isStacks ? entry.state.attributes : undefined;
          return html`
            <div
              class="row clickable"
              tabindex="0"
              role="button"
              @click=${() => this._moreInfo(entry.entityId)}
              @keydown=${onKeydownActivate(() => this._moreInfo(entry.entityId))}
            >
              ${renderIcon({ baseClass: 'row-icon', hass: this._hass, stateObj: entry.state, text: item.label, static: true })}
              <span class="row-right breakdown">
                ${entry.state.state}
                ${isStacks && Number(entry.state.state) > 0
                  ? html`
                      <span class="running">${stackAttrs?.running ?? 0}</span>/<span class="partial">${stackAttrs?.partial ?? 0}</span>/<span
                        class="stopped"
                        >${stackAttrs?.stopped ?? 0}</span
                      >
                    `
                  : nothing}
              </span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderEventsRow(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult | typeof nothing {
    if (!s.activityEvents) return nothing;
    const eventsTotal = Number(s.activityEvents.state.state);
    if (!Number.isFinite(eventsTotal) || eventsTotal <= 0) return nothing;
    const eventsToday = s.activityEvents.state.attributes.today ?? 0;
    const id = s.activityEvents.entityId;

    return html`
      <div
        class="row clickable"
        tabindex="0"
        role="button"
        @click=${() => this._moreInfo(id)}
        @keydown=${onKeydownActivate(() => this._moreInfo(id))}
      >
        ${renderIcon({ baseClass: 'row-icon', hass: this._hass, stateObj: s.activityEvents.state, text: 'Events', static: true })}
        <span class="row-right">${eventsToday} today <span>/ ${eventsTotal} total</span></span>
      </div>
    `;
  }

  /** Detailed-mode-only sections. Each is entirely omitted, not shown as an
   * empty block, when its data isn't available. Top containers prefers the
   * `top_containers` attribute on sensor.cpu_usage (added to ha-dockhand
   * alongside this — no extra API call, computed from data already fetched
   * every poll) over the older per-container-entity computation, which
   * needed the opt-in CPU/memory sensors enabled per container to work at
   * all; the attribute-based path works regardless. recent_events needs a
   * recent-enough ha-dockhand release, so an empty result there is a
   * normal, expected case rather than an error. */
  private _renderDetailedExtras(s: ResolutionResult<EnvTranslationKey>['found']): (TemplateResult | typeof nothing)[] {
    const topContainers = this._resolveTopContainers(s);
    const activityEntry = this._config
      ? resolveEnvironmentEntities(this._hass!, this._config.device_id, ['activityEvents']).found.activityEvents
      : undefined;
    const recentEvents: RecentEvent[] = Array.isArray(activityEntry?.state.attributes.recent_events)
      ? activityEntry!.state.attributes.recent_events
      : [];

    return [this._renderRecentEvents(recentEvents, activityEntry?.entityId), this._renderTopContainers(topContainers)];
  }

  /** "Custom" mode — same building-block render methods every preset mode
   * composes, just picked individually via custom_sections instead of a
   * fixed combination. Render order is always CUSTOM_SECTION_ORDER,
   * regardless of the order sections were toggled on in — custom mode
   * offers which sections show, not reordering them; the Overview card's
   * section_order is a separate, unrelated ordering concept (columns
   * within a dashboard, not sections within one environment card). */
  private _renderCustomBody(s: ResolutionResult<EnvTranslationKey>['found']): TemplateResult {
    const selected = new Set(this._config?.custom_sections ?? DEFAULT_CUSTOM_SECTIONS);
    if (selected.size === 0) {
      return html`<div class="card-message warn">
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
        <span>No sections selected — edit this card to choose what to show.</span>
      </div>`;
    }

    const needsEvents = selected.has('recent_events');
    const needsTopContainers = selected.has('top_containers');

    let recentEvents: RecentEvent[] = [];
    let recentEventsEntityId: string | undefined;
    if (needsEvents) {
      const activityEntry = this._config
        ? resolveEnvironmentEntities(this._hass!, this._config.device_id, ['activityEvents']).found.activityEvents
        : undefined;
      recentEvents = Array.isArray(activityEntry?.state.attributes.recent_events) ? activityEntry!.state.attributes.recent_events : [];
      recentEventsEntityId = activityEntry?.entityId;
    }
    const topContainers = needsTopContainers ? this._resolveTopContainers(s) : [];

    const sectionRenderers: Record<CustomSection, () => TemplateResult | typeof nothing> = {
      container_counts: () => this._renderContainerSection(s),
      metrics: () => this._renderMetricsSection(s),
      resources: () => this._renderResourceGrid(s),
      events_summary: () => this._renderEventsRow(s),
      recent_events: () => this._renderRecentEvents(recentEvents, recentEventsEntityId),
      top_containers: () => this._renderTopContainers(topContainers),
      disk_usage: () => this._renderDiskUsage(s),
      history_chart: () => this._renderHistoryCharts(s)
    };

    return joinWithDividers(CUSTOM_SECTION_ORDER.filter((section) => selected.has(section)).map((section) => sectionRenderers[section]()));
  }

  private _resolveTopContainers(s: ResolutionResult<EnvTranslationKey>['found']): TopContainerEntry[] {
    const fromAttribute = s.cpuUsage?.state.attributes.top_containers;
    if (!Array.isArray(fromAttribute)) return [];
    return fromAttribute.map((c: { name?: string; cpu_percent?: number | null; memory_percent?: number | null }) => ({
      name: c.name ?? '—',
      cpuPercent: typeof c.cpu_percent === 'number' ? c.cpu_percent : null,
      memoryPercent: typeof c.memory_percent === 'number' ? c.memory_percent : null
    }));
  }

  private _renderTopContainers(entries: TopContainerEntry[]): TemplateResult | typeof nothing {
    if (entries.length === 0) return nothing;
    return html`
      <div class="section">
        <div class="section-title"><ha-icon icon="mdi:package-variant"></ha-icon> Top containers by CPU</div>
        <div class="list">
          ${entries.map(
            (c) => html`
              <div class="row">
                <span class="item-name">${c.name}</span>
                <div class="row-right">
                  ${renderIcon({ baseClass: 'row-icon', icon: 'mdi:cpu-64-bit', text: c.cpuPercent !== null ? `${c.cpuPercent.toFixed(0)}%` : '—', static: true })}
                  ${renderIcon({ baseClass: 'row-icon', icon: 'mdi:memory', text: c.memoryPercent !== null ? `${c.memoryPercent.toFixed(0)}%` : '—', static: true })}
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  private _renderRecentEvents(events: RecentEvent[], activityEntityId: string | undefined): TemplateResult | typeof nothing {
    if (events.length === 0) return nothing;
    return html`
      <div class="section">
        <div
          class="section-title ${activityEntityId ? 'clickable' : ''}"
          tabindex=${activityEntityId ? 0 : -1}
          role=${activityEntityId ? 'button' : nothing}
          @click=${() => this._moreInfo(activityEntityId)}
          @keydown=${onKeydownActivate(() => this._moreInfo(activityEntityId))}
        >
          <ha-icon icon="mdi:pulse"></ha-icon> Recent events
        </div>
        <div class="list">
          ${events.slice(0, 8).map(
            (e) => html`
              <div class="row">
                <div class="row-left">
                  <ha-icon
                    icon=${(e.action && EVENT_ICON[eventLookupKey(e.action)]) || 'mdi:pulse'}
                    style="color:${(e.action && EVENT_COLOR[eventLookupKey(e.action)]) || EVENT_COLOR_DEFAULT}"
                    title=${e.action ?? ''}
                  ></ha-icon>
                  <span class="item-name">${e.container_name ?? 'unknown'}</span>
                </div>
                ${e.timestamp
                  ? html`<span class="row-right">${formatRelativeTime(e.timestamp)}</span>`
                  : nothing}
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

}
