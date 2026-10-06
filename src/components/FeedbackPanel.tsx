import { useEffect, useRef, type KeyboardEvent } from 'react';
import {
  FEEDBACK_KINDS, closeFeedback, feedbackText, newFeedback,
  sendFeedback, setFeedbackKind, updateFeedbackDraft, useFeedback,
  type FeedbackContext, type FeedbackKind,
} from '../feedback';
import { getLanguage, t, useLanguage } from '../i18n';
import { openPacks } from '../packs';
import { copyText, isDesktop, openExternal } from '../platform';
import { toast } from '../ui';
import { Icon } from './Icon';
import './feedback.css';

const PROFILE_URL = 'https://github.com/matteodisalvo';

const labels: Record<FeedbackKind, string> = {
  package: 'Nuovo pacchetto', addition: 'Aggiunta', bug: 'Segnala un errore',
};
const titles: Record<FeedbackKind, [string, string]> = {
  package: ['Ambito o titolo', 'Es. Neuroscienze'],
  addition: ['Cosa vorresti aggiungere?', 'Es. Un nuovo modello o una forma'],
  bug: ['Cosa non funziona?', 'Es. L’esportazione PDF non termina'],
};
const descriptions: Record<FeedbackKind, string> = {
  package: 'Quali forme o modelli ti servono? A cosa ti servirebbero?',
  addition: 'Descrivi l’aggiunta e dove vorresti trovarla.',
  bug: 'Descrivi cosa succede e gli eventuali messaggi di errore.',
};
const errors = {
  validation: 'Compila titolo e descrizione e controlla email e link.',
  network: 'Sei offline. La bozza è conservata: riprova quando sei connesso.',
  rejected: 'Il servizio non ha accettato la richiesta. La bozza è conservata: riprova più tardi.',
  unconfirmed: 'Non è arrivata una conferma. Il messaggio potrebbe essere stato ricevuto; la bozza è conservata.',
  activation: 'Il servizio deve essere attivato da chi gestisce HeroFig. La bozza è conservata.',
};

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], summary, [tabindex="0"]';

/** Tab e Maiusc+Tab restano dentro una finestra modale che non è un <dialog> nativo. */
export function keepTabInside(event: KeyboardEvent<HTMLElement>, container: HTMLElement | null) {
  if (event.key !== 'Tab' || !container) return;
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter((node) => node.getClientRects().length && !node.closest('fieldset:disabled'));
  const first = items[0], last = items[items.length - 1];
  const active = document.activeElement as HTMLElement;
  if (!first) { event.preventDefault(); container.focus(); return; }
  if (event.shiftKey && (active === first || !items.includes(active))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (active === last || !items.includes(active))) {
    event.preventDefault(); first.focus();
  }
}

function context(): FeedbackContext {
  return {
    version: __APP_VERSION__,
    platform: navigator.platform || '—',
    language: getLanguage(),
    runtime: isDesktop ? 'desktop' : 'web',
  };
}

