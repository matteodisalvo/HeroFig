import { t } from '../i18n';
// Sezione "paper" nella barra della vista Pagina: collega la figura a una cartella del paper, a Google Drive
// (per Overleaf gratuito) o a un progetto Overleaf con Git; dice dove il paper la usa e se ha l'ultima versione.
// Solo nell'app desktop.
import { useEffect, useState, type ReactNode } from 'react';
import { VENUES } from '../paper';
import { lastPush, lastSynced, onPaperSynced, paperName, syncPaper } from '../papersync';
import {
  copyText,
  hasPaperSync,
  overleafHasToken,
  overleafLink,
  paperChoose,
  paperDrive,
  paperReveal,
  paperScan,
  type PaperScan,
} from '../platform';
import { getState, setDoc, useStore } from '../store';
import { toast } from '../ui';
import './paperlink.css';
import { FILE_MANAGER, keys } from '../os';

// ---------- icone (16 × 16, stesso tratto delle altre icone dell'app) ----------

const PATHS = {
  link: 'M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.9.9 M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8a3 3 0 0 0 4.2 4.2l.9-.9',
  folder: 'M1.5 4h4.2l1.5 1.5h7.3v7.5h-13z',
  drive: 'M5.5 2.5h5l4 7-2.5 4h-8l-2.5-4z M5.5 2.5l4 7h5 M1.5 9.5l4-7 M4 13.5l2.5-4h8',
  leaf: 'M2.5 13.5c0-6.5 4.5-11 11-11 0 6.5-4.5 11-11 11z M2.5 13.5l6-6',
  git: 'M5 2.5v11 M5 13.5a1.5 1.5 0 1 0 0-.1 M5 2.5a1.5 1.5 0 1 0 0-.1 M11.5 5.5a1.5 1.5 0 1 0 0-.1 M11.5 7c0 3-6.5 2-6.5 5',
  refresh: 'M13.5 8A5.5 5.5 0 1 1 11.9 4.1 M13.5 1.8v3.4h-3.4',
  reveal: 'M8.5 2.5h5v5 M13.5 2.5 7.5 8.5 M12 9.5v4H2.5V4h4',
  unlink: 'M4 4l8 8 M12 4l-8 8',
  check: 'M3 8.5l3 3 7-7',
  clock: 'M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M8 4.5V8l2.5 1.5',
  doc: 'M3.5 1.5h6l3 3v10h-9z M9.5 1.5v3h3 M5.5 8h5 M5.5 10.5h5',
  copy: 'M5.5 5.5h8v8h-8z M10.5 5.5v-3h-8v8h3',
  info: 'M8 1.5a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13z M8 7v4.5 M8 4.5v.5',
  cloud: 'M4.5 12.5h7a3 3 0 0 0 .4-6A4.2 4.2 0 0 0 4 6.7a2.9 2.9 0 0 0 .5 5.8z',
} as const;
type IconName = keyof typeof PATHS;

const Ico = ({ n }: { n: IconName }) => (
  <svg className="plink-ico" width={15} height={15} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[n]} />
  </svg>
);

function IconButton(p: { n: IconName; tip: string; onClick: () => void }) {
  return (
    <button className="plink-icon-btn" onClick={p.onClick} aria-label={t(p.tip)} data-tip={t(p.tip)}>
      <Ico n={p.n} />
    </button>
  );
}

function Chip(p: { tone: 'ok' | 'warn' | 'info'; icon: IconName; children: ReactNode; tip?: string }) {
  return (
    <span className={`plink-chip ${p.tone}`} data-tip={p.tip ? t(p.tip) : undefined}>
      <Ico n={p.icon} />
      {p.children}
    </span>
  );
}

// ---------- azioni ----------

function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return t('adesso');
  if (s < 3600) return t('{count} min fa', { count: Math.round(s / 60) });
  if (s < 86400) return t('{count} ore fa', { count: Math.round(s / 3600) });
  return t('{count} giorni fa', { count: Math.round(s / 86400) });
}

function setPaper(patch: { paperDir?: string; paperName?: string }) {
  const cur = getState().doc;
  setDoc({ ...cur, settings: { ...cur.settings, ...patch } });
}

async function syncNow() {
  const { doc, filePath } = getState();
  const r = await syncPaper(doc, filePath);
  if (!r.ok) toast(r.error ?? t('Non riesco ad aggiornare il paper.'), 'info');
  else if (r.pushError) toast(t('Scritta nella copia locale, ma non inviata a Overleaf: {error}', { error: r.pushError }), 'info');
  else toast(t(r.pushed ? 'Inviata a Overleaf: {files}' : 'Aggiornata nel paper: {files}', { files: r.files ?? '' }));
}

/** Rivista dell'app che corrisponde al template e al formato usati dal paper; null se non si capisce. */
function venueFor(scan: PaperScan, current: string): string | null {
  if (!scan.family) return null;
  const span = scan.span ?? (current.endsWith('-col') ? 'col' : 'full');
  const id = `${scan.family}-${span}`;
  return VENUES.some((v) => v.id === id) ? id : VENUES.some((v) => v.id === scan.family) ? scan.family : null;
}

