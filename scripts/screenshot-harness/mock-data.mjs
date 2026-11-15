// Generates a fictional hass-like object for rendering ha-dockhand-cards
// in a headless browser, with no real instance data at all — every name,
// ID, and value below is made up for demonstration purposes.

// A config entry id as Home Assistant makes them (a ULID).
const ENTRY_ID = '01JDEMO0ENTRY000000000000';

// Shaped like Home Assistant's own hass.devices entries (the device
// registry, config/device_registry/list) and hass.entities entries (the
// display registry, config/entity_registry/list_for_display, which holds
// enabled entities only and leaves out absent fields).
function device(id, identifiers, name, extra = {}) {
  return {
    id,
    name,
    name_by_user: null,
    model: extra.model ?? null,
    model_id: null,
    manufacturer: 'Dockhand',
    // ha-dockhand prefixes every identifier with its config entry's id.
    identifiers: identifiers.map((i) => ['dockhand', `${ENTRY_ID}_${i}`]),
    connections: [],
    config_entry_id: ENTRY_ID,
    config_entries: [ENTRY_ID],
    primary_config_entry: ENTRY_ID,
    configuration_url: extra.configuration_url ?? null,
    sw_version: null,
    hw_version: extra.hw_version ?? null,
    serial_number: null,
    via_device_id: extra.via_device_id ?? null,
    area_id: null,
    labels: [],
    entry_type: extra.entry_type ?? null,
    disabled_by: null
  };
}

function entity(entityId, deviceId, translationKey, state, attributes = {}, extra = {}) {
  return {
    reg: {
      entity_id: entityId,
      device_id: deviceId,
      platform: 'dockhand',
      labels: [],
      ...(translationKey ? { translation_key: translationKey } : {}),
      ...(extra.entity_category ? { entity_category: extra.entity_category } : {})
    },
    state: {
      entity_id: entityId,
      state: String(state),
      attributes: { friendly_name: extra.friendly_name ?? entityId, ...attributes },
      last_changed: extra.last_changed ?? new Date().toISOString(),
      last_updated: extra.last_updated ?? new Date().toISOString()
    }
  };
}

// Home Assistant's update entity attributes, with ha-dockhand's own:
// Install, release notes and progress where Dockhand would update the
// container (21), release notes alone where it can't (16).
const INSTALLABLE = 21;
const NOTES_ONLY = 16;
function updateAttrs(installed, latest, supportedFeatures, extra = {}) {
  return {
    auto_update: false,
    display_precision: 0,
    installed_version: installed,
    in_progress: false,
    latest_version: latest,
    release_summary: null,
    release_url: null,
    skipped_version: null,
    title: null,
    update_percentage: null,
    supported_features: supportedFeatures,
    ...extra
  };
}

const SYNC_ERROR = 'Merge conflict in docker-compose.yml — manual resolution required.';

/** Builds one fictional environment's device + entities: the environment
 * itself, its containers, and its stacks. Every environment gets the same
 * shape of container/stack/event data (so every card has something
 * meaningful to render) but different connection type, online status, and
 * optional extras — letting the four Environment Card screenshots (one
 * per mode) each show a genuinely different environment rather than the
 * same fake data four times over. */
