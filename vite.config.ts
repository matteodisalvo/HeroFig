import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

// Content-Security-Policy della build (app desktop e versione web). Non in sviluppo: il dev server di Vite usa
// script inline (React Refresh) e il websocket dell'HMR. connect-src: il server del gruppo sulla rete locale
// (http://<indirizzo>:<porta>, qualsiasi), FormSubmit per le segnalazioni dalla versione web, data: per le
// immagini generate. Gli stili inline servono alla stampa in PDF della versione web.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob: http: https://formsubmit.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');

// base relativa: in produzione Electron carica dist/index.html via file://
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'herofig-csp',
      apply: 'build',
      transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
    },
  ],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5183, strictPort: false },
});
