const reference = (citation: string, doi: string) => ({ citation, doi });

const REFERENCES = {
  opticalData: reference("M. N. Polyanskiy, Refractiveindex.info database of optical constants, Scientific Data 11 (2024).", "10.1038/s41597-023-02898-2"),
  cauchy: reference("S. Hajduk, H. Bednarski, and B. Trzebicka, Temperature-Dependent Spectroscopic Ellipsometry of Thin Polymer Films, J. Phys. Chem. B 124, 3229–3251 (2020).", "10.1021/acs.jpcb.9b11863"),
  sellmeier: reference("B. Tatian, Fitting refractive-index data with the Sellmeier dispersion formula, Applied Optics 23, 4477 (1984).", "10.1364/AO.23.004477"),
  forouhiBloomer: reference("A. R. Forouhi and I. Bloomer, Optical dispersion relations for amorphous semiconductors and amorphous dielectrics, Phys. Rev. B 34, 7018–7026 (1986).", "10.1103/PhysRevB.34.7018"),
  taucLorentz: reference("G. E. Jellison Jr. and F. A. Modine, Parameterization of the optical functions of amorphous materials in the interband region, Appl. Phys. Lett. 69, 371–373 (1996).", "10.1063/1.118064"),
  codyLorentz: reference("A. Ferlauto et al., Analytical model for the optical functions of amorphous semiconductors from the near-infrared to ultraviolet, J. Appl. Phys. 92, 2424–2436 (2002).", "10.1063/1.1497462"),
  gaussian: reference("M. R. Morris et al., Developing an Analysis Procedure and Dispersion Model for Pristine and W-Doped VO₂ Thin Films, ACS Appl. Mater. Interfaces 16, 68621–68631 (2024).", "10.1021/acsami.4c15356"),
  brendelBormann: reference("R. Brendel and D. Bormann, An infrared dielectric function model for amorphous solids, J. Appl. Phys. 71, 1–6 (1992).", "10.1063/1.350737"),
  drude: reference("P. Drude, Zur Elektronentheorie der Metalle, Annalen der Physik 306, 566–613 (1900).", "10.1002/andp.19003060312"),
  drudeSmith: reference("N. V. Smith, Classical generalization of the Drude formula for the optical conductivity, Phys. Rev. B 64, 155106 (2001).", "10.1103/PhysRevB.64.155106"),
  adachi: reference("S. Adachi, Model dielectric constants of GaP, GaAs, GaSb, InP, InAs, and InSb, Phys. Rev. B 35, 7454–7463 (1987).", "10.1103/PhysRevB.35.7454"),
  kuzmenko: reference("A. B. Kuzmenko, Kramers–Kronig constrained variational analysis of optical spectra, Rev. Sci. Instrum. 76, 083108 (2005).", "10.1063/1.1979470"),
  bspline: reference("B. Johs and J. S. Hale, Dielectric function representation by B-splines, phys. status solidi (a) 205, 715–719 (2008).", "10.1002/pssa.200777754"),
  bruggeman: reference("D. A. G. Bruggeman, Berechnung verschiedener physikalischer Konstanten von heterogenen Substanzen I, Annalen der Physik 416, 636–664 (1935).", "10.1002/andp.19354160705"),
  maxwellGarnett: reference("J. C. Maxwell Garnett, Colours in metal glasses and in metallic films, Phil. Trans. R. Soc. A 203, 385–420 (1904).", "10.1098/rsta.1904.0024"),
};

const equation = (label: string, mathml: string) => ({ label, mathml });

const TL_EQUATION = equation(
  "Tauc–Lorentz imaginary permittivity and its Kramers–Kronig real part",
  "<mrow><msub><mi>ε</mi><mn>2</mn></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mfrac><mrow><mi>A</mi><msub><mi>E</mi><mn>0</mn></msub><mi>C</mi><msup><mrow><mo>(</mo><mi>E</mi><mo>−</mo><msub><mi>E</mi><mi>g</mi></msub><mo>)</mo></mrow><mn>2</mn></msup></mrow><mrow><mi>E</mi><mo>[</mo><msup><mrow><mo>(</mo><msup><mi>E</mi><mn>2</mn></msup><mo>−</mo><msubsup><mi>E</mi><mn>0</mn><mn>2</mn></msubsup><mo>)</mo></mrow><mn>2</mn></msup><mo>+</mo><msup><mi>C</mi><mn>2</mn></msup><msup><mi>E</mi><mn>2</mn></msup><mo>]</mo></mrow></mfrac><mo>,</mo></mtd><mtd><mi>E</mi><mo>&gt;</mo><msub><mi>E</mi><mi>g</mi></msub></mtd></mtr><mtr><mtd><mn>0</mn><mo>,</mo></mtd><mtd><mi>E</mi><mo>≤</mo><msub><mi>E</mi><mi>g</mi></msub></mtd></mtr></mtable></mrow><mspace width=\"1em\"></mspace><msub><mi>ε</mi><mn>1</mn></msub><mo>=</mo><msub><mi>ε</mi><mi>∞</mi></msub><mo>+</mo><mi mathvariant=\"normal\">KK</mi><mo>[</mo><msub><mi>ε</mi><mn>2</mn></msub><mo>]</mo></mrow>",
);

