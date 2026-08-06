# Design — Reflectometry

Carbon Design System v11 is the visual and interaction contract for this application.

## Stack

- Components: `@carbon/react`.
- Icons: `@carbon/react/icons`.
- Styling: Carbon Sass and `--cds-*` tokens.
- Typography: IBM Plex Sans and IBM Plex Mono.

## Interface rules

- Use Carbon components before adding custom controls.
- Use Carbon spacing, colour, focus, motion, typography and square geometry.
- Keep the configuration in Carbon vertical tabs; Carbon converts them to contained horizontal tabs on small screens.
- Keep results in Carbon contained tabs: Overview, Fit quality and Optical constants.
- Put secondary scientific controls behind native disclosures when their content must remain mounted.
- Custom CSS is limited to the scientific workbench layout, dense parameter editors, stack diagram and plots.

## Functional contract

The calculation engine queries controls by `id` during startup. Those elements must keep their IDs and remain in the DOM while hidden tabs are inactive. Carbon `TabPanel` satisfies that requirement by toggling `hidden` without unmounting its contents.
