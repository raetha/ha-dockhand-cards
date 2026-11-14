# Choosing environments and filtering lists

Shared by the cards that list items across environments: the [Stacks](stacks.md), [Containers](containers.md), [Updates](updates.md), [Schedules](schedules.md) and [Overview](overview.md) cards. [All cards](../../README.md#cards)

## Choosing environments

Every multi-environment card (Stacks, Containers, Updates, Schedules and Overview) has the same **Environments** section in its editor:

- **Drag** to reorder — sets the order of environment groups
- **Eye icon** to include or leave out one environment
- **Target icon** to show only that environment
- **Show all / Clear** to include every environment, or start from none

## Filtering lists

The Stacks, Containers, Updates and Schedules cards have a **Filters** section in their editors. Each filter takes one or more values (a row matching any of them shows) and can be flipped to **is not**; set several filters and a row has to pass them all. For example, failed containers that aren't in a stack:

```yaml
filters:
  state: [exited_error, dead]
  stack: ["(none)"] # not in a stack
  tags: { not: [infra] } # "is not"
```

**Always show problems**, under the filters on the Containers, Stacks and Schedules cards, keeps a row in view whatever the filters say when something's wrong with it, so you can filter out the routine rows without missing a failure. For example, hiding Git sync schedules except when one fails is **Type** is not Git sync, with **Always show problems** on. What counts as a problem:

- **Containers** (`always_show_problems: true`): exited with an error (a non-zero exit code; ha-dockhand 2.0.0), dead, restarting, or unhealthy.
- **Stacks**: stopped, partly running, restarting, or its Git sync failed.
- **Schedules**: its last run failed.

| Card | Filter | Values |
| --- | --- | --- |
| Containers | `state` | `running`, `paused`, `restarting`, `created`, `exited_ok`, `exited_error`, `dead` (the exited ones need ha-dockhand 2.0.0's `exit_code`) |
| | `health` | `healthy`, `unhealthy`, `starting`, `(none)` for no health check |
| | `stack` | a stack name, or `(none)` for containers not in a stack |
| | `update` | `up_to_date`, `installable`, `tag` (newer tag), `pinned` (pinned digest), `held` |
| | `tags` | a Dockhand tag, or `(none)` |
| Stacks | `status` | `running`, `partial`, `restarting`, `stopped`, `created` |
| | `type` | `internal`, `git`, `untracked` |
| | `updates` | `available`, `none` |
| | `git_sync` | `synced`, `syncing`, `pending`, `error` |
| | `tags` | a Dockhand tag, or `(none)` |
| Updates | `update`, `stack`, `tags` | as on the Containers card |
| Schedules | `type` | a Dockhand schedule type, such as `container_update` or `image_prune` |
| | `last_result` | `success`, `failed`, `warning`, `error`, `running`, `queued`, `skipped`, `cancelled`, `stale`, or `(none)` for never run |
| | `enabled` | `enabled`, `disabled` |
| | `origin` | `system` (Dockhand's own), `user` |
| | `scope` | `environment`, `global` |

A filtered card says when nothing matches, and shows how many rows filters hide unless `show_filtered_count: false`. In the Overview card, filters are set per section like its other settings.
