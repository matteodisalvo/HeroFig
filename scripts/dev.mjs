// Avvia Electron: in sviluppo sul dev server di Vite, con --prod sulla build in dist/.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electron = require('electron');
const prod = process.argv.includes('--prod');

const env = { ...process.env };
// impostata dai terminali di alcuni editor (es. VS Code): farebbe partire Electron come semplice Node
delete env.ELECTRON_RUN_AS_NODE;

let server;
if (!prod) {
  const { createServer } = await import('vite');
  server = await createServer();
  await server.listen();
  env.VITE_DEV_SERVER_URL = server.resolvedUrls.local[0];
}

const child = spawn(electron, ['.'], { stdio: 'inherit', env });
child.on('exit', async (code) => {
  await server?.close();
  process.exit(code ?? 0);
});
