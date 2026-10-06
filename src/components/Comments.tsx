import { t, useLanguage, getLanguage } from '../i18n';
// Commenti appuntati sul foglio (relatore, coautori) e presenza nella barra di stato.
// I commenti restano nel file della figura e non finiscono negli export.
import { useEffect, useRef, useState } from 'react';
import { getAuthor, setAuthor, usePresence } from '../collab';
import { getLive } from '../live';
import type { Comment } from '../model';
import { getState, setDoc, useStore } from '../store';
import { setUi, toast, useUi } from '../ui';
import './comments.css';

function updateComments(fn: (list: Comment[]) => Comment[]) {
  const doc = getState().doc;
  const comments = fn(doc.comments ?? []);
  setDoc({ ...doc, comments });
}

const when = (time: number) => (time ? new Date(time).toLocaleDateString(getLanguage(), { day: 'numeric', month: 'short' }) : '');

interface Draft {
  x: number;
  y: number;
}

export function CommentsLayer() {
  useLanguage();
  const comments = useStore((s) => s.doc.comments);
  const view = useStore((s) => s.view);
  const mode = useUi((u) => u.commentMode);
  const focus = useUi((u) => u.commentFocus);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [name, setName] = useState(getAuthor);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (draft) area.current?.focus();
  }, [draft]);
  useEffect(() => {
    if (!mode) setDraft(null);
  }, [mode]);
  // commento scelto dall'elenco del pannello «Insieme»
  useEffect(() => {
    if (!focus) return;
    setDraft(null);
    setOpenId(focus);
    setUi({ commentFocus: null });
  }, [focus]);
  // Esc esce dalla modalità commento anche col cursore sul foglio
  useEffect(() => {
    if (!mode && !openId) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenId(null);
      setUi({ commentMode: false });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [mode, openId]);

  const at = (x: number, y: number) => ({ left: view.x + x * view.zoom, top: view.y + y * view.zoom });
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const place = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setOpenId(null);
    // Il profilo può essere stato impostato dopo il montaggio del foglio.
    // Lo si riprende soltanto per un nuovo commento, senza toccare una bozza aperta.
    setName(getAuthor());
    setText('');
    setDraft({ x: (e.clientX - r.left - view.x) / view.zoom, y: (e.clientY - r.top - view.y) / view.zoom });
  };

  const add = () => {
    if (!draft || !text.trim()) return;
    if (name.trim()) setAuthor(name);
    // due persone nella stessa stanza possono commentare nello stesso istante: l'identificativo non deve coincidere
    const c: Comment = { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, x: draft.x, y: draft.y, author: name.trim() || t('Anonimo'), text: text.trim(), time: Date.now(), done: false };
    updateComments((list) => [...list, c]);
    setDraft(null);
    setUi({ commentMode: false });
    toast(getLive().room ? t('Commento aggiunto: lo vedono subito tutti su questa figura') : t('Commento aggiunto: salva la figura per condividerlo'));
  };

  const list = comments ?? [];
  const current = list.find((c) => c.id === openId);
  if (!mode && !list.length) return null;
  return (
    <div className="comments-layer">
      {mode && <div className="comments-capture" onPointerDown={place} />}
      {list.map((c, i) => ( <button
          key={c.id}
          className={`comment-pin${c.done ? ' done' : ''}${c.id === openId ? ' on' : ''}`}
          style={at(c.x, c.y)}
          onPointerDown={stop}
          onDoubleClick={stop}
          onClick={() => {
            setDraft(null);
            setOpenId(c.id === openId ? null : c.id);
          }}
          aria-label={t('Commento {count} di {name}', { count: i + 1, name: c.author })}
        >
          {i + 1}
        </button>
      ))}
      {current && (
        <div className="comment-card" style={at(current.x, current.y)} onPointerDown={stop} onDoubleClick={stop} onKeyDown={stop} onWheel={stop}>
          <small>
            <b>{current.author}</b> · {when(current.time)}
            {current.done && ` · ${t('risolto')}`}
          </small>
          <p>{current.text}</p>
          <div className="comment-actions">
            <button className="btn" onClick={() => updateComments((l) => l.map((c) => (c.id === current.id ? { ...c, done: !c.done } : c)))}>
              {current.done ? t('Riapri') : t('Risolto')}
            </button>
            <button
              className="link-btn"
              onClick={() => {
                updateComments((l) => l.filter((c) => c.id !== current.id));
                setOpenId(null);
              }}
            >{t("Elimina")}</button>
          </div>
        </div>
      )}
      {draft && (
        <form
          className="comment-card"
          style={at(draft.x, draft.y)}
          onPointerDown={stop}
          onDoubleClick={stop}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') setDraft(null);
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add();
          }}
          onWheel={stop}
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          {!getAuthor() && <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Il tuo nome")} aria-label={t("Il tuo nome")} />}
          <textarea ref={area} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Scrivi il commento…")} aria-label={t("Commento")} />
          <div className="comment-actions">
            <button type="submit" className="btn" disabled={!text.trim()}>{t("Commenta")}</button>
            <button type="button" className="link-btn" onClick={() => setDraft(null)}>{t("Annulla")}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Barra di stato: chi altro ha aperto questa figura dalla cartella condivisa. */
export function PresenceChip() {
  useLanguage();
  const others = usePresence();
  if (!others.length) return null;
  const names = [...new Set(others.map((p) => p.name))];
  return (
    <span className="presence-chip" data-tip={t("Ha aperto questa figura dalla cartella condivisa. Quando salva, la vedi aggiornarsi.")} data-tip-place="above">
      {t('Qui anche: {names}', { names: names.join(', ') })}
    </span>
  );
}
