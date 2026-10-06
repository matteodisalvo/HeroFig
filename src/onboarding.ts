// La configurazione appartiene all'utente, mai al file della figura.
import { useSyncExternalStore } from 'react';

const KEY = 'tensorfig:onboarding';
const VERSION = 1;
type Status = 'pending' | 'completed' | 'skipped';

function loadStatus(): Status {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object' && 'version' in saved && saved.version === VERSION && 'status' in saved) {
      if (saved.status === 'completed' || saved.status === 'skipped') return saved.status;
    }
  } catch {
    // Prima apertura, preferenza corrotta o storage non disponibile.
  }
  return 'pending';
}

const status = loadStatus();
let state = { open: status === 'pending', status };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export const getOnboarding = () => state;
export const useOnboarding = () => useSyncExternalStore(
  (listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  getOnboarding,
);

export function openOnboarding() {
  state = { ...state, open: true };
  notify();
}

/** Saltare ricorda la scelta; annullare una riapertura conserva lo stato precedente. */
export function closeOnboarding(completed = false) {
  const status = completed ? 'completed' : state.status === 'pending' ? 'skipped' : state.status;
  saveStatus(status, false);
}

/** La conferma viene registrata prima della schermata finale, anche se l'app si chiude lì. */
export function completeOnboarding() {
  saveStatus('completed', true);
}

function saveStatus(status: Status, open: boolean) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, status }));
  } catch {
    // In assenza di storage il wizard resta comunque chiuso per questa sessione.
  }
  state = { open, status };
  notify();
}
