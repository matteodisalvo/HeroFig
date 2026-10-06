import { useSyncExternalStore } from 'react';
import { setupMessages } from './locales/setup';
import { editorMessages } from './locales/editor';
import { panelsMessages } from './locales/panels';
import { nativeMessages } from './locales/native';
import { paperMessages } from './locales/paper';
import { feedbackMessages } from './locales/feedback';
import { profileMessages } from './locales/profile';
import { libraryMessages } from './locales/library';

export const LANGUAGES = [
  { id: 'it', name: 'Italiano', english: 'Italian' },
  { id: 'en', name: 'English', english: 'English' },
  { id: 'es', name: 'Español', english: 'Spanish' },
  { id: 'fr', name: 'Français', english: 'French' },
  { id: 'de', name: 'Deutsch', english: 'German' },
  { id: 'pt', name: 'Português', english: 'Portuguese' },
  { id: 'ru', name: 'Русский', english: 'Russian' },
  { id: 'zh', name: '简体中文', english: 'Chinese' },
  { id: 'ja', name: '日本語', english: 'Japanese' },
  { id: 'ko', name: '한국어', english: 'Korean' },
  { id: 'ar', name: 'العربية', english: 'Arabic' },
  { id: 'hi', name: 'हिन्दी', english: 'Hindi' },
] as const;
export type Language = typeof LANGUAGES[number]['id'];
export type LanguagePreference = Language | 'system';
const KEY = 'tensorfig:language';
const isLanguage = (value: unknown): value is Language => LANGUAGES.some((language) => language.id === value);

export function systemLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  for (const locale of navigator.languages ?? [navigator.language]) {
    const language = locale.toLowerCase().split(/[-_]/)[0];
    if (isLanguage(language)) return language;
  }
  return 'en';
}

function load(): LanguagePreference {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLanguage(saved)) return saved;
  } catch { /* Preferenza disponibile comunque per la sessione. */ }
  return 'system';
}

let preference = load();
const listeners = new Set<() => void>();
export const getLanguagePreference = () => preference;
export const getLanguage = (): Language => preference === 'system' ? systemLanguage() : preference;
export const useLanguage = () => useSyncExternalStore(
  (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getLanguage,
);

export function setLanguage(language: LanguagePreference, options: { persist?: boolean } = {}) {
  if (language !== 'system' && !isLanguage(language)) return;
  preference = language;
  if (options.persist !== false) {
    try { localStorage.setItem(KEY, language); } catch { /* Sessione senza storage. */ }
  }
  listeners.forEach((listener) => listener());
}

const catalogs = [setupMessages, editorMessages, panelsMessages, nativeMessages, paperMessages, feedbackMessages, profileMessages, libraryMessages];

/** Testo sorgente in una lingua precisa, indipendente da quella scelta (es. la ricerca anche in inglese). */
export function translateTo(language: Language, source: string): string {
  return language === 'it' ? source : catalogs.map((catalog) => catalog[language]?.[source]).find((value) => value !== undefined) ?? source;
}

/** Solo testi dell'interfaccia: mai nomi di file, etichette delle figure o input utente. */
export function t(source: string, params?: Record<string, string | number>): string {
  const translated = translateTo(getLanguage(), source);
  return params ? translated.replace(/\{(\w+)\}/g, (match: string, name: string) => String(params[name] ?? match)) : translated;
}
