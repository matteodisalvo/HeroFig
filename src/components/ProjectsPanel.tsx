import { t, useLanguage, getLanguage } from '../i18n';
// Pannello t("Progetti"): le figure di un paper o di una tesi raccolte in una cartella, con lo
// stato di ognuna e la scadenza. Le cartelle si possono mettere in Dropbox/Drive per condividerle.
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adoptSaved, openFigure } from '../App';
import { docBounds } from '../geometry';
import type { Doc } from '../model';
import { hasProjects, projectPick, readFile } from '../platform';
import {
  STATUS_LABEL,
  createFigure,
  daysLeft,
  folderName,
  loadProject,
  nextStatus,
  projectDirs,
  samePath,
  saveMeta,
  saveProjectDirs,
  type Project,
  type ProjectFigure,
  type ProjectMeta,
} from '../projects';
import { DiagramContent } from '../render/DiagramContent';
import { getState, useStore } from '../store';
import { toast } from '../ui';
import { othersIn, setAuthor, useAuthor } from '../collab';
import type { Presence } from '../platform';
import { Icon } from './Icon';
import './projects.css';

const dirOf = (path: string | null) => (path ? path.replace(/[\\/][^\\/]*$/, '') : null);
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function Thumb({ doc }: { doc: Doc | null }) {
  useLanguage();
  if (!doc || !doc.nodes.length) return <span className="project-thumb empty">{doc ? t('Figura vuota') : t('Anteprima non disponibile')}</span>;
  const b = docBounds(doc);
  return (
    <span className="project-thumb">
      <svg viewBox={`${b.x - 8} ${b.y - 8} ${b.w + 16} ${b.h + 16}`}>
        <DiagramContent doc={doc} />
      </svg>
    </span>
  );
}

const openComments = (f: ProjectFigure) => f.doc?.comments?.filter((c) => !c.done).length ?? 0;

/** Quando è stata salvata l'ultima volta, in parole. */
function when(mtime: number): string {
  const days = Math.floor((Date.now() - mtime) / 86400000);
  if (days <= 0) return t('modificata oggi');
  if (days === 1) return t('modificata ieri');
  if (days < 30) return t('modificata {count} giorni fa', { count: days });
  return t('modificata il {date}', { date: new Date(mtime).toLocaleDateString(getLanguage(), { day: 'numeric', month: 'short' }) });
}

function deadlineText(deadline: string): string {
  const d = daysLeft(deadline);
  if (d === null) return t('Scadenza');
  return d < 0 ? t('Scadenza passata') : d === 0 ? t('Scade oggi') : d === 1 ? t('Scade domani') : t('Scade fra {count} giorni', { count: d });
}

/** Colore della scadenza: rossa se passata, arancione nell'ultima settimana. */
function deadlineTone(deadline: string): string {
  const d = daysLeft(deadline);
  return d === null ? '' : d < 0 ? 'late' : d <= 7 ? 'soon' : '';
}

/** Barra a tre colori: quante figure sono pronte, da rivedere, in bozza. */
function Progress({ figures }: { figures: ProjectFigure[] }) {
  useLanguage();
  const n = figures.length;
  if (!n) return null;
  const count = (s: ProjectFigure['status']) => figures.filter((f) => f.status === s).length;
  const ready = count('pronta');
  const review = count('rivedere');
  return (
    <div className="projects-progress">
      <div className="projects-bar" role="img" aria-label={t('{ready} figure pronte su {total}', { ready, total: n })}>
        {ready > 0 && <span className="pronta" style={{ flex: ready }} />}
        {review > 0 && <span className="rivedere" style={{ flex: review }} />}
        {n - ready - review > 0 && <span style={{ flex: n - ready - review }} />}
      </div>
      <span>
        {ready === n ? t('Tutte le figure sono pronte') : t('{ready} figure pronte su {total}', { ready, total: n })}
        {review > 0 && ` · ${t('{count} da rivedere', { count: review })}`}
      </span>
    </div>
  );
}

