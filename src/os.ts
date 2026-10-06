// Differenze fra macOS e Windows/Linux mostrate all'utente: nomi dei tasti e del gestore dei file.
// I testi dell'app scrivono le scorciatoie alla Mac (⌘S); keys() le traduce dove serve (Ctrl+S).

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const MODS: Record<string, string> = { '⌃': 'Ctrl', '⌘': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' };
const ORDER = ['Ctrl', 'Alt', 'Shift']; // l'ordine usato su Windows: Ctrl+Shift+S, non Shift+Ctrl+S

/** Scorciatoia nella forma del sistema: "⇧⌘S" resta così su Mac, diventa "Ctrl+Shift+S" altrove. */
export function keys(text: string): string {
  if (IS_MAC || !text) return text;
  return text
    .replace(/([⌃⌥⇧⌘]+)([^\s:,;)]?)/g, (_, mods: string, key: string) => {
      const names = ORDER.filter((n) => [...mods].some((m) => MODS[m] === n));
      return [...names, ...(key ? [key] : [])].join('+'); // un tasto da solo ("⇧ + clic") resta senza "+"
    })
    .replace(/↩/g, 'Invio')
    .replace(/⌫/g, 'Canc'); // così si chiama il tasto sulle tastiere italiane per Windows
}

/** Come si chiama il gestore dei file del sistema. */
export const FILE_MANAGER = IS_MAC ? 'Finder' : 'Esplora file';
