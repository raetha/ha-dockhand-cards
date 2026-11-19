/** Every card and editor, registered under its real name (the Overview
 * card creates the others by name, and its editor embeds theirs). */
import { DockhandEnvironmentCard } from './dockhand-environment-card/card';
import { DockhandVulnerabilityCard } from './dockhand-vulnerability-card/card';
import { DockhandStackCard } from './dockhand-stack-card/card';
import { DockhandContainerCard } from './dockhand-container-card/card';
import { DockhandStacksCard } from './dockhand-stacks-card/card';
import { DockhandContainersCard } from './dockhand-containers-card/card';
import { DockhandUpdatesCard } from './dockhand-updates-card/card';
import { DockhandSchedulesCard } from './dockhand-schedules-card/card';
import { DockhandOverviewCard } from './dockhand-overview-card/card';
import { DockhandEnvironmentCardEditor } from './dockhand-environment-card/editor';
import { DockhandVulnerabilityCardEditor } from './dockhand-vulnerability-card/editor';
import { DockhandStackCardEditor } from './dockhand-stack-card/editor';
import { DockhandContainerCardEditor } from './dockhand-container-card/editor';
import { DockhandStacksCardEditor } from './dockhand-stacks-card/editor';
import { DockhandContainersCardEditor } from './dockhand-containers-card/editor';
import { DockhandUpdatesCardEditor } from './dockhand-updates-card/editor';
import { DockhandSchedulesCardEditor } from './dockhand-schedules-card/editor';
import { DockhandOverviewCardEditor } from './dockhand-overview-card/editor';

export const CARDS = {
  environment: DockhandEnvironmentCard,
  vulnerability: DockhandVulnerabilityCard,
  stack: DockhandStackCard,
  container: DockhandContainerCard,
  stacks: DockhandStacksCard,
  containers: DockhandContainersCard,
  updates: DockhandUpdatesCard,
  schedules: DockhandSchedulesCard,
  overview: DockhandOverviewCard
} as const;
export type Card = keyof typeof CARDS;

export const EDITORS: Record<Card, CustomElementConstructor> = {
  environment: DockhandEnvironmentCardEditor,
  vulnerability: DockhandVulnerabilityCardEditor,
  stack: DockhandStackCardEditor,
  container: DockhandContainerCardEditor,
  stacks: DockhandStacksCardEditor,
  containers: DockhandContainersCardEditor,
  updates: DockhandUpdatesCardEditor,
  schedules: DockhandSchedulesCardEditor,
  overview: DockhandOverviewCardEditor
};

// Registered under the real names: the Overview card creates the others by
// name, and its editor embeds the other editors.
for (const [card, cls] of Object.entries(CARDS)) {
  if (!customElements.get(`dockhand-${card}-card`)) customElements.define(`dockhand-${card}-card`, cls as unknown as CustomElementConstructor);
}
for (const [card, cls] of Object.entries(EDITORS)) {
  if (!customElements.get(`dockhand-${card}-card-editor`)) customElements.define(`dockhand-${card}-card-editor`, cls);
}


