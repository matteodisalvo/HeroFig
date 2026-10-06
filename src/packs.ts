// Pacchetti: gli ambiti specialistici della libreria (medico, segnali, visione…) si installano
// e si tolgono a scelta. Le forme restano sempre nell'app: «installare» decide solo cosa compare
// nella libreria, quindi una figura che usa un pacchetto non installato si apre comunque bene.
import { useSyncExternalStore } from 'react';

export interface Pack {
  id: string;
  name: string;
  blurb: string;
  categories: string[]; // categorie dei blocchi
  sections: string[]; // sezioni dei modelli
  defaultOn: boolean;
}

export const PACKS: Pack[] = [
  {
    id: 'medico',
    name: 'Medico e biomedico',
    blurb: 'Istologia, radiologia, oftalmologia, icone biomediche e schemi di colorazione virtuale, segmentazione e MIL.',
    categories: ['Imaging medico', 'Icone bio'],
    sections: ['Design medicali'],
    defaultOn: false,
  },
  {
    id: 'segnali',
    name: 'Segnali e DSP',
    blurb: 'Segnali nel tempo e in frequenza, spettrogrammi, filtri, biosegnali e simboli dei diagrammi a blocchi.',
    categories: ['Segnali', 'DSP'],
    sections: ['Signal processing'],
    defaultOn: true,
  },
  {
    id: 'visione',
    name: 'Pattern recognition e visione',
    blurb: 'Riconoscimento di forme, rilevamento, segmentazione e gli schemi classici di computer vision.',
    categories: ['Pattern recognition', 'Computer vision'],
    sections: ['Pattern recognition & CV'],
    defaultOn: true,
  },
  {
    id: 'rl-nlp',
    name: 'Reinforcement learning e NLP',
    blurb: 'Agenti, ambienti e politiche; token, attenzione e gli schemi dei modelli linguistici.',
    categories: ['Reinforcement learning', 'NLP & LLM'],
    sections: ['Reinforcement learning', 'NLP & LLM'],
    defaultOn: true,
  },
  {
    id: 'ml',
    name: 'Machine learning classico',
    blurb: 'Alberi, SVM, clustering, validazione incrociata e i grafici tipici del machine learning.',
    categories: ['ML classico', 'Grafici ML'],
    sections: ['Machine learning'],
    defaultOn: true,
  },
  {
    id: 'robotica',
    name: 'Robotica e controllo',
    blurb: 'Manipolatori, robot mobili e con gambe, droni, sensori e mappe, schemi di controllo (PID, spazio di stato, MPC) e figure di robot learning tratte dai paper.',
    categories: ['Robotica', 'Controllo'],
    sections: ['Robotica e controllo'],
    defaultOn: false,
  },
  {
    id: 'quantum',
    name: 'Quantum computing',
    blurb: 'Circuiti quantistici in stile libro di testo, sfera di Bloch, hardware e algoritmi: da Bell e teletrasporto a Grover, Shor, VQE e codici di correzione.',
    categories: ['Circuiti quantistici', 'Quantum computing'],
    sections: ['Quantum computing'],
    defaultOn: false,
  },
  {
    id: 'quantum-ml',
    name: 'Quantum ML e generative AI',
    blurb: 'Classificatori variazionali, kernel quantistici, QCNN e barren plateau, più modelli generativi quantistici (qGAN, QCBM, Boltzmann machine, QuDDPM) ricalcati dai paper.',
    categories: ['Quantum ML'],
    sections: ['Quantum ML', 'Quantum generative AI'],
    defaultOn: false,
  },
  {
    id: 'genomica',
    name: 'Genomica e proteine',
    blurb: 'DNA, sequenze, NGS, single-cell, GWAS, CRISPR e strutture proteiche, con gli schemi di AlphaFold2, ESM, Enformer, DNABERT e scGPT.',
    categories: ['Genomica', 'Proteine'],
    sections: ['Genomica e proteine'],
    defaultOn: false,
  },
  {
    id: 'ottica',
    name: 'Ottica e fotonica',
    blurb: 'Componenti ottici in vista laterale, fasci laser, campo vicino e lontano, microscopia, fotonica integrata e figure di imaging computazionale e calcolo ottico (D2NN, reti di MZI, ptychography).',
    categories: ['Ottica', 'Fotonica'],
    sections: ['Ottica e fotonica'],
    defaultOn: false,
  },
  {
    id: 'chimica',
    name: 'Chimica e molecole',
    blurb: 'Molecole, cristalli, reazioni, docking e i modelli ML per chimica e materiali: MPNN, SchNet, EGNN, NequIP, JT-VAE, EDM, DiffDock, CDVAE e altri.',
    categories: ['Chimica', 'Materiali'],
    sections: ['Chimica e molecole'],
    defaultOn: false,
  },
];

/** Ambiti che ancora non esistono: servono a far capire che si possono chiedere. */
export const IDEAS = ['Neuroscienze', 'Fisica e simulazione', 'Clima e scienze della Terra', 'Astrofisica'];

const KEY = 'mlsketch:packs';

function load(): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (Array.isArray(v)) return new Set(v.filter((x): x is string => typeof x === 'string'));
  } catch {
    // preferenza assente o rovinata: valori predefiniti
  }
  return new Set(PACKS.filter((p) => p.defaultOn).map((p) => p.id));
}

interface PacksState {
  installed: Set<string>;
  open: boolean; // finestra dei pacchetti
}

let state: PacksState = { installed: load(), open: false };
const listeners = new Set<() => void>();
const set = (p: Partial<PacksState>) => {
  state = { ...state, ...p };
  listeners.forEach((l) => l());
};

export const usePacks = <T,>(selector: (s: PacksState) => T): T =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selector(state),
  );

export function setInstalled(id: string, on: boolean) {
  const installed = new Set(state.installed);
  if (on) installed.add(id);
  else installed.delete(id);
  setInstalledPacks(installed);
}

/** Conferma in una sola volta la selezione della configurazione iniziale. */
export function setInstalledPacks(ids: Iterable<string>) {
  const known = new Set(PACKS.map((p) => p.id));
  const installed = new Set([...ids].filter((id) => known.has(id)));
  set({ installed });
  try {
    localStorage.setItem(KEY, JSON.stringify([...installed]));
  } catch {
    // senza storage la scelta vale per questa sessione
  }
}

export const openPacks = () => set({ open: true });
export const closePacks = () => set({ open: false });

/** Il pacchetto a cui appartiene una categoria o una sezione; undefined se è della libreria di base. */
export const packOf = (group: string) => PACKS.find((p) => p.categories.includes(group) || p.sections.includes(group));

/** Vero se la categoria o la sezione va mostrata nella libreria. */
export function groupVisible(group: string, installed: Set<string>): boolean {
  const pack = packOf(group);
  return !pack || installed.has(pack.id);
}
