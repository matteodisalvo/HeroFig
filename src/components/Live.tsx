import { t, useLanguage } from '../i18n';
// Insieme: un solo pulsante per commenti e lavoro dal vivo. Resta spento finché non si collega
// il server privato del gruppo; il pannello guida la configurazione e poi mostra chi c'è,
// le stanze del gruppo e i commenti. Sul foglio, i cursori degli altri.
import { useCallback, useEffect, useRef, useState } from 'react';
import { clientId, getAuthor, setAuthor, useAuthor } from '../collab';
import {
  canClose, closeRoom, createGroup, createRoom, currentRoom, figureTitle, joinGroup, joinRoom, leaveGroup, leaveRoom, reconnect, roomMates, setHosting,
  stopServer, useLive, type Member, type Room,
} from '../live';
import type { Comment } from '../model';
import { IS_MAC } from '../os';
import { canHostGroup, copyText, groupLogin, groupStatus } from '../platform';
import { getState, setView, useStore } from '../store';
import { setUi, toast } from '../ui';
import { Icon } from './Icon';
import './live.css';

const COLORS = ['#8250df', '#d9730d', '#1a7f72', '#cf3b6f', '#a16207', '#6a7d1c']; // niente blu: è il colore di «tu»
const colorOf = (id: string) => COLORS[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % COLORS.length];
const message = (err: unknown) => (err instanceof Error ? err.message : String(err));
const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

type View = 'choose' | 'host' | 'join' | 'invite' | 'home' | 'settings';

function CopyInvite({ invite }: { invite: string }) {
  useLanguage();
  const [done, setDone] = useState(false);
  return (
    <div className="together-invite">
      <code>{invite}</code>
      <button
        className="btn"
        onClick={() =>
          copyText(invite)
            .then(() => setDone(true))
            .catch((err) => toast(message(err), 'info'))
        }
      >{done ? t('Copiato') : t('Copia')}</button>
    </div>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  useLanguage();
  return (
    <label className="together-field">
      <span>{t('Il tuo nome')}</span>
      <input type="text" maxLength={80} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('Come ti vedono gli altri')} />
    </label>
  );
}

/** Configurazione: una volta sola, poi il pulsante si accende. */
function Setup({ view, go }: { view: View; go: (v: View) => void }) {
  useLanguage();
  const [group, setGroup] = useState('');
  const [name, setName] = useState(getAuthor);
  const [invite, setInvite] = useState('');
  const [login, setLogin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>, next: View) => {
    if (name.trim()) setAuthor(name);
    setBusy(true);
    setError('');
    try {
      await fn();
      go(next);
    } catch (err) {
      setError(message(err));
    }
    setBusy(false);
  };

  if (view === 'host')
    return (
      <form
        className="together-body"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => createGroup(group.trim(), login), 'invite');
        }}
      >
        <label className="together-field">
          <span>{t('Nome del gruppo')}</span>
          <input type="text" value={group} onChange={(e) => setGroup(e.target.value)} placeholder={t('Es. Lab Visione')} autoFocus />
        </label>
        <NameField value={name} onChange={setName} />
        <label className="together-check">
          <input type="checkbox" checked={login} onChange={(e) => setLogin(e.target.checked)} />
          <span>{t('Apri l’app all’accensione del computer')}</span>
        </label>
        <p className="hint">
          {IS_MAC
            ? t('Il server resta attivo finché l’app è aperta, anche con le finestre chiuse. Funziona fra computer sulla stessa rete o VPN.')
            : t('Il server resta attivo finché l’app è aperta. Funziona fra computer sulla stessa rete o VPN.')}
        </p>
        {error && <p className="together-error" role="alert">{error}</p>}
        <div className="together-actions">
          <button type="submit" className="btn primary-fill" disabled={busy || !group.trim() || !name.trim()}>{busy ? t('Creo il server…') : t('Crea il server')}</button>
          <button type="button" className="link-btn" onClick={() => go('choose')}>{t('Indietro')}</button>
        </div>
      </form>
    );

  if (view === 'join')
    return (
      <form
        className="together-body"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => joinGroup(invite), 'home');
        }}
      >
        <label className="together-field">
          <span>{t('Invito ricevuto')}</span>
          <input type="text" value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="192.168.1.20:47800/ABCD-EFGH-JKLM" spellCheck={false} autoFocus />
        </label>
        <NameField value={name} onChange={setName} />
        {error && <p className="together-error" role="alert">{error}</p>}
        <div className="together-actions">
          <button type="submit" className="btn primary-fill" disabled={busy || !invite.trim() || !name.trim()}>{busy ? t('Mi collego…') : t('Collegati')}</button>
          <button type="button" className="link-btn" onClick={() => go('choose')}>{t('Indietro')}</button>
        </div>
      </form>
    );

  return (
    <div className="together-body">
      <p className="hint">{t('Commenti e lavoro dal vivo con i colleghi passano da un server privato del vostro gruppo, senza account né servizi esterni. Si configura una volta sola.')}</p>
      <div className="together-choices">
        {canHostGroup && (
          <button className="together-choice" onClick={() => go('host')}>
            <strong>{t('Questo computer fa da server')}</strong>
            <small>{t('Ad esempio il computer del laboratorio, quello che resta acceso.')}</small>
          </button>
        )}
        <button className="together-choice" onClick={() => go('join')}>
          <strong>{t('Ho ricevuto un invito')}</strong>
          <small>{t('Un collega ha già creato il server.')}</small>
        </button>
      </div>
    </div>
  );
}