const GAUSSIAN_EQUATION = equation(
  "Causal Gaussian oscillator",
  "<mrow><msub><mi>ε</mi><mn>2</mn></msub><mo>=</mo><mi>A</mi><mo>[</mo><msup><mi>e</mi><mrow><mo>−</mo><msup><mrow><mi>q</mi><mo>(</mo><mi>E</mi><mo>−</mo><msub><mi>E</mi><mn>0</mn></msub><mo>)</mo></mrow><mn>2</mn></msup></mrow></msup><mo>−</mo><msup><mi>e</mi><mrow><mo>−</mo><msup><mrow><mi>q</mi><mo>(</mo><mi>E</mi><mo>+</mo><msub><mi>E</mi><mn>0</mn></msub><mo>)</mo></mrow><mn>2</mn></msup></mrow></msup><mo>]</mo><mo>,</mo><mspace width=\".6em\"></mspace><mi>q</mi><mo>=</mo><mfrac><mrow><mn>2</mn><msqrt><mrow><mi>ln</mi><mn>2</mn></mrow></msqrt></mrow><mi>FWHM</mi></mfrac><mo>,</mo><mspace width=\".6em\"></mspace><msub><mi>ε</mi><mn>1</mn></msub><mo>=</mo><mi mathvariant=\"normal\">KK</mi><mo>[</mo><msub><mi>ε</mi><mn>2</mn></msub><mo>]</mo></mrow>",
);

