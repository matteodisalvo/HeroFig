import { t as tr } from '../i18n';
// Finestra «Informazioni» (autore e GitHub) e invito a lasciare una stella alla repo.
import { useEffect, useRef } from 'react';
import { getUi, setUi, useUi } from '../ui';
import { openExternal } from '../platform';
import { keepTabInside } from './FeedbackPanel';
import { Icon } from './Icon';
import './about.css';

const AUTHOR = 'Matteo Di Salvo';
/** La repo dell'app su GitHub: è l'unico punto da cambiare se l'indirizzo è diverso. */
const REPO_URL = 'https://github.com/matteodisalvo/herofig';

const STAR_KEY = 'tensorfig:star';
/** L'invito compare una volta sola, dopo qualche export riuscito: quando l'app è già servita. */
const NUDGE_AT = 3;

function loadStar(): { exports: number; done: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(STAR_KEY) ?? '{}') ?? {};
    return { exports: Number(v.exports) || 0, done: !!v.done };
  } catch {
    return { exports: 0, done: false };
  }
}

function saveStar(v: { exports: number; done: boolean }) {
  try {
    localStorage.setItem(STAR_KEY, JSON.stringify(v));
  } catch {
    // senza storage l'invito può ricomparire: pazienza
  }
}

/** Da chiamare a ogni export riuscito: al terzo propone la stella, poi non insiste più. */
export function noteExport() {
  const s = loadStar();
  if (s.done) return;
  s.exports += 1;
  saveStar(s);
  if (s.exports >= NUDGE_AT && !getUi().about) setUi({ starNudge: true });
}

function closeNudge() {
  saveStar({ ...loadStar(), done: true });
  setUi({ starNudge: false });
}

function star() {
  openExternal(REPO_URL);
  closeNudge();
}

function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function About() {
  const open = useUi((s) => s.about);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, [open]);
  if (!open) return null;
  const close = () => setUi({ about: false });
  return (
    <div className="modal-backdrop" onPointerDown={close}>
      <div className="modal about" role="dialog" aria-modal="true" aria-label={tr("Informazioni su HeroFig")} tabIndex={-1} ref={ref}
        onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => keepTabInside(e, ref.current)}>
        <button className="tool icon-only about-close" onClick={close} aria-label={tr("Chiudi")} data-tip={tr("Chiudi")} data-keys="Esc">
          <Icon name="close" />
        </button>
        <img className="about-logo" src="./favicon.svg" width="56" height="56" alt="" />
        <h2 className="about-name">Hero<span>Fig</span></h2>
        <p className="about-version">{tr("Versione {version}", { version: __APP_VERSION__ })}</p>
        <p className="about-text">{tr("Figure scientifiche pronte per il paper.")}</p>
        <p className="about-author">
          {tr("Creato da")} <strong>{AUTHOR}</strong>
        </p>
        <div className="about-actions">
          <button className="about-btn" onClick={() => openExternal(REPO_URL)}>
            <GitHubMark />
            <span>GitHub</span>
          </button>
          <button className="about-btn star" onClick={star}>
            <Icon name="star" className="filled" />
            <span>{tr("Metti una stella")}</span>
          </button>
        </div>
        <p className="about-hint">{tr("HeroFig è gratuito: una stella aiuta altri ricercatori a trovarlo.")}</p>
      </div>
    </div>
  );
}

/** Cartoncino in basso a destra: non blocca il lavoro e, una volta chiuso, non torna più. */
export function StarNudge() {
  const open = useUi((s) => s.starNudge);
  if (!open) return null;
  return (
    <aside className="star-nudge" role="status">
      <Icon name="star" size={18} className="filled star-nudge-icon" />
      <div>
        <strong>{tr("Ti è utile HeroFig?")}</strong>
        <p>{tr("Una stella su GitHub aiuta altri ricercatori a trovarlo.")}</p>
        <div className="star-nudge-actions">
          <button className="about-btn star" onClick={star}>
            <GitHubMark size={14} />
            <span>{tr("Metti una stella")}</span>
          </button>
          <button className="star-nudge-later" onClick={closeNudge}>
            {tr("Non ora")}
          </button>
        </div>
      </div>
    </aside>
  );
}