function ProjectsPanel({ onClose }: { onClose: () => void }) {
  useLanguage();
  const author = useAuthor();
  const filePath = useStore((s) => s.filePath);
  const [dirs, setDirs] = useState(projectDirs);
  const [active, setActive] = useState<string | null>(() => {
    const here = dirOf(getState().filePath);
    const all = projectDirs();
    return all.find((d) => samePath(d, here)) ?? all[0] ?? null;
  });
  const [project, setProject] = useState<Project | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState('');
  // la tessera «Nuova figura» diventa un campo per il nome: vuota, oppure con la figura aperta
  const [adding, setAdding] = useState<null | 'empty' | 'current'>(null);
  const [others, setOthers] = useState<Presence[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  // l'ultima cartella chiesta: una lettura lenta di un progetto lasciato prima non deve prendere il suo posto
  const wanted = useRef<string | null>(null);

  const reload = useCallback(async (dir: string | null) => {
    wanted.current = dir;
    if (!dir) return setProject(null);
    try {
      const p = await loadProject(dir);
      if (wanted.current !== dir) return;
      setMissing(!p);
      setProject(p);
      const here = p ? await othersIn(dir) : [];
      if (wanted.current === dir) setOthers(here);
    } catch (err) {
      if (wanted.current === dir) toast(message(err), 'info');
    }
  }, []);

  useEffect(() => {
    void reload(active);
  }, [active, reload]);
  useEffect(() => {
    ref.current?.focus();
  }, []);

  const updateDirs = (next: string[]) => {
    setDirs(next);
    saveProjectDirs(next);
  };

  const addProject = async () => {
    const dir = await projectPick();
    if (!dir) return;
    updateDirs([dir, ...dirs.filter((d) => !samePath(d, dir))]);
    setActive(dir);
    try {
      const p = await loadProject(dir);
      // il file di progetto rende la cartella riconoscibile anche su un altro computer
      if (p) await saveMeta(dir, p.meta);
    } catch (err) {
      toast(message(err), 'info');
    }
    void reload(dir);
  };

  const removeProject = (dir: string) => {
    const next = dirs.filter((d) => d !== dir);
    updateDirs(next);
    if (active === dir) setActive(next[0] ?? null);
    toast(t('Progetto tolto dall’elenco: la cartella e le figure restano sul disco'), 'info');
  };

  const setMeta = (patch: Partial<ProjectMeta>) => {
    if (!project) return;
    const meta = { ...project.meta, ...patch };
    setProject({ ...project, meta, figures: project.figures.map((f) => ({ ...f, status: meta.status[f.name] ?? 'bozza' })) });
    saveMeta(project.dir, meta).catch((err) => toast(message(err), 'info'));
  };

  /** false se la figura non si è aperta (file illeggibile, o l'utente tiene le modifiche correnti). */
  const open = async (path: string) => {
    try {
      // si rilegge il file: potrebbe essere cambiato dopo l'apertura del pannello
      if (openFigure(await readFile(path), path)) {
        onClose();
        return true;
      }
    } catch (err) {
      toast(message(err), 'info');
    }
    return false;
  };

  const create = async (withCurrent: boolean) => {
    if (!project || !title.trim()) return;
    const doc = withCurrent ? getState().doc : undefined;
    let res: { path?: string; error?: string };
    try {
      res = await createFigure(project.dir, title, doc);
    } catch (err) {
      res = { error: message(err) };
    }
    if (res.error || !res.path) return toast(res.error ?? t('Non riesco a creare la figura'), 'info');
    setTitle('');
    setAdding(null);
    if (withCurrent) {
      // le modifiche fatte mentre si scriveva il file restano da salvare
      adoptSaved(res.path, doc!);
      toast(t('Figura salvata nel progetto «{name}»', { name: project.meta.name }));
      void reload(project.dir);
    } else if (!(await open(res.path))) void reload(project.dir);
  };

  // la figura aperta non è ancora in un file: si può salvare direttamente nel progetto
  const canAddCurrent = !filePath && getState().doc.nodes.length > 0;

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div
        className="modal projects"
        role="dialog"
        aria-modal="true"
        aria-label={t("Progetti")}
        tabIndex={-1}
        ref={ref}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // i tasti restano nel pannello: niente scorciatoie del foglio sotto
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
      >
        <header>
          <h2>{t("Progetti")}</h2>
          <button className="tool icon-only" onClick={onClose} aria-label={t("Chiudi")} data-tip={t("Chiudi")} data-keys="Esc">
            <Icon name="close" />
          </button>
        </header>
        <div className="projects-body">
          <nav className="projects-list" aria-label={t("I tuoi progetti")}>
            {dirs.map((d) => ( <button key={d} className={d === active ? 'on' : ''} aria-pressed={d === active} onClick={() => setActive(d)} data-tip={d}>
                <Icon name="open" size={14} />
                <span>{d === active && project ? project.meta.name : folderName(d)}</span>
              </button>
            ))}
            <button className="projects-add" onClick={addProject} data-tip={t("Scegli o crea la cartella del paper o della tesi")}>
              <Icon name="plus" size={14} />
              <span>{t("Nuovo progetto…")}</span>
            </button>
            <label className="projects-me" data-tip={t("Il nome con cui ti vedono relatore e coautori nei commenti e nelle figure aperte")}>
              <span>{t("Il tuo nome")}</span>
              <input key={author} type="text" maxLength={80} defaultValue={author} placeholder={t("Come ti vedono gli altri")} onBlur={(e) => setAuthor(e.target.value)} />
            </label>
          </nav>
          <div className="projects-main">
            {!active && (
              <div className="projects-empty">
                <strong>{t("Un progetto è la cartella di un paper o di una tesi.")}</strong>
                <p>{t("Dentro ci sono tutte le sue figure, con lo stato di ognuna e la scadenza. Se la metti in una cartella condivisa, la vedono anche relatore e coautori.")}</p>
                <button className="btn" onClick={addProject}>
                  <Icon name="plus" size={14} />{t("Crea il primo progetto…")}</button>
              </div>
            )}
            {active && missing && (
              <div className="projects-empty">
                <strong>{t("Non trovo più questa cartella.")}</strong>
                <p>{active}</p>
                <button className="btn" onClick={() => removeProject(active)}>{t("Togli dall’elenco")}</button>
              </div>
            )}
            {project && (
              <>
                <div className="projects-head">
                  <input
                    type="text"
                    className="projects-name"
                    aria-label={t("Nome del progetto")}
                    defaultValue={project.meta.name}
                    key={project.dir}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== project.meta.name && setMeta({ name: e.target.value.trim() })}
                  />
                  <label className={`projects-deadline ${deadlineTone(project.meta.deadline)}`}>
                    <span>{deadlineText(project.meta.deadline)}</span>
                    <input type="date" aria-label={t("Scadenza")} value={project.meta.deadline} onChange={(e) => setMeta({ deadline: e.target.value })} />
                  </label>
                </div>
                <Progress figures={project.figures} />
                {canAddCurrent && adding !== 'current' && (
                  <div className="projects-banner">
                    <span>{t("La figura che hai aperta non è ancora in un file.")}</span>
                    <button className="link-btn" onClick={() => setAdding('current')}>{t("Salvala in questo progetto")}</button>
                  </div>
                )}
                <div className="projects-grid">
                  {project.figures.map((f) => ( <div key={f.name} className={samePath(f.path, filePath) ? 'project-card current' : 'project-card'}>
                      <button className="project-open" onClick={() => void open(f.path)} data-tip={samePath(f.path, filePath) ? t('È la figura aperta ora') : t('Apri la figura')}>
                        <Thumb doc={f.doc} />
                        <span className="project-title">{f.title}</span>
                      </button>
                      <div className="project-foot">
                        <button
                          className={`project-status ${f.status}`}
                          onClick={() => setMeta({ status: { ...project.meta.status, [f.name]: nextStatus(f.status) } })}
                          data-tip={t('Clic per passare a «{status}»', { status: t(STATUS_LABEL[nextStatus(f.status)]) })}
                        >
                          {t(STATUS_LABEL[f.status])}
                        </button>
                        {samePath(f.path, filePath) ? <span className="project-when open">{t("aperta ora")}</span> : <span className="project-when">{when(f.mtime)}</span>}
                      </div>
                      {(openComments(f) > 0 || others.some((o) => o.figure === f.name)) && ( <div className="project-notes">
                          {openComments(f) > 0 && <span className="project-note">{t('{count} commenti', { count: openComments(f) })}</span>}
                          {[...new Set(others.filter((o) => o.figure === f.name).map((o) => o.name))].map((name) => ( <span key={name} className="project-note here">
                              {t('{name} è qui', { name })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {adding ? (
                    <form
                      className="project-card adding"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void create(adding === 'current');
                      }}
                    >
                      <strong>{adding === 'current' ? t('Salva qui la figura aperta') : t('Nuova figura vuota')}</strong>
                      <input type="text" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("es. Fig. 2 · Metodo")} aria-label={t("Nome della figura")} />
                      <div className="project-adding-actions">
                        <button type="submit" className="btn primary-fill" disabled={!title.trim()}>
                          {adding === 'current' ? t('Salva') : t('Crea')}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            setAdding(null);
                            setTitle('');
                          }}
                        >{t("Annulla")}</button>
                      </div>
                    </form> ) : ( <button className="project-card add" onClick={() => setAdding('empty')}>
                      <Icon name="plus" size={18} />
                      <span>{t("Nuova figura")}</span>
                    </button>
                  )}
                </div>
                <p className="projects-foot">
                  <span data-tip={project.dir}>{t('Cartella: {name}', { name: folderName(project.dir) })}</span>
                  <button className="link-btn" onClick={() => removeProject(project.dir)} data-tip={t("Non cancella nulla dal disco")}>{t("Togli il progetto dall’elenco")}</button>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pulsante della barra degli strumenti; i progetti esistono solo nell'app desktop. */
export function ProjectsButton() {
  useLanguage();
  const [open, setOpen] = useState(false);
  if (!hasProjects) return null;
  return (
    <>
      <button className="tool" onClick={() => setOpen(true)} aria-label={t("Progetti")} data-tip={t("Le figure del paper o della tesi, in una cartella")}>
        <Icon name="blocks" />
        <span>{t("Progetti")}</span>
      </button>
      {/* fuori dalla barra: il suo effetto vetro terrebbe la finestra chiusa dentro la barra stessa */}
      {open && createPortal(<ProjectsPanel onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}
