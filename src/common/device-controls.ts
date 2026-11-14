import { html, nothing, type TemplateResult } from 'lit';
import { fireEvent } from 'custom-card-helpers';

import type { HassEntity } from 'home-assistant-js-websocket';

import type { HomeAssistant } from './ha-types';
import { findPrimaryEntityByDomain, resolveEntities } from './entity-resolver';
import { renderIcon } from './icon';
import { isStackDevice } from './device-utils';
import { t } from './i18n-card';
import { SCHEDULE_TRANSLATION_KEYS } from './const';

declare global {
  interface HASSDomEvents {
    'hass-action': {
      config: {
        tap_action: {
          action: 'perform-action';
          perform_action: string;
          target: { entity_id: string };
          confirmation?: { text: string };
        };
      };
      action: 'tap';
    };
  }
}

const SCHEDULE_CONTROL_KEYS = {
  run: SCHEDULE_TRANSLATION_KEYS.run,
  enabled: SCHEDULE_TRANSLATION_KEYS.enabled
} as const;

const isStack = (hass: HomeAssistant, deviceId: string): boolean => {
  const device = hass.devices?.[deviceId];
  return device ? isStackDevice(device) : false;
};

const DEVICE_CONTROL_KEYS = {
  state: 'state',
  restart: 'restart',
  pause: 'pause',
  deploy: 'stack_deploy',
  gitDeploy: 'git_stack_deploy'
} as const;

/** A row's place in the actions column: a fixed slot per control, so each
 * control lines up down the card even where a row lacks one. */
const EMPTY_SLOT = html`<span class="row-control-slot"></span>`;

export interface DeviceControls {
  running: { entityId: string; isOn: boolean };
  /** A paused container: its running switch is off, and turning it on
   * resumes it, so Start reads Resume. */
  paused: boolean;
  restartEntityId: string | null;
  /** A running container's Pause button, when that entity is on (it's
   * disabled by default in ha-dockhand). */
  pauseEntityId: string | null;
  /** A stack's redeploy (internal) or deploy / sync-from-git (git) button;
   * at most one exists per stack, none for a container or external stack. */
  deploy: { entityId: string; state: HassEntity; label: string | undefined } | null;
}

/** The start/stop/restart controls to render for a container or stack
 * device, or null for none. Keyed off the device's running switch:
 * ha-dockhand doesn't create one for a system container or a stack holding
 * one, so their absence is what hides the controls there. Restart is
 * offered as Dockhand's own lists offer it: always for a container, only
 * while running for a stack. A stack's deploy button is offered in either
 * state: for a git stack that isn't deployed, it's the way to deploy it.
 * Pause, like Dockhand's, only while a container runs. */
export function resolveDeviceControls(hass: HomeAssistant, deviceId: string, showControls: boolean | undefined): DeviceControls | null {
  if (showControls === false) return null;
  const running = findPrimaryEntityByDomain(hass, deviceId, 'switch');
  if (!running) return null;
  const isOn = running.state.state === 'on';
  const { found } = resolveEntities(hass, deviceId, DEVICE_CONTROL_KEYS, ['state', 'restart', 'pause', 'deploy', 'gitDeploy']);
  const deploy = found.deploy ?? found.gitDeploy;
  return {
    running: { entityId: running.entityId, isOn },
    paused: !isOn && found.state?.state.state === 'paused',
    restartEntityId: isOn || !isStack(hass, deviceId) ? (found.restart?.entityId ?? null) : null,
    pauseEntityId: isOn && found.pause && found.pause.state.state !== 'unavailable' ? found.pause.entityId : null,
    deploy: deploy ? { entityId: deploy.entityId, state: deploy.state, label: deployLabel(hass, deviceId, deploy.state) } : null
  };
}

/** The deploy button's own name. ha-dockhand relabels the git one "Deploy"
 * or "Sync from Git" to match Dockhand, so the card shows whatever the
 * entity is called rather than a fixed string. Falls back to the friendly
 * name minus the device-name prefix HA builds it with. */
function deployLabel(hass: HomeAssistant, deviceId: string, state: HassEntity): string | undefined {
  const formatted = hass.formatEntityName?.(state, { type: 'entity' });
  if (formatted) return formatted;
  const friendly = state.attributes.friendly_name;
  const device = hass.devices?.[deviceId];
  const deviceName = device?.name_by_user || device?.name;
  if (typeof friendly !== 'string' || !friendly) return undefined;
  return deviceName && friendly.startsWith(`${deviceName} `) ? friendly.slice(deviceName.length + 1) : undefined;
}

/** Routed through HA's own action handler rather than hass.callService so
 * stop/restart get HA's native confirmation dialog, and a failure surfaces
 * as HA's standard error toast (with ha-dockhand's translated message). */
export function performAction(host: HTMLElement, action: string, entityId: string, confirmText?: string): void {
  fireEvent(host, 'hass-action', {
    config: {
      tap_action: {
        action: 'perform-action',
        perform_action: action,
        target: { entity_id: entityId },
        ...(confirmText ? { confirmation: { text: confirmText } } : {})
      }
    },
    action: 'tap'
  });
}

type ControlButton = (icon: string, label: string, onClick: () => void) => TemplateResult;

/** The controls' buttons in Dockhand's own order for its containers and
 * stacks lists: a stack's deploy, then start (resume, for a paused
 * container) while stopped, restart, and pause and stop while running. */
