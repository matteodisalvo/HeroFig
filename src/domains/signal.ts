// Modulo di dominio "Signal processing": segnali nel tempo e in frequenza, spettrogrammi,
// filtri, piano z, comunicazioni digitali, biosegnali e simboli dei diagrammi a blocchi DSP.
// Forme in signal-shapes.ts, modelli in signal-templates.ts.
// Vedi src/registry.ts per l'API e src/domains/README.md per le convenzioni.
import { COLORS, ICON, MED_IMG, type Preset } from '../model';
import { registerPresets, registerShapes, registerTemplates } from '../registry';
import { SIGNAL_SHAPES } from './signal-shapes';
import { SIGNAL_TEMPLATES } from './signal-templates';

const { BLUE, GREEN, ORANGE, YELLOW, PURPLE, TEAL, WHITE } = COLORS;

/** Tracciato senza riquadro: assi grigi, curva nel colore del bordo, etichetta sotto. */
const TRACE = { fill: 'none', strokeWidth: 1.2, ...ICON };
const SP_BLUE = '#2F6FB2';
const SP_RED = '#C0392B';
const SP_GREEN = '#2E8B57';
const SP_PURPLE = '#7E57C2';
const SP_INK = '#3A3F47';

const S = 'Segnali';
const D = 'DSP';

