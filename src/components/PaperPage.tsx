import { t, getLanguage } from '../i18n';
// Vista "Pagina": stesso disegno della Lavagna, appoggiato sulla pagina del paper alla larghezza
// vera della colonna, con didascalia e controllo del testo troppo piccolo. Niente di questo
// finisce negli export: è solo uno sfondo dell'editor.
// Sul foglio resta una barra sottile (rivista, larghezza, stato); controlli, didascalia, collegamento
// al paper e anteprima di stampa stanno nel pannello di destra (PaperPanel).
import { useMemo, type ReactNode } from 'react';
import { zoomFit } from '../actions';
import { FONT_CSS, type Doc } from '../model';
import { plainText } from '../richtext';
import { fitHeight, fitPage, fitToVenue, type FitResult, type HeightResult } from '../fit';
import { PaperLink } from './PaperLink';
import { hasPaperSync } from '../platform';
import { HALF_PAGE_CM, MIN_PT, VENUES, bestVenue, figureWidthCm, pageLayout, venueById, type Venue } from '../paper';
import { reviewDoc, type Issue } from '../review';
import { getState, setDoc, setSel, useStore } from '../store';
import { getUi, setUi, toast, useUi, type CanvasView, type PaperPreview } from '../ui';
import { Panel, Segmented } from './controls';
import { Icon } from './Icon';
import './paper.css';

const LINE = '#E1E4E9';
const WARN = '#E8590C';
const CAPTION_PREFIX = 'Figure 1. ';

const num = (v: number, digits = 1) => v.toLocaleString(getLanguage(), { maximumFractionDigits: digits });

function setCanvasView(view: CanvasView) {
  if (getUi().canvasView === view) return;
  setUi({ canvasView: view, paperHighlight: false });
  // dopo il disegno: nella vista Pagina l'inquadratura parte da sotto la barra della rivista
  requestAnimationFrame(() => zoomFit());
}

/** Interruttore Lavagna / Pagina nella barra degli strumenti. */
export function ViewSwitch() {
  const view = useUi((u) => u.canvasView);
  return (
    <div className="segmented view-switch" role="group" aria-label={t("Vista del foglio")}>
      <button
        className={view === 'lavagna' ? 'on' : ''}
        aria-pressed={view === 'lavagna'}
        onClick={() => setCanvasView('lavagna')}
        data-tip={t("Disegno libero sulla griglia")}
      >
        {t('Lavagna')}
      </button>
      <button
        className={view === 'pagina' ? 'on' : ''}
        aria-pressed={view === 'pagina'}
        onClick={() => setCanvasView('pagina')}
        data-tip={t("La figura sulla pagina del paper, alla larghezza vera")}
      >
        {t('Pagina')}
      </button>
    </div>
  );
}

// ---------- riviste: famiglia (CVPR, ICML…) e larghezza (una colonna / pagina intera) ----------

const familyOf = (id: string) => id.replace(/-(full|col)$/, '');
const FAMILIES = VENUES.reduce<{ id: string; name: string }[]>((out, v) => {
  const id = familyOf(v.id);
  if (!out.some((f) => f.id === id)) out.push({ id, name: v.name.split(' · ')[0] });
  return out;
}, []);
const variant = (family: string, span: Venue['span']) => VENUES.find((v) => familyOf(v.id) === family && v.span === span);
const spanName = (span: 'col' | 'full') => t(span === 'col' ? 'una colonna' : 'tutta pagina');

function pickVenue(id: string) {
  const cur = getState().doc;
  if (cur.settings.venue === id) return;
  setDoc({ ...cur, settings: { ...cur.settings, venue: id } });
  zoomFit();
}

/** Cambiando rivista si tiene la larghezza scelta, se la nuova rivista la prevede. */
function pickFamily(family: string) {
  const cur = venueById(getState().doc.settings.venue);
  pickVenue((variant(family, cur.span) ?? VENUES.find((v) => familyOf(v.id) === family)!).id);
}

// ---------- stato della figura sulla pagina ----------