function controlButtons(host: HTMLElement, hass: HomeAssistant | undefined, controls: DeviceControls, name: string, button: ControlButton, deployClass: string): TemplateResult[] {
  const { entityId, isOn } = controls.running;
  const { restartEntityId, pauseEntityId } = controls;
  const buttons: TemplateResult[] = [];
  if (controls.deploy) buttons.push(renderDeploy(host, hass, controls.deploy, name, deployClass));
  if (!isOn) buttons.push(button('mdi:play', t(hass, controls.paused ? 'control_resume' : 'control_start'), () => performAction(host, 'switch.turn_on', entityId)));
  if (restartEntityId) buttons.push(button('mdi:restart', t(hass, 'control_restart'), () => performAction(host, 'button.press', restartEntityId, t(hass, 'control_restart_confirm', { name }))));
  if (pauseEntityId) buttons.push(button('mdi:pause', t(hass, 'control_pause'), () => performAction(host, 'button.press', pauseEntityId)));
  if (isOn) buttons.push(button('mdi:stop', t(hass, 'control_stop'), () => performAction(host, 'switch.turn_off', entityId, t(hass, 'control_stop_confirm', { name }))));
  return buttons;
}

/** `controls` as icon-only buttons for a Stack or Container card's header,
 * before its settings link. Each button's tooltip names it. Actions fire
 * from `host` (the card). */
export function renderHeaderControls(host: HTMLElement, hass: HomeAssistant | undefined, controls: DeviceControls, name: string): TemplateResult {
  const button: ControlButton = (icon, label, onClick) => renderIcon({ baseClass: 'header-icon', icon, title: label, onClick });
  return html`${controlButtons(host, hass, controls, name, button, 'header-icon')}`;
}

/** Uses the entity's own icon (rocket or refresh for the git button), and
 * its name as the tooltip, so the card stays in step with whatever the
 * integration shows. */
function renderDeploy(host: HTMLElement, hass: HomeAssistant | undefined, deploy: NonNullable<DeviceControls['deploy']>, name: string, baseClass: string): TemplateResult {
  const action = deploy.label ?? t(hass, 'control_deploy');
  return renderIcon({
    baseClass,
    hass,
    stateObj: deploy.state,
    title: action,
    onClick: () => performAction(host, 'button.press', deploy.entityId, t(hass, 'control_deploy_confirm', { name, action }))
  });
}

/** How many buttons a row's controls take: a list card gives every row
 * that many slots (at least two), so the buttons line up down the card. */
export function controlCount(controls: DeviceControls | null): number {
  if (!controls) return 0;
  const { isOn } = controls.running;
  return [controls.deploy, !isOn, controls.restartEntityId, controls.pauseEntityId, isOn].filter(Boolean).length;
}

/** The same controls as renderHeaderControls, for a list card's row, padded
 * with empty slots to `slots` (see controlCount). */
export function renderRowControls(host: HTMLElement, hass: HomeAssistant | undefined, controls: DeviceControls, name: string, slots: number): TemplateResult {
  const button: ControlButton = (icon, label, onClick) => renderIcon({ baseClass: 'row-icon row-control', icon, title: label, onClick });
  const buttons = controlButtons(host, hass, controls, name, button, 'row-icon row-control');
  return html`${buttons}${Array.from({ length: Math.max(0, slots - buttons.length) }, () => EMPTY_SLOT)}`;
}

/** The slots a list card's rows get: the most controls any row shows, and
 * at least two. Set as `--row-control-slots` on the card. */
export function rowControlSlots(hass: HomeAssistant, deviceIds: string[]): number {
  return Math.max(2, ...deviceIds.map((id) => controlCount(resolveDeviceControls(hass, id, true))));
}

/** The actions column of a list row, present on every row while controls
 * are shown (empty for a row without any), so the values beside it line
 * up too. */
export function renderActionsColumn(content: TemplateResult | null): TemplateResult {
  return html`<div class="row-actions">${content ?? nothing}</div>`;
}

export interface ScheduleControls {
  runEntityId: string | null;
  enabled: { entityId: string; isOn: boolean } | null;
}

/** A schedule's Run now button and Enabled switch, each only when
 * ha-dockhand offers it for the schedule's type and it's available. */
export function resolveScheduleControls(hass: HomeAssistant, deviceId: string): ScheduleControls | null {
  const { found } = resolveEntities(hass, deviceId, SCHEDULE_CONTROL_KEYS, ['run', 'enabled']);
  const usable = (e: { state: HassEntity } | undefined) => e && e.state.state !== 'unavailable';
  const runEntityId = usable(found.run) ? found.run!.entityId : null;
  const enabled = usable(found.enabled) ? { entityId: found.enabled!.entityId, isOn: found.enabled!.state.state === 'on' } : null;
  return runEntityId || enabled ? { runEntityId, enabled } : null;
}

/** Run now asks first: a schedule can prune, back up or update. Turning
 * one on or off doesn't. Run now goes last, so it lines up down the card:
 * not every schedule has the toggle. */
export function renderScheduleControls(host: HTMLElement, hass: HomeAssistant | undefined, controls: ScheduleControls, name: string): TemplateResult {
  const { runEntityId, enabled } = controls;
  return html`
    ${enabled
      ? renderIcon({
          baseClass: 'row-icon row-control',
          icon: enabled.isOn ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline',
          title: t(hass, enabled.isOn ? 'control_disable_schedule' : 'control_enable_schedule'),
          onClick: () => performAction(host, enabled.isOn ? 'switch.turn_off' : 'switch.turn_on', enabled.entityId)
        })
      : EMPTY_SLOT}
    ${runEntityId
      ? renderIcon({
          baseClass: 'row-icon row-control',
          icon: 'mdi:play',
          title: t(hass, 'control_run_now'),
          onClick: () => performAction(host, 'button.press', runEntityId, t(hass, 'control_run_now_confirm', { name }))
        })
      : EMPTY_SLOT}
  `;
}
