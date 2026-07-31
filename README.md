# Reflectometry

Static browser tool for calibrated reflectance/transmittance fitting of a coherent thin film on an optically thick substrate.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:4173`. Run the numerical checks with `npm test`.

## Current scope

- Local TXT parsing and SHA-256 provenance.
- Background/SNR filtering and non-overlapping median binning of raw counts before R/T normalization.
- Fixed, independently scaled, or constant n,k models.
- Causal one/two-oscillator Tauc–Lorentz, Tauc–Lorentz + Gaussian, Cody–Lorentz, and Drude + Tauc–Lorentz models.
- Coherent single-film TMM with incoherent substrate returns.
- SciPy-compatible scrambled Sobol screening (seed 1729, 512 points) and 16 bounded robust trust-region reflective refinements in a Web Worker, with Jacobian scaling and logarithmic screening for broad positive parameters.
- Optional affine spectral-shape residuals and n,k regularization toward local ellipsometry, matching the Python objective definition.
- Measured/model n,k overlays and wavelength-resolved R/T residual plots.
- Joint R/T gain calibration across bundled samples, with one independent film thickness per material.
- Local identifiability, approximate parameter uncertainty, bound, gain, energy-balance, and ranked distinct-minimum diagnostics.
- Reproducible JSON, full spectra CSV, and dedicated optical-constants CSV export.
- Integrated scientific FAQ covering assumptions, priors, non-uniqueness, and reproducibility.

Every dielectric model and every bundled fixed-table dataset are checked against fixed values produced by the Python/SciPy reference implementation. The browser fit remains a diagnostic estimator: finite-difference uncertainties are local approximations and do not replace experimental uncertainty propagation.
