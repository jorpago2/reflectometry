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
- Fixed, independently scaled, constant, Cauchy–Urbach, Sellmeier, Forouhi–Bloomer, and five-knot Kramers–Kronig B-spline models.
- Independent additive dielectric components: 0–5 Tauc–Lorentz and 0–5 Lorentz oscillators plus Gaussian, Cody–Lorentz, Drude, Drude–Smith, Brendel–Bormann, and critical-point terms.
- Bruggeman and Maxwell–Garnett effective-medium models using two user-supplied n,k tables.
- Coherent transfer-matrix solver with a uniform complex substrate index, Beer–Lambert substrate absorption, incoherent rear-surface returns, and either-side illumination.
- Optional affine spectral-shape residuals and n,k regularization.
- Scrambled Sobol screening followed by bounded robust trust-region reflective refinement in a Web Worker.
- Local identifiability, approximate uncertainty, bound, convergence, alternative-minimum, and energy-balance diagnostics.
- Reproducible JSON fit export/import, spectra CSV, and layer-resolved n,k CSV exports. Current JSON files embed the raw measurement, stack, n,k tables, fitted values, bounds, and controls; v5/v6 files remain importable with their original limitations.
- A deterministic browser-generated synthetic stack for immediate testing; no material-specific presets or bundled measurement datasets.

The inverse fit is a diagnostic estimator. Approximate local uncertainties do not replace experimental uncertainty propagation, and model parameters may remain non-identifiable from R/T data alone.
