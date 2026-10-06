import { t as tr } from '../i18n';
import { run } from '../App';
import { addTemplate, zoomFit } from '../actions';
import { DiagramContent } from '../render/DiagramContent';
import { allTemplates, type Template } from '../templates';
import { noteRecent, setUi } from '../ui';
import { Icon } from './Icon';
import { templatePreview } from './Palette';
import { keys } from '../os';

/** Modelli proposti nella scheda iniziale (i primi disponibili, se qualcuno manca). */
const PICKS = ['transformer', 'unet', 'vit', 'diffusion'];

function showAllTemplates() {
  setUi({ libraryTab: 'templates' });
  document.querySelector('.palette-list')?.scrollTo({ top: 0 });
}

/** Scheda mostrata sul foglio vuoto: punti di partenza rapidi. */
export function EmptyState() {
  const all = allTemplates();
  const picks = [...PICKS.map((id) => all.find((t) => t.id === id)), ...all].filter((t, i, arr): t is Template => !!t && arr.indexOf(t) === i).slice(0, 4);
  return (
    <div className="empty-state">
      <div className="empty-card" onPointerDown={(e) => e.stopPropagation()}>
        <h2>{tr("Inizia una nuova figura")}</h2>
        <p className="empty-sub">{tr("Trascina un blocco dalla libreria a sinistra, oppure parti da un modello:")}</p>
        <div className="empty-templates">
          {picks.map((t) => {
            const data = templatePreview(t);
            return (
              <button
                key={t.id}
                className="empty-template"
                data-tip={tr("Inserisci {name}", { name: tr(t.name) })}
                onClick={() => {
                  addTemplate(t.id);
                  noteRecent(`t:${t.id}`);
                  zoomFit();
                }}
              >
                <span className="preview">
                  <svg viewBox={data.viewBox}>
                    <DiagramContent doc={data.doc} />
                  </svg>
                </span>
                <span className="item-name">{tr(t.name)}</span>
              </button>
            );
          })}
        </div>
        <div className="empty-actions">
          <button
            className="btn"
            onClick={showAllTemplates}
            data-tip={tr("Mostra i modelli nella libreria")}
          >
            <Icon name="template" size={14} /> {tr("Tutti i modelli")}
          </button>
          <button className="btn" onClick={() => run('example')}>
            <Icon name="example" size={14} /> {tr("Apri l'esempio")}
          </button>
          <button className="btn" onClick={() => run('open')} data-keys="⌘O" data-tip={tr("Apri un file .hfig")}>
            <Icon name="open" size={14} /> {tr("Apri un file…")}
          </button>
        </div>
        <div className="empty-tips">
          <span>
            <kbd>{keys('⌘F')}</kbd> {tr("cerca nella libreria")}
          </span>
          <span>
            <kbd>{tr("Doppio clic")}</kbd> {tr("scrivi un'etichetta")}
          </span>
          <span>
            <kbd>{keys('⌘/')}</kbd> {tr("scorciatoie")}
          </span>
        </div>
      </div>
    </div>
  );
}
