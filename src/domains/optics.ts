// Modulo di dominio "Ottica e fotonica": componenti ottici in vista laterale (lenti, specchi,
// beam splitter, laser, fasci, rivelatori), microscopia, maschere a pixel (SLM, DMD, strati
// diffrattivi), immagini di intensità/fase e fotonica integrata (MZI, microanelli, chip).
// Forme in optics-shapes.ts, modelli in optics-templates.ts.
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, MED_IMG, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { OPTICS_SHAPES } from './optics-shapes';
import { OPTICS_TEMPLATES } from './optics-templates';

const { BLUE, GREEN, YELLOW, RED, PURPLE, TEAL, GRAY, WHITE } = COLORS;

const O = 'Ottica';
const F = 'Fotonica';
const LW = { strokeWidth: 1.2 };
/** Fasci laser: banda chiara con bordi sottili (rosso o verde). */
const BEAM_RED = { fill: '#F9D3CF', stroke: '#D9665A' };
const BEAM_GREEN = { fill: '#D5EDD0', stroke: '#5FA15A' };
const RAY = { fill: 'none', stroke: '#D9534F', strokeWidth: 1 };
const DARK = { fill: '#4B5563', stroke: '#2F3338' };
const BODY = { fill: '#EEF0F3', stroke: '#5B6270' };
const WG = { fill: 'none', stroke: '#3A3F47' };
const CHIP = { fill: '#E8EBF0', stroke: '#3A3F47' };
const FIBER = { fill: '#FFF2CC', stroke: '#D79B00' };
const TRACE = { fill: 'none', stroke: '#2F6FB2', strokeWidth: 1.2, ...ICON };
const img = (id: string, name: string, spec: string, label: string, extra: Preset['node'] = {}): Preset => ({
  id: `opt-${id}`, name, category: O, node: { shape: 'opt-pattern', spec, label, ...MED_IMG, ...extra },
});