interface PaperState {
  venue: Venue;
  widthCm: number;
  heightCm: number;
  scale: number;
  natural: boolean; // stampata alla sua grandezza (non ingrandita fino alla colonna)
  pt: number; // testo stampato più piccolo
  tooSmall: number; // elementi con testo sotto MIN_PT
  best: Venue; // larghezza consigliata
  tall: boolean;
  issues: Issue[];
  todo: number;
}

function usePaperState(doc: Doc, active: boolean): PaperState | null {
  const language = getLanguage();
  return useMemo(() => {
    if (!active) return null;
    const venue = venueById(doc.settings.venue);
    const L = pageLayout(doc, venue, 0);
    if (!L) return null;
    const issues = reviewDoc(doc);
    const best = bestVenue(doc, venue);
    const tooSmall = L.text.small.length + L.text.smallEdges;
    const tall = L.heightCm > HALF_PAGE_CM;
    return {
      venue,
      widthCm: L.widthCm,
      heightCm: L.heightCm,
      scale: L.scale,
      natural: L.widthCm < figureWidthCm(venue) - 0.05,
      pt: L.text.pt,
      tooSmall,
      best,
      tall,
      issues,
      todo: (best.id !== venue.id ? 1 : 0) + (tooSmall ? 1 : 0) + (tall ? 1 : 0) + issues.length,
    };
  }, [active, doc, language]);
}

// ---------- sfondo sul foglio ----------

/** Porta alla didascalia nel pannello di destra (aprendolo se serve). */
function editCaption() {
  setSel({ nodes: [], edges: [] });
  setUi({ hideInspector: false });
  requestAnimationFrame(() => {
    const el = document.getElementById('paper-caption-input') as HTMLTextAreaElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el?.focus();
  });
}

/** Sfondo della vista Pagina, disegnato sotto i blocchi nelle coordinate del foglio. */
export function PaperPage({ doc, zoom }: { doc: Doc; zoom: number }) {
  const view = useUi((u) => u.canvasView);
  const highlight = useUi((u) => u.paperHighlight);
  const { venue: venueId, caption } = doc.settings;
  const L = useMemo(
    () => (view === 'pagina' ? pageLayout(doc, venueById(venueId), CAPTION_PREFIX.length + caption.length) : null),
    [view, doc, venueId, caption],
  );
  if (!L) return null;
  const { page, span, k } = L;
  const u = 1 / zoom; // misure costanti sullo schermo
  const rulerY = page.y + 27 * k;
  const tick = 5 * u;
  return (
    <g pointerEvents="none">
      <rect x={-50000} y={-50000} width={100000} height={100000} style={{ fill: 'var(--desk)' }} />
      <rect x={page.x + 2 * u} y={page.y + 3 * u} width={page.w} height={page.h} fill="#000000" opacity={0.08} />
      <rect x={page.x} y={page.y} width={page.w} height={page.h} fill="#FFFFFF" />
      {L.lines.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx={r.h / 2} fill={LINE} />
      ))}
      <g stroke="#8F98A8" strokeWidth={u}>
        <path
          d={`M${span.x} ${rulerY} H${span.x + span.w} M${span.x} ${rulerY - tick} V${rulerY + tick} M${span.x + span.w} ${rulerY - tick} V${rulerY + tick}`}
        />
      </g>
      <text x={span.x + span.w / 2} y={rulerY - 6 * u} fontSize={11 * u} fill="#5B6578" textAnchor="middle" fontFamily={FONT_CSS.sans}>
        {num(figureWidthCm(venueById(venueId)), 2)} cm
      </text>
      <foreignObject x={L.caption.x} y={L.caption.y} width={L.caption.w} height={L.caption.size * 30} pointerEvents="auto">
        <div
          className="paper-caption-text"
          style={{ fontFamily: FONT_CSS.serif, fontSize: L.caption.size }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={editCaption}
          data-tip={t("Clic per scrivere la didascalia")}
        >
          {/* anteprima: le formule $…$ diventano testo; il TikZ esportato le lascia a LaTeX */}
          <b>Figure 1.</b> {caption ? plainText(caption) : <span className="placeholder">{t('Clic qui per scrivere la didascalia.')}</span>}
        </div>
      </foreignObject>
      {L.text.small.map((n) =>
        highlight ? (
          <rect
            key={n.id}
            x={n.x - 5 * u}
            y={n.y - 5 * u}
            width={n.w + 10 * u}
            height={n.h + 10 * u}
            rx={4 * u}
            fill="none"
            stroke={WARN}
            strokeWidth={1.5 * u}
            strokeDasharray={`${4 * u} ${3 * u}`}
          />
        ) : (
          // di solito solo un puntino discreto: i contorni compaiono passando sul controllo del testo
          <circle key={n.id} cx={n.x + n.w} cy={n.y} r={3.5 * u} fill={WARN} stroke="#FFFFFF" strokeWidth={1.2 * u} />
        ),
      )}
    </g>
  );
}

