// Profilo personale locale: non fa parte di Doc, dei progetti o dei messaggi live.
// Solo il nome viene letto dalla collaborazione e dai nuovi commenti.
import { useSyncExternalStore } from 'react';

export const PROFILE_COLORS = ['violet', 'blue', 'teal', 'rose', 'amber'] as const;
export type ProfileColor = typeof PROFILE_COLORS[number];
export interface UserProfile {
  name: string;
  affiliation: string;
  role: string;
  color: ProfileColor;
}

const KEY = 'herofig:profile';
const AUTHOR_KEY = 'mlsketch:author';
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const read = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};

function normalize(raw: Partial<UserProfile>): UserProfile {
  return {
    name: text(raw.name, 80),
    affiliation: text(raw.affiliation, 120),
    role: text(raw.role, 80),
    color: PROFILE_COLORS.includes(raw.color as ProfileColor) ? raw.color! : 'violet',
  };
}

function load(): UserProfile {
  let saved: Partial<UserProfile> = {};
  try {
    const raw = JSON.parse(read(KEY) ?? 'null');
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.version === 1) saved = raw;
  } catch { /* Profilo corrotto: recupera almeno il nome precedente. */ }
  // Il nome vuoto è una scelta valida. La migrazione non scrive durante l'apertura.
  return normalize({ ...saved, name: typeof saved.name === 'string' ? saved.name : read(AUTHOR_KEY) ?? '' });
}

let profile = load();
const listeners = new Set<() => void>();
export const getProfile = () => profile;
export const subscribeProfile = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const useProfile = () => useSyncExternalStore(subscribeProfile, getProfile);

/** True solo quando il profilo è stato salvato; in caso di errore resta utilizzabile in memoria. */
export function updateProfile(patch: Partial<UserProfile>): boolean {
  profile = normalize({ ...profile, ...patch });
  let persisted = false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, ...profile }));
    persisted = true;
  } catch { /* La UI segnala che la modifica vale per questa sessione. */ }
  // Compatibilità con i nomi salvati dalle versioni precedenti di HeroFig.
  if (persisted) {
    try { localStorage.setItem(AUTHOR_KEY, profile.name); } catch { /* Il profilo è già salvato. */ }
  }
  listeners.forEach((listener) => listener());
  return persisted;
}

export const getProfileName = () => profile.name;
export const setProfileName = (name: string) => { updateProfile({ name }); };
export const useProfileName = () => useSyncExternalStore(subscribeProfile, getProfileName);

export function profileInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'HF';
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : '';
  return (first + last).toLocaleUpperCase();
}
