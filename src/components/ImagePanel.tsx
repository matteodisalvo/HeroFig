import { t, useLanguage } from '../i18n';
// Pulsante t("Immagine"): inserire un file dell'utente, oppure generare un'immagine illustrativa
// con FLUX su Hugging Face (electron/images.cjs). Per generare serve una chiave gratuita di Hugging Face,
// incollata una volta sola: la custodisce cifrata il processo principale, qui arriva solo da dove viene.
// Le immagini generate restano marcate nel documento (NodeModel.ai), così all'export si ricorda di dichiararle.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { run } from '../App';
import { addImage } from '../actions';
import { readImage } from '../images';
import { clearImageToken, hasImageGen, imageGenerate, imageStop, imageTokenSource, onImageStep, setImageToken, type ImageKeyInfo, type ImageKeySource, type ImageResult } from '../platform';
import { toast } from '../ui';
import { Icon } from './Icon';
import './image.css';

// pagina di Hugging Face che prepara una chiave con il solo permesso «Make calls to Inference Providers»
const KEY_URL = 'https://huggingface.co/settings/tokens/new?ownUserPermissions=inference.serverless.write&tokenType=fineGrained';
// è anche l'errore del processo principale quando la chiave manca: allora basta il riquadro
const NEED_KEY = 'Per generare immagini serve una chiave gratuita di Hugging Face, una volta sola.';
const MAX_PROMPT = 2000; // come in electron/images.cjs

/** Riquadro per incollare la chiave di Hugging Face. */
function KeyBox({ problem, focus, onSaved, onCancel }: { problem: string; focus: boolean; onSaved: () => void; onCancel?: () => void }) {
  useLanguage();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(problem);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) input.current?.focus();
  }, [focus]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const value = key.trim();
    if (!value || busy) return;
    setBusy(true);
    let res: { ok?: boolean; error?: string };
    try {
      res = await setImageToken(value);
    } catch (err) {
      res = { error: err instanceof Error ? err.message : String(err) };
    }
    setBusy(false);
    if (res.ok) onSaved();
    else {
      setError(t(res.error ?? 'Non riesco a salvare la chiave.'));
      input.current?.focus();
    }
  };

  return (
    <form className="image-key" onSubmit={save}>
      <p className="hint">{t(NEED_KEY)}</p>
      <a className="link-btn" href={KEY_URL} target="_blank" rel="noreferrer">{t("Crea una chiave")}</a>
      <label className="image-key-field">
        <span>{t("Chiave di Hugging Face")}</span>
        <input
          ref={input}
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="hf_…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!error}
        />
      </label>
      {error && <div className="image-error" role="alert">{error}</div>}
      <div className="image-actions">
        <button type="submit" className="btn primary-fill" disabled={!key.trim() || busy}>{t("Salva la chiave")}</button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>{t("Annulla")}</button>
        )}
      </div>
    </form>
  );
}