const presets: Preset[] = [
  // ---------------- lenti, specchi, beam splitter ----------------
  { id: 'opt-lens', name: 'Lente convergente', category: O, node: { shape: 'opt-lens', spec: 'convex', count: 5, label: '$L$', w: 18, h: 90, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-lens-neg', name: 'Lente divergente', category: O, node: { shape: 'opt-lens', spec: 'concave', count: 7, label: '$L$', w: 22, h: 90, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-lens-plano', name: 'Lente piano-convessa', category: O, node: { shape: 'opt-lens', spec: 'plano', count: 6, label: '$L$', w: 14, h: 90, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-doe', name: 'Lente di Fresnel / DOE', category: O, node: { shape: 'opt-lens', spec: 'fresnel', count: 3, label: 'DOE', w: 16, h: 90, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-lens-thin', name: 'Lente sottile (simbolo)', category: O, node: { shape: 'opt-lens', spec: 'convex thin', label: '$f$', w: 14, h: 100, ...ICON, fill: 'none', stroke: '#2F6FB2', ...LW } },
  { id: 'opt-mirror', name: 'Specchio', category: O, node: { shape: 'opt-mirror', spec: 'flat', direction: 'left', label: 'M', w: 12, h: 70, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-mirror45', name: 'Specchio a 45°', category: O, node: { shape: 'opt-mirror', spec: 'flat d45', direction: 'top', label: 'M', w: 44, h: 44, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-mirror-cc', name: 'Specchio concavo', category: O, node: { shape: 'opt-mirror', spec: 'concave', direction: 'left', label: 'M', w: 16, h: 80, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-galvo', name: 'Specchio galvo', category: O, node: { shape: 'opt-mirror', spec: 'flat d45 galvo', direction: 'top', label: 'Galvo', w: 44, h: 44, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-polygon', name: 'Scanner poligonale', category: O, node: { shape: 'opt-mirror', spec: 'polygon', label: 'Polygon scanner', w: 56, h: 56, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-bs', name: 'Beam splitter (cubo)', category: O, node: { shape: 'opt-bs', spec: 'cube d45', label: 'BS', w: 40, h: 40, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-bs-plate', name: 'Beam splitter (lamina)', category: O, node: { shape: 'opt-bs', spec: 'plate d45', direction: 'top', label: 'BS', w: 44, h: 44, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-pbs', name: 'Beam splitter polarizzante', category: O, node: { shape: 'opt-bs', spec: 'pbs d45', label: 'PBS', w: 40, h: 40, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-dichroic', name: 'Specchio dicroico', category: O, node: { shape: 'opt-bs', spec: 'dichroic d45', direction: 'top', label: 'DM', w: 44, h: 44, ...ICON, ...GREEN, ...LW } },
  // ---------------- sorgenti ----------------
  { id: 'opt-laser', name: 'Laser', category: O, node: { shape: 'opt-laser', spec: 'box sign', label: 'Laser', w: 110, h: 44, fontSize: 12, ...BODY, ...LW } },
  { id: 'opt-diode', name: 'Diodo laser', category: O, node: { shape: 'opt-laser', spec: 'diode', label: 'Laser diode', w: 64, h: 30, ...ICON, ...BODY, ...LW } },
  { id: 'opt-hene', name: 'Laser HeNe', category: O, node: { shape: 'opt-laser', spec: 'tube', label: 'HeNe laser', w: 130, h: 40, fontSize: 12, fill: '#F8E3E1', stroke: '#B85450', ...LW } },
  { id: 'opt-sld', name: 'Sorgente a banda larga', category: O, node: { shape: 'opt-source', spec: 'broadband', label: 'SLD', w: 90, h: 40, fontSize: 12, ...BODY, ...LW } },
  { id: 'opt-lamp', name: 'Lampada', category: O, node: { shape: 'opt-source', spec: 'lamp', label: 'Lamp', w: 50, h: 56, ...ICON, ...YELLOW, ...LW } },
  { id: 'opt-led', name: 'LED', category: O, node: { shape: 'opt-source', spec: 'led', label: 'LED', w: 54, h: 36, ...ICON, ...RED, ...LW } },
  { id: 'opt-ledarray', name: 'Matrice di LED', category: O, node: { shape: 'opt-source', spec: 'ledarray', direction: 'top', count: 11, label: 'LED matrix', w: 130, h: 40, ...ICON, ...YELLOW, ...LW } },
  { id: 'opt-ledgrid', name: 'Matrice di LED (fronte)', category: O, node: { shape: 'opt-source', spec: 'ledarray grid', count: 8, label: 'LED array', w: 80, h: 80, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-point', name: 'Sorgente puntiforme', category: O, node: { shape: 'opt-source', spec: 'point', label: 'Point source', w: 40, h: 40, ...ICON, ...YELLOW, ...LW } },
  // ---------------- fasci e raggi ----------------
  { id: 'opt-beam', name: 'Fascio collimato', category: O, node: { shape: 'opt-beam', spec: 'collimated', w: 140, h: 16, ...BEAM_RED, ...LW } },
  { id: 'opt-beam-green', name: 'Fascio verde', category: O, node: { shape: 'opt-beam', spec: 'collimated', w: 140, h: 16, ...BEAM_GREEN, ...LW } },
  { id: 'opt-beam-focus', name: 'Fascio convergente', category: O, node: { shape: 'opt-beam', spec: 'focus', count: 0, w: 120, h: 40, ...BEAM_RED, ...LW } },
  { id: 'opt-beam-div', name: 'Fascio divergente', category: O, node: { shape: 'opt-beam', spec: 'diverge', count: 0, w: 120, h: 40, ...BEAM_RED, ...LW } },
  {
    id: 'opt-gauss',
    name: 'Fascio gaussiano (waist)',
    category: O,
    node: { shape: 'opt-beam', spec: 'waist gauss fronts axis', count: 22, label: 'Gaussian beam  $w(z) = w_0\\sqrt{1 + (z/z_R)^2}$', w: 220, h: 70, ...ICON, ...BEAM_RED, ...LW },
  },
  { id: 'opt-cone', name: 'Cono di luce', category: O, node: { shape: 'opt-fan', spec: 'cone', count: 50, w: 120, h: 70, ...BEAM_RED, ...LW } },
  { id: 'opt-band', name: 'Fascio inclinato', category: O, node: { shape: 'opt-fan', spec: 'band up', count: 25, w: 120, h: 60, ...BEAM_RED, ...LW } },
  { id: 'opt-rays', name: 'Raggi paralleli', category: O, node: { shape: 'opt-rays', spec: 'parallel arrows', count: 5, w: 120, h: 60, ...RAY } },
  { id: 'opt-rays-focus', name: 'Raggi convergenti', category: O, node: { shape: 'opt-rays', spec: 'focus arrows', count: 5, w: 120, h: 60, ...RAY } },
  { id: 'opt-rays-div', name: 'Raggi divergenti', category: O, node: { shape: 'opt-rays', spec: 'diverge arrows', count: 5, w: 120, h: 60, ...RAY } },
  { id: 'opt-axis', name: 'Asse ottico', category: O, node: { shape: 'opt-axis', spec: 'arrow', label: '$z$', w: 200, h: 12, fill: 'none', stroke: '#8A9099', strokeWidth: 0.9, labelPos: 'below', fontSize: 12 } },
  // ---------------- reticoli, prismi, lamine, aperture ----------------
  { id: 'opt-grating', name: 'Reticolo', category: O, node: { shape: 'opt-grating', spec: 'blazed', count: 10, label: 'Grating', w: 16, h: 80, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-grating-orders', name: 'Reticolo e ordini', category: O, node: { shape: 'opt-grating', spec: 'binary orders', count: 12, label: 'Diffraction orders', w: 130, h: 100, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-grating-spec', name: 'Reticolo (spettro)', category: O, node: { shape: 'opt-grating', spec: 'blazed spectral', count: 12, label: 'Grating', w: 110, h: 90, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-prism', name: 'Prisma (dispersione)', category: O, node: { shape: 'opt-prism', spec: 'equi dispersion', label: 'Prism', w: 140, h: 90, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-polarizer', name: 'Polarizzatore', category: O, node: { shape: 'opt-plate', spec: 'polarizer', label: 'P', w: 12, h: 70, ...ICON, ...PURPLE, ...LW } },
  { id: 'opt-polarizer-front', name: 'Polarizzatore (fronte)', category: O, node: { shape: 'opt-plate', spec: 'polarizer front', label: 'Polarizer', w: 60, h: 60, ...ICON, ...PURPLE, ...LW } },
  { id: 'opt-hwp', name: 'Lamina λ/2', category: O, node: { shape: 'opt-plate', spec: 'halfwave', label: '$\\lambda/2$', w: 12, h: 70, ...ICON, ...TEAL, ...LW } },
  { id: 'opt-qwp', name: 'Lamina λ/4', category: O, node: { shape: 'opt-plate', spec: 'quarterwave', label: '$\\lambda/4$', w: 12, h: 70, ...ICON, ...TEAL, ...LW } },
  { id: 'opt-filter', name: 'Filtro', category: O, node: { shape: 'opt-plate', spec: 'filter', label: 'Filter', w: 10, h: 70, ...ICON, ...GREEN, ...LW } },
  { id: 'opt-diffuser', name: 'Diffusore', category: O, node: { shape: 'opt-plate', spec: 'diffuser', label: 'Diffuser', w: 14, h: 80, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-pinhole', name: 'Pinhole', category: O, node: { shape: 'opt-aperture', spec: 'pinhole', count: 14, label: 'Pinhole', w: 8, h: 70, ...ICON, ...DARK, ...LW } },
  { id: 'opt-slit', name: 'Fenditura', category: O, node: { shape: 'opt-aperture', spec: 'slit front', count: 30, label: 'Slit', w: 60, h: 60, ...ICON, ...DARK, ...LW } },
  { id: 'opt-double', name: 'Doppia fenditura', category: O, node: { shape: 'opt-aperture', spec: 'double front', count: 40, label: 'Double slit', w: 60, h: 60, ...ICON, ...DARK, ...LW } },
  { id: 'opt-iris', name: 'Diaframma a iride', category: O, node: { shape: 'opt-aperture', spec: 'iris front', count: 40, label: 'Iris', w: 60, h: 60, ...ICON, ...DARK, ...LW } },
  // ---------------- SLM, DMD, strati diffrattivi ----------------
  { id: 'opt-slm', name: 'SLM (fase)', category: O, node: { shape: 'opt-pixels', spec: 'phase front grid', count: 12, label: 'SLM', w: 80, h: 80, ...ICON, stroke: '#555555', fill: 'none', ...LW } },
  { id: 'opt-dmd', name: 'DMD (pattern)', category: O, node: { shape: 'opt-pixels', spec: 'binary persp grid', count: 12, label: 'DMD', w: 60, h: 90, ...ICON, stroke: '#555555', fill: 'none', ...LW } },
  { id: 'opt-dmd-side', name: 'DMD (microspecchi)', category: O, node: { shape: 'opt-pixels', spec: 'dmd', direction: 'top', count: 12, label: 'DMD', w: 120, h: 36, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-layer', name: 'Strato diffrattivo', category: O, node: { shape: 'opt-pixels', spec: 'phase persp jet v1', count: 24, label: 'Diffractive layer', w: 56, h: 100, ...ICON, stroke: '#555555', fill: 'none', ...LW } },
  { id: 'opt-layer-row', name: 'Strato (pixel in fila)', category: O, node: { shape: 'opt-pixels', spec: 'phase front jet grid v2', count: 16, label: 'Layer', w: 180, h: 11, ...ICON, stroke: '#555555', fill: 'none', strokeWidth: 0.8 } },
  { id: 'opt-fresnel', name: 'Lente di Fresnel (fase)', category: O, node: { shape: 'opt-pixels', spec: 'lens front twilight', count: 40, label: 'Phase mask', w: 80, h: 80, ...ICON, stroke: '#555555', fill: 'none', ...LW } },
  { id: 'opt-colorbar', name: 'Barra di fase', category: O, node: { shape: 'opt-pixels', spec: 'ramp front jet', count: 32, label: 'Phase', w: 10, h: 60, ...ICON, stroke: '#555555', fill: 'none', strokeWidth: 0.8 } },
  { id: 'opt-hadamard', name: 'Maschera di Hadamard', category: O, node: { shape: 'opt-pixels', spec: 'hadamard front grid', count: 8, label: 'Hadamard pattern', w: 80, h: 80, ...ICON, stroke: '#555555', fill: 'none', ...LW } },
  // ---------------- immagini di intensità e fase ----------------
  img('speckle', 'Speckle', 'speckle', 'Speckle'),
  img('airy', 'Disco di Airy', 'airy', 'Airy pattern'),
  img('fringes', 'Frange', 'fringes', 'Fringes', { count: 6 }),
  img('rings', 'Anelli di interferenza', 'rings', 'Circular fringes', { count: 4 }),
  img('spot', 'Spot gaussiano', 'gauss', 'Gaussian spot'),
  img('hologram', 'Ologramma', 'hologram', 'Hologram'),
  img('phasemap', 'Mappa di fase', 'phase', 'Phase $\\phi(x, y)$'),
  img('fourier', 'Spettro di Fourier', 'spectrum', 'Fourier spectrum'),
  img('psf', 'PSF', 'psf', 'PSF'),
  img('digit', 'Cifra (MNIST)', 'digit', 'Input', { count: 5 }),
  img('detectors', 'Piano dei rivelatori', 'detectors labels', 'Output plane', { count: 5 }),
  img('usaf', 'Mira USAF', 'usaf', 'USAF target'),
  img('caustic', 'Caustica (PSF diffusore)', 'caustic', 'Caustic PSF'),
  img('cells', 'Cellule (intensità)', 'cells', 'Intensity'),
  img('kspace', 'Spazio k (FPM)', 'kspace', 'Fourier space'),
  img('phantom', 'Fantoccio', 'phantom', 'Object'),
  img('blurry', 'Misura sfocata', 'blurry', 'Measurement'),
  // ---------------- campo vicino e campo lontano ----------------
  { id: 'opt-nearfield', name: 'Campo vicino (ombra)', category: O, node: { shape: 'opt-diffraction', spec: 'shadow profile edges', direction: 'top', label: 'Near field  $N_F \\gg 1$', w: 120, h: 60, ...ICON, ...BEAM_RED, strokeWidth: 1.1 } },
  { id: 'opt-fresnelpat', name: 'Diffrazione di Fresnel', category: O, node: { shape: 'opt-diffraction', spec: 'fresnel profile edges', direction: 'top', label: 'Fresnel  $N_F \\approx 3$', w: 120, h: 60, ...ICON, ...BEAM_RED, strokeWidth: 1.1 } },
  { id: 'opt-farfield', name: 'Campo lontano (Fraunhofer)', category: O, node: { shape: 'opt-diffraction', spec: 'far profile', direction: 'top', label: 'Far field  $\\mathrm{sinc}^2$', w: 120, h: 60, ...ICON, ...BEAM_RED, strokeWidth: 1.1 } },
  { id: 'opt-airyprofile', name: 'Profilo di Airy', category: O, node: { shape: 'opt-diffraction', spec: 'far profile circ', direction: 'top', label: 'Airy  $[2J_1(x)/x]^2$', w: 120, h: 60, ...ICON, ...BEAM_RED, strokeWidth: 1.1 } },
  { id: 'opt-screenpat', name: 'Figura sullo schermo', category: O, node: { shape: 'opt-diffraction', spec: 'fresnel profile screen', direction: 'right', label: 'Screen', w: 70, h: 110, ...ICON, ...BEAM_RED, strokeWidth: 1.1 } },
  { id: 'opt-radpattern', name: 'Diagramma di radiazione', category: O, node: { shape: 'opt-diffraction', spec: 'far polar', label: 'Far-field pattern', w: 80, h: 120, ...ICON, ...BEAM_RED, strokeWidth: 1.1 } },
  { id: 'opt-evanescent', name: 'Onda evanescente', category: O, node: { shape: 'opt-evanescent', spec: 'tir labels', label: 'Evanescent wave (TIR)', w: 160, h: 110, ...ICON, fill: '#DAE8FC', stroke: '#D9534F', ...LW } },
  { id: 'opt-subwl', name: 'Apertura sub-λ', category: O, node: { shape: 'opt-evanescent', spec: 'aperture labels', label: 'Near field of a sub-λ aperture', w: 150, h: 110, ...ICON, fill: 'none', stroke: '#D9534F', ...LW } },
  { id: 'opt-decay', name: 'Decadimento evanescente', category: O, node: { shape: 'opt-evanescent', spec: 'decay labels', label: '$|E|^2 \\propto e^{-z/d}$', w: 120, h: 70, ...ICON, fill: 'none', stroke: '#D9534F', ...LW } },
  { id: 'opt-regions', name: 'Regioni di campo', category: O, node: { shape: 'opt-fieldregions', spec: 'labels', label: 'Field regions', w: 260, h: 180, ...ICON, fill: 'none', stroke: '#8A9099', strokeWidth: 1 } },
  { id: 'opt-snomtip', name: 'Sonda SNOM', category: O, node: { shape: 'opt-probe', spec: 'aperture', direction: 'bottom', label: 'Aperture probe', w: 40, h: 110, ...ICON, fill: '#B8BEC6', stroke: '#5B6270', ...LW } },
  { id: 'opt-metaltip', name: 'Punta metallica', category: O, node: { shape: 'opt-probe', spec: 'tip', direction: 'bottom', label: 'Metal tip', w: 30, h: 70, ...ICON, fill: '#E3C77A', stroke: '#B08D2E', ...LW } },
  { id: 'opt-cantilever', name: 'Cantilever AFM', category: O, node: { shape: 'opt-probe', spec: 'cantilever', direction: 'bottom', label: 'AFM cantilever', w: 90, h: 50, ...ICON, fill: '#B8BEC6', stroke: '#5B6270', ...LW } },
  // ---------------- microscopia e campioni ----------------
  { id: 'opt-objective', name: 'Obiettivo', category: O, node: { shape: 'opt-objective', direction: 'bottom', label: 'Objective', w: 40, h: 80, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-slide', name: 'Vetrino', category: O, node: { shape: 'opt-sample', spec: 'slide', label: 'Sample', w: 110, h: 40, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-dish', name: 'Piastra di coltura', category: O, node: { shape: 'opt-sample', spec: 'dish', label: 'Dish', w: 100, h: 44, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-cuvette', name: 'Cuvetta', category: O, node: { shape: 'opt-sample', spec: 'cuvette', label: 'Cuvette', w: 44, h: 60, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-tissue', name: 'Tessuto', category: O, node: { shape: 'opt-sample', spec: 'tissue', label: 'Tissue', w: 110, h: 50, ...ICON, fill: '#F6D5D0', stroke: '#B5655A', ...LW } },
  { id: 'opt-chamber', name: 'Camera del campione', category: O, node: { shape: 'opt-sample', spec: 'chamber', label: 'Sample chamber', w: 90, h: 70, ...ICON, ...BLUE, ...LW } },
  // ---------------- rivelatori ----------------
  { id: 'opt-camera', name: 'Fotocamera', category: O, node: { shape: 'opt-detector', spec: 'camera', direction: 'left', label: 'Camera', w: 70, h: 50, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-sensor', name: 'Sensore', category: O, node: { shape: 'opt-detector', spec: 'sensor', count: 8, label: 'Sensor', w: 70, h: 70, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-linesensor', name: 'Sensore lineare', category: O, node: { shape: 'opt-detector', spec: 'linear', count: 16, label: 'Sensor', w: 10, h: 100, ...ICON, ...WHITE, ...LW } },
  { id: 'opt-pd', name: 'Fotodiodo', category: O, node: { shape: 'opt-detector', spec: 'pd', direction: 'left', label: 'PD', w: 40, h: 34, ...ICON, ...PURPLE, ...LW } },
  { id: 'opt-pmt', name: 'Fotomoltiplicatore', category: O, node: { shape: 'opt-detector', spec: 'pmt', direction: 'left', label: 'PMT', w: 70, h: 34, ...ICON, ...GRAY, ...LW } },
  // ---------------- oggetti e grafici ----------------
  { id: 'opt-objarrow', name: 'Oggetto (freccia)', category: O, node: { shape: 'opt-object', spec: 'arrow', direction: 'top', label: 'Object', w: 14, h: 60, ...ICON, fill: 'none', stroke: '#2F6FB2', ...LW } },
  { id: 'opt-imgarrow', name: 'Immagine (freccia)', category: O, node: { shape: 'opt-object', spec: 'arrow', direction: 'bottom', label: 'Image', w: 14, h: 50, ...ICON, fill: 'none', stroke: '#C0392B', ...LW } },
  { id: 'opt-cube', name: 'Cubo', category: O, node: { shape: 'opt-object', spec: 'cube', w: 50, h: 50, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-sphere', name: 'Sfera', category: O, node: { shape: 'opt-object', spec: 'sphere', w: 50, h: 50, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-car', name: 'Auto', category: O, node: { shape: 'opt-object', spec: 'car', w: 90, h: 44, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-tree', name: 'Albero', category: O, node: { shape: 'opt-object', spec: 'tree', w: 50, h: 70, ...ICON, ...GREEN, ...LW } },
  { id: 'opt-person', name: 'Persona', category: O, node: { shape: 'opt-object', spec: 'person', w: 30, h: 70, ...ICON, ...YELLOW, ...LW } },
  { id: 'opt-eye', name: 'Occhio', category: O, node: { shape: 'opt-object', spec: 'eye', label: 'Observer', w: 50, h: 28, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-interferogram', name: 'Interferogramma', category: O, node: { shape: 'opt-plot', spec: 'interferogram labels', label: 'Spectral interferogram', w: 120, h: 60, ...TRACE } },
  { id: 'opt-ascan', name: 'A-scan', category: O, node: { shape: 'opt-plot', spec: 'ascan labels', label: 'A-scan', w: 120, h: 60, ...TRACE } },
  { id: 'opt-tof', name: 'Tempo di volo', category: O, node: { shape: 'opt-plot', spec: 'tof labels', label: 'Time of flight', w: 130, h: 60, ...TRACE } },
  { id: 'opt-psfprofile', name: 'Profilo PSF', category: O, node: { shape: 'opt-plot', spec: 'psf labels', label: 'PSF', w: 110, h: 60, ...TRACE } },
  { id: 'opt-cos2', name: 'Interferenza cos²', category: O, node: { shape: 'opt-plot', spec: 'cos2 labels', label: '$I \\propto \\cos^2(\\Delta\\varphi/2)$', w: 120, h: 60, ...TRACE } },
  { id: 'opt-spectrum', name: 'Spettro sorgente', category: O, node: { shape: 'opt-plot', spec: 'spectrum labels', label: '$S(\\lambda)$', w: 110, h: 60, ...TRACE } },
  { id: 'opt-tcspc', name: 'Istogramma TCSPC', category: O, node: { shape: 'opt-plot', spec: 'histogram labels', count: 18, label: 'Photon counts', w: 120, h: 60, ...TRACE } },

  // ---------------- fibre e guide d'onda ----------------
  { id: 'opt-fiber', name: 'Fibra (bobina)', category: F, node: { shape: 'opt-fiber', spec: 'coil', label: 'Fiber', w: 80, h: 50, ...ICON, ...FIBER, ...LW } },
  { id: 'opt-patch', name: 'Fibra con connettori', category: F, node: { shape: 'opt-fiber', spec: 'straight', label: 'Patch cord', w: 130, h: 12, ...ICON, fill: '#E5E7EB', stroke: '#D79B00', ...LW } },
  { id: 'opt-collimator', name: 'Collimatore', category: F, node: { shape: 'opt-fiber', spec: 'collimator', label: 'Collimator', w: 60, h: 28, ...ICON, ...GRAY, ...LW } },
  { id: 'opt-fibercross', name: 'Fibra (sezione)', category: F, node: { shape: 'opt-fiber', spec: 'cross', label: 'Core / cladding', w: 60, h: 60, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-slab', name: 'Guida planare', category: F, node: { shape: 'opt-waveguide', spec: 'slab labels', label: 'Total internal reflection', w: 170, h: 60, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-wgmode', name: 'Guida con modo', category: F, node: { shape: 'opt-waveguide', spec: 'mode labels', label: 'Guided mode', w: 170, h: 60, ...ICON, ...BLUE, ...LW } },
  { id: 'opt-ridge', name: 'Guida a costola (sezione)', category: F, node: { shape: 'opt-waveguide', spec: 'ridge labels', label: 'Ridge waveguide', w: 130, h: 80, ...ICON, fill: '#D6DCE8', stroke: '#5B6270', ...LW } },
  { id: 'opt-bend', name: 'Guida curva', category: F, node: { shape: 'opt-waveguide', spec: 'bend', w: 120, h: 40, ...ICON, ...WG, ...LW } },
  { id: 'opt-dc', name: 'Accoppiatore direzionale', category: F, node: { shape: 'opt-coupler', spec: 'dc', label: 'Directional coupler', w: 130, h: 50, ...ICON, ...WG, ...LW } },
  { id: 'opt-fused', name: 'Accoppiatore in fibra 2×2', category: F, node: { shape: 'opt-coupler', spec: 'fused', label: '50:50 coupler', w: 130, h: 50, ...ICON, ...FIBER, ...LW } },
  { id: 'opt-ybranch', name: 'Giunzione Y', category: F, node: { shape: 'opt-coupler', spec: 'ybranch', label: 'Y-branch', w: 110, h: 50, ...ICON, ...WG, ...LW } },
  { id: 'opt-circulator', name: 'Circolatore', category: F, node: { shape: 'opt-coupler', spec: 'circulator labels', label: 'Circulator', w: 80, h: 60, ...ICON, fill: '#FFFFFF', stroke: '#3A3F47', ...LW } },
  // ---------------- fotonica integrata ----------------
  { id: 'opt-mzi', name: 'MZI', category: F, node: { shape: 'opt-mzi', count: 2, spec: 'labels', label: 'MZI', w: 170, h: 56, ...ICON, ...WG, ...LW } },
  { id: 'opt-mesh', name: 'Rete MZI (Clements)', category: F, node: { shape: 'opt-mzi', count: 4, spec: 'clements chip', label: 'MZI mesh', w: 280, h: 110, ...ICON, ...CHIP, ...LW } },
  { id: 'opt-reck', name: 'Rete MZI (Reck)', category: F, node: { shape: 'opt-mzi', count: 4, spec: 'reck chip', label: 'Triangular MZI mesh', w: 300, h: 110, ...ICON, ...CHIP, ...LW } },
  { id: 'opt-ring', name: 'Microanello', category: F, node: { shape: 'opt-ring', spec: 'allpass labels', label: 'Microring', w: 120, h: 80, ...ICON, ...WG, ...LW } },
  { id: 'opt-adddrop', name: 'Anello add-drop', category: F, node: { shape: 'opt-ring', spec: 'adddrop heater labels', label: 'Add-drop ring', w: 130, h: 100, ...ICON, ...WG, ...LW } },
  { id: 'opt-chip', name: 'Chip fotonico', category: F, node: { shape: 'opt-chip', spec: 'top', label: 'Photonic chip', w: 220, h: 120, ...ICON, ...CHIP, ...LW } },
  { id: 'opt-chip3d', name: 'Chip (assonometria)', category: F, node: { shape: 'opt-chip', spec: 'iso', label: 'Photonic chip', w: 220, h: 110, ...ICON, ...CHIP, ...LW } },
  { id: 'opt-ringtx', name: 'Trasmissione anello', category: F, node: { shape: 'opt-plot', spec: 'transmission labels', label: 'Through-port transmission', w: 130, h: 60, ...TRACE } },
  { id: 'opt-huygens', name: 'Onde secondarie (D2NN)', category: F, node: { shape: 'opt-huygens', count: 4, direction: 'bottom', label: 'Secondary waves', w: 120, h: 60, ...ICON, fill: '#4B5563', stroke: '#4B5563', ...LW } },
];

registerShapes(OPTICS_SHAPES);
registerPresets(presets);
registerTemplates(OPTICS_TEMPLATES);
