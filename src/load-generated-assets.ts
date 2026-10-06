import { registerGeneratedAssets } from './generated-assets';
import dimensions from './assets/generated/dimensions.json';

// L'avvio importa solo URL e dimensioni, senza decine di MB di base64 nel bundle.
const files = import.meta.glob<string>('./assets/generated/{medical,bio,signals,icons}/*.{png,jpg}', {
  eager: true,
  query: '?no-inline',
  import: 'default',
});

// Vite produce moduli separati caricati soltanto quando la relativa immagine è esportata.
// Gli import locali funzionano anche con file:// in Electron, senza fetch remoto.
const inlineFiles = import.meta.glob<string>('./assets/generated/{medical,bio,signals,icons}/*.{png,jpg}', {
  query: '?inline',
  import: 'default',
});

const idForPath = (path: string) => path.slice(path.lastIndexOf('/') + 1, path.lastIndexOf('.'));
registerGeneratedAssets(
  Object.fromEntries(Object.entries(files).map(([path, src]) => [idForPath(path), src])),
  {
    dimensions,
    loaders: Object.fromEntries(Object.entries(inlineFiles).map(([path, load]) => [idForPath(path), load])),
  },
);