function buildEnvironment(addDevice, addEntity, opts) {
  const { envId, name, slug, connectionType, online, hostPort, showStatusIcons, labels, autoUpdate, updateChecks } = opts;
  const envDeviceId = `env_${envId}`;

  addDevice(
    device(envDeviceId, [`env_${envId}`], name, {
      model: 'Environment',
      configuration_url: `http://${slug}.example.internal:2376/settings?tab=environments&edit=${envId}`,
      hw_version: connectionType
    })
  );
  // ha-dockhand's group devices: stacks sit under Stacks, and containers
  // under their stack or, on their own, under Containers.
  for (const group of ['Stacks', 'Containers']) {
    addDevice(device(`env_${envId}_${group}`, [`env_${envId}_${group}`], `${name} – ${group}`, { model: 'Environment Group', via_device_id: envDeviceId }));
  }

  addEntity(
    entity(`binary_sensor.${slug}_online`, envDeviceId, 'online', online ? 'on' : 'off', {
      connection_host: hostPort?.host ?? null,
      connection_port: hostPort?.port ?? null,
      labels: labels ?? []
    })
  );
  // The environment's settings, as ha-dockhand 2.0 has them: switches,
  // with scanning a sensor plus the scanner select.
  const setting = (domain, key, on) =>
    addEntity(entity(`${domain}.${slug}_${key}`, envDeviceId, key, on ? 'on' : 'off', { friendly_name: `${name} ${key.replace(/_/g, ' ')}` }, { entity_category: 'config' }));
  // showStatusIcons turns every setting on, so each header icon shows in color.
  setting('switch', 'auto_update', autoUpdate);
  setting('switch', 'update_checks', showStatusIcons || updateChecks || autoUpdate);
  setting('switch', 'activity_logging', showStatusIcons || online);
  setting('switch', 'metrics_collection', showStatusIcons || (online && !autoUpdate));
  setting('binary_sensor', 'vulnerability_scanning', true);
  addEntity(entity(`select.${slug}_vulnerability_scanner`, envDeviceId, 'vulnerability_scanner', 'grype', { options: ['none', 'grype', 'trivy', 'both'] }, { entity_category: 'config' }));
  addEntity(entity(`sensor.${slug}_connection_type`, envDeviceId, 'connection_type', connectionType, { options: ['socket', 'direct', 'hawser-standard', 'hawser-edge'] }, { entity_category: 'diagnostic' }));

  // Host details, shown as the dashboard's environment page badges; the
  // agent version only for Hawser connections, as ha-dockhand creates it.
  if (online) {
    const diagnostic = { entity_category: 'diagnostic' };
    const detail = (key, state, attrs) => addEntity(entity(`sensor.${slug}_${key}`, envDeviceId, key, state, attrs, diagnostic));
    detail('host_platform', 'Ubuntu 24.04.3 LTS', { friendly_name: `${name} Host platform`, architecture: 'x86_64' });
    detail('uptime', new Date(Date.now() - 16 * 86400000).toISOString(), { friendly_name: `${name} Uptime`, device_class: 'timestamp' });
    if (connectionType.startsWith('hawser')) detail('hawser_agent_version', '0.9.4', { friendly_name: `${name} Hawser agent version`, agent_name: slug, agent_id: `${slug}-agent` });
    detail('host_docker_version', '29.1.2', { friendly_name: `${name} Docker version` });
  }

  addEntity(
    entity(`sensor.${slug}_cpu_usage`, envDeviceId, 'cpu_usage', online ? '3.8' : '0', {
      unit_of_measurement: '%',
      cpu_count: 8,
      top_containers: online
        ? [
            { name: 'postgres', cpu_percent: 6.1, memory_percent: 12.4 },
            { name: 'web', cpu_percent: 4.2, memory_percent: 8.1 },
            { name: 'redis', cpu_percent: 1.1, memory_percent: 3.2 },
            { name: 'traefik', cpu_percent: 0.4, memory_percent: 1.8 },
            { name: 'worker', cpu_percent: 0.2, memory_percent: 2.6 }
          ]
        : []
    })
  );
  addEntity(
    entity(`sensor.${slug}_memory_usage`, envDeviceId, 'memory_usage', online ? '41.2' : '0', { unit_of_measurement: '%' })
  );
  // ha-dockhand's counts and sizes are each their own sensor; sizes are
  // native bytes shown in MiB, as Home Assistant reports them.
  const valueSensor = (key, value, attributes = {}) => addEntity(entity(`sensor.${slug}_${key}`, envDeviceId, key, String(value), attributes));
  const mibSensor = (key, bytes) => valueSensor(key, bytes / 1024 ** 2, { unit_of_measurement: 'MiB' });
  mibSensor('memory_used', online ? 6618980352 : 0);
  mibSensor('memory_total', 16072835072);
  valueSensor('image_count', 31);
  valueSensor('volume_count', 9);
  valueSensor('network_count', 6);
  addEntity(
    entity(`sensor.${slug}_activity_events`, envDeviceId, 'activity_events', online ? '3' : '0', {
      recent_events: online
        ? [
            { container_name: 'web', action: 'health_status: healthy', timestamp: new Date(Date.now() - 3600e3).toISOString() },
            { container_name: 'worker', action: 'restart', timestamp: new Date(Date.now() - 7200e3).toISOString() },
            { container_name: 'postgres', action: 'health_status: healthy', timestamp: new Date(Date.now() - 86400e3).toISOString() }
          ]
        : []
    })
  );
  addEntity(
    entity(`sensor.${slug}_disk_usage`, envDeviceId, 'disk_usage', '20480', {
      unit_of_measurement: 'MiB'
    })
  );
  valueSensor('activity_events_today', online ? 3 : 0);
  mibSensor('disk_usage_images', 12884901888);
  mibSensor('disk_usage_containers', 419430400);
  mibSensor('disk_usage_volumes', 6979321856);
  mibSensor('disk_usage_build_cache', 1191182336);
  addEntity(entity(`sensor.${slug}_vulnerabilities`, envDeviceId, 'vulnerabilities', '7'));
  for (const [key, value] of Object.entries({ critical: 0, high: 2, medium: 4, low: 1 })) valueSensor(`vulnerabilities_${key}`, value);
  valueSensor('images_scanned', 24);
  addEntity(entity(`button.${slug}_env_bulk_update`, envDeviceId, 'env_bulk_update', 'unknown'));
  addEntity(entity(`button.${slug}_check_updates`, envDeviceId, 'check_updates', 'unknown'));

  // ── Containers ─────────────────────────────────────────────────────
  // An installable update is either a generic "Update available" (no
  // digest details) or a short image-digest hash pair — Dockhand can't
  // offer "1.4.2" -> "1.5.0" for the tag a container is pinned to. A
  // newer version tag (`newer`) is separate: it needs the pinned tag
  // changed, and can appear alongside an installable update or alone
  // (update: 'tag'). update: 'pinned' is a digest-pinned image whose tag
  // moved on, update: 'held' an update waiting out the minimum image age
  // (both on, with nothing to install).
  const containers = [
    {
      name: 'web',
      state: 'running',
      health: 'healthy',
      cpu: 4.2,
      mem: 8.1,
      memLimit: 512,
      update: 'hash',
      image: 'nginx:1.25',
      netRx: 184320,
      netTx: 92160,
      blkRead: 15728640,
      blkWrite: 4194304
    },
    { name: 'postgres', state: 'running', health: 'healthy', cpu: 6.1, mem: 12.4, memLimit: 1024, update: 'tag', newer: '17.6', newerBump: 'major', newerCount: 7, image: 'postgres:16' },
    { name: 'redis', state: 'running', health: 'healthy', cpu: 1.1, mem: 3.2, memLimit: 256, update: 'held', heldHours: 9, image: 'redis:7.2' },
    { name: 'traefik', state: 'running', health: null, cpu: 0.4, mem: 1.8, memLimit: 256, update: 'generic', newer: 'v3.5', newerBump: 'minor', newerCount: 4, image: 'traefik:v3.1' },
    {
      name: 'worker',
      state: 'running',
      health: 'unhealthy',
      cpu: 0.2,
      mem: 2.6,
      memLimit: 512,
      update: 'pinned',
      image: 'ghcr.io/nebula/worker:latest@sha256:5c1d9e0f7a2b'
    },
    { name: 'backup', state: 'exited', health: null, cpu: 0, mem: 0, memLimit: 256, update: 'none', exitCode: 1, image: 'restic/restic:0.17', netRx: 0, netTx: 0, blkRead: 0, blkWrite: 0 }
  ];

  // Counted from the containers above, so the counts and the update
  // entities can't disagree. No container here is a system container.
  const onKinds = ['hash', 'generic', 'tag', 'pinned', 'held'];
  const pendingUpdateCount = containers.filter((c) => onKinds.includes(c.update)).length;
  const pendingVersionUpdateCount = containers.filter((c) => c.update === 'tag').length;
  const pendingPinnedDigestCount = containers.filter((c) => c.update === 'pinned').length;
  const heldCount = containers.filter((c) => c.update === 'held').length;
  const systemContainers = containers.filter((c) => c.systemContainer);
  const pendingSystemUpdateCount = systemContainers.filter((c) => onKinds.includes(c.update)).length;
  // An offline environment's containers all count as stopped.
  const count = (pred) => (online ? containers.filter(pred).length : 0);
  valueSensor('containers', containers.length);
  for (const [key, value] of Object.entries({
    containers_running: count((c) => c.state === 'running'),
    containers_stopped: online ? containers.filter((c) => c.state === 'exited').length : containers.length,
    containers_paused: count((c) => c.state === 'paused'),
    containers_restarting: count((c) => c.state === 'restarting'),
    containers_unhealthy: count((c) => c.health === 'unhealthy'),
    pending_updates: online ? pendingUpdateCount : 0,
    installable_updates: online ? pendingUpdateCount - pendingSystemUpdateCount - pendingVersionUpdateCount - pendingPinnedDigestCount - heldCount : 0,
    system_updates: online ? pendingSystemUpdateCount : 0,
    version_tag_updates: online ? pendingVersionUpdateCount : 0,
    pinned_digest_updates: online ? pendingPinnedDigestCount : 0,
    held_updates: online ? heldCount : 0
  }))
    valueSensor(key, value);

  // ── Stacks ─────────────────────────────────────────────────────────
  const stacks = [
    { name: 'core', status: 'running', containerCount: 3, type: 'Git', containerNames: ['traefik', 'web', 'worker'], git: true, syncStatus: 'pending', syncError: true, lastSyncHoursAgo: 3, lastCommit: 'a3f29e17c8b4' },
    { name: 'monitoring', status: 'partial', containerCount: 2, type: 'Internal', containerNames: ['postgres', 'redis'] }
  ];
  valueSensor('stacks', stacks.length);
  valueSensor('stacks_running', online ? stacks.filter((st) => st.status === 'running').length : 0);
  valueSensor('stacks_partial', online ? stacks.filter((st) => st.status === 'partial').length : 0);
  valueSensor('stacks_stopped', online ? stacks.filter((st) => st.status === 'stopped').length : stacks.length);
  // A container's device sits under its stack's, as in ha-dockhand; backup
  // runs on its own.
  const stackOf = Object.fromEntries(stacks.flatMap((st) => st.containerNames.map((n) => [n, st.name])));
  for (const c of containers) {
    const devId = `container_${envId}_${c.name}`;
    addDevice(
      device(devId, [`container_${envId}_${c.name}`], `${name} – Containers – ${c.name}`, {
        model: 'Container',
        configuration_url: `http://${slug}.example.internal:2376/containers`,
        via_device_id: stackOf[c.name] ? `stack_${envId}_${stackOf[c.name]}` : `env_${envId}_Containers`
      })
    );
    addEntity(
      entity(
        `sensor.${slug}_${c.name}_state`,
        devId,
        'state',
        c.state,
        {
          image: c.image,
          restart_count: null,
          exit_code: c.state === 'exited' ? (c.exitCode ?? 0) : null,
          networks: c.state === 'running' ? { [`${stackOf[c.name] ?? 'bridge'}${stackOf[c.name] ? '_default' : ''}`]: `172.18.0.${containers.indexOf(c) + 2}` } : {},
          system_container: false,
          ...mockTags(c.name)
        },
        { friendly_name: c.name }
      )
    );
    if (c.health) {
      addEntity(entity(`sensor.${slug}_${c.name}_health`, devId, 'health', c.health));
    }
    // ha-dockhand creates neither control entity for a system container.
    if (!c.systemContainer) {
      addEntity(entity(`switch.${slug}_${c.name}`, devId, null, c.state === 'running' ? 'on' : 'off', {}, { friendly_name: c.name }));
      addEntity(entity(`button.${slug}_${c.name}_restart`, devId, 'restart', 'unknown'));
    }
    // Like ha-dockhand, stats sensors are unavailable for a container that
    // isn't running — Docker reports no stats for it.
    const stat = (v) => (c.state === 'running' ? v : 'unavailable');
    // ha-dockhand's data-size sensors are native bytes with a suggested MiB
    // display unit, so HA's state is in MiB — mirror that, not raw bytes.
    const mib = (bytes) => stat(String(bytes / 1024 ** 2));
    addEntity(entity(`sensor.${slug}_${c.name}_cpu_percent`, devId, 'container_cpu_percent', stat(c.cpu.toFixed(1)), { unit_of_measurement: '%' }));
    addEntity(
      entity(`sensor.${slug}_${c.name}_memory_percent`, devId, 'container_memory_percent', stat(c.mem.toFixed(1)), { unit_of_measurement: '%' })
    );
    addEntity(
      entity(`sensor.${slug}_${c.name}_memory_usage`, devId, 'container_memory_usage', mib(Math.round(c.memLimit * (c.mem / 100) * 1024 * 1024)), {
        unit_of_measurement: 'MiB'
      })
    );
    addEntity(entity(`sensor.${slug}_${c.name}_memory_limit`, devId, 'container_memory_limit', mib(c.memLimit * 1024 * 1024), { unit_of_measurement: 'MiB' }));
    if (c.netRx !== undefined) {
      addEntity(entity(`sensor.${slug}_${c.name}_network_rx`, devId, 'container_network_rx', mib(c.netRx), { unit_of_measurement: 'MiB' }));
      addEntity(entity(`sensor.${slug}_${c.name}_network_tx`, devId, 'container_network_tx', mib(c.netTx), { unit_of_measurement: 'MiB' }));
      addEntity(entity(`sensor.${slug}_${c.name}_block_read`, devId, 'container_block_read', mib(c.blkRead), { unit_of_measurement: 'MiB' }));
      addEntity(entity(`sensor.${slug}_${c.name}_block_write`, devId, 'container_block_write', mib(c.blkWrite), { unit_of_measurement: 'MiB' }));
    }
    const newer = c.newer ? { newer_version: c.newer, newer_version_bump: c.newerBump, newer_versions_count: c.newerCount } : {};
    const tag = c.image.split(':')[1];
    const update = {
      hash: () => ['on', updateAttrs('a3f29e1', 'b82d4f0', INSTALLABLE, newer)],
      generic: () => ['on', updateAttrs('latest', 'update-pending', INSTALLABLE, newer)],
      // A newer version tag alone: it's latest_version too, and Install
      // is withheld, since the pinned tag has to change.
      tag: () => ['on', updateAttrs(tag, c.newer, NOTES_ONLY, newer)],
      pinned: () => ['on', updateAttrs('latest', 'update-pending', NOTES_ONLY, { pinned_digest_moved: true })],
      held: () => ['on', updateAttrs(tag, 'update-pending', NOTES_ONLY, { update_held_hours: c.heldHours })],
      none: () => ['off', updateAttrs(tag, tag, INSTALLABLE)]
    }[c.update]();
    addEntity(entity(`update.${slug}_${c.name}_update`, devId, null, ...update));
  }

  for (const s of stacks) {
    const devId = `stack_${envId}_${s.name}`;
    addDevice(device(devId, [`stack_${envId}_${s.name}`], `${name} – Stacks – ${s.name}`, { model: `${s.type} Stack`, configuration_url: `http://${slug}.example.internal:2376/stacks`, via_device_id: `env_${envId}_Stacks` }));
    // Same as ha-dockhand: on while running or partially running.
    addEntity(entity(`switch.${slug}_stacks_${s.name}`, devId, null, s.status === 'running' || s.status === 'partial' ? 'on' : 'off', {}, { friendly_name: s.name }));
    addEntity(entity(`button.${slug}_stacks_${s.name}_restart`, devId, 'restart', 'unknown'));
    // A git stack's button names itself "Deploy" or "Sync from Git", with
    // its own icon, by whether the stack is deployed; an internal stack's
    // is "Redeploy".
    addEntity(
      s.git
        ? entity(`button.${slug}_stacks_${s.name}_git_deploy`, devId, 'git_stack_deploy', 'unknown', { icon: 'mdi:refresh' }, { friendly_name: `${s.name} Sync from Git` })
        : entity(`button.${slug}_stacks_${s.name}_deploy`, devId, 'stack_deploy', 'unknown', {}, { friendly_name: `${s.name} Redeploy` })
    );
    addEntity(
      entity(`sensor.${slug}_${s.name}_status`, devId, 'status', s.status, {
        type: s.type,
        system_container: false,
        ...mockTags(s.name)
      })
    );
    addEntity(
      entity(`sensor.${slug}_${s.name}_containers_in_stack`, devId, 'containers_in_stack', s.containerCount, {
        container_names: s.containerNames
      })
    );
    // Stack totals as Dockhand's /api/stack-stats reports them (via
    // ha-dockhand): summed over running containers, except the memory limit,
    // which is the largest single one, and no memory percentage.
    const running = containers.filter((c) => s.containerNames.includes(c.name) && c.state === 'running');
    if (running.length > 0) {
      const sum = (f) => running.reduce((total, c) => total + (f(c) ?? 0), 0);
      const usedMiB = sum((c) => c.memLimit * (c.mem / 100));
      const limitMiB = Math.max(...running.map((c) => c.memLimit));
      const mibOf = (bytes) => String(bytes / 1024 ** 2);
      const totals = [
        ['cpu_percent', sum((c) => c.cpu).toFixed(1), '%'],
        ['memory_usage', String(usedMiB), 'MiB'],
        ['memory_limit', String(limitMiB), 'MiB'],
        ['network_rx', mibOf(sum((c) => c.netRx)), 'MiB'],
        ['network_tx', mibOf(sum((c) => c.netTx)), 'MiB'],
        ['block_read', mibOf(sum((c) => c.blkRead)), 'MiB'],
        ['block_write', mibOf(sum((c) => c.blkWrite)), 'MiB'],
        ['running_containers', String(running.length), undefined]
      ];
      for (const [key, value, unit] of totals) {
        addEntity(
          entity(`sensor.${slug}_${s.name}_${key}`, devId, `stack_${key}`, value, {
            ...(unit ? { unit_of_measurement: unit } : {})
          })
        );
      }
    }
    // Dockhand's count of the stack's containers with an update to install.
    const pending = containers.filter((c) => s.containerNames.includes(c.name) && ['hash', 'generic'].includes(c.update)).map((c) => c.name);
    addEntity(entity(`sensor.${slug}_${s.name}_pending_updates`, devId, 'stack_pending_updates', String(pending.length)));
    addEntity(entity(`binary_sensor.${slug}_${s.name}_updates_available`, devId, 'stack_updates_available', pending.length ? 'on' : 'off', { pending_container_names: pending }));
    if (s.git) {
      addEntity(
        entity(`sensor.${slug}_${s.name}_git_sync_status`, devId, 'git_stack_sync_status', s.syncStatus, {
          last_commit: s.lastCommit,
          sync_error: s.syncError ? SYNC_ERROR : null,
          auto_update: false,
          webhook_enabled: false
        })
      );
      addEntity(
        entity(
          `sensor.${slug}_${s.name}_git_last_sync`,
          devId,
          'git_stack_last_sync',
          new Date(Date.now() - s.lastSyncHoursAgo * 3600e3).toISOString()
        )
      );
      addEntity(
        entity(`binary_sensor.${slug}_${s.name}_git_sync_error`, devId, 'git_stack_sync_error', s.syncError ? 'on' : 'off', { sync_error: s.syncError ? SYNC_ERROR : null })
      );
    }
  }
}

