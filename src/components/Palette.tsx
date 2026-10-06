import { t, translateTo, useLanguage } from '../i18n';
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addPreset, addTemplate } from '../actions';
import { docBounds } from '../geometry';
import { DEFAULT_SETTINGS, allPresets, makeNode, type Doc, type Preset } from '../model';
import { DiagramContent } from '../render/DiagramContent';
import { allTemplates, type Template } from '../templates';
import { noteRecent, setUi, toast, toggleFavorite, useUi, type LibraryKey } from '../ui';
import { Icon } from './Icon';
import { PACKS, groupVisible, openPacks, packOf, setInstalled, usePacks } from '../packs';
import { openFeedback } from '../feedback';
import { keys } from '../os';

// ---------- anteprime: calcolate una volta, disegnate solo quando entrano in vista ----------

interface PreviewData {
  doc: Doc;
  viewBox: string;
}

const previewCache = new Map<string, PreviewData>();

function previewData(key: string, build: () => Pick <Doc, 'nodes' | 'edges'>, pad: number): PreviewData {
  let data = previewCache.get(key);
  if (!data) {
    const doc: Doc = { version: 1, ...build(), settings: DEFAULT_SETTINGS };
    const b = docBounds(doc);
    data = { doc, viewBox: `${b.x - pad} ${b.y - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}` };
    previewCache.set(key, data);
  }
  return data;
}

const presetPreview = (p: Preset) =>
  previewData(`p:${p.id}`, () => ({ nodes: [makeNode({ ...p.node, id: `preview-${p.id}` })], edges: [] }), 3);
export const templatePreview = (t: Template) => previewData(`t:${t.id}`, t.build, 6);

/** Osservatore condiviso: le anteprime fuori vista restano segnaposto leggeri. */
const ObserverCtx = createContext<IntersectionObserver | null>(null);
const onVisible = new WeakMap<Element, () => void> ();

function useInView <T extends Element> (): [React.RefObject <T | null>, boolean] {
  const io = useContext(ObserverCtx);
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(!io);
  useEffect(() => {
    const el = ref.current;
    if (!io || !el || seen) return;
    onVisible.set(el, () => setSeen(true));
    io.observe(el);
    return () => io.unobserve(el);
  }, [io, seen]);
  return [ref, seen];
}

const PresetPreview = memo(function PresetPreview({ preset }: { preset: Preset }) {
  useLanguage();
  const [ref, seen] = useInView<HTMLDivElement>();
  const data = seen ? presetPreview(preset) : null;
  return (
    <div className="preview" ref={ref}>
      {data && (
        <svg viewBox={data.viewBox}>
          <DiagramContent doc={data.doc} />
        </svg>
      )}
    </div>
  );
});

const TemplatePreview = memo(function TemplatePreview({ template }: { template: Template }) {
  useLanguage();
  const [ref, seen] = useInView<HTMLDivElement>();
  const data = seen ? templatePreview(template) : null;
  return (
    <div className="preview" ref={ref}>
      {data && (
        <svg viewBox={data.viewBox}>
          <DiagramContent doc={data.doc} />
        </svg>
      )}
    </div>
  );
});

// ---------- ricerca ----------

/** Minuscole, senza accenti né comandi LaTeX: "Rete neurale" trova anche "rete neurale". */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\\[a-z]+|[${}\\_^]/gi, ' ')
    .toLowerCase();

interface Entry {
  key: LibraryKey;
  name: string;
  group: string;
  haystack: string;
  nameN: string;
  preset?: Preset;
  template?: Template;
}

function score(e: Entry, tokens: string[]): number {
  let s = 0;
  for (const t of tokens) {
    if (!e.haystack.includes(t)) return 0;
    if (e.nameN.startsWith(t)) s += 4;
    else if (e.nameN.split(/\s+/).some((w) => w.startsWith(t))) s += 3;
    else if (e.nameN.includes(t)) s += 2;
    else s += 1;
  }
  return s;
}