const presets: Preset[] = [
  // ---------------- segnali nel tempo ----------------
  { id: 'sp-sine', name: 'Sinusoide', category: S, node: { shape: 'sp-signal', spec: 'sine labels', count: 2, label: '$x(t)$', w: 110, h: 54, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-chirp', name: 'Chirp', category: S, node: { shape: 'sp-signal', spec: 'chirp labels', count: 3, label: 'Chirp', w: 120, h: 54, stroke: SP_PURPLE, ...TRACE } },
  { id: 'sp-square', name: 'Onda quadra', category: S, node: { shape: 'sp-signal', spec: 'square labels', count: 3, label: 'Square wave', w: 110, h: 54, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-noisy', name: 'Segnale rumoroso', category: S, node: { shape: 'sp-signal', spec: 'noisy labels', count: 2, label: '$x(t) + n(t)$', w: 120, h: 54, stroke: SP_INK, ...TRACE } },
  { id: 'sp-am', name: 'Modulazione AM', category: S, node: { shape: 'sp-signal', spec: 'am labels', count: 2, label: 'AM signal', w: 130, h: 56, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-fm', name: 'Modulazione FM', category: S, node: { shape: 'sp-signal', spec: 'fm labels', count: 2, label: 'FM signal', w: 130, h: 56, stroke: SP_GREEN, ...TRACE } },
  { id: 'sp-impulses', name: 'Treno di impulsi', category: S, node: { shape: 'sp-signal', spec: 'impulses labels', count: 7, label: '$\\sum_{k}\\delta(t-kT_s)$', w: 120, h: 54, stroke: SP_INK, ...TRACE } },
  { id: 'sp-speech', name: 'Audio (parlato)', category: S, node: { shape: 'sp-signal', spec: 'audio labels', label: 'Speech waveform', w: 130, h: 56, stroke: SP_BLUE, ...TRACE } },
  // ---------------- tempo discreto ----------------
  { id: 'sp-xn', name: 'Segnale discreto', category: S, node: { shape: 'sp-discrete', spec: 'sine labels', count: 12, label: '$x[n]$', w: 120, h: 58, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-hn', name: 'Risposta impulsiva', category: S, node: { shape: 'sp-discrete', spec: 'decay labels', count: 12, label: '$h[n]$', w: 110, h: 56, stroke: SP_RED, ...TRACE } },
  { id: 'sp-sampling', name: 'Campionamento', category: S, node: { shape: 'sp-discrete', spec: 'sine analog labels', count: 12, label: '$x[n] = x(nT_s)$', w: 130, h: 60, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-quantized', name: 'Quantizzazione', category: S, node: { shape: 'sp-discrete', spec: 'sine quant labels', count: 12, label: 'Quantization', w: 130, h: 64, stroke: SP_RED, ...TRACE } },
  // ---------------- frequenza ----------------
  { id: 'sp-spectrum', name: 'Spettro', category: S, node: { shape: 'sp-spectrum', spec: 'peaks labels', count: 3, label: '$|X(f)|$', w: 110, h: 60, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-harmonics', name: 'Armoniche', category: S, node: { shape: 'sp-spectrum', spec: 'harmonic labels', count: 6, label: 'Harmonic spectrum', w: 120, h: 60, stroke: SP_PURPLE, ...TRACE } },
  { id: 'sp-replicas', name: 'Spettro campionato', category: S, node: { shape: 'sp-spectrum', spec: 'replica labels', label: '$X_s(f)$', w: 150, h: 60, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-aliasing', name: 'Aliasing', category: S, node: { shape: 'sp-spectrum', spec: 'aliasing labels', label: 'Aliasing', w: 150, h: 60, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-psd', name: 'PSD', category: S, node: { shape: 'sp-spectrum', spec: 'psd labels', count: 3, label: 'PSD (dB)', w: 120, h: 60, stroke: SP_INK, ...TRACE } },
  // ---------------- tempo-frequenza ----------------
  { id: 'sp-spectrogram', name: 'Spettrogramma', category: S, node: { shape: 'sp-spectrogram', spec: 'speech', label: 'Spectrogram', ...MED_IMG, w: 130, h: 86 } },
  { id: 'sp-logmel', name: 'Log-mel', category: S, node: { shape: 'sp-spectrogram', spec: 'mel viridis', label: 'Log-mel spectrogram', ...MED_IMG, w: 130, h: 86 } },
  { id: 'sp-mfccimg', name: 'MFCC', category: S, node: { shape: 'sp-spectrogram', spec: 'mfcc', label: 'MFCCs', ...MED_IMG, w: 130, h: 70 } },
  { id: 'sp-scalogram', name: 'Scalogramma (CWT)', category: S, node: { shape: 'sp-spectrogram', spec: 'cwt inferno', label: 'Scalogram (CWT)', ...MED_IMG, w: 130, h: 86 } },
  { id: 'sp-melbank', name: 'Banco mel', category: S, node: { shape: 'sp-melbank', spec: 'mel labels', count: 10, label: 'Mel filterbank', w: 130, h: 56, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-stft', name: 'Finestre STFT', category: S, node: { shape: 'sp-stft', spec: 'hann labels', count: 5, label: 'Framing + window', w: 140, h: 60, stroke: SP_BLUE, ...TRACE } },
  // ---------------- filtri e sistemi ----------------
  { id: 'sp-lowpass', name: 'Passa-basso', category: S, node: { shape: 'sp-response', spec: 'lowpass labels', count: 4, label: '$|H(e^{j\\omega})|$', w: 96, h: 64, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-highpass', name: 'Passa-alto', category: S, node: { shape: 'sp-response', spec: 'highpass labels', count: 4, label: 'High-pass', w: 96, h: 64, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-bandpass', name: 'Passa-banda', category: S, node: { shape: 'sp-response', spec: 'bandpass labels', count: 3, label: 'Band-pass', w: 96, h: 64, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-notch', name: 'Notch', category: S, node: { shape: 'sp-response', spec: 'notch labels', label: 'Notch', w: 96, h: 64, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-polezero', name: 'Poli e zeri', category: S, node: { shape: 'sp-polezero', spec: 'iir labels', count: 2, label: '$z$-plane', w: 80, h: 80, stroke: SP_BLUE, ...TRACE } },
  // ---------------- comunicazioni ----------------
  { id: 'sp-qam', name: 'Costellazione QAM', category: S, node: { shape: 'sp-constellation', spec: 'qam16 labels', label: '16-QAM', w: 80, h: 80, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-psk', name: 'Costellazione PSK', category: S, node: { shape: 'sp-constellation', spec: 'psk8 labels', label: '8-PSK', w: 80, h: 80, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-qamrx', name: 'QAM ricevuta', category: S, node: { shape: 'sp-constellation', spec: 'qam16 noisy grid labels', label: 'Received symbols', w: 80, h: 80, stroke: SP_BLUE, ...TRACE } },
  { id: 'sp-eye', name: 'Diagramma a occhio', category: S, node: { shape: 'sp-eye', label: 'Eye diagram', w: 110, h: 72, radius: 3, ...TRACE, fill: '#FFFFFF', stroke: SP_BLUE } },
  // ---------------- biosegnali ----------------
  { id: 'sp-eeg', name: 'EEG multicanale', category: S, node: { shape: 'sp-eeg', spec: 'names', count: 6, label: 'EEG', w: 130, h: 90, stroke: SP_INK, ...TRACE, strokeWidth: 1 } },
  { id: 'sp-headcap', name: 'Montaggio EEG', category: S, node: { shape: 'sp-headcap', label: '10-20 montage', w: 76, h: 84, strokeWidth: 1.2, ...ICON, fill: '#FBEFE6', stroke: '#8C6A55' } },
  { id: 'sp-headcap10-20', name: 'Montaggio 10-20 (nomi)', category: S, node: { shape: 'sp-headcap', spec: 'names', label: 'International 10-20 system', w: 170, h: 186, strokeWidth: 1.2, ...ICON, fill: '#FBEFE6', stroke: '#8C6A55' } },

  // ---------------- simboli DSP ----------------
  { id: 'sp-delay', name: 'Ritardo z⁻¹', category: D, node: { label: '$z^{-1}$', w: 44, h: 34, radius: 2, fontSize: 14, strokeWidth: 1.2, ...WHITE } },
  { id: 'sp-sum', name: 'Nodo somma', category: D, node: { shape: 'sp-junction', spec: 'sum', w: 28, h: 28, strokeWidth: 1.2, ...WHITE } },
  { id: 'sp-sigma', name: 'Sommatore Σ', category: D, node: { shape: 'sp-junction', spec: 'sigma', w: 32, h: 32, strokeWidth: 1.2, ...WHITE } },
  { id: 'sp-mult', name: 'Moltiplicatore', category: D, node: { shape: 'sp-junction', spec: 'mult', w: 28, h: 28, strokeWidth: 1.2, ...WHITE } },
  { id: 'sp-osc', name: 'Oscillatore', category: D, node: { shape: 'sp-junction', spec: 'osc', label: '$\\cos(\\omega_c t)$', w: 32, h: 32, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'sp-gain', name: 'Guadagno', category: D, node: { shape: 'triangle', direction: 'right', label: '$b_k$', w: 40, h: 34, radius: 2, fontSize: 12, strokeWidth: 1.2, ...WHITE } },
  { id: 'sp-filter', name: 'Filtro H(z)', category: D, node: { shape: 'sp-filter', spec: 'lp', label: '$H(z)$', w: 84, h: 54, radius: 4, fontSize: 14, strokeWidth: 1.2, ...BLUE } },
  { id: 'sp-bpf', name: 'Filtro passa-banda', category: D, node: { shape: 'sp-filter', spec: 'bp', label: 'Band-pass', w: 120, h: 44, radius: 4, fontSize: 12, strokeWidth: 1.2, ...BLUE } },
  { id: 'sp-fft', name: 'FFT', category: D, node: { shape: 'sp-filter', spec: 'fft', label: 'FFT', w: 84, h: 54, radius: 4, fontSize: 13, strokeWidth: 1.2, ...PURPLE } },
  { id: 'sp-adaptive', name: 'Filtro adattivo', category: D, node: { shape: 'sp-filter', spec: 'adaptive', label: '$\\mathbf{w}[n]$', w: 84, h: 50, radius: 4, fontSize: 14, strokeWidth: 1.2, ...ORANGE } },
  { id: 'sp-integrator', name: 'Integratore', category: D, node: { shape: 'sp-opbox', spec: 'int', w: 40, h: 40, radius: 3, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'sp-deriv', name: 'Derivatore', category: D, node: { shape: 'sp-opbox', spec: 'deriv', w: 40, h: 40, radius: 3, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'sp-quantizer', name: 'Quantizzatore', category: D, node: { shape: 'sp-opbox', spec: 'quant', label: 'Quantizer', w: 46, h: 46, radius: 3, strokeWidth: 1.2, ...ICON, ...YELLOW } },
  { id: 'sp-nonlin', name: 'Saturazione', category: D, node: { shape: 'sp-opbox', spec: 'sat', label: 'Limiter', w: 46, h: 46, radius: 3, strokeWidth: 1.2, ...ICON, ...WHITE } },
  { id: 'sp-down', name: 'Decimatore ↓M', category: D, node: { shape: 'sp-opbox', spec: 'down', label: '$M$', w: 40, h: 36, radius: 3, fontSize: 14, strokeWidth: 1.2, ...WHITE } },
  { id: 'sp-up', name: 'Espansore ↑L', category: D, node: { shape: 'sp-opbox', spec: 'up', label: '$L$', w: 40, h: 36, radius: 3, fontSize: 14, strokeWidth: 1.2, ...WHITE } },
  { id: 'sp-adc', name: 'ADC', category: D, node: { shape: 'sp-converter', spec: 'adc', label: 'ADC', w: 48, h: 48, radius: 3, strokeWidth: 1.2, ...ICON, ...TEAL } },
  { id: 'sp-dac', name: 'DAC', category: D, node: { shape: 'sp-converter', spec: 'dac', label: 'DAC', w: 48, h: 48, radius: 3, strokeWidth: 1.2, ...ICON, ...TEAL } },
  { id: 'sp-sampler', name: 'Campionatore', category: D, node: { shape: 'sp-switch', label: '$T_s$', w: 70, h: 40, fill: 'none', stroke: '#333333', strokeWidth: 1.2, ...ICON } },
  { id: 'sp-sh', name: 'Sample & hold', category: D, node: { shape: 'sp-switch', spec: 'hold', label: 'Sample & hold', w: 80, h: 56, fill: 'none', stroke: '#333333', strokeWidth: 1.2, ...ICON } },
  { id: 'sp-mic', name: 'Microfono', category: D, node: { shape: 'sp-transducer', spec: 'mic', w: 34, h: 50, strokeWidth: 1.2, ...ICON, ...GREEN } },
  { id: 'sp-speaker', name: 'Altoparlante', category: D, node: { shape: 'sp-transducer', spec: 'speaker', w: 50, h: 44, strokeWidth: 1.2, ...ICON, ...GREEN } },
  { id: 'sp-antenna', name: 'Antenna', category: D, node: { shape: 'sp-transducer', spec: 'antenna', w: 44, h: 54, strokeWidth: 1.2, ...ICON, ...GREEN } },
];

registerShapes(SIGNAL_SHAPES);
registerPresets(presets);
registerTemplates(SIGNAL_TEMPLATES);
