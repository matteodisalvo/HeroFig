// Lavoro condiviso su una cartella di progetto (Dropbox, Drive…): chi sei, e chi altro ha
// aperto la stessa figura. I commenti stanno nel documento (model.ts), la presenza in piccoli
// file dentro la cartella del progetto.
import { useEffect, useRef, useState } from 'react';
import { presenceList, presenceSet, type Presence } from './platform';
import { projectDirs, samePath } from './projects';
import { useStore } from './store';
import { useProfileName as useAuthor } from './profile';
export { getProfileName as getAuthor, setProfileName as setAuthor, useProfileName as useAuthor } from './profile';

const CLIENT_KEY = 'mlsketch:client';
const BEAT_MS = 20000;

const read = (key: string) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // senza storage il valore vale per questa sessione
  }
};

let client = read(CLIENT_KEY);
if (!client) {
  client = Math.random().toString(36).slice(2, 10);
  write(CLIENT_KEY, client);
}
export const clientId = client;

const split = (path: string) => {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
};

/** Le altre persone nella cartella di un progetto. */
export const othersIn = (dir: string) => presenceList(dir, clientId);

/**
 * Segnala agli altri la figura aperta (solo se sta in un progetto) e restituisce chi altro
 * la sta guardando.
 */
export function usePresence(): Presence[] {
  const filePath = useStore((s) => s.filePath);
  const name = useAuthor();
  const [others, setOthers] = useState<Presence[]>([]);
  const pendingWrite = useRef(Promise.resolve());
  useEffect(() => {
    setOthers([]);
    if (!filePath) return;
    const { dir, name: figure } = split(filePath);
    if (!projectDirs().some((d) => samePath(d, dir))) return;
    let alive = true;
    // Cancella prima la presenza precedente, poi scrive quella nuova: le due
    // chiamate IPC possono completare fuori ordine quando si cambia nome.
    const writePresence = (who: string, current: string | null) => {
      pendingWrite.current = pendingWrite.current.catch(() => {}).then(() => presenceSet(dir, clientId, who, current));
      return pendingWrite.current;
    };
    const beat = async () => {
      try {
        await writePresence(name || 'Qualcuno', figure);
        const list = await othersIn(dir);
        if (alive) setOthers(list.filter((p) => p.figure === figure));
      } catch {
        // cartella momentaneamente non raggiungibile: si riprova al prossimo giro
      }
    };
    void beat();
    const timer = setInterval(beat, BEAT_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      writePresence('', null).catch(() => {});
    };
  }, [filePath, name]);
  return others;
}
