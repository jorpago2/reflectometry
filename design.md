# Design — Reflectometry

## Interface contract (normative)

Carbon Design System v11 is the visual and interaction contract. React is the sole owner of rendered structure, form values, visibility, ARIA attributes and interaction handlers.

The scientific runtime is DOM-independent. It exposes a subscribable state snapshot and stable actions for loading, editing, previewing, fitting, bootstrapping, history and export. Components never relay actions through hidden controls or global custom events.

## Stack

- Components: `@carbon/react`.
- Icons: `@carbon/react/icons`.
- Styling: Carbon Sass and `--cds-*` tokens.
- Typography: IBM Plex Sans throughout, including scientific values and charts.
- Shell and layout: the Carbon-based `scientific-ui` shell with product-specific workspace composition.

## Interface rules

- Use Carbon components before adding custom controls.
- Use Carbon spacing, colour, focus, motion, typography and square geometry.
- Use one configuration rail with Carbon buttons. On smaller screens it becomes the fixed bottom navigation.
- Open one React task panel for Measurement, Layer stack or Fit; do not mount duplicate controls for header, panel and results actions.
- Keep results in Carbon contained tabs: Overview, Fit quality and Optical constants.
- Overview contains only the physical stack and the combined reflectance/transmittance plot.
- On mobile, the open configuration panel owns the available workspace; do not expose a competing nested stage scroll.
- Use Carbon accordions for secondary scientific controls and model guidance.
- Keep material editors compact and reserve the primary button style for fitting.
- Use compact status feedback and a Carbon overflow menu for exports.
- Custom CSS is limited to the scientific workbench layout, dense parameter editors, stack diagram and plots.

## Functional contract

- Loading a measurement never calculates a preview implicitly.
- Configuration edits preserve the previous valid result and mark it stale until the user previews or fits again.
- The runtime owns only scientific/application state and the worker lifecycle. Plotly is isolated behind a React `ref`/effect in `PlotCard`.
- Autosave receives a serializable editor snapshot from the runtime and restores it through a runtime action.