// La ricerca trova un nome nella lingua scelta, nell'originale italiano e in inglese.
function buildEntries(): Entry[] {
  const presets = allPresets().map((p): Entry => {
    const n = p.node;
    return {
      key: `p:${p.id}`,
      name: t(p.name),
      group: p.category,
      nameN: norm(t(p.name)),
      haystack: norm([t(p.name), t(p.category), p.name, p.category, translateTo('en', p.name), translateTo('en', p.category), p.id, n.label ?? '', n.sublabel ?? '', n.shape ?? ''].join(' ')),
      preset: p,
    };
  });
  const templates = allTemplates().map(
    (template): Entry => ({
      key: `t:${template.id}`,
      name: t(template.name),
      group: template.section,
      nameN: norm(t(template.name)),
      haystack: norm([t(template.name), t(template.section), template.name, template.section, translateTo('en', template.name), translateTo('en', template.section), template.id].join(' ')),
      template,
    }),
  );
  return [...presets, ...templates];
}

// ---------- elementi ----------

/** Inserisce un elemento e lo ricorda fra i recenti. */
function insert(e: Entry) {
  if (e.preset) addPreset(e.preset.id);
  else if (e.template) addTemplate(e.template.id);
  noteRecent(e.key);
}

interface HoverState {
  entry: Entry;
  top: number;
  left: number;
}

/** Dopo un'anteprima, le successive compaiono quasi subito (si scorre la griglia col mouse). */
let cardHiddenAt = 0;

function Item({ entry, fav, onHover }: { entry: Entry; fav: boolean; onHover: (h: HoverState | null) => void }) {
  useLanguage();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leave = () => {
    clearTimeout(timer.current);
    onHover(null);
  };
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className={fav ? 'palette-cell fav' : 'palette-cell'}>
      <button
        className="palette-item"
        draggable
        aria-label={`${entry.name} (${t(entry.group)})`}
        onPointerEnter={(ev) => {
          const el = ev.currentTarget;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            if (!el.isConnected) return;
            const r = el.getBoundingClientRect();
            const aside = el.closest('.palette')!.getBoundingClientRect();
            onHover({ entry, top: r.top, left: aside.right + 8 });
          }, Date.now() - cardHiddenAt < 500 ? 60 : 420);
        }}
        onPointerLeave={leave}
        onDragStart={(ev) => {
          leave();
          ev.dataTransfer.setData(entry.preset ? 'application/x-mlsketch-preset' : 'application/x-mlsketch-template', entry.key.slice(2));
          ev.dataTransfer.effectAllowed = 'copy';
        }}
        onClick={(ev) => {
          leave();
          insert(entry);
          // col mouse il focus torna al foglio, così le frecce spostano il blocco appena inserito
          if (ev.detail > 0) ev.currentTarget.blur();
        }}
      >
        {entry.preset ? <PresetPreview preset={entry.preset} /> : <TemplatePreview template={entry.template!} />}
        <span className="item-name">{entry.name}</span>
      </button>
      <button
        className="fav-btn"
        tabIndex={-1}
        aria-label={fav ? t('Togli dai preferiti') : t('Aggiungi ai preferiti')}
        data-tip={fav ? t('Togli dai preferiti') : t('Aggiungi ai preferiti')}
        onClick={() => toggleFavorite(entry.key)}
      >
        <Icon name="star" size={12} className={fav ? 'filled' : undefined} />
      </button>
    </div>
  );
}

function HoverCard({ hover }: { hover: HoverState }) {
  useLanguage();
  const { entry } = hover;
  const big = !!entry.template;
  const data = entry.preset ? presetPreview(entry.preset) : templatePreview(entry.template!);
  const h = big ? 300 : 170;
  const top = Math.max(56, Math.min(hover.top - 8, window.innerHeight - h - 90));
  return (
    <div className={big ? 'hover-card big' : 'hover-card'} style={{ top, left: hover.left }} aria-hidden="true">
      <div className="hover-preview">
        <svg viewBox={data.viewBox}>
          <DiagramContent doc={data.doc} />
        </svg>
      </div>
      <div className="hover-meta">
        <strong>{entry.name}</strong>
        <span>{t(entry.group)}</span>
      </div>
      <div className="hover-hint">{t("Clic per inserire al centro · trascina sul foglio · ☆ per i preferiti")}</div>
    </div>
  );
}