/** Collega la cartella e, se il paper usa un template noto, imposta la rivista giusta. */
async function linkTo(dir: string) {
  const { doc, filePath } = getState();
  setPaper({ paperDir: dir });
  const scan = await paperScan(dir, filePath, paperName(doc, filePath));
  const venue = scan.ok ? venueFor(scan, doc.settings.venue) : null;
  if (venue && venue !== doc.settings.venue) {
    const cur = getState().doc;
    setDoc({ ...cur, settings: { ...cur.settings, venue } });
    toast(t('Formato preso dal paper: {venue}', { venue: VENUES.find((v) => v.id === venue)?.name ?? venue }));
  }
  await syncNow();
}

async function linkFolder() {
  const chosen = await paperChoose(getState().filePath);
  if (chosen) await linkTo(chosen.dir);
}

/** Overleaf gratuito: la figura va in Il mio Drive/HeroFig, e Overleaf la carica «da Google Drive». */
async function linkDrive() {
  const drive = await paperDrive();
  if (!drive) {
    toast(t('Non trovo Google Drive su questo computer: installa «Google Drive per computer» oppure scegli una cartella.'), 'info');
    return;
  }
  await linkTo(drive.dir);
}

// ---------- modulo per Overleaf con Git ----------

function GitForm({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    overleafHasToken().then(setSaved);
  }, []);
  const connect = async () => {
    setBusy(true);
    const r = await overleafLink(url, token);
    setBusy(false);
    if (!r.ok || !r.dir) {
      toast(r.error ?? t('Collegamento non riuscito.'), 'info');
      return;
    }
    onClose();
    await linkTo(r.dir);
  };
  return (
    <div className="plink-form">
      <label>
        <span>{t("Link del progetto")}</span>
        <input id="plink-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.overleaf.com/project/…" />
      </label>
      <label>
        <span>{t("Token Git")}</span>
        <input
          id="plink-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={saved ? t('già salvato su questo computer') : 'olp_…'}
          autoComplete="off"
        />
      </label>
      <p className="plink-hint">
        <Ico n="info" />
        {t('Il token si genera in Overleaf, Impostazioni account › Integrazione Git, e resta cifrato su questo computer. Serve un piano Overleaf che includa Git.')}
      </p>
      <div className="plink-form-actions">
        <button className="btn" onClick={onClose}>
          {t("Annulla")}
        </button>
        <button className="btn primary" disabled={!url.trim() || (!token.trim() && !saved) || busy} onClick={connect}>
          {t(busy ? 'Collego…' : 'Collega')}
        </button>
      </div>
    </div>
  );
}

// ---------- sezione ----------