function People({ me, others }: { me: string; others: Member[] }) {
  useLanguage();
  return (
    <ul className="together-people">
      <li>
        <i style={{ background: 'var(--accent)' }} /> {t('{name} (tu)', { name: me || t('Tu') })}
      </li>
      {others.map((p) => (
        <li key={p.id}>
          <i style={{ background: colorOf(p.id) }} /> {p.name}
        </li>
      ))}
    </ul>
  );
}

/** Porta il foglio sul commento e lo apre. */
function focusComment(c: Comment) {
  const el = document.querySelector('.canvas');
  const { view } = getState();
  if (el) {
    const r = el.getBoundingClientRect();
    setView({ ...view, x: r.width / 2 - c.x * view.zoom, y: r.height / 2 - c.y * view.zoom });
  }
  setUi({ commentFocus: c.id });
}

function CommentList({ onPick }: { onPick: () => void }) {
  useLanguage();
  const comments = useStore((s) => s.doc.comments) ?? [];
  const [showDone, setShowDone] = useState(false);
  const open = comments.filter((c) => !c.done);
  const done = comments.length - open.length;
  const shown = comments.map((c, i) => ({ c, n: i + 1 })).filter(({ c }) => showDone || !c.done);
  return (
    <section className="together-section">
      <div className="together-row">
        <h4>{open.length ? t('Commenti · {count}', { count: open.length }) : t('Commenti')}</h4>
        <button
          className="btn small"
          onClick={() => {
            setUi({ commentMode: true });
            onPick();
          }}
        >{t('+ Commento')}</button>
      </div>
      {!comments.length && <p className="hint">{t('Clicca «+ Commento» e poi il punto del foglio da commentare.')}</p>}
      {shown.length > 0 && (
        <ul className="together-comments">
          {shown.map(({ c, n }) => (
            <li key={c.id}>
              <button
                className={c.done ? 'together-comment done' : 'together-comment'}
                onClick={() => {
                  focusComment(c);
                  onPick();
                }}
              >
                <b className="together-pin">{n}</b>
                <span>
                  <small>{c.author}</small>
                  {c.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {done > 0 && (
        <button className="link-btn" onClick={() => setShowDone((v) => !v)}>
          {showDone ? t('Nascondi i risolti') : t('Mostra i risolti ({count})', { count: done })}
        </button>
      )}
    </section>
  );
}

/** Conferma prima di chiudere una stanza per tutti, al posto dei pulsanti che l'hanno aperta. */
function CloseRoom({ room, online, onDone }: { room: Room; online: boolean; onDone: () => void }) {
  useLanguage();
  const [busy, setBusy] = useState(false);
  return (
    <div className="together-confirm">
      <p className="hint">{t('Chiudere «{name}» per tutti? Chi è dentro esce, ma la figura resta aperta sul suo computer.', { name: room.name })}</p>
      <div className="together-actions">
        <button
          className="btn small danger-fill"
          disabled={busy || !online}
          onClick={async () => {
            setBusy(true);
            await closeRoom(room.id).catch((err) => toast(message(err), 'info'));
            setBusy(false);
            onDone();
          }}
        >{t('Chiudi per tutti')}</button>
        <button className="btn small" onClick={onDone}>{t('Annulla')}</button>
      </div>
    </div>
  );
}

/** Una stanza nell'elenco: chi c'è, chi l'ha creata, entrare e (per chi può) chiuderla. */
function RoomRow({ room, inside, online, label, primary, slot, onEnter }: { room: Room; inside: Member[]; online: boolean; label: string; primary: boolean; slot: boolean; onEnter: () => void }) {
  useLanguage();
  const live = useLive((s) => s);
  const [confirm, setConfirm] = useState(false);
  const who = inside.length ? t('Dentro: {names}', { names: inside.map((p) => p.name).join(', ') }) : t('Vuota');
  const by = room.owner === clientId ? t('creata da te') : t('creata da {name}', { name: room.ownerName });
  return (
    <li>
      <div className="together-room-main">
        <span>
          <strong>{room.name}</strong>
          <small>{who} · {by}</small>
        </span>
        <button className={primary ? 'btn small primary-fill' : 'btn small'} disabled={!online} onClick={onEnter}>{label}</button>
        {canClose(room, live) ? (
          <button
            className="together-room-close"
            disabled={!online}
            aria-label={t('Chiudi la stanza')}
            aria-expanded={confirm}
            data-tip={t('Chiudi la stanza')}
            onClick={() => setConfirm((c) => !c)}
          >
            <Icon name="close" size={13} />
          </button>
        ) : (
          // posto vuoto se un'altra stanza ha la ×: i pulsanti «Entra» restano in colonna
          slot && <span className="together-room-slot" />
        )}
      </div>
      {confirm && <CloseRoom room={room} online={online} onDone={() => setConfirm(false)} />}
    </li>
  );
}

/** «Nuova stanza»: si sceglie il nome, la figura aperta diventa quella della stanza. */
function NewRoom({ primary, online }: { primary: boolean; online: boolean }) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!open)
    return (
      <button
        className={primary ? 'btn primary-fill' : 'btn'}
        disabled={!online}
        onClick={() => {
          setName(figureTitle());
          setError('');
          setOpen(true);
        }}
      >{t('Nuova stanza con questa figura')}</button>
    );
  return (
    <form
      className="together-new"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await createRoom(name.trim());
          setOpen(false);
        } catch (err) {
          setError(message(err));
        }
        setBusy(false);
      }}
    >
      <label className="together-field">
        <span>{t('Nome della stanza')}</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus onFocus={(e) => e.target.select()} />
      </label>
      <p className="hint">{t('La figura aperta diventa la figura della stanza. Potrai chiuderla tu, quando avete finito.')}</p>
      {error && <p className="together-error" role="alert">{error}</p>}
      <div className="together-actions">
        <button type="submit" className="btn primary-fill" disabled={busy || !online || !name.trim()}>{busy ? t('Creo la stanza…') : t('Crea la stanza')}</button>
        <button type="button" className="link-btn" onClick={() => setOpen(false)}>{t('Annulla')}</button>
      </div>
    </form>
  );
}

function Home({ go, close }: { go: (v: View) => void; close: () => void }) {
  useLanguage();
  const live = useLive((s) => s);
  const me = useAuthor();
  const dirty = useStore((s) => s.dirty);
  const hasNodes = useStore((s) => s.doc.nodes.length > 0);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const online = live.status === 'online';
  const mates = roomMates(live);
  const here = currentRoom(live);
  const others = live.rooms.filter((r) => r.id !== live.room).sort((a, b) => b.created - a.created);
  const inside = (id: string) => live.members.filter((m) => m.room === id);
  const idle = live.members.filter((m) => !m.room);
  // senza stanza, la figura aperta con modifiche non salvate verrebbe sostituita: si chiede conferma
  const enter = (room: string) => {
    if (!live.room && hasNodes && dirty && replacing !== room) return setReplacing(room);
    setReplacing(null);
    void joinRoom(room);
  };
  const slot = others.some((r) => canClose(r, live));
  const list = (label: string) => (
    <ul className="together-rooms">
      {others.map((r) => (
        <RoomRow
          key={r.id}
          room={r}
          inside={inside(r.id)}
          online={online}
          primary={replacing === r.id}
          label={replacing === r.id ? t('Sostituisci la mia') : label}
          slot={slot}
          onEnter={() => enter(r.id)}
        />
      ))}
    </ul>
  );

  return (
    <div className="together-body">
      {live.status === 'offline' && (
        <div className="together-notice" role="status">
          <p>
            {live.badKey
              ? t('Il server non accetta più questo invito: forse è stato ricreato. Chiedi un invito nuovo.')
              : t('Il server del gruppo non risponde. Controlla che il computer che lo ospita sia acceso e sulla stessa rete. Riprovo da solo.')}
          </p>
          {live.badKey ? (
            <button className="btn small" onClick={() => go('settings')}>{t('Cambia server')}</button>
          ) : (
            <button className="btn small" onClick={reconnect}>{t('Riprova ora')}</button>
          )}
        </div>
      )}

      {live.room ? (
        <>
          <section className="together-section">
            <div className="together-here">
              <h4>{t('Sei nella stanza')}</h4>
              <strong>{here?.name ?? '…'}</strong>
              {here && <small>{here.owner === clientId ? t('creata da te') : t('creata da {name}', { name: here.ownerName })}</small>}
            </div>
            {live.joining ? (
              <p className="hint">{t('Ricevo la figura…')}</p>
            ) : (
              <>
                <People me={me} others={mates} />
                {!mates.length && <p className="hint">{t('Per ora ci sei solo tu. Il gruppo vede la stanza nell’elenco e può entrare.')}</p>}
              </>
            )}
            {closing && here ? (
              <CloseRoom room={here} online={online} onDone={() => setClosing(false)} />
            ) : (
              // uscire e chiudere per tutti stanno ai due lati: difficile sbagliare l'uno per l'altro
              <div className="together-actions together-room-actions">
                <button className="btn small" onClick={() => void leaveRoom()}>{t('Esci dalla stanza')}</button>
                {here && canClose(here, live) && (
                  <button className="btn small danger-outline" disabled={!online} onClick={() => setClosing(true)}>
                    <Icon name="close" size={12} />
                    {t('Chiudi la stanza')}
                  </button>
                )}
              </div>
            )}
          </section>
          {others.length > 0 && (
            <section className="together-section">
              <h4>{t('Altre stanze')}</h4>
              {list(t('Passa qui'))}
            </section>
          )}
        </>
      ) : (
        <section className="together-section">
          {others.length > 0 ? (
            <>
              <h4>{t('Stanze del gruppo')}</h4>
              {list(t('Entra'))}
              {replacing && <p className="hint">{t('La figura aperta ha modifiche non salvate e verrà sostituita. Salvala prima, oppure conferma.')}</p>}
            </>
          ) : (
            <p className="hint">{t('Una stanza è una figura su cui lavorare insieme dal vivo, con i commenti. Resta aperta finché chi l’ha creata non la chiude.')}</p>
          )}
          <NewRoom primary={!others.length} online={online} />
          {online && (idle.length > 0 || !live.members.length) && (
            <p className="hint">
              {idle.length ? t('In linea: {names}', { names: idle.map((m) => m.name).join(', ') }) : t('Nessun altro del gruppo è in linea adesso.')}
            </p>
          )}
        </section>
      )}

      <CommentList onPick={close} />
    </div>
  );
}

function Settings({ go }: { go: (v: View) => void }) {
  useLanguage();
  const live = useLive((s) => s);
  const author = useAuthor();
  const [name, setName] = useState(author);
  useEffect(() => { setName(author); }, [author]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const hosting = live.hosting;
  // l'indirizzo del computer può cambiare: si rilegge ogni volta
  useEffect(() => {
    void groupStatus().then(setHosting, () => {});
  }, []);
  const saveName = () => {
    if (!name.trim() || name.trim() === getAuthor()) return;
    setAuthor(name);
  };

  return (
    <div className="together-body">
      {hosting ? (
        <section className="together-section">
          <p className="together-ok">
            <i /> {t('Questo computer ospita il server «{name}»', { name: hosting.name })}
          </p>
          <h4>{t('Invito per i colleghi')}</h4>
          <CopyInvite invite={hosting.invite} />
          <p className="hint">{t('Contiene la chiave segreta: mandalo solo a chi deve entrare.')}</p>
          <label className="together-check">
            <input
              type="checkbox"
              checked={hosting.openAtLogin}
              onChange={(e) => {
                const on = e.target.checked;
                setHosting({ ...hosting, openAtLogin: on });
                void groupLogin(on);
              }}
            />
            <span>{t('Apri l’app all’accensione del computer')}</span>
          </label>
        </section>
      ) : (
        <section className="together-section">
          <p className="together-ok">
            <i /> {t('Collegato a «{name}»', { name: live.group || live.invite })}
          </p>
          <h4>{t('Invito')}</h4>
          <CopyInvite invite={live.invite} />
        </section>
      )}
      <label className="together-field">
        <span>{t('Il tuo nome')}</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && saveName()} />
      </label>
      <div className="together-danger">
        {!confirm ? (
          <button className="link-btn danger" onClick={() => setConfirm(true)}>{hosting ? t('Spegni il server…') : t('Esci dal gruppo…')}</button>
        ) : (
          <>
            <p className="hint">
              {hosting
                ? t('Spegnere il server? I colleghi verranno scollegati, l’invito non varrà più e tutte le stanze verranno chiuse.')
                : t('Uscire dal gruppo? Per rientrare servirà di nuovo l’invito. I commenti restano nei file delle figure.')}
            </p>
            <div className="together-actions">
              <button
                className="btn danger-fill"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  if (hosting) await stopServer().catch((err) => toast(message(err), 'info'));
                  else leaveGroup();
                  setBusy(false);
                  go('choose');
                }}
              >{hosting ? t('Spegni il server') : t('Esci dal gruppo')}</button>
              <button className="link-btn" onClick={() => setConfirm(false)}>{t('Annulla')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const TITLES: Record<View, string> = {
  choose: 'Server del gruppo',
  host: 'Nuovo server del gruppo',
  join: 'Entra nel gruppo',
  invite: 'Server pronto',
  home: 'Insieme',
  settings: 'Server e invito',
};

function TogetherPanel({ onClose }: { onClose: () => void }) {
  useLanguage();
  const live = useLive((s) => s);
  const configured = live.status !== 'none';
  const [view, setView] = useState<View>(configured ? 'home' : 'choose');
  const ref = useRef<HTMLDivElement>(null);
  // se il gruppo viene dimenticato, si torna alla scelta iniziale
  const shown: View = !configured && (view === 'home' || view === 'settings') ? 'choose' : view;

  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const down = (e: PointerEvent) => {
      if (!ref.current?.parentElement?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', down, true);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', down, true);
    };
  }, [onClose]);

  return (
    <div className="together-panel" ref={ref} role="dialog" aria-label={t(TITLES[shown])} onKeyDown={(e) => e.stopPropagation()}>
      <div className="together-head">
        {shown === 'settings' ? (
          <button className="link-btn" onClick={() => setView('home')}>← {t('Insieme')}</button>
        ) : (
          <strong>{t(TITLES[shown])}</strong>
        )}
        {shown === 'home' && (
          <button className={`together-status ${live.status}`} onClick={() => setView('settings')} data-tip={t('Server e invito')}>
            <i /> {live.group || t('Gruppo')}
          </button>
        )}
      </div>
      {shown === 'invite' && live.hosting ? (
        <div className="together-body">
          <p className="together-ok">
            <i /> {t('Server attivo: «{name}»', { name: live.hosting.name })}
          </p>
          <h4>{t('Invito per i colleghi')}</h4>
          <CopyInvite invite={live.hosting.invite} />
          <p className="hint">{t('Contiene la chiave segreta: mandalo solo a chi deve entrare. Lo ritrovi in «Server e invito».')}</p>
          <div className="together-actions">
            <button className="btn primary-fill" onClick={() => setView('home')}>{t('Fatto')}</button>
          </div>
        </div>
      ) : shown === 'home' ? (
        <Home go={setView} close={onClose} />
      ) : shown === 'settings' ? (
        <Settings go={setView} />
      ) : (
        <Setup view={shown} go={setView} />
      )}
    </div>
  );
}

export function TogetherButton() {
  useLanguage();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const status = useLive((s) => s.status);
  const inRoom = useLive((s) => !!s.room && !s.joining);
  const roomName = useLive((s) => currentRoom(s)?.name ?? '');
  const mates = useLive(roomMatesKey);
  const openComments = useStore((s) => s.doc.comments)?.filter((c) => !c.done).length ?? 0;
  const off = status === 'none';
  const people = mates ? mates.split('\n').map((row) => row.split('\t')) : [];
  const tip = off
    ? t('Commenti e lavoro dal vivo: collega prima il server del gruppo')
    : status === 'offline'
      ? t('Il server del gruppo non risponde')
      : inRoom
        ? t('Sei nella stanza «{name}»', { name: roomName })
        : t('Commenti e lavoro dal vivo con il gruppo');
  return (
    <div className="together">
      <button
        className={`tool together-tool${off ? ' off' : ''}${inRoom ? ' on' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('Insieme')}
        data-tip={open ? undefined : tip}
      >
        <svg className="icon" width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true">
          <path d="M2.5 3.5h11v7.5H7.5L4.5 13.5V11h-2z" />
          <circle cx="6" cy="7.25" r=".7" fill="currentColor" stroke="none" />
          <circle cx="10" cy="7.25" r=".7" fill="currentColor" stroke="none" />
        </svg>
        <span>{t('Insieme')}</span>
        {!off && !inRoom && <i className={`together-dot ${status}`} aria-hidden="true" />}
        {inRoom && people.length > 0 && (
          <span className="together-avatars" aria-hidden="true">
            {people.slice(0, 3).map(([id, name]) => (
              <i key={id} style={{ background: colorOf(id) }}>{initial(name)}</i>
            ))}
          </span>
        )}
        {openComments > 0 && <b className="comment-count">{openComments}</b>}
      </button>
      {open && <TogetherPanel onClose={close} />}
    </div>
  );
}

// selettore con valore stabile (una stringa) per i compagni nella stanza
const roomMatesKey = (s: Parameters<typeof roomMates>[0]) => roomMates(s).map((m) => `${m.id}\t${m.name}`).join('\n');

/** Cursori delle altre persone, nelle coordinate del foglio. */
export function LiveCursors() {
  useLanguage();
  const cursors = useLive((s) => s.cursors);
  const members = useLive((s) => s.members);
  const view = useStore((s) => s.view);
  return (
    <>
      {Object.entries(cursors).map(([id, p]) => {
        const who = members.find((m) => m.id === id);
        return who ? (
          <span key={id} className="live-cursor" style={{ left: view.x + p.x * view.zoom, top: view.y + p.y * view.zoom, background: colorOf(id) }}>
            {who.name}
          </span>
        ) : null;
      })}
    </>
  );
}