// ---------- sezioni ----------

const COLLAPSED_KEY = 'mlsketch:collapsed';

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function Section(p: { title: string; icon?: ReactNode; count: number; open: boolean; onToggle?: () => void; children: ReactNode }) {
  useLanguage();
  return (
    <section className="lib-section">
      <h3>
        <button className="section-title" onClick={p.onToggle} disabled={!p.onToggle} aria-expanded={p.open}>
          {p.onToggle && <Icon name="chevron" size={12} className={p.open ? 'chevron open' : 'chevron'} />}
          {p.icon}
          <span className="section-name">{p.title}</span>
          <span className="count">{p.count}</span>
        </button>
      </h3>
      {p.open && p.children}
    </section>
  );
}

/** Spostamento del focus con le frecce: alla cella più vicina nella direzione scelta. */
function moveFocus(from: HTMLElement, key: string, root: HTMLElement) {
  const items = [...root.querySelectorAll<HTMLElement>('.palette-item')];
  const i = items.indexOf(from);
  if (i < 0) return;
  if (key === 'ArrowRight') return items[i + 1]?.focus();
  if (key === 'ArrowLeft') {
    if (i === 0) return root.querySelector<HTMLInputElement>('.search input')?.focus();
    return items[i - 1]?.focus();
  }
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const down = key === 'ArrowDown';
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of items) {
    const q = el.getBoundingClientRect();
    const dy = down ? q.top - r.bottom : r.top - q.bottom;
    if (dy < -2) continue;
    const s = dy * 4 + Math.abs(q.left + q.width / 2 - cx);
    if (s < bestScore) {
      bestScore = s;
      best = el;
    }
  }
  if (best) best.focus();
  else if (!down) root.querySelector<HTMLInputElement>('.search input')?.focus();
}

