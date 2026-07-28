# Versioning policy

The canonical semver policy for this repo lives in `ha-dockhand`, the primary repo these cards
depend on:
[`ha-dockhand/docs/SEMVER.md`](https://github.com/raetha/ha-dockhand/blob/main/docs/SEMVER.md).
Read that first — this file only covers what's specific to `ha-dockhand-cards` and isn't already
said there.

## Cards-specific major/minor/patch notes

Everything below is this repo's version of the same major/minor/patch split the canonical policy
defines — nothing here overrides it, just makes it concrete for cards-only concerns the shared
doc can't know about:

- **Major:** renaming a card's `type` string, removing a card, renaming/removing a YAML config
  key *without* a working backward-compatible fallback for it, or dropping support for an
  entity/attribute shape a released version currently reads. (Already listed in the canonical
  doc's ha-dockhand-cards section — repeated here so this file is a complete quick-reference on
  its own, not because the rule differs.) A rename *with* a genuine, verified, unconditional
  fallback — the old key keeps working indefinitely, and normal editor use migrates a config to
  the new key on its own — is minor instead; see the canonical doc for the full reasoning. First
  real case of this: `environment_overrides`/`environment_order` renamed to
  `environments_overrides`/`environments_order` in 1.1.0 (see `CHANGELOG.md`) — old configs keep
  reading correctly forever via `getEnvironmentOverrides()`/`getEnvironmentOrder()`, and the
  editor's `setConfig()` migrates to the new keys unconditionally the moment it loads.
- **Not breaking, but coordinate a release:** ha-dockhand renaming a `translation_key` this repo
  depends on. From this repo's side that shows up as entities silently stopping resolving, not a
  compile-time break — bump at least minor here too when picking up a
  `translation_key` rename from the other side, and call out the required ha-dockhand version in
  `CHANGELOG.md`.
- **Minor:** a new card, a new optional YAML config key or editor field, new locale coverage.
- **Patch:** bug fixes, cosmetic-only fixes (e.g. a color/spacing correction with no behavior
  change), translation fill-ins for already-covered keys, docs.

## `dist/` isn't versioned independently

`dist/ha-dockhand-cards.js` is built fresh per release (see `CONTRIBUTING.md`'s "Releasing"
section) and only ever exists at the `package.json` version it was built from — there's no
separate build-number or dist-specific versioning scheme to track here.