function ImagePanel({ left, onClose }: { left: number; onClose: () => void }) {
  useLanguage();
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ src: string; prompt: string } | null>(null);
  // da dove viene la chiave di Hugging Face: undefined finché non si sa, null se manca
  const [source, setSource] = useState<ImageKeySource | undefined>(undefined);
  const [variable, setVariable] = useState('HF_TOKEN'); // la variabile d'ambiente che la contiene
  // riquadro della chiave aperto apposta («Cambia chiave», chiave rifiutata), con il motivo
  const [asking, setAsking] = useState<{ problem: string } | null>(null);
  const alive = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const focusPrompt = useRef(false);

  // salvata la chiave (o chiuso il riquadro), il fuoco passa alla descrizione appena compare
  useEffect(() => {
    if (focusPrompt.current && textarea.current) {
      focusPrompt.current = false;
      textarea.current.focus();
    }
  });

  const loadSource = async () => {
    let next: ImageKeyInfo = { source: null };
    try {
      next = await imageTokenSource();
    } catch {
      // senza risposta dall'app si chiede la chiave
    }
    if (alive.current) {
      setSource(next.source);
      setVariable(next.variable ?? 'HF_TOKEN');
    }
    return next.source;
  };

  useEffect(() => onImageStep(setStep), []);
  useEffect(() => {
    alive.current = true;
    if (hasImageGen) void loadSource();
    return () => {
      alive.current = false;
      imageStop();
    };
  }, []);

  const generate = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    setStep(t('Avvio…'));
    let res: ImageResult;
    try {
      res = await imageGenerate({ prompt: text, style: '' });
    } catch (err) {
      // senza risposta dall'app il pannello resterebbe per sempre in attesa
      res = { error: err instanceof Error ? err.message : String(err) };
    }
    if (!alive.current) return;
    setBusy(false);
    if (res.src) setResult({ src: res.src, prompt: text });
    else if (res.needsToken) {
      // chiave mancante o rifiutata da Hugging Face: la si chiede di nuovo, con il motivo
      setAsking({ problem: res.error && res.error !== NEED_KEY ? t(res.error) : '' });
      void loadSource();
    } else setError(res.error ? t(res.error, { detail: res.detail ?? '' }) : t('Generazione non riuscita.'));
  };

  const keySaved = () => {
    focusPrompt.current = true;
    setAsking(null);
    setSource('app');
  };

  // «Annulla»: si torna alla descrizione, e il fuoco con lei (il riquadro che lo aveva sparisce)
  const keyCancel = () => {
    focusPrompt.current = true;
    setAsking(null);
  };

  const removeKey = async () => {
    try {
      await clearImageToken();
    } catch {
      // la chiave resta: la riga qui sotto lo mostra
    }
    // può restare quella di HF_TOKEN o di «hf auth login»; se non ce n'è più nessuna, la si chiede
    if (!(await loadSource()) && alive.current) setAsking({ problem: '' });
  };

  const insert = async () => {
    if (!result) return;
    try {
      // stesso percorso dei file dell'utente: ridimensiona e alleggerisce l'immagine
      const img = await readImage(await (await fetch(result.src)).blob());
      addImage({ ...img, ai: result.prompt });
      toast(t('Immagine inserita: è marcata come generata con l’IA'));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="image-panel" style={{ left }} onKeyDown={(e) => e.stopPropagation()}>
      <button
        className="btn full"
        onClick={() => {
          onClose();
          void run('insertImage');
        }}
        data-keys="⇧⌘I"
      >
        <Icon name="open" size={14} />{t("Scegli un file dal computer…")}</button>
      <p className="hint">{t("Puoi anche trascinare o incollare un’immagine sul foglio.")}</p>
      {hasImageGen && source !== undefined && (
        <>
          <div className="image-sep">{t("oppure generala")}</div>
          {source === null || asking ? (
            <KeyBox problem={asking?.problem ?? ''} focus={!!asking || source === null} onSaved={keySaved} onCancel={source ? keyCancel : undefined} />
          ) : (
            <>
              <textarea
                ref={textarea}
                rows={3}
                value={prompt}
                maxLength={MAX_PROMPT}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t("Descrivi l'immagine, meglio in inglese, e dì anche lo stile: es. H&E stained histology section, microscopy image")}
                aria-label={t("Descrizione dell'immagine")}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void generate();
                }}
              />
              <p className="hint">{t("La genera FLUX tramite Hugging Face: la descrizione va a Hugging Face e al fornitore che fa girare il modello. Usa il piccolo credito gratuito mensile del tuo account, poi si paga a consumo.")}</p>
              {result && !busy && <img className="image-result" src={result.src} alt={t('Immagine generata: {prompt}', { prompt: result.prompt })} />}
              {busy && <div className="image-busy" role="status">{t(step)}</div>}
              {error && <div className="image-error" role="alert">{error}</div>}
              <div className="image-actions">
                {busy ? (
                  <button
                    className="btn"
                    onClick={() => {
                      imageStop();
                    }}
                  >{t("Ferma")}</button> ) : ( <button className="btn" disabled={!prompt.trim()} onClick={generate}>
                    {result ? t('Genera di nuovo') : t('Genera')}
                  </button>
                )}
                {result && !busy && (
                  <button className="btn primary-fill" onClick={insert}>{t("Inserisci nel foglio")}</button>
                )}
              </div>
              <p className="hint">{t("Sono immagini di esempio, non dati veri: molte riviste chiedono di dichiarare quelle generate con l’IA.")}</p>
              <div className="image-key-status">
                <span className="dot" aria-hidden="true" />
                <span>{t("Collegato a Hugging Face")}</span>
                {source !== 'app' && <code>{source === 'env' ? variable : 'hf auth login'}</code>}
                <span className="image-key-links">
                  <button className="link-btn" onClick={() => setAsking({ problem: '' })} disabled={busy}>{t("Cambia chiave")}</button>
                  {source === 'app' && (
                    <button className="link-btn" onClick={removeKey} disabled={busy}>{t("Rimuovi")}</button>
                  )}
                </span>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Pulsante della barra degli strumenti: file dal computer oppure immagine generata. */
export function ImageButton() {
  useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const wrap = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  const left = Math.max(12, Math.min((ref.current?.getBoundingClientRect().left ?? 300) - 8, window.innerWidth - 372));
  return (
    <span ref={wrap} className="image-wrap">
      <button
        ref={ref}
        className={open ? 'tool minor on' : 'tool minor'}
        onClick={() => setOpen((o) => !o)}
        aria-pressed={open}
        aria-label={t("Immagine")}
        data-tip={t("Inserisci una tua immagine, oppure generane una di esempio")}
      >
        <Icon name="image" />
        <span>{t("Immagine")}</span>
      </button>
      {open && <ImagePanel left={left} onClose={() => setOpen(false)} />}
    </span>
  );
}
