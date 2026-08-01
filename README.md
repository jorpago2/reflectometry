# Reflectometry

Material-agnostic static browser tool for calibrated reflectance/transmittance fitting of coherent multilayer stacks on a finite phase-incoherent substrate.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:4173`; it redirects to the only application, the generic multilayer editor. Run the numerical checks with `npm test`.

## Current scope

- Local TXT parsing, background/SNR filtering, and non-overlapping median binning before R/T normalization.
- Generic reflectance and transmittance reference signals plus a tabulated reference-reflectance spectrum.
- Up to 12 coherent homogeneous isotropic layers with independent model, n,k table, thickness, bounds, and fit selection.
- Fixed, independently scaled, constant, Cauchy?Urbach, Sellmeier, Forouhi?Bloomer, and five-knot Kramers?Kronig B-spline models.
- Independent additive dielectric components: 0?5 Tauc?Lorentz and 0?5 Lorentz oscillators plus Gaussian, Cody?Lorentz, Drude, Drude?Smith, Brendel?Bormann, and critical-point terms.
- Bruggeman and Maxwell?Garnett effective-medium models using two user-supplied n,k tables.
- Coherent transfer-matrix solver with a finite phase-incoherent dispersive substrate, Beer?Lambert absorption, incoherent rear-surface returns, and either-side illumination. The substrate accepts every generic optical model or a tabulated n,k spectrum.
- Optional affine spectral-shape residuals and n,k regularization.
- Scrambled Sobol screening followed by bounded robust trust-region reflective refinement in a Web Worker.
- Local identifiability, covariance correlation, approximate 95% intervals, reproducible residual-bootstrap bands, bound, convergence, alternative-minimum, and energy-balance diagnostics.
- Layer duplication, cross-layer parameter links, 30-step undo/redo, selectable alternative solutions, and printable reports.
- Reproducible JSON fit export/import, spectra CSV, and material-resolved n,k CSV exports. Current JSON files embed the raw measurement, stack, dispersive substrate, links, n,k tables, fitted values, bounds, controls, and uncertainty results; v5?v7 files remain importable with their original limitations.
- A deterministic browser-generated synthetic stack for immediate testing; no material-specific presets or bundled measurement datasets.

The inverse fit is a diagnostic estimator. Approximate local uncertainties do not replace experimental uncertainty propagation, and model parameters may remain non-identifiable from R/T data alone.

## Citation

If you use this software in a scientific publication, please cite the exact version used. Citation metadata are provided in [`CITATION.cff`](CITATION.cff); GitHub's **Cite this repository** menu exports them in BibTeX and APA formats.