export function PaperLink() {
  const dir = useStore((s) => s.doc.settings.paperDir);
  const custom = useStore((s) => s.doc.settings.paperName);
  const venue = useStore((s) => s.doc.settings.venue);
  const filePath = useStore((s) => s.filePath);
  const dirty = useStore((s) => s.dirty);
  const doc = useStore((s) => s.doc);
  const name = paperName(doc, filePath);
  const [scan, setScan] = useState<PaperScan | null>(null);
  const [tick, setTick] = useState(0);
  const [gitForm, setGitForm] = useState(false);
  useEffect(() => onPaperSynced(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (!dir) return setScan(null);
    let alive = true;
    paperScan(dir, filePath, name).then((s) => alive && setScan(s));
    return () => {
      alive = false;
    };
  }, [dir, filePath, name, tick]);
  // "aggiornata X min fa" resta vero anche se nessuno tocca niente
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (!hasPaperSync) return null;

  if (!dir) {
    return (
      <section className="plink">
        <div className="plink-head">
          <Ico n="link" />
          <b>{t("Collega al paper")}</b>
          <span className="plink-muted">{t("a ogni salvataggio il PDF si aggiorna anche lì")}</span>
        </div>
        <div className="plink-choices">
          <button className="plink-choice" onClick={linkFolder}>
            <Ico n="folder" />
            <span>
              <b>{t("Cartella del paper")}</b>
              <small>{t("LaTeX sul computer, GitHub, Dropbox")}</small>
            </span>
          </button>
          <button className="plink-choice" onClick={linkDrive}>
            <Ico n="drive" />
            <span>
              <b>{t("Overleaf gratuito")}</b>
              <small>{t("tramite Google Drive")}</small>
            </span>
          </button>
          <button className="plink-choice" onClick={() => setGitForm(true)} aria-pressed={gitForm}>
            <Ico n="git" />
            <span>
              <b>{t("Overleaf con Git")}</b>
              <small>{t("automatico, piani con Git")}</small>
            </span>
          </button>
        </div>
        {gitForm && <GitForm onClose={() => setGitForm(false)} />}
      </section>
    );
  }

  if (scan && !scan.ok) {
    return (
      <section className="plink">
        <div className="plink-head">
          <Ico n="folder" />
          <span className="plink-error">{scan.error}</span>
          <span className="plink-actions">
            <button className="btn" onClick={linkFolder}>
              {t("Scegli di nuovo…")}
            </button>
            <IconButton n="unlink" tip="Scollega" onClick={() => setPaper({ paperDir: '' })} />
          </span>
        </div>
      </section>
    );
  }

  const kind: 'overleaf' | 'drive' | 'folder' = scan?.overleaf ? 'overleaf' : scan?.cloud === 'gdrive' ? 'drive' : 'folder';
  const where = kind === 'overleaf' ? 'Overleaf' : kind === 'drive' ? 'Google Drive › HeroFig' : (scan?.root?.split(/[\\/]/).pop() ?? '…');
  const sub = scan?.sub ?? '';
  const refs = scan?.refs ?? [];
  const exchange = scan?.ok && scan.texCount === 0 && kind !== 'overleaf'; // cartella di scambio per Overleaf gratuito
  const pending = dirty && doc !== lastSynced();
  const stale = !!scan?.pdfTime && !!scan.tfigTime && scan.tfigTime > scan.pdfTime + 2000;
  const push = lastPush();
  const suggested = scan ? venueFor(scan, venue) : null;
  const snippet = `\\includegraphics[width=\\linewidth]{${sub ? sub + '/' : ''}${name}}`;

  return (
    <section className="plink">
      <div className="plink-head">
        <span className={`plink-kind ${kind}`}>
          <Ico n={kind === 'overleaf' ? 'leaf' : kind === 'drive' ? 'drive' : 'folder'} />
        </span>
        <span className="plink-path">
          <span className="plink-where">{where}</span>
          {sub && (
            <>
              <span className="plink-sep">›</span>
              <span>{sub}</span>
            </>
          )}
          <span className="plink-sep">›</span>
          <input
            className="plink-name"
            value={custom || name}
            onChange={(e) => setPaper({ paperName: e.target.value })}
            aria-label={t("Nome dei file nel paper")}
            data-tip={t("Nome dei file scritti nel paper (.pdf e .tex)")}
          />
          <span className="plink-ext">.pdf</span>
        </span>
        <span className="plink-actions">
          <IconButton n="refresh" tip={kind === 'overleaf' ? 'Aggiorna e invia a Overleaf adesso' : 'Aggiorna adesso'} onClick={syncNow} />
          <IconButton n="reveal" tip={t('Mostra il PDF in {manager}', { manager: FILE_MANAGER })} onClick={() => paperReveal(dir, filePath, name)} />
          <IconButton n="unlink" tip="Scollega: i file già scritti restano" onClick={() => setPaper({ paperDir: '' })} />
        </span>
      </div>

      <div className="plink-chips">
        {pending ? (
          <Chip tone="warn" icon="clock">
            {t('Da aggiornare: salva con {keys}', { keys: keys('⌘S') })}
          </Chip>
        ) : !scan?.pdfTime ? (
          <Chip tone="warn" icon="clock">
            {t("Non ancora scritta")}
          </Chip>
        ) : stale ? (
          <Chip tone="warn" icon="clock">
            {t("Versione vecchia nel paper")}
          </Chip>
        ) : (
          <Chip tone="ok" icon="check">
            {t(exchange ? 'Nella cartella: {time}' : 'Aggiornata: {time}', { time: ago(scan.pdfTime) })}
          </Chip>
        )}

        {kind === 'overleaf' &&
          (push.error ? (
            <Chip tone="warn" icon="cloud" tip={push.error}>
              {t("Non inviata a Overleaf")}
            </Chip>
          ) : push.time ? (
            <Chip tone="ok" icon="cloud">
              {t('Su Overleaf: {time}', { time: ago(push.time) })}
            </Chip>
          ) : null)}

        {!exchange &&
          (refs.length ? (
            <Chip tone="ok" icon="doc" tip={refs.map((r) => `${r.file}:${r.line}`).join('\n')}>
              {t('{file} · riga {line}', { file: refs[0].file, line: refs[0].line })}
              {refs.length > 1 ? ` (+${refs.length - 1})` : ''}
            </Chip>
          ) : (
            <Chip tone="info" icon="doc">
              {t("Non ancora nel paper")}
              <button
                className="plink-chip-btn"
                onClick={async () => {
                  await copyText(snippet);
                  toast(t('Copiato: {text}', { text: snippet }));
                }}
                data-tip={t('Copia {text}', { text: snippet })}
                aria-label={t("Copia la riga \\includegraphics")}
              >
                <Ico n="copy" />
              </button>
            </Chip>
          ))}

        {suggested && suggested !== venue && (
          <Chip tone="info" icon="info">
            {t('Il paper è {venue}', { venue: VENUES.find((v) => v.id === suggested)?.name ?? suggested })}
            <button className="plink-chip-btn text" onClick={() => setDoc({ ...getState().doc, settings: { ...getState().doc.settings, venue: suggested } })}>
              {t("Usa")}
            </button>
          </Chip>
        )}
      </div>

      {exchange && (
        <p className="plink-hint">
          <Ico n="info" />
          {t('In Overleaf: la prima volta «Carica › Da Google Drive»; poi, dopo ogni salvataggio qui, «Aggiorna» sul file. In alternativa trascina il PDF da {manager}.', { manager: FILE_MANAGER })}
        </p>
      )}
    </section>
  );
}