export const MODEL_GUIDES = {
  fixed: {
    summary: "Uses a measured or published wavelength table directly, with linear interpolation onto the measurement grid.",
    equation: equation("Tabulated complex refractive index", "<mrow><mi>N</mi><mo>(</mo><mi>λ</mi><mo>)</mo><mo>=</mo><mi mathvariant=\"normal\">interp</mi><mo>[</mo><msub><mi>n</mi><mi>tab</mi></msub><mo>(</mo><mi>λ</mi><mo>)</mo><mo>+</mo><mi>i</mi><msub><mi>k</mi><mi>tab</mi></msub><mo>(</mo><mi>λ</mi><mo>)</mo><mo>]</mo></mrow>"),
    represents: "Measured optical constants of any isotropic material when the table covers the fitted wavelength range.",
    limitation: "Interpolation is not a physical extrapolation model and does not enforce causality outside the supplied data.",
    references: [REFERENCES.opticalData],
  },
  scaled: {
    summary: "Applies independent multiplicative corrections to a tabulated real index and extinction coefficient.",
    equation: equation("Scaled tabulated refractive index", "<mrow><mi>N</mi><mo>(</mo><mi>λ</mi><mo>)</mo><mo>=</mo><msub><mi>s</mi><mi>n</mi></msub><msub><mi>n</mi><mi>tab</mi></msub><mo>(</mo><mi>λ</mi><mo>)</mo><mo>+</mo><mi>i</mi><msub><mi>s</mi><mi>k</mi></msub><msub><mi>k</mi><mi>tab</mi></msub><mo>(</mo><mi>λ</mi><mo>)</mo></mrow>"),
    represents: "Small density, composition, calibration, or sample-to-sample changes relative to a trusted n,k spectrum.",
    limitation: "Large scale factors can distort a causal spectrum; use a physical dispersion model for broadband extrapolation.",
    references: [REFERENCES.opticalData],
  },
  constant: {
    summary: "Assumes wavelength-independent n and k over the fitted interval.",
    equation: equation("Constant complex refractive index", "<mrow><mi>N</mi><mo>(</mo><mi>λ</mi><mo>)</mo><mo>=</mo><mi>n</mi><mo>+</mo><mi>i</mi><mi>k</mi></mrow>"),
    represents: "A narrow spectral window with weak dispersion, or a deliberately minimal baseline model.",
    limitation: "A constant absorbing index is not a causal broadband material model.",
    references: [REFERENCES.opticalData],
  },
  composite: {
    summary: "Builds one dielectric function by adding independently selected bound-electron, absorption-edge, free-carrier, and critical-point contributions.",
    equation: equation("Additive composite dielectric function", "<mrow><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><msub><mi>ε</mi><mi>∞</mi></msub><mo>+</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mi>M</mi></munderover><mi>Δ</mi><msub><mi>ε</mi><mi>j</mi></msub><mo>(</mo><mi>E</mi><mo>)</mo></mrow>"),
    represents: "Generic spectra containing several independent interband transitions, disorder-broadened bands, and/or free carriers.",
    limitation: "Additive components can be strongly correlated; fit only parameters supported by the measured bandwidth.",
    references: [REFERENCES.taucLorentz, REFERENCES.codyLorentz, REFERENCES.drudeSmith],
  },
  cauchy: {
    summary: "An empirical transparent-region dispersion with an optional exponential Urbach absorption tail.",
    equation: equation("Cauchy dispersion with Urbach extinction", "<mrow><mi>n</mi><mo>(</mo><mi>λ</mi><mo>)</mo><mo>=</mo><mi>A</mi><mo>+</mo><mfrac><mi>B</mi><msup><mi>λ</mi><mn>2</mn></msup></mfrac><mo>+</mo><mfrac><mi>C</mi><msup><mi>λ</mi><mn>4</mn></msup></mfrac><mo>,</mo><mspace width=\"1em\"></mspace><mi>k</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><msub><mi>k</mi><mn>0</mn></msub><mi>exp</mi><mo>[</mo><mfrac><mrow><mi>E</mi><mo>−</mo><msub><mi>E</mi><mi>ref</mi></msub></mrow><msub><mi>E</mi><mi>U</mi></msub></mfrac><mo>]</mo></mrow>"),
    represents: "Transparent or weakly absorbing dielectrics, polymers, oxides, and thin films below their main electronic absorption edge.",
    limitation: "Phenomenological and valid only over a limited transparent/near-edge range; it is not globally Kramers–Kronig constrained.",
    references: [REFERENCES.cauchy],
  },
  sellmeier: {
    summary: "Represents transparent dispersion through three resonance poles.",
    equation: equation("Three-term Sellmeier dispersion", "<mrow><msup><mi>n</mi><mn>2</mn></msup><mo>(</mo><mi>λ</mi><mo>)</mo><mo>=</mo><mn>1</mn><mo>+</mo><munderover><mo>∑</mo><mrow><mi>j</mi><mo>=</mo><mn>1</mn></mrow><mn>3</mn></munderover><mfrac><mrow><msub><mi>B</mi><mi>j</mi></msub><msup><mi>λ</mi><mn>2</mn></msup></mrow><mrow><msup><mi>λ</mi><mn>2</mn></msup><mo>−</mo><msub><mi>C</mi><mi>j</mi></msub></mrow></mfrac><mo>,</mo><mspace width=\".8em\"></mspace><mi>k</mi><mo>=</mo><mn>0</mn></mrow>"),
    represents: "Transparent glasses, crystals, and dielectric films away from absorption bands.",
    limitation: "Do not fit across a pole or an absorbing band; this implementation fixes k = 0.",
    references: [REFERENCES.sellmeier],
  },
  "forouhi-bloomer": {
    summary: "A closed-form amorphous-material dispersion relating absorption above a gap to the real refractive index.",
    equation: equation("Forouhi–Bloomer optical functions", "<mrow><mi>k</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mfrac><mrow><mi>A</mi><msup><mrow><mo>(</mo><mi>E</mi><mo>−</mo><msub><mi>E</mi><mi>g</mi></msub><mo>)</mo></mrow><mn>2</mn></msup></mrow><mrow><msup><mi>E</mi><mn>2</mn></msup><mo>−</mo><mi>B</mi><mi>E</mi><mo>+</mo><mi>C</mi></mrow></mfrac><mo>,</mo></mtd><mtd><mi>E</mi><mo>&gt;</mo><msub><mi>E</mi><mi>g</mi></msub></mtd></mtr><mtr><mtd><mn>0</mn><mo>,</mo></mtd><mtd><mi>E</mi><mo>≤</mo><msub><mi>E</mi><mi>g</mi></msub></mtd></mtr></mtable></mrow><mspace width=\".8em\"></mspace><mi>n</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><msub><mi>n</mi><mi>∞</mi></msub><mo>+</mo><mfrac><mrow><msub><mi>B</mi><mn>0</mn></msub><mi>E</mi><mo>+</mo><msub><mi>C</mi><mn>0</mn></msub></mrow><mrow><msup><mi>E</mi><mn>2</mn></msup><mo>−</mo><mi>B</mi><mi>E</mi><mo>+</mo><mi>C</mi></mrow></mfrac></mrow>"),
    represents: "Amorphous semiconductors and dielectrics with a broad interband absorption edge.",
    limitation: "A compact phenomenological parameterization; verify it against a causal model when extrapolation matters.",
    references: [REFERENCES.forouhiBloomer],
  },
  "kk-spline": {
    summary: "Fits non-negative ε₂ at five energy knots and obtains ε₁ from the Kramers–Kronig transform.",
    equation: equation("Kramers–Kronig constrained B-spline", "<mrow><msub><mi>ε</mi><mn>2</mn></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><munderover><mo>∑</mo><mi>j</mi><mn>5</mn></munderover><msub><mi>a</mi><mi>j</mi></msub><msub><mi>B</mi><mi>j</mi></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>,</mo><mspace width=\".7em\"></mspace><msub><mi>ε</mi><mn>1</mn></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><msub><mi>ε</mi><mi>∞</mi></msub><mo>+</mo><mfrac><mn>2</mn><mi>π</mi></mfrac><mi mathvariant=\"normal\">P</mi><mo>∫</mo><mfrac><mrow><mi>ξ</mi><msub><mi>ε</mi><mn>2</mn></msub><mo>(</mo><mi>ξ</mi><mo>)</mo></mrow><mrow><msup><mi>ξ</mi><mn>2</mn></msup><mo>−</mo><msup><mi>E</mi><mn>2</mn></msup></mrow></mfrac><mi>d</mi><mi>ξ</mi></mrow>"),
    represents: "Broad or overlapping absorption features when a named oscillator model is too restrictive.",
    limitation: "This implementation has fixed knots from 0.50 to 5.00 eV and a finite 0–30 eV KK integration window.",
    references: [REFERENCES.kuzmenko, REFERENCES.bspline],
  },
  ema: {
    summary: "Converts tabulated host and inclusion optical constants to an effective isotropic permittivity.",
    equation: equation("Generic effective medium condition", "<mrow><mi>ε</mi><mo>=</mo><msup><mi>N</mi><mn>2</mn></msup><mo>,</mo><mspace width=\".8em\"></mspace><msub><mi>ε</mi><mi>eff</mi></msub><mo>=</mo><mi mathvariant=\"normal\">mix</mi><mo>(</mo><msub><mi>ε</mi><mi>host</mi></msub><mo>,</mo><msub><mi>ε</mi><mi>inc</mi></msub><mo>,</mo><mi>f</mi><mo>)</mo></mrow>"),
    represents: "Porous films, roughness layers, nanocomposites, or two-phase mixtures whose feature size is much smaller than the wavelength.",
    limitation: "Assumes homogeneous isotropic subwavelength mixing; morphology, anisotropy, scattering, and finite particle size are not resolved.",
    references: [REFERENCES.bruggeman, REFERENCES.maxwellGarnett],
  },
  tl1: {
    summary: "A causal absorption-edge model formed by a Tauc joint-density-of-states onset and one Lorentz oscillator.",
    equation: TL_EQUATION,
    represents: "Amorphous semiconductors, amorphous oxides, chalcogenides, and disordered films dominated by one interband band.",
    limitation: "It forces ε₂ = 0 below E_g and can miss Urbach or defect-state absorption.",
    references: [REFERENCES.taucLorentz],
  },
  tl2: {
    summary: "Adds two independently parameterized Tauc–Lorentz transitions that share one optical gap and one high-frequency background.",
    equation: equation("Two-oscillator Tauc–Lorentz dielectric function", "<mrow><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><msub><mi>ε</mi><mi>∞</mi></msub><mo>+</mo><mi>Δ</mi><msub><mi>ε</mi><mi>TL,1</mi></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>+</mo><mi>Δ</mi><msub><mi>ε</mi><mi>TL,2</mi></msub><mo>(</mo><mi>E</mi><mo>)</mo></mrow>"),
    represents: "Amorphous or disordered materials with two resolvable interband absorption bands.",
    limitation: "The shared gap is a model constraint; strongly correlated oscillators may not be identifiable from R/T alone.",
    references: [REFERENCES.taucLorentz],
  },
  "tl-gaussian": {
    summary: "Combines a causal Tauc–Lorentz absorption edge with a causal Gaussian band.",
    equation: equation("Tauc–Lorentz plus Gaussian dielectric function", "<mrow><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><msub><mi>ε</mi><mi>TL</mi></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>+</mo><mi>Δ</mi><msub><mi>ε</mi><mi>G</mi></msub><mo>(</mo><mi>E</mi><mo>)</mo></mrow>"),
    represents: "Disordered semiconductors, oxides, and molecular/organic films with an absorption edge plus a broader interband or excitonic feature.",
    limitation: "The Gaussian band is empirical; avoid assigning it to a microscopic transition without independent evidence.",
    references: [REFERENCES.taucLorentz, REFERENCES.gaussian],
  },
  cody: {
    summary: "A causal amorphous-semiconductor model with a Cody absorption onset, an Urbach tail, and a Lorentz-like interband band.",
    equation: equation("Cody–Lorentz imaginary permittivity", "<mrow><msub><mi>ε</mi><mn>2</mn></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mrow><mo>{</mo><mtable><mtr><mtd><mfrac><msub><mi>S</mi><mi>t</mi></msub><mi>E</mi></mfrac><mi>exp</mi><mo>[</mo><mfrac><mrow><mi>E</mi><mo>−</mo><msub><mi>E</mi><mi>t</mi></msub></mrow><msub><mi>E</mi><mi>U</mi></msub></mfrac><mo>]</mo><mo>,</mo></mtd><mtd><mi>E</mi><mo>≤</mo><msub><mi>E</mi><mi>t</mi></msub></mtd></mtr><mtr><mtd><mfrac><msup><mrow><mo>(</mo><mi>E</mi><mo>−</mo><msub><mi>E</mi><mi>g</mi></msub><mo>)</mo></mrow><mn>2</mn></msup><mrow><msup><mrow><mo>(</mo><mi>E</mi><mo>−</mo><msub><mi>E</mi><mi>g</mi></msub><mo>)</mo></mrow><mn>2</mn></msup><mo>+</mo><msubsup><mi>E</mi><mi>p</mi><mn>2</mn></msubsup></mrow></mfrac><mfrac><mrow><mi>A</mi><msub><mi>E</mi><mn>0</mn></msub><mi>γ</mi><mi>E</mi></mrow><mrow><msup><mrow><mo>(</mo><msup><mi>E</mi><mn>2</mn></msup><mo>−</mo><msubsup><mi>E</mi><mn>0</mn><mn>2</mn></msubsup><mo>)</mo></mrow><mn>2</mn></msup><mo>+</mo><msup><mi>γ</mi><mn>2</mn></msup><msup><mi>E</mi><mn>2</mn></msup></mrow></mfrac><mo>,</mo></mtd><mtd><mi>E</mi><mo>&gt;</mo><msub><mi>E</mi><mi>t</mi></msub></mtd></mtr></mtable></mrow></mrow>"),
    represents: "Hydrogenated amorphous silicon and related amorphous semiconductors with measurable sub-gap/Urbach absorption.",
    limitation: "Its numerical KK transform and several edge parameters require broad, high-SNR spectra to constrain reliably.",
    references: [REFERENCES.codyLorentz],
  },
  "drude-tl": {
    summary: "Adds free-carrier Drude response to a causal Tauc–Lorentz interband transition.",
    equation: equation("Drude plus Tauc–Lorentz dielectric function", "<mrow><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><msub><mi>ε</mi><mi>TL</mi></msub><mo>(</mo><mi>E</mi><mo>)</mo><mo>−</mo><mfrac><msubsup><mi>E</mi><mi>p</mi><mn>2</mn></msubsup><mrow><msup><mi>E</mi><mn>2</mn></msup><mo>+</mo><mi>i</mi><mi>γ</mi><mi>E</mi></mrow></mfrac></mrow>"),
    represents: "Conductive oxides, doped semiconductors, semimetals, and phase-change or metallic films with both free-carrier and interband absorption.",
    limitation: "A single Drude damping rate assumes spatially uniform, frequency-independent carrier scattering.",
    references: [REFERENCES.drude, REFERENCES.taucLorentz],
  },
};

