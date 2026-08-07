/**
 * Stable integration points between the scientific controller and the UI.
 *
 * The calculation code must depend on this contract, not on CSS classes or
 * component structure. A future Carbon UI can therefore replace the current
 * view without changing the scientific model.
 */
export const SCIENTIFIC_ELEMENT_IDS = [
  "status", "status-indicator", "fit-progress", "cancel-operation",
  "fit-button", "preview-button", "bootstrap-button", "reset-example",
  "load-files", "saved-fit-file", "add-layer", "undo-button", "redo-button",
  "layers", "substrate-editor", "fit-count", "results-content", "results-empty",
  "report-meta", "rt-chart", "nk-chart", "residual-chart", "stack-layers",
  "stack-substrate-index", "stack-direction", "stack-arrow",
] as const;

export type ScientificElementId = (typeof SCIENTIFIC_ELEMENT_IDS)[number];

export function getScientificElement<T extends HTMLElement = HTMLElement>(id: ScientificElementId): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Scientific UI contract is missing #${id}.`);
  return element as T;
}