// ---------- azioni ----------

// perché il testo non arriva a MIN_PT (FitResult.why)
const NOT_READABLE: Record<NonNullable<FitResult['why']>, string> = {
  small: 'Il testo arriverebbe a {min} pt solo diventando sproporzionato rispetto ai disegni.',
  tall: 'Per arrivare a {min} pt la figura si allungherebbe troppo.',
  torn: 'Per arrivare a {min} pt le frecce fra i blocchi si aggroviglierebbero.',
  issue: 'Per arrivare a {min} pt i blocchi finirebbero fuori linea o con spazi disuguali.',
};

/** Perché il testo resta piccolo e cosa provare: «tutta pagina» solo se c'è e lì la figura non diventa molto alta. */
function notReadable(res: FitResult, doc: Doc) {
  const venue = venueById(doc.settings.venue);
  const full = venue.span === 'col' ? variant(familyOf(venue.id), 'full') : undefined;
  const wider = !!full && (pageLayout(doc, full, 0)?.heightCm ?? Infinity) <= HALF_PAGE_CM;
  return `${t(NOT_READABLE[res.why ?? 'small'], { min: MIN_PT })} ${t(wider ? 'Prova «tutta pagina» o togli qualche blocco.' : 'Togli qualche blocco o accorcia le scritte.')}`;
}

function fixText() {
  const before = getState().doc;
  const res = fitToVenue(before);
  if (res.doc === before) {
    // meglio non toccare la figura che peggiorarla: si dice perché
    if (!res.ok) toast(notReadable(res, before), 'info');
    return;
  }
  setDoc(res.doc);
  setUi({ paperHighlight: false });
  zoomFit();
  if (res.ok && res.rows > 1) toast(t('Testo leggibile ({pt} pt), figura su {rows} righe. Blocchi allargati dove serviva. ⌘Z annulla.', { pt: num(res.pt), rows: res.rows }));
  else if (res.ok) toast(t('Testo leggibile ({pt} pt). Blocchi allargati dove serviva. ⌘Z annulla.', { pt: num(res.pt) }));
  else toast(`${t('Testo ingrandito a {pt} pt (⌘Z annulla).', { pt: num(res.pt) })} ${notReadable(res, res.doc)}`, 'info');
}

function fixIssue(issue: Issue) {
  setDoc(issue.fix(getState().doc));
  toast(t('Sistemato. ⌘Z annulla.'));
}

const TOO_TALL = 'Non riesco ad abbassarla senza rendere il testo troppo piccolo: sposta di lato qualche gruppo di blocchi.';

/** Come è stata abbassata la figura, per i messaggi: «una colonna», «spazi più stretti», «più piccola (85%)». */
function lowered(res: HeightResult, column = res.column) {
  const how = [column && spanName('col'), res.tighter && t('spazi più stretti'), res.shrink < 1 && t('più piccola ({pct}%)', { pct: num(res.shrink * 100, 0) })];
  return how.filter((s): s is string => !!s);
}