export const COMPONENT_GUIDES = {
  taucLorentz: {
    title: "Tauc–Lorentz oscillator",
    summary: "Causal interband absorption with a hard optical gap.",
    equation: TL_EQUATION,
    represents: "Amorphous/disordered semiconductor or dielectric interband transitions.",
    references: [REFERENCES.taucLorentz],
  },
  lorentz: {
    title: "Lorentz oscillator",
    summary: "A damped bound-charge resonance.",
    equation: equation("Lorentz oscillator dielectric contribution", "<mrow><mi>Δ</mi><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mfrac><mrow><mi>S</mi><msubsup><mi>E</mi><mn>0</mn><mn>2</mn></msubsup></mrow><mrow><msubsup><mi>E</mi><mn>0</mn><mn>2</mn></msubsup><mo>−</mo><msup><mi>E</mi><mn>2</mn></msup><mo>−</mo><mi>i</mi><mi>γ</mi><mi>E</mi></mrow></mfrac></mrow>"),
    represents: "Bound-electron interband transitions, phonons, molecular vibrations, or excitonic bands with Lorentzian broadening.",
    references: [REFERENCES.brendelBormann],
  },
  gaussian: {
    title: "Causal Gaussian oscillator",
    summary: "A Gaussian absorption band paired with its Kramers–Kronig-consistent dispersive part.",
    equation: GAUSSIAN_EQUATION,
    represents: "Inhomogeneously broadened interband, excitonic, molecular, or disordered-state absorption bands.",
    references: [REFERENCES.gaussian],
  },
  cody: {
    title: "Cody–Lorentz component",
    summary: "A Cody onset with Urbach tail and causal Lorentz-like interband response.",
    equation: MODEL_GUIDES.cody.equation,
    represents: "Amorphous semiconductors with appreciable sub-gap disorder absorption.",
    references: [REFERENCES.codyLorentz],
  },
  drude: {
    title: "Drude component",
    summary: "A delocalized free-carrier response with one collision energy.",
    equation: equation("Drude dielectric contribution", "<mrow><mi>Δ</mi><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mo>−</mo><mfrac><msubsup><mi>E</mi><mi>p</mi><mn>2</mn></msubsup><mrow><msup><mi>E</mi><mn>2</mn></msup><mo>+</mo><mi>i</mi><mi>γ</mi><mi>E</mi></mrow></mfrac></mrow>"),
    represents: "Metals, transparent conductive oxides, and doped semiconductors with mobile carriers.",
    references: [REFERENCES.drude],
  },
  drudeSmith: {
    title: "Drude–Smith component",
    summary: "Extends Drude response with one carrier backscattering/localization coefficient.",
    equation: equation("Drude–Smith dielectric contribution", "<mrow><mi>Δ</mi><msub><mi>ε</mi><mi>DS</mi></msub><mo>=</mo><mi>Δ</mi><msub><mi>ε</mi><mi>D</mi></msub><mo>[</mo><mn>1</mn><mo>+</mo><msub><mi>c</mi><mn>1</mn></msub><mfrac><mi>γ</mi><mrow><mi>γ</mi><mo>−</mo><mi>i</mi><mi>E</mi></mrow></mfrac><mo>]</mo><mo>,</mo><mspace width=\".6em\"></mspace><mo>−</mo><mn>1</mn><mo>≤</mo><msub><mi>c</mi><mn>1</mn></msub><mo>≤</mo><mn>0</mn></mrow>"),
    represents: "Nanostructured conductors, granular films, confined carriers, and systems with persistent backscattering.",
    references: [REFERENCES.drudeSmith],
  },
  brendelBormann: {
    title: "Brendel–Bormann component",
    summary: "Convolves Lorentz resonances with a Gaussian distribution of resonance energies.",
    equation: equation("Brendel–Bormann Gaussian convolution", "<mrow><mi>Δ</mi><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mo>∫</mo><mi>G</mi><mo>(</mo><mi>x</mi><mo>;</mo><msub><mi>E</mi><mn>0</mn></msub><mo>,</mo><mi>σ</mi><mo>)</mo><mfrac><mrow><mi>S</mi><msup><mi>x</mi><mn>2</mn></msup></mrow><mrow><msup><mi>x</mi><mn>2</mn></msup><mo>−</mo><msup><mi>E</mi><mn>2</mn></msup><mo>−</mo><mi>i</mi><mi>γ</mi><mi>E</mi></mrow></mfrac><mi>d</mi><mi>x</mi></mrow>"),
    represents: "Amorphous solids and vibrational/interband bands with inhomogeneous broadening.",
    references: [REFERENCES.brendelBormann],
  },
  criticalPoint: {
    title: "Critical-point / Adachi component",
    summary: "A logarithmic critical-point line shape for an electronic band-structure singularity.",
    equation: equation("Logarithmic critical-point dielectric contribution", "<mrow><mi>Δ</mi><mi>ε</mi><mo>(</mo><mi>E</mi><mo>)</mo><mo>=</mo><mo>−</mo><mi>A</mi><mi>ln</mi><mo>{</mo><mn>1</mn><mo>−</mo><msup><mrow><mo>[</mo><mfrac><mrow><mi>E</mi><mo>+</mo><mi>i</mi><mi>Γ</mi></mrow><msub><mi>E</mi><mn>0</mn></msub></mfrac><mo>]</mo></mrow><mn>2</mn></msup><mo>}</mo></mrow>"),
    represents: "Direct interband critical points in crystalline semiconductors and related electronic transitions.",
    references: [REFERENCES.adachi],
  },
};