export function Palette() {
  const language = useLanguage();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [hover, setHoverState] = useState<HoverState | null>(null);
  const setHover = (h: HoverState | null) => {
    setHoverState((prev) => {
      if (prev && !h) cardHiddenAt = Date.now();
      return h;
    });
  };
  const [io, setIo] = useState<IntersectionObserver | null>(null);
  const tab = useUi((s) => s.libraryTab);
  const recent = useUi((s) => s.recent);
  const favorites = useUi((s) => s.favorites);
  const hidden = useUi((s) => s.hideLibrary);
  const asideRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allEntries = useMemo(buildEntries, [language]);
  // la libreria mostra la base e i pacchetti installati (vedi packs.ts)
  const installed = usePacks((p) => p.installed);
  const entries = useMemo(() => allEntries.filter((e) => groupVisible(e.group, installed)), [allEntries, installed]);
  const byKey = useMemo(() => new Map(entries.map((e) => [e.key, e])), [entries]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (list) => {
        for (const en of list) {
          if (!en.isIntersecting) continue;
          onVisible.get(en.target)?.();
          observer.unobserve(en.target);
        }
      },
      { root: listRef.current, rootMargin: '240px 0px' },
    );
    setIo(observer);
    return () => observer.disconnect();
  }, []);

  const tokens = norm(query).split(/\s+/).filter(Boolean);
  const searching = tokens.length > 0;
  const results = useMemo(() => {
    if (!searching) return null;
    const scored = entries
      .map((e) => ({ e, s: score(e, tokens) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || a.e.name.localeCompare(b.e.name));
    return {
      blocks: scored.filter((x) => x.e.preset).map((x) => x.e),
      templates: scored.filter((x) => x.e.template).map((x) => x.e),
    };
  }, [entries, tokens.join(' ')]);
  // risultati che stanno in pacchetti non installati: si propone di installarli
  const packHits = useMemo(() => {
    if (!searching) return [];
    const hits = new Map<string, number>();
    for (const e of allEntries) {
      const pack = packOf(e.group);
      if (!pack || installed.has(pack.id) || score(e, tokens) <= 0) continue;
      hits.set(pack.id, (hits.get(pack.id) ?? 0) + 1);
    }
    return PACKS.filter((p) => hits.has(p.id)).map((p) => ({ pack: p, n: hits.get(p.id)! }));
  }, [allEntries, installed, tokens.join(' ')]);
  const packHitRows = packHits.map(({ pack, n }) => ( <button
      key={pack.id}
      className="lib-pack-hit"
      onClick={() => {
        setInstalled(pack.id, true);
        toast(t('Pacchetto «{name}» installato', { name: t(pack.name) }));
      }}
    >
      <span>
        {t('{count} risultati nel pacchetto «{name}»', { count: n, name: t(pack.name) })}
      </span>
      <b>{t("Installa")}</b>
    </button>
  ));

  const isOpen = (name: string) => !collapsed.has(name);
  const setCollapsedPersist = (next: Set<string>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
    } catch {
      // ricordare le sezioni chiuse è solo una comodità
    }
  };
  const toggle = (name: string) => {
    const next = new Set(collapsed);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setCollapsedPersist(next);
  };

  const kind = tab === 'blocks' ? 'p' : 't';
  const tabEntries = entries.filter((e) => e.key[0] === kind);
  const groups = [...new Set(tabEntries.map((e) => e.group))];
  const favEntries = favorites.filter((k) => k[0] === kind).map((k) => byKey.get(k)).filter((e): e is Entry => !!e);
  const recentEntries = recent.filter((k) => k[0] === kind).map((k) => byKey.get(k)).filter((e): e is Entry => !!e);
  const allCollapsed = groups.every((g) => collapsed.has(g));
  const favSet = new Set(favorites);

  const grid = (list: Entry[], cls = '') => ( <div className={`palette-grid ${cls}`}>
      {list.map((e) => ( <Item key={e.key} entry={e} fav={favSet.has(e.key)} onHover={setHover} />
      ))}
    </div>
  );
  const gridFor = (list: Entry[]) => grid(list, list[0]?.template ? 'templates' : '');

  const firstResult = results ? (results.blocks[0] ?? results.templates[0]) : undefined;

  return (
    <aside
      className={hidden ? 'palette hidden' : 'palette'}
      ref={asideRef}
      onKeyDown={(e) => {
        const t = e.target as HTMLElement;
        if (!t.classList.contains('palette-item') || !e.key.startsWith('Arrow')) return;
        e.preventDefault();
        e.stopPropagation(); // le frecce qui non spostano i blocchi del foglio
        moveFocus(t, e.key, asideRef.current!);
      }}
    >
      <div className="palette-head">
        <div className="search">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={query}
            placeholder={t("Cerca blocchi e modelli…")}
            aria-label={t("Cerca nella libreria")}
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setHover(null);
              listRef.current?.scrollTo({ top: 0 });
            }}
            onKeyDown={(e) => {
              // Invio ed Esc durante la composizione (cinese, giapponese, coreano) appartengono alla tastiera
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Escape') {
                e.stopPropagation();
                if (query) setQuery('');
                else e.currentTarget.blur();
              } else if (e.key === 'Enter' && firstResult) {
                e.preventDefault();
                insert(firstResult);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                asideRef.current?.querySelector<HTMLElement>('.palette-item')?.focus();
              }
            }}
          />
          {query ? (
            <button className="search-clear" aria-label={t("Cancella la ricerca")} data-tip={t("Cancella la ricerca")} onClick={() => setQuery('')}>
              <Icon name="close" size={12} />
            </button> ) : ( <kbd className="search-kbd">{keys('⌘F')}</kbd>
          )}
        </div>
        {searching ? (
          <div className="search-summary">
            {results!.blocks.length + results!.templates.length
              ? <>
                  {t('{blocks} blocchi · {templates} modelli', { blocks: results!.blocks.length, templates: results!.templates.length })}
                  <span className="search-enter" data-tip={t("Invio inserisce il primo risultato")}>
                    <kbd>{keys('↩')}</kbd>{t("inserisci")}</span>
                </>
              : t('Nessun risultato')}
          </div> ) : ( <div className="segmented lib-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'blocks'} className={tab === 'blocks' ? 'on' : ''} onClick={() => setUi({ libraryTab: 'blocks' })}>
              <Icon name="blocks" size={14} />{t("Blocchi")}<span className="count">{entries.filter((e) => e.preset).length}</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'templates'}
              className={tab === 'templates' ? 'on' : ''}
              onClick={() => setUi({ libraryTab: 'templates' })}
            >
              <Icon name="template" size={14} />{t("Modelli")}<span className="count">{entries.filter((e) => e.template).length}</span>
            </button>
          </div>
        )}
      </div>

      <ObserverCtx.Provider value={io}>
        <div className="palette-list" ref={listRef} onScroll={() => hover && setHover(null)}>
          {io && results && (
            <>
              {results.blocks.length > 0 && ( <Section title={t("Blocchi")} count={results.blocks.length} open>
                  {grid(results.blocks)}
                </Section>
              )}
              {results.templates.length > 0 && ( <Section title={t("Modelli")} count={results.templates.length} open>
                  {grid(results.templates, 'templates')}
                </Section>
              )}
              {!results.blocks.length && !results.templates.length && (
                <div className="empty-search">
                  <Icon name="search" size={22} />
                  <p>{t('Nessun risultato per «{query}»', { query: query.trim() })}
                  </p>
                  <p className="hint">{t("Prova un termine in inglese (es. attention, encoder, loss) o il nome di una categoria.")}</p>
                  {packHitRows}
                  <button className="btn" onClick={() => setQuery('')}>{t("Cancella la ricerca")}</button>
                  {packHitRows.length === 0 && (
                    <button className="btn" onClick={() => openFeedback('addition', query.trim())} data-tip={t("Chiedi di aggiungerlo: i pacchetti nascono dalle richieste")}>
                      {t('Chiedi di aggiungere «{name}»', { name: query.trim() })}
                    </button>
                  )}
                </div>
              )}
              {(results.blocks.length > 0 || results.templates.length > 0) && packHitRows}
            </>
          )}
          {io && !results && (
            <>
              {favEntries.length > 0 && ( <Section title={t("Preferiti")} icon={<Icon name="star" size={12} className="filled section-icon fav-icon" />} count={favEntries.length} open={isOpen('★')} onToggle={() => toggle('★')}>
                  {gridFor(favEntries)}
                </Section>
              )}
              {recentEntries.length > 0 && ( <Section title={t("Recenti")} icon={<Icon name="clock" size={12} className="section-icon" />} count={recentEntries.length} open={isOpen('⟲')} onToggle={() => toggle('⟲')}>
                  {gridFor(recentEntries)}
                </Section>
              )}
              <div className="lib-groups-head">
                <span>{tab === 'blocks' ? t('Categorie') : t('Sezioni')}</span>
                <button
                  className="link-btn"
                  onClick={() => {
                    const next = new Set(collapsed);
                    for (const g of groups) {
                      if (allCollapsed) next.delete(g);
                      else next.add(g);
                    }
                    setCollapsedPersist(next);
                  }}
                >
                  {allCollapsed ? t('Espandi tutto') : t('Comprimi tutto')}
                </button>
              </div>
              {groups.map((g) => {
                const items = tabEntries.filter((e) => e.group === g);
                return (
                  <Section key={g} title={t(g)} count={items.length} open={isOpen(g)} onToggle={() => toggle(g)}>
                    {gridFor(items)}
                  </Section>
                );
              })}
              <div className="lib-packs">
                <span>
                  <strong>{t("Cerchi un altro ambito?")}</strong>{t("Medico, segnali, visione e altri sono pacchetti: li installi o li chiedi.")}</span>
                <button className="btn" onClick={() => openPacks()}>{t("Pacchetti…")}</button>
              </div>
            </>
          )}
        </div>
      </ObserverCtx.Provider>
      {hover && <HoverCard hover={hover} />}
    </aside>
  );
}