export function FeedbackPanel() {
  useLanguage();
  const state = useFeedback((value) => value);
  const ref = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDetailsElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const { open, kind, status, error, lastReceipt } = state;
  const draft = state.drafts[kind];
  const sending = status === 'sending';
  const details = context();

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = ref.current?.parentElement;
    // Keep keyboard and assistive technology inside the dialog, including while sending.
    const siblings = backdrop?.parentElement ? [...backdrop.parentElement.children]
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node !== backdrop)
      .map((node) => ({ node, inert: node.inert })) : [];
    siblings.forEach(({ node }) => { node.inert = true; });
    (titleRef.current ?? ref.current)?.focus();
    return () => {
      siblings.forEach(({ node, inert }) => { node.inert = inert; });
      const target = opener?.isConnected ? opener : document.querySelector<HTMLElement>('[data-feedback-launcher]');
      target?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open && status === 'success') successRef.current?.focus();
  }, [open, status]);

  if (!open) return null;

  const [privacyBefore, privacyAfter] = t('La richiesta viene inviata a {recipient}. Il disegno e i file non vengono allegati.').split('{recipient}');

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFeedback();
    }
    keepTabInside(event, ref.current);
  };

  const copy = async () => {
    try {
      await copyText(feedbackText(kind, draft, details));
      toast(t('Messaggio copiato'));
    } catch {
      if (previewRef.current) {
        previewRef.current.open = true;
        previewRef.current.querySelector('textarea')?.select();
      }
      toast(t('Non riesco a copiare: seleziona il testo nell’anteprima.'), 'info');
    }
  };

  return (
    <div className="modal-backdrop feedback-backdrop" onPointerDown={closeFeedback}>
      <div className="modal feedback" role="dialog" aria-modal="true" aria-labelledby="feedback-title"
        ref={ref} tabIndex={-1} onPointerDown={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
        <header>
          <h2 id="feedback-title">{t('Richieste e segnalazioni')}</h2>
          <button className="tool icon-only" onClick={closeFeedback} aria-label={t('Chiudi')}><Icon name="close" /></button>
        </header>
        {status === 'success' ? (
          <div className="feedback-success" ref={successRef} tabIndex={-1} role="status">
            <Icon name="check" size={28} />
            <h3>{t('Richiesta accettata dal servizio')}</h3>
            <p>{t('Il servizio ha accettato il messaggio per l’inoltro a Matteo.')}</p>
            {lastReceipt && <p className="feedback-receipt">{t('Riferimento: {id}', { id: lastReceipt })}</p>}
            <div className="feedback-actions">
              <button className="btn primary-fill" onClick={closeFeedback}>{t('Chiudi')}</button>
              <button className="btn" onClick={() => { newFeedback(); requestAnimationFrame(() => titleRef.current?.focus()); }}>{t('Nuova richiesta')}</button>
            </div>
          </div>
        ) : (
          <>
            <p className="hint">{t('Proponi un ambito, chiedi un’aggiunta o raccontaci cosa non funziona.')}</p>
            <div className="feedback-types" role="group" aria-label={t('Richieste e segnalazioni')}>
              {FEEDBACK_KINDS.map((value) => (
                <button key={value} type="button" aria-pressed={kind === value} disabled={sending}
                  onClick={() => setFeedbackKind(value)}>{t(labels[value])}</button>
              ))}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); void sendFeedback(context()); }} aria-busy={sending}>
              <fieldset className="feedback-fields" disabled={sending}>
                <p className="hint feedback-required">{t('Campi obbligatori: titolo e descrizione.')}</p>
                <label htmlFor="feedback-subject">{t(titles[kind][0])} *</label>
                <input id="feedback-subject" ref={titleRef} type="text" required maxLength={120}
                  value={draft.title} placeholder={t(titles[kind][1])} onChange={(event) => updateFeedbackDraft({ title: event.target.value })} />
                <label htmlFor="feedback-description">{t('Descrizione')} *</label>
                <textarea id="feedback-description" required rows={3} maxLength={4000} value={draft.details}
                  placeholder={t(descriptions[kind])} onChange={(event) => updateFeedbackDraft({ details: event.target.value })} />
                {kind === 'bug' && <>
                  <label htmlFor="feedback-steps">{t('Passaggi per riprodurre il problema (facoltativo)')}</label>
                  <textarea id="feedback-steps" rows={2} maxLength={2000} value={draft.steps}
                    placeholder={t('Es. 1. Apro una figura 2. Scelgo Esporta PDF…')} onChange={(event) => updateFeedbackDraft({ steps: event.target.value })} />
                  <label htmlFor="feedback-expected">{t('Cosa ti aspettavi? (facoltativo)')}</label>
                  <input id="feedback-expected" type="text" maxLength={1000} value={draft.expected}
                    onChange={(event) => updateFeedbackDraft({ expected: event.target.value })} />
                </>}
                <label htmlFor="feedback-reference">{t('Link di riferimento (facoltativo)')}</label>
                <input id="feedback-reference" type="url" maxLength={500} placeholder="https://…" value={draft.reference}
                  onChange={(event) => updateFeedbackDraft({ reference: event.target.value })} />
                <div className="feedback-contact">
                  <label>{t('Nome (facoltativo)')}
                    <input type="text" autoComplete="name" maxLength={100} value={draft.name}
                      onChange={(event) => updateFeedbackDraft({ name: event.target.value })} />
                  </label>
                  <label>{t('Email per ricevere una risposta (facoltativo)')}
                    <input type="email" autoComplete="email" maxLength={254} value={draft.email}
                      aria-describedby="feedback-reply-hint" onChange={(event) => updateFeedbackDraft({ email: event.target.value })} />
                  </label>
                </div>
                <p className="hint" id="feedback-reply-hint">{t('Lascia la tua email se desideri una risposta.')}</p>
                {kind === 'bug' && <div className="feedback-diagnostics">
                  <label><input type="checkbox" checked={draft.includeDiagnostics}
                    onChange={(event) => updateFeedbackDraft({ includeDiagnostics: event.target.checked })} />
                    {t('Includi versione dell’app e sistema')}</label>
                  {draft.includeDiagnostics && <p className="hint">{t('Dati inclusi: {version} · {platform} · {runtime} · {language}', { ...details })}</p>}
                </div>}
              </fieldset>
              <details className="feedback-preview" ref={previewRef}>
                <summary>{t('Anteprima del messaggio')}</summary>
                <textarea readOnly rows={7} value={feedbackText(kind, draft, details)} aria-label={t('Anteprima del messaggio')} />
              </details>
              {error && <p className="feedback-error" role="alert">{t(errors[error])}</p>}
              <p className="hint feedback-privacy">
                {privacyBefore}<a href={PROFILE_URL} target="_blank" rel="noopener noreferrer"
                  onClick={(event) => { event.preventDefault(); openExternal(PROFILE_URL); }}>Matteo</a>{privacyAfter}
              </p>
              <div className="feedback-actions">
                <button type="submit" className="btn primary-fill" disabled={sending || !draft.title.trim() || !draft.details.trim()}>
                  {t(sending ? 'Invio in corso…' : 'Invia direttamente')}
                </button>
                <button type="button" className="btn" onClick={() => void copy()}>{t('Copia il testo')}</button>
              </div>
            </form>
          </>
        )}
        <button className="feedback-back" onClick={() => { closeFeedback(); openPacks(); }}>{t('Torna ai pacchetti')}</button>
      </div>
    </div>
  );
}