/** Schedule devices as ha-dockhand makes them (helpers.py's
 * _sched_device()): global schedules under the schedules hub, an
 * environment's under its Schedules group, each with a Next run and a
 * Last status sensor. */
function buildSchedules(addDevice, addEntity) {
  const inHours = (h) => new Date(Date.now() + h * 3600e3).toISOString();

  addDevice(device('schedules_hub', ['schedules_hub'], 'Dockhand – Schedules', { model: 'Service' }));
  addDevice(
    device('env_1_Schedules', ['env_1_Schedules'], 'Nebula – Schedules', {
      model: 'Environment Group',
      via_device_id: 'env_1'
    })
  );
  addDevice(
    device('env_2_Schedules', ['env_2_Schedules'], 'Aurora – Schedules', {
      model: 'Environment Group',
      via_device_id: 'env_2'
    })
  );
  addDevice(
    device('env_4_Schedules', ['env_4_Schedules'], 'Vega – Schedules', {
      model: 'Environment Group',
      via_device_id: 'env_4'
    })
  );

  function schedule({ id, type, name, description, viaDeviceId, environment, status, nextRunIso, enabled = true, isSystem = false, errorMessage }) {
    const devId = `schedule_${id}_${type}`;
    addDevice(device(devId, [`schedule_${id}_${type}`], `${environment ?? 'Dockhand'} – Schedules – ${name}`, { model: 'Schedule', via_device_id: viaDeviceId }));
    addEntity(
      entity(`sensor.${devId}_next_run`, devId, 'next_run', nextRunIso ?? 'unknown', {
        cron_expression: '0 */4 * * *',
        enabled,
        environment: environment ?? null,
        schedule_type: type
      })
    );
    addEntity(
      entity(`sensor.${devId}_last_status`, devId, 'last_status', status, {
        description,
        is_system: isSystem,
        cron_expression: '0 */4 * * *',
        enabled,
        environment: environment ?? null,
        schedule_type: type,
        triggered_by: status === 'queued' ? null : 'cron',
        triggered_at: status === 'queued' ? null : new Date(Date.now() - 3600e3).toISOString(),
        duration_ms: ['success', 'failed', 'warning', 'skipped'].includes(status) ? 4210 : null,
        error_message: errorMessage ?? null,
        updates_found: type.endsWith('update') || type === 'env_update_check' ? 0 : null
      })
    );
    // ha-dockhand 2.0's Run now and Enabled (not offered for env reports
    // and stack deploys, or Enabled for container updates and git syncs).
    if (type !== 'env_report' && type !== 'stack_deploy') {
      addEntity(entity(`button.${devId}_run`, devId, 'schedule_run', 'unknown'));
    }
    if (type !== 'container_update' && type !== 'git_stack_sync') {
      addEntity(entity(`switch.${devId}_enabled`, devId, 'schedule_enabled', enabled ? 'on' : 'off'));
    }
  }

  schedule({
    id: 1,
    type: 'system_cleanup',
    name: 'Container event cleanup',
    description: 'Removes old container event logs',
    viaDeviceId: 'schedules_hub',
    environment: null,
    status: 'success',
    nextRunIso: inHours(0.17),
    isSystem: true
  });
  schedule({
    id: 2,
    type: 'container_update',
    name: 'Update container: web',
    description: 'Check, scan & auto-update containers',
    viaDeviceId: 'env_1_Schedules',
    environment: 'Nebula',
    status: 'success',
    nextRunIso: inHours(4)
  });
  schedule({
    id: 3,
    type: 'git_stack_sync',
    name: 'Git sync: core',
    description: 'Pull and redeploy from the linked git repository',
    viaDeviceId: 'env_1_Schedules',
    environment: 'Nebula',
    status: 'running',
    nextRunIso: null
  });
  schedule({
    id: 4,
    type: 'container_update',
    name: 'Update container: postgres',
    description: 'Check, scan & auto-update containers',
    viaDeviceId: 'env_2_Schedules',
    environment: 'Aurora',
    status: 'failed',
    nextRunIso: inHours(2),
    errorMessage: 'Connection timeout'
  });
  schedule({
    id: 5,
    type: 'image_prune',
    name: 'Prune images: Aurora',
    description: 'Prune dangling images only',
    viaDeviceId: 'env_2_Schedules',
    environment: 'Aurora',
    status: 'success',
    nextRunIso: inHours(12)
  });
  schedule({
    id: 6,
    type: 'env_update_check',
    name: 'Update environment: Vega',
    description: 'Check, scan & auto-update containers',
    viaDeviceId: 'env_4_Schedules',
    environment: 'Vega',
    status: 'success',
    nextRunIso: null,
    enabled: false
  });
  schedule({
    id: 7,
    type: 'git_stack_sync',
    name: 'Git sync: api',
    description: 'Pull and redeploy from the linked git repository',
    viaDeviceId: 'env_2_Schedules',
    environment: 'Aurora',
    status: 'skipped',
    nextRunIso: inHours(3)
  });
  schedule({
    id: 8,
    type: 'env_update_check',
    name: 'Update environment: Nebula',
    description: 'Check, scan & auto-update containers',
    viaDeviceId: 'env_1_Schedules',
    environment: 'Nebula',
    status: 'warning',
    nextRunIso: inHours(6),
    errorMessage: 'Some containers could not be scanned'
  });
  schedule({
    id: 9,
    type: 'container_update',
    name: 'Update container: redis',
    description: 'Check, scan & auto-update containers',
    viaDeviceId: 'env_4_Schedules',
    environment: 'Vega',
    status: 'queued',
    nextRunIso: null
  });
}

