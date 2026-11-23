import { html, nothing, type TemplateResult } from 'lit';

/** A Dockhand's host as a pill, after an environment's name, when that
 * name repeats across Dockhands (EnvironmentDeviceOption.instance);
 * nothing otherwise. In a row, RowFitController leaves it out last. */
export function renderInstancePill(instance: string | null | undefined): TemplateResult | typeof nothing {
  return instance ? html`<span class="label-pill name-label instance-label">${instance}</span>` : nothing;
}
