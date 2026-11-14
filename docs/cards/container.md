# Dockhand Container Card

[All cards](../../README.md#cards)

```yaml
type: custom:dockhand-container-card
device_id: <container device>
name: null # optional — Composed or Custom, same as every other card's Name field
icon: null # optional — custom header icon (e.g. mdi:server); defaults to mdi:docker
show_settings_link: true # link to open this container in Dockhand
show_controls: true # start/stop/restart buttons in the header — off hides them
visible_sections: [state, metrics, io] # which sections show, independent of each other
```

Under the header, the container's Dockhand tags as coloured pills (when it has any). The container's state, health (when it has a healthcheck), CPU/memory and network/disk I/O. CPU, memory and I/O need ha-dockhand's **Enable container and stack stats** option; without it the card simply leaves them out, and its editor tells you what to enable.

Buttons in the header start, stop or restart the container, asking for confirmation before Stop or Restart. System containers (Dockhand itself, or a Hawser agent) have no buttons, matching Dockhand.

<picture>
  <source media="(prefers-color-scheme: light)" srcset="../images/container-light.png">
  <img src="../images/container.png" alt="Container card" width="420">
</picture>
