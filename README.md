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
- Fixed or independently scaled tabulated n,k.
- Coherent single-film TMM with incoherent substrate returns.
- Deterministic Halton screening and bounded Nelder–Mead refinement in a Web Worker.
- Local JSON and CSV export.

The current release deliberately excludes Tauc–Lorentz, Gaussian, Cody–Lorentz and Drude models. These require a separate parity-validation phase against the Python reference implementation.