export const EMA_RULE_GUIDES = {
  bruggeman: {
    title: "Bruggeman symmetric rule",
    equation: equation("Bruggeman effective medium equation", "<mrow><mi>f</mi><mfrac><mrow><msub><mi>ε</mi><mi>inc</mi></msub><mo>−</mo><msub><mi>ε</mi><mi>eff</mi></msub></mrow><mrow><msub><mi>ε</mi><mi>inc</mi></msub><mo>+</mo><mn>2</mn><msub><mi>ε</mi><mi>eff</mi></msub></mrow></mfrac><mo>+</mo><mo>(</mo><mn>1</mn><mo>−</mo><mi>f</mi><mo>)</mo><mfrac><mrow><msub><mi>ε</mi><mi>host</mi></msub><mo>−</mo><msub><mi>ε</mi><mi>eff</mi></msub></mrow><mrow><msub><mi>ε</mi><mi>host</mi></msub><mo>+</mo><mn>2</mn><msub><mi>ε</mi><mi>eff</mi></msub></mrow></mfrac><mo>=</mo><mn>0</mn></mrow>"),
    represents: "Two phases treated symmetrically; often used near comparable volume fractions or for roughness/porosity layers.",
    references: [REFERENCES.bruggeman],
  },
  "maxwell-garnett": {
    title: "Maxwell–Garnett rule",
    equation: equation("Maxwell–Garnett effective medium equation", "<mrow><msub><mi>ε</mi><mi>eff</mi></msub><mo>=</mo><msub><mi>ε</mi><mi>host</mi></msub><mfrac><mrow><msub><mi>ε</mi><mi>inc</mi></msub><mo>+</mo><mn>2</mn><msub><mi>ε</mi><mi>host</mi></msub><mo>+</mo><mn>2</mn><mi>f</mi><mo>(</mo><msub><mi>ε</mi><mi>inc</mi></msub><mo>−</mo><msub><mi>ε</mi><mi>host</mi></msub><mo>)</mo></mrow><mrow><msub><mi>ε</mi><mi>inc</mi></msub><mo>+</mo><mn>2</mn><msub><mi>ε</mi><mi>host</mi></msub><mo>−</mo><mi>f</mi><mo>(</mo><msub><mi>ε</mi><mi>inc</mi></msub><mo>−</mo><msub><mi>ε</mi><mi>host</mi></msub><mo>)</mo></mrow></mfrac></mrow>"),
    represents: "Dilute, approximately spherical inclusions embedded in a continuous host.",
    references: [REFERENCES.maxwellGarnett],
  },
};

