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
- Deterministic Halton screening and bounded Nelder–Mead refinement in a Web Worker, with logarithmic sampling for broad positive parameters.
- Local JSON and CSV export.

Every dielectric model is checked against fixed values produced by the Python/SciPy reference implementation. The browser fit remains a diagnostic estimator: thickness, optical constants, and channel gains may be correlated and should not be interpreted as independently identified without sensitivity analysis.