// ha-dockhand 2.0's Dockhand tags, on a few containers and stacks (Dockhand's palette).
const MOCK_TAGS = {
  traefik: [['edge', '#0ea5e9']],
  postgres: [['database', '#8b5cf6'], ['critical', '#ef4444']],
  monitoring: [['observability', '#22c55e']],
  core: [['critical', '#ef4444']]
};
function mockTags(name) {
  const tags = MOCK_TAGS[name];
  return tags ? { tags: tags.map(([n]) => n), tag_colors: Object.fromEntries(tags) } : {};
}

export function buildMockHass() {
  const devices = {};
  const entities = {};
  const states = {};

  function addDevice(d) {
    devices[d.id] = d;
  }
  function addEntity(e) {
    entities[e.reg.entity_id] = e.reg;
    states[e.state.entity_id] = e.state;
  }

  // Four fictional environments — one per Environment Card screenshot
  // mode, each with a different connection type and online status so the
  // set of screenshots shows real variety rather than the same fake data
  // four times over. "Vega" (the "full" mode screenshot) also carries the
  // header's host:port display and all four status icons, since that's
  // the mode with room to show the extra detail.
  buildEnvironment(addDevice, addEntity, {
    envId: 1,
    name: 'Nebula',
    slug: 'nebula',
    connectionType: 'hawser-standard',
    online: true,
    labels: ['production', 'critical'],
    updateChecks: true
  });
  buildEnvironment(addDevice, addEntity, {
    envId: 2,
    name: 'Aurora',
    slug: 'aurora',
    connectionType: 'socket',
    online: true
  });
  buildEnvironment(addDevice, addEntity, {
    envId: 3,
    name: 'Orion',
    slug: 'orion',
    connectionType: 'direct',
    online: false
  });
  buildEnvironment(addDevice, addEntity, {
    envId: 4,
    name: 'Vega',
    slug: 'vega',
    connectionType: 'hawser-edge',
    online: true,
    hostPort: { host: '192.168.1.42', port: 2376 },
    showStatusIcons: true,
    autoUpdate: true
  });

  buildSchedules(addDevice, addEntity);

  return { devices, entities, states };
}