const PARAMETER_HELP = {
  thicknessNm: "Physical thickness of this coherent layer; it controls optical phase and interference spacing.",
  rGain: "Multiplicative reflectance-channel calibration factor; values far from 1 can indicate a normalization problem.",
  tGain: "Multiplicative transmittance-channel calibration factor; values far from 1 can indicate a normalization problem.",
  epsilonInf: "Real high-frequency background permittivity from transitions outside the modeled spectral range.",
  amplitudeEv: "Oscillator strength/amplitude in the selected energy-domain model.",
  resonanceEv: "Center or resonance photon energy E₀ of the optical transition.",
  broadeningEv: "Energy broadening that controls the transition linewidth and damping.",
  bandgapEv: "Optical gap E_g below which the Tauc-type interband contribution vanishes.",
  strength: "Dimensionless Lorentz/Brendel–Bormann oscillator strength.",
  gammaEv: "Collision or damping energy γ; larger values broaden the response and shorten the relaxation time.",
  amplitude: "Dimensionless amplitude of the selected dielectric contribution.",
  centerEnergyEv: "Center photon energy E₀ of the Gaussian absorption band.",
  fwhmEv: "Full width at half maximum of the Gaussian absorption band.",
  transitionEv: "Cody transition energy Eₜ joining the Urbach tail to the interband expression.",
  crossoverEv: "Cody onset/crossover energy Eₚ controlling how rapidly the absorption rises above E_g.",
  urbachEv: "Urbach energy E_U; the exponential sub-gap tail becomes broader as this value increases.",
  plasmaEnergyEv: "Plasma energy E_p, proportional to the square root of free-carrier density divided by effective mass.",
  backscattering: "Drude–Smith persistence coefficient c₁: 0 gives Drude behavior and −1 gives complete velocity reversal after one collision.",
  sigmaEv: "Standard deviation σ of the Gaussian distribution of Brendel–Bormann resonance energies.",
  energyEv: "Critical-point transition energy E₀.",
  cauchyA: "Long-wavelength baseline of the Cauchy refractive index.",
  cauchyBUm2: "Second-order Cauchy dispersion coefficient B; wavelength is evaluated in µm.",
  cauchyCUm4: "Fourth-order Cauchy dispersion coefficient C; wavelength is evaluated in µm.",
  urbachK0: "Extinction coefficient k₀ at the chosen Urbach reference energy; set to zero for a transparent model.",
  urbachReferenceEv: "Photon energy E_ref at which the Urbach extinction equals k₀.",
  urbachEnergyEv: "Urbach energy E_U controlling the exponential absorption-tail slope.",
  nInfinity: "Forouhi–Bloomer refractive index n∞ in the high-energy limit.",
  bEv: "Forouhi–Bloomer denominator coefficient B in energy units.",
  cEv2: "Forouhi–Bloomer denominator coefficient C; the model requires 4C > B².",
  volumeFraction: "Volume fraction f occupied by the inclusion phase, from 0 (host only) to 1 (inclusion only).",
  nScale: "Multiplicative correction applied to every tabulated n value.",
  kScale: "Multiplicative correction applied to every tabulated k value.",
  n: "Wavelength-independent real part of the layer refractive index.",
  k: "Wavelength-independent extinction coefficient; k ≥ 0 represents absorption.",
  gaussianAmplitude: "Amplitude of the causal Gaussian dielectric contribution.",
  gaussianCenterEv: "Center energy E₀ of the Gaussian absorption band.",
  gaussianFwhmEv: "Full width at half maximum of the Gaussian absorption band.",
  drudeGammaEv: "Drude collision/damping energy γ; τ = ħ/γ is the corresponding relaxation time.",
};

export function parameterDescription(parameter: string): string {
  const name = parameter.includes("__") ? parameter.split("__").at(-1) ?? parameter : parameter;
  if (Object.hasOwn(PARAMETER_HELP, name)) return PARAMETER_HELP[name as keyof typeof PARAMETER_HELP];
  if (/^amplitude[12]Ev$/.test(name)) return PARAMETER_HELP.amplitudeEv;
  if (/^resonance[12]Ev$/.test(name)) return PARAMETER_HELP.resonanceEv;
  if (/^broadening[12]Ev$/.test(name)) return PARAMETER_HELP.broadeningEv;
  if (/^sellmeierB[123]$/.test(name)) return "Dimensionless strength Bⱼ of one Sellmeier resonance term.";
  if (/^sellmeierC[123]Um2$/.test(name)) return "Squared resonance wavelength Cⱼ of one Sellmeier term, expressed in µm².";
  if (/^splineEpsilon2_[1-5]$/.test(name)) return "Non-negative ε₂ amplitude at this fixed B-spline energy knot; ε₁ is coupled through Kramers–Kronig integration.";
  return "Numerical parameter used by the selected optical model.";
}
