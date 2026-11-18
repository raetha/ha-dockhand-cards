# Dockhand Containers Card

[All cards](../../README.md#cards)

```yaml
type: custom:dockhand-containers-card
environments_order: [] # environment display order; all environments are included by default
exclude_device_ids: [] # environments to leave out
name: null # optional — Composed or Custom, same as every other card's Name field
show_settings_link: true # link to view containers in Dockhand
show_controls: false # the Container card's buttons on each row
visible_badges: [health, updates, cpu, memory, tags] # per-row details; add `environment` for an environment pill
group_by: environment # none | environment | status
sort_by: name # name | status | cpu | memory (highest first)
filters: {} # which rows show — see lists.md
show_filtered_count: true # a "Hidden by filters" line under a filtered list
```

Every container in one environment, several, or all of them, one compact row each: state, health, pending updates and CPU/memory (when container stats are enabled). Works like the [Stacks card](stacks.md), including **Row details** and **Show controls**.

A newer version tag Dockhand has found shows as a tag icon (hover for the tag): after the update icon when there's also an update to install, or on its own when there isn't. A container pinned to a digest whose tag has moved on gets an orange pin in the update icon's place, and one whose update Dockhand is holding until the new image reaches its minimum image age gets a grey clock; hover either for the details. All of these are part of the **updates** row detail.

The row details line up in columns down the card, one for each detail shown that some row has, each as wide as its widest value. On a row too narrow for everything, the name stays readable: tags that don't all fit fold into one pill with their count (hover for their names). The Stacks and Updates cards do the same.

<picture>
  <source media="(prefers-color-scheme: light)" srcset="../images/containers-list-light.png">
  <img src="../images/containers-list.png" alt="Containers card" width="420">
</picture>