function fixHeight() {
  const res = fitHeight(getState().doc);
  if (!res) {
    toast(t(TOO_TALL), 'info');
    return;
  }
  setDoc(res.doc);
  zoomFit();
  const args = { height: num(res.heightCm), changes: lowered(res).join(' · ') };
  if (res.heightCm > HALF_PAGE_CM) toast(t('Abbassata a {height} cm ({changes}), ma resta più alta di metà pagina. ⌘Z annulla.', args), 'info');
  else toast(t('Abbassata a {height} cm: {changes}. ⌘Z annulla.', args));
}

/** Un solo passo (e un solo ⌘Z): correzioni del revisore, formato migliore, testo leggibile, altezza (fitPage). */
function autoFit() {
  const before = getState().doc;
  const { doc, fixes, text, retext, low, declined } = fitPage(before);
  const venue = venueById(doc.settings.venue);
  const L = pageLayout(doc, venue, 0);
  // cosa non si è potuto fare, e perché
  const notes: string[] = [];
  if (L && L.text.pt < MIN_PT) notes.push(notReadable(text, doc));
  if (declined) notes.push(t('Non passo a «{span}»: la figura sarebbe alta {height} cm, più di metà pagina.', { span: spanName(declined.span), height: num(declined.heightCm) }));
  if (doc === before) {
    // niente che si possa fare in automatico: si dice perché, invece di non fare nulla in silenzio
    if ((L?.heightCm ?? 0) > HALF_PAGE_CM) notes.push(t(TOO_TALL));
    toast(notes.length ? notes.join(' ') : t('Niente da cambiare in automatico.'), 'info');
    return;
  }
  const done: string[] = [];
  // la larghezza si dice una volta sola, quella finale: l'altezza può aver cambiato la scelta fatta per il testo
  if (venue.id !== before.settings.venue) done.push(spanName(venue.span));
  if (retext) done.push(text.ok ? (text.rows > 1 ? t('testo leggibile su {rows} righe', { rows: text.rows }) : t('testo leggibile')) : t('testo ingrandito a {pt} pt', { pt: num(text.pt) }));
  if (low) done.push(t('alta {height} cm', { height: num(low.heightCm) }), ...lowered(low, false));
  if (fixes) done.push(t('correzioni: {count}', { count: fixes }));
  setDoc(doc);
  setUi({ paperHighlight: false });
  zoomFit();
  const msg = t('Adattata: {changes}. ⌘Z annulla.', { changes: done.join(' · ') });
  if (notes.length) toast(`${msg} ${notes.join(' ')}`, 'info');
  else toast(msg);
}

