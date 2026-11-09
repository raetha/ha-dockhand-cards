import { html, nothing, type TemplateResult } from 'lit';
import { fireEvent } from 'custom-card-helpers';

import type { HassEntity } from 'home-assistant-js-websocket';

import type { HomeAssistant } from './ha-types';
import { findPrimaryEntityByDomain, resolveEntities } from './entity-resolver';
import { renderIcon } from './icon';
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

const DEVICE_CONTROL_KEYS = {
  restart: 'restart',
  deploy: 'stack_deploy',
  gitDeploy: 'git_stack_deploy'
} as const;

export interface DeviceControls {
  running: { entityId: string; isOn: boolean };
  restartEntityId: string | null;
  /** A stack's redeploy (internal) or deploy / sync-from-git (git) button;
   * at most one exists per stack, none for a container or external stack. */
  deploy: { entityId: string; state: HassEntity; label: string | undefined } | null;
}

/** The start/stop/restart controls to render for a container or stack
 * device, or null for none. Keyed off the device's running switch:
 * ha-dockhand doesn't create one for a system container or a stack holding
 * one, so their absence is what hides the controls there. Restart is offered
 * only while running — on a stopped device it would just start it,
 * duplicating the start button. A stack's deploy button is offered in either
 * state: for a git stack that isn't deployed, it's the way to deploy it. */
export function resolveDeviceControls(hass: HomeAssistant, deviceId: string, showControls: boolean | undefined): DeviceControls | null {
  if (showControls === false) return null;
  const running = findPrimaryEntityByDomain(hass, deviceId, 'switch');
  if (!running) return null;
  const isOn = running.state.state === 'on';
  const { found } = resolveEntities(hass, deviceId, DEVICE_CONTROL_KEYS, ['restart', 'deploy', 'gitDeploy']);
  const deploy = found.deploy ?? found.gitDeploy;
  return {
    running: { entityId: running.entityId, isOn },
    restartEntityId: isOn ? (found.restart?.entityId ?? null) : null,
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

/** A row of labeled buttons for `controls`, placed in the card body under
 * the status rather than in the header, which has no room for them beside
 * a long device name. Actions fire from `host` (the card). */
export function renderDeviceControls(host: HTMLElement, hass: HomeAssistant | undefined, controls: DeviceControls, name: string): TemplateResult {
  const { entityId, isOn } = controls.running;
  const restartEntityId = controls.restartEntityId;
  const button = (icon: string, label: string, onClick: () => void) => renderIcon({ baseClass: 'control-button', icon, text: label, title: label, onClick });
  return html`
    <div class="control-row">
      ${isOn
        ? button('mdi:stop', t(hass, 'control_stop'), () => performAction(host, 'switch.turn_off', entityId, t(hass, 'control_stop_confirm', { name })))
        : button('mdi:play', t(hass, 'control_start'), () => performAction(host, 'switch.turn_on', entityId))}
      ${restartEntityId
        ? button('mdi:restart', t(hass, 'control_restart'), () =>
            performAction(host, 'button.press', restartEntityId, t(hass, 'control_restart_confirm', { name }))
          )
        : nothing}
      ${controls.deploy ? renderDeploy(host, hass, controls.deploy, name) : nothing}
    </div>
  `;
}

/** Uses the entity's own icon (rocket or refresh for the git button) and
 * name, so the card stays in step with whatever the integration shows. */
function renderDeploy(host: HTMLElement, hass: HomeAssistant | undefined, deploy: NonNullable<DeviceControls['deploy']>, name: string): TemplateResult {
  const action = deploy.label ?? t(hass, 'control_deploy');
  return renderIcon({
    baseClass: 'control-button',
    hass,
    stateObj: deploy.state,
    text: action,
    title: action,
    onClick: () => performAction(host, 'button.press', deploy.entityId, t(hass, 'control_deploy_confirm', { name, action }))
  });
}

/** The same controls as renderDeviceControls, as icons only, for a list
 * card's row: start or stop, and restart while running. A stack's deploy
 * stays on the Stack card, where its label says which kind it is. */
export function renderRowControls(host: HTMLElement, hass: HomeAssistant | undefined, controls: DeviceControls, name: string): TemplateResult {
  const { entityId, isOn } = controls.running;
  const restartEntityId = controls.restartEntityId;
  const button = (icon: string, label: string, onClick: () => void) => renderIcon({ baseClass: 'row-icon row-control', icon, title: label, onClick });
  return html`
    ${isOn
      ? button('mdi:stop', t(hass, 'control_stop'), () => performAction(host, 'switch.turn_off', entityId, t(hass, 'control_stop_confirm', { name })))
      : button('mdi:play', t(hass, 'control_start'), () => performAction(host, 'switch.turn_on', entityId))}
    ${restartEntityId
      ? button('mdi:restart', t(hass, 'control_restart'), () => performAction(host, 'button.press', restartEntityId, t(hass, 'control_restart_confirm', { name })))
      : nothing}
  `;
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
      : nothing}
    ${runEntityId
      ? renderIcon({
          baseClass: 'row-icon row-control',
          icon: 'mdi:play',
          title: t(hass, 'control_run_now'),
          onClick: () => performAction(host, 'button.press', runEntityId, t(hass, 'control_run_now_confirm', { name }))
        })
      : nothing}
  `;
}
