import { t, type Language } from './i18n';
import { setAppLanguage } from './platform';

// The renderer owns the dictionaries so native menus use exactly the same wording.
export const NATIVE_SOURCES = [
  'File', 'Nuovo', 'Apri…', 'Salva', 'Salva con nome…', 'Inserisci immagine…', 'Esporta',
  'Configura HeroFig…', 'Il tuo spazio', 'Esci', 'Modifica', 'Annulla modifica', 'Ripeti', 'Taglia', 'Copia', 'Incolla',
  'Copia come immagine', 'Copia come SVG', 'Copia stile', 'Incolla stile', 'Raggruppa in un contenitore',
  'Duplica', 'Seleziona tutto', 'Vista', 'Ingrandisci', 'Riduci', 'Adatta alla finestra', 'Dimensioni reali',
  'Zoom sulla selezione', 'Cerca nella libreria', 'Mostra/nascondi libreria e pannello', 'Mostra/nascondi griglia',
  'Schermo intero', 'Strumenti di sviluppo', 'Aiuto', 'Scorciatoie da tastiera', 'Informazioni su HeroFig',
  'Richieste e segnalazioni',
  'Non salvare', 'Annulla', 'Salvare le modifiche prima di chiudere?', 'Se non salvi, le modifiche andranno perse.',
  'Impossibile aprire il file', 'Immagine SVG', 'Documento PDF', 'Immagine PNG', 'Codice TikZ',
  'Cartella del paper', 'Scegli la cartella del paper: quella con il file .tex principale',
  'Usa questa cartella', 'Scegli (o crea) la cartella del progetto: le figure .hfig al suo interno ne faranno parte.',
] as const;

export function syncNativeLanguage(language: Language) {
  const labels = Object.fromEntries(NATIVE_SOURCES.map((source) => [source, t(source)]));
  if (language === 'it') labels['Annulla modifica'] = 'Annulla';
  setAppLanguage(language, labels);
}
