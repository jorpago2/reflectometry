# Reflectometry

Static browser tool for calibrated reflectance/transmittance fitting of coherent single-film and multilayer stacks on an optically thick substrate.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:4173` for the validated single-layer workflow or `http://localhost:4173/multilayer.html` for the generic layer-stack editor. Run the numerical checks with `npm test`.

## Current scope

- Local TXT parsing and SHA-256 provenance.
- Background/SNR filtering and non-overlapping median binning of raw counts before R/T normalization.
- Fixed, independently scaled, or constant n,k models.
- Causal one/two-oscillator Tauc–Lorentz, Tauc–Lorentz + Gaussian, Cody–Lorentz, and Drude + Tauc–Lorentz models.
- Coherent transfer-matrix solver for up to 12 layers, with incoherent rear-surface substrate returns and single-film equivalence checks.
- Independent optical model, material preset, n,k table, thickness, bounds, and fit selection for every layer; layers can be added, removed, and reordered.
- Independent additive dielectric components per layer: up to two Tauc–Lorentz oscillators plus Gaussian, Cody–Lorentz, and Drude terms sharing one ε∞ without double counting.
- Generic multilayer JSON, spectra CSV, and layer-resolved n,k CSV exports.
- Configurable SciPy-compatible scrambled Sobol screening (seed 1729, 64–4096 points) and 1–50 bounded robust trust-region reflective refinements in a Web Worker, with Jacobian scaling and logarithmic screening for broad positive parameters.
- Dynamic causal-model seeding from any loaded 300–1100 nm ellipsometry table; bundled Python/SciPy seeds remain reproducible references.
- Optional affine spectral-shape residuals and n,k regularization toward local ellipsometry, matching the Python objective definition.
- Measured/model n,k overlays and wavelength-resolved R/T residual plots.
- Joint R/T gain calibration across bundled samples or multiple local samples stored in the current browser session, with one independent film thickness per material.
- Local identifiability, per-parameter approximate uncertainty, bound, gain, energy-balance, wavelength-band, convergence, and ranked distinct-minimum diagnostics.
- Keyboard/pointer wavelength zoom and pan, reset controls, and PNG export for every chart.
- Reproducible JSON, full spectra CSV, and dedicated optical-constants CSV export.
- Integrated scientific FAQ covering assumptions, priors, non-uniqueness, and reproducibility.

Every dielectric model and every bundled fixed-table dataset are checked against fixed values produced by the Python/SciPy reference implementation. The browser fit remains a diagnostic estimator: finite-difference uncertainties are local approximations and do not replace experimental uncertainty propagation.