/** Apre il pannello di destra sui controlli della pagina. */
function showChecks() {
  setSel({ nodes: [], edges: [] });
  setUi({ hideInspector: false });
  requestAnimationFrame(() => document.querySelector('.inspector-body')?.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ---------- barra sul foglio ----------

/** Barra sottile in alto nella vista Pagina: rivista, larghezza, misure, stato. */
export function PaperBar() {
  const view = useUi((u) => u.canvasView);
  const preview = useUi((u) => u.paperPreview);
  const doc = useStore((s) => s.doc);
  const p = usePaperState(doc, view === 'pagina');
  if (!p) return null;
  const family = familyOf(p.venue.id);
  const col = variant(family, 'col');
  const full = variant(family, 'full');
  return (
    <div className="paper-bar" data-preview={preview}>
      <label className="paper-select" data-tip={t("Rivista o conferenza: dà la larghezza della pagina")}>
        <Icon name="doc" size={14} />
        <select value={family} onChange={(e) => pickFamily(e.target.value)} aria-label={t("Rivista")}>
          {FAMILIES.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={12} />
      </label>
      {col && full ? (
        <div className="segmented paper-span" role="group" aria-label={t("Larghezza della figura")}>
          {[col, full].map((v) => (
            <button
              key={v.id}
              className={p.venue.id === v.id ? 'on' : ''}
              aria-pressed={p.venue.id === v.id}
              onClick={() => pickVenue(v.id)}
              data-tip={v.span === 'col' ? `figure: ${num(v.colCm!, 2)} cm` : `figure*: ${num(v.textCm, 2)} cm`}
            >
              {t(v.span === 'col' ? 'Colonna' : 'Pagina intera')}
            </button>
          ))}
        </div>
      ) : (
        <span className="paper-onecol" data-tip={t("Questo modello ha una colonna sola")}>
          {t('una colonna')}
        </span>
      )}
      <span className="paper-sep" />
      <span className="paper-info" data-tip={t(p.natural ? 'Stampata alla sua grandezza' : 'LaTeX la riduce per farla stare nella larghezza')}>
        {num(p.widthCm, 1)} × {num(p.heightCm, 1)} cm · {p.natural ? '100%' : `${num(p.scale * 100, 0)}%`}
      </span>
      <button className={p.todo ? 'paper-status warn' : 'paper-status ok'} onClick={showChecks} data-tip={t("Mostra i controlli nel pannello a destra")}>
        <Icon name={p.todo ? 'info' : 'check'} size={13} />
        {p.todo ? t('{count} da sistemare', { count: p.todo }) : t('Pronta')}
      </button>
      {p.todo > 0 && (
        <button
          className="btn primary paper-auto"
          onClick={autoFit}
          data-tip={t("Sceglie la larghezza migliore, rende leggibile il testo e applica le correzioni (⌘Z annulla)")}
        >
          <Icon name="fit" size={14} />
          <span className="paper-auto-label">{t('Adatta')}</span>
        </button>
      )}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="paper-cvd" colorInterpolationFilters="linearRGB">
          <feColorMatrix type="matrix" values="0.29275 0.70725 0 0 0  0.29275 0.70725 0 0 0  -0.02234 0.02234 1 0 0  0 0 0 1 0" />
        </filter>
      </svg>
    </div>
  );
}

// ---------- pannello di destra ----------

function CheckRow(p: { ok: boolean; title: string; detail: ReactNode; action?: ReactNode; onHover?: (on: boolean) => void }) {
  return (
    <li
      className={p.ok ? 'paper-check ok' : 'paper-check warn'}
      onPointerEnter={p.onHover && (() => p.onHover!(true))}
      onPointerLeave={p.onHover && (() => p.onHover!(false))}
    >
      <span className="paper-check-mark">
        <Icon name={p.ok ? 'check' : 'info'} size={12} />
      </span>
      <span className="paper-check-text">
        <b>{t(p.title)}</b>
        <small>{typeof p.detail === 'string' ? t(p.detail) : p.detail}</small>
      </span>
      {p.action}
    </li>
  );
}

const ISSUE_TITLES: Record<Issue['id'], string> = {
  align: 'Blocchi quasi allineati',
  spacing: 'Frecce di lunghezze diverse',
  overflow: 'Testo fuori dai blocchi',
};

const PREVIEWS: { value: PaperPreview; label: string; tip: string }[] = [
  { value: 'colori', label: 'Colori', tip: 'La figura come la vedi di solito' },
  { value: 'grigi', label: 'Bianco e nero', tip: 'Come esce da una stampante in bianco e nero' },
  { value: 'daltonici', label: 'Daltonici', tip: 'Come la vede chi non distingue rosso e verde' },
];

/** Pannello di destra nella vista Pagina, quando non è selezionato niente. */
export function PaperPanel() {
  const doc = useStore((s) => s.doc);
  const preview = useUi((u) => u.paperPreview);
  const p = usePaperState(doc, true);
  if (!p) return <p className="hint paper-empty">{t('Aggiungi qualche blocco: qui vedrai come esce la figura nel paper.')}</p>;
  const setCaption = (caption: string) => {
    const cur = getState().doc;
    setDoc({ ...cur, settings: { ...cur.settings, caption } }, { coalesce: 'caption' });
  };
  const btn = (label: string, onClick: () => void, tip?: string) => (
    <button className="btn small" onClick={onClick} data-tip={tip ? t(tip) : undefined}>
      {t(label)}
    </button>
  );
  return (
    <>
      <Panel id="paper-checks" title="Controlli">
        {p.todo === 0 ? (
          <div className="paper-ready">
            <Icon name="check" size={16} />
            <span>
              <b>{t('Pronta per la consegna')}</b>
              <small>{t('Testo leggibile, larghezza giusta, blocchi in ordine.')}</small>
            </span>
          </div>
        ) : (
          <button className="btn primary full paper-auto-big" onClick={autoFit} data-tip={t("Un solo passo: ⌘Z lo annulla tutto")}>
            <Icon name="fit" size={14} /> {t('Adatta alla pagina · {count}', { count: p.todo })}
          </button>
        )}
        <ul className="paper-checks">
          {Number.isFinite(p.pt) &&
            (p.tooSmall ? (
              <CheckRow
                ok={false}
                title="Testo troppo piccolo"
                detail={t('{pt} pt in {count} elementi (minimo {min} pt)', { pt: num(p.pt), count: p.tooSmall, min: MIN_PT })}
                action={btn('Correggi', fixText, 'Ingrandisce solo le scritte troppo piccole, quanto basta (⌘Z annulla)')}
                onHover={(on) => setUi({ paperHighlight: on })}
              />
            ) : (
              <CheckRow ok title="Testo leggibile" detail={t('il più piccolo è {pt} pt', { pt: num(p.pt) })} />
            ))}
          {p.best.id !== p.venue.id ? (
            <CheckRow
              ok={false}
              title={p.best.span === 'col' ? 'Basta una colonna' : 'Meglio la pagina intera'}
              detail={
                p.best.span === 'col'
                  ? 'Il testo resta leggibile anche stretta: occupa meno spazio.'
                  : 'In una colonna il testo diventa troppo piccolo.'
              }
              action={btn('Usa', () => pickVenue(p.best.id))}
            />
          ) : (
            <CheckRow ok title="Larghezza giusta" detail={`${spanName(p.venue.span)} · ${num(figureWidthCm(p.venue), 2)} cm`} />
          )}
          {p.tall ? (
            <CheckRow
              ok={false}
              title="Figura molto alta"
              detail={t('{height} cm, più di metà pagina: disponi i blocchi più in largo.', { height: num(p.heightCm, 1) })}
              action={btn('Abbassa', fixHeight, 'Stringe gli spazi vuoti, la mette in una colonna o la rimpicciolisce un poco, senza rendere illeggibile il testo (⌘Z annulla)')}
            />
          ) : (
            <CheckRow ok title="Altezza giusta" detail={t('{height} cm, meno di metà pagina', { height: num(p.heightCm, 1) })} />
          )}
          {p.issues.length ? (
            p.issues.map((i) => (
              <CheckRow
                key={i.id}
                ok={false}
                title={ISSUE_TITLES[i.id]}
                detail={i.text}
                action={btn('Correggi', () => fixIssue(i), 'Corregge in automatico (⌘Z annulla)')}
              />
            ))
          ) : (
            <CheckRow ok title="Blocchi in ordine" detail="allineati, spazi regolari, scritte dentro i blocchi" />
          )}
        </ul>
      </Panel>

      <Panel id="paper-caption" title="Didascalia">
        <textarea
          id="paper-caption-input"
          className="paper-caption"
          rows={3}
          value={doc.settings.caption}
          placeholder={t("Cosa mostra la figura…")}
          aria-label={t("Didascalia della figura")}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="hint">{t('Le formule tra $…$ restano a LaTeX nel TikZ esportato.')}</p>
      </Panel>

      {/* nella versione web non si scrive su disco: niente collegamento */}
      {hasPaperSync && (
        <Panel id="paper-link" title="Paper">
          <PaperLink />
        </Panel>
      )}

      <Panel id="paper-preview" title="Anteprima di stampa">
        <Segmented<PaperPreview>
          value={preview}
          options={PREVIEWS.map((o) => ({ value: o.value, label: t(o.label), tip: t(o.tip) }))}
          onChange={(paperPreview) => setUi({ paperPreview })}
          label="Anteprima di stampa"
        />
        <p className="hint">{t('Solo sullo schermo: la figura e gli export non cambiano.')}</p>
      </Panel>
    </>
  );
}
