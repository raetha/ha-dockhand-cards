// Generates a fictional hass-like object for rendering ha-dockhand-cards
// in a headless browser, with no real instance data at all — every name,
// ID, and value below is made up for demonstration purposes.

const ENTRY_ID = 'demo_entry';

function device(id, identifiers, name, extra = {}) {
  return {
    id,
    name,
    name_by_user: null,
    model: extra.model ?? null,
    manufacturer: 'Dockhand',
    identifiers: identifiers.map((i) => ['dockhand', i]),
    config_entries: [ENTRY_ID],
    configuration_url: extra.configuration_url ?? null,
    hw_version: extra.hw_version ?? null
  };
}

function entity(entityId, deviceId, translationKey, state, attributes = {}, extra = {}) {
  return {
    reg: {
      entity_id: entityId,
      device_id: deviceId,
      platform: 'dockhand',
      translation_key: translationKey,
      unique_id: `${ENTRY_ID}_${entityId}`,
      disabled_by: extra.disabled_by ?? null,
      hidden_by: null,
      entity_category: extra.entity_category ?? null
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

// Matches ha-dockhand's icons.json exactly, so the harness's ha-state-icon
// shim (which can't do real icon-translation resolution — see ha-shims.mjs)
// shows the right glyph via an explicit `icon` attribute shortcut instead.
// Passed inside `attributes`, not `extra` — `entity()` only merges
// `attributes` into the mock state's attributes object.
const ONLINE_ICON = { true: 'mdi:wifi', false: 'mdi:wifi-off' };
const CONNECTION_ICON = {
  socket: 'mdi:power-plug',
  direct: 'mdi:docker',
  'hawser-standard': 'mdi:transit-connection-variant',
  'hawser-edge': 'mdi:undo-variant'
};
const STATUS_ICON = {
  update_checks: 'mdi:arrow-up-circle-outline',
  vulnerability_scanning: 'mdi:shield-check',
  activity_logging: 'mdi:pulse',
  metrics_collection: 'mdi:cpu-64-bit'
};

/** Builds one fictional environment's device + entities: the environment
 * itself, its containers, and its stacks. Every environment gets the same
 * shape of container/stack/event data (so every card has something
 * meaningful to render) but different connection type, online status, and
 * optional extras — letting the four Environment Card screenshots (one
 * per mode) each show a genuinely different environment rather than the
 * same fake data four times over. */
function buildEnvironment(addDevice, addEntity, opts) {
  const { envId, name, slug, connectionType, online, hostPort, showStatusIcons } = opts;
  const envDeviceId = `env_${envId}`;

  addDevice(
    device(envDeviceId, [`env_${envId}`], name, {
      model: 'Environment',
      configuration_url: `http://${slug}.example.internal:2376/settings?tab=environments&edit=${envId}`,
      hw_version: connectionType
    })
  );

  const onlineAttrs = { name, icon: ONLINE_ICON[online] };
  if (hostPort) {
    onlineAttrs.connection_host = hostPort.host;
    onlineAttrs.connection_port = hostPort.port;
  }
  addEntity(entity(`binary_sensor.${slug}_online`, envDeviceId, 'online', online ? 'on' : 'off', onlineAttrs));
  addEntity(
    entity(
      `sensor.${slug}_connection_type`,
      envDeviceId,
      'connection_type',
      connectionType,
      { icon: CONNECTION_ICON[connectionType] },
      { entity_category: 'diagnostic' }
    )
  );

  if (showStatusIcons) {
    for (const [key, iconName] of Object.entries(STATUS_ICON)) {
      addEntity(entity(`binary_sensor.${slug}_${key}`, envDeviceId, key, 'on', { name, icon: iconName }));
    }
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
    entity(`sensor.${slug}_memory_usage`, envDeviceId, 'memory_usage', online ? '41.2' : '0', {
      unit_of_measurement: '%',
      memory_used_bytes: online ? 6618980352 : 0,
      memory_total_bytes: 16072835072
    })
  );
  addEntity(
    entity(`sensor.${slug}_containers`, envDeviceId, 'containers', online ? '14' : '0', {
      running: online ? 12 : 0,
      stopped: online ? 1 : 14,
      paused: 0,
      restarting: 0,
      unhealthy: online ? 1 : 0,
      pending_updates: online ? 2 : 0
    })
  );
  addEntity(
    entity(`sensor.${slug}_stacks`, envDeviceId, 'stacks', online ? '4' : '0', {
      running: online ? 3 : 0,
      partial: online ? 1 : 0,
      stopped: online ? 0 : 4
    })
  );
  addEntity(entity(`sensor.${slug}_image_count`, envDeviceId, 'image_count', '31'));
  addEntity(entity(`sensor.${slug}_volume_count`, envDeviceId, 'volume_count', '9'));
  addEntity(entity(`sensor.${slug}_network_count`, envDeviceId, 'network_count', '6'));
  addEntity(
    entity(`sensor.${slug}_activity_events`, envDeviceId, 'activity_events', online ? '3' : '0', {
      today: online ? 3 : 0,
      total: 512,
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
    entity(`sensor.${slug}_disk_usage`, envDeviceId, 'disk_usage', '21474836480', {
      unit_of_measurement: 'B',
      images_size_bytes: 12884901888,
      containers_size_bytes: 419430400,
      volumes_size_bytes: 6979321856,
      build_cache_size_bytes: 1191182336
    })
  );
  addEntity(
    entity(`sensor.${slug}_vulnerabilities`, envDeviceId, 'vulnerabilities', '7', {
      critical: 0,
      high: 2,
      medium: 4,
      low: 1,
      images_scanned: 24,
      total_images: 31
    })
  );
  addEntity(entity(`button.${slug}_env_bulk_update`, envDeviceId, 'env_bulk_update', 'unknown'));
  addEntity(entity(`button.${slug}_check_updates`, envDeviceId, 'check_updates', 'unknown'));

  // ── Containers ─────────────────────────────────────────────────────
  // Update entities deliberately don't use real semantic versions (e.g.
  // "1.4.2" -> "1.5.0") — Dockhand can't offer that for arbitrary images.
  // What you actually see is either a generic "Update available" (no
  // digest details) or a short image-digest hash pair, matching the two
  // real modes this card can show.
  const containers = [
    {
      name: 'web',
      state: 'running',
      health: 'healthy',
      cpu: 4.2,
      mem: 8.1,
      memLimit: 512,
      update: 'hash',
      netRx: 184320,
      netTx: 92160,
      blkRead: 15728640,
      blkWrite: 4194304
    },
    { name: 'postgres', state: 'running', health: 'healthy', cpu: 6.1, mem: 12.4, memLimit: 1024, update: 'none' },
    { name: 'redis', state: 'running', health: 'healthy', cpu: 1.1, mem: 3.2, memLimit: 256, update: 'none' },
    { name: 'traefik', state: 'running', health: null, cpu: 0.4, mem: 1.8, memLimit: 256, update: 'generic' },
    { name: 'worker', state: 'running', health: 'unhealthy', cpu: 0.2, mem: 2.6, memLimit: 512, update: 'none' }
  ];

  for (const c of containers) {
    const devId = `container_${envId}_${c.name}`;
    addDevice(device(devId, [`container_${envId}_${c.name}`], c.name, { model: 'Container' }));
    addEntity(
      entity(`sensor.${slug}_${c.name}_state`, devId, 'state', c.state, { name: c.name, type: 'Compose' }, { friendly_name: c.name })
    );
    if (c.health) {
      addEntity(entity(`sensor.${slug}_${c.name}_health`, devId, 'health', c.health));
    }
    addEntity(entity(`sensor.${slug}_${c.name}_cpu_percent`, devId, 'container_cpu_percent', c.cpu.toFixed(1), { unit_of_measurement: '%' }));
    addEntity(
      entity(`sensor.${slug}_${c.name}_memory_percent`, devId, 'container_memory_percent', c.mem.toFixed(1), { unit_of_measurement: '%' })
    );
    addEntity(
      entity(`sensor.${slug}_${c.name}_memory_usage`, devId, 'container_memory_usage', (c.memLimit * (c.mem / 100)).toFixed(0), {
        unit_of_measurement: 'MB'
      })
    );
    if (c.netRx !== undefined) {
      addEntity(entity(`sensor.${slug}_${c.name}_network_rx`, devId, 'container_network_rx', c.netRx, { unit_of_measurement: 'B' }));
      addEntity(entity(`sensor.${slug}_${c.name}_network_tx`, devId, 'container_network_tx', c.netTx, { unit_of_measurement: 'B' }));
      addEntity(entity(`sensor.${slug}_${c.name}_block_read`, devId, 'container_block_read', c.blkRead, { unit_of_measurement: 'B' }));
      addEntity(entity(`sensor.${slug}_${c.name}_block_write`, devId, 'container_block_write', c.blkWrite, { unit_of_measurement: 'B' }));
    }
    if (c.update === 'hash') {
      addEntity(
        entity(`update.${slug}_${c.name}_update`, devId, null, 'on', {
          name: c.name,
          installed_version: 'a3f29e1',
          latest_version: 'b82d4f0'
        })
      );
    } else if (c.update === 'generic') {
      addEntity(
        entity(`update.${slug}_${c.name}_update`, devId, null, 'on', {
          name: c.name,
          installed_version: 'Update available',
          latest_version: 'Update available'
        })
      );
    } else {
      addEntity(entity(`update.${slug}_${c.name}_update`, devId, null, 'off', { name: c.name }));
    }
  }

  // ── Stacks ─────────────────────────────────────────────────────────
  const stacks = [
    { name: 'core', status: 'running', containerCount: 3, type: 'Git' },
    { name: 'monitoring', status: 'partial', containerCount: 2, type: 'Internal' }
  ];
  for (const s of stacks) {
    const devId = `stack_${envId}_${s.name}`;
    addDevice(device(devId, [`stack_${envId}_${s.name}`], s.name, { model: `${s.type} Stack` }));
    addEntity(
      entity(`sensor.${slug}_${s.name}_status`, devId, 'status', s.status, {
        name: s.name,
        type: s.type,
        container_count: s.containerCount
      })
    );
    addEntity(entity(`sensor.${slug}_${s.name}_containers_in_stack`, devId, 'containers_in_stack', s.containerCount));
  }
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
    online: true
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
    showStatusIcons: true
  });

  return { devices, entities, states };
}
