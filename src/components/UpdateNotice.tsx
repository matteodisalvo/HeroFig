import { t, useLanguage } from '../i18n';
// L'avviso di una versione nuova di HeroFig (electron/update.cjs): compare in basso a destra quando su GitHub c'è una
// release più nuova. «Aggiorna» scarica il file per questo computer: su Windows HeroFig si chiude, si aggiorna e si
// riapre; sul Mac si apre il disco da cui trascinare la nuova versione in Applicazioni. «Più tardi» lo nasconde fino al
// prossimo avvio.
import { useEffect, useState } from 'react';
import { hasUpdates, onUpdate, openExternal, updateInstall, updateQuit, updateStatus, updateStop, type UpdateInfo } from '../platform';
import { Icon } from './Icon';
import './update.css';

type Phase = { kind: 'idle' } | { kind: 'downloading'; done: number; total: number } | { kind: 'open' } | { kind: 'error'; text: string };

export function UpdateNotice() {
  useLanguage();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [later, setLater] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  useEffect(() => {
    if (!hasUpdates) return;
    // il controllo può essere già finito prima che la pagina si mettesse in ascolto
    void updateStatus()
      .then((u) => u && setInfo(u))
      .catch(() => {});
    return onUpdate((s) => {
      if (s.kind === 'available') {
        const { kind: _kind, ...u } = s;
        setInfo(u);
        setPhase({ kind: 'idle' });
      } else setPhase({ kind: 'downloading', done: s.done, total: s.total });
    });
  }, []);

  if (!info || later === info.version) return null;
  const mac = info.platform === 'darwin';

  const install = async () => {
    // nessun file adatto (o senza impronta): la pagina della release
    if (!info.canInstall) return openExternal(info.page);
    setPhase({ kind: 'downloading', done: 0, total: 0 });
    let res: { ok?: boolean; error?: string };
    try {
      res = await updateInstall();
    } catch (err) {
      res = { error: err instanceof Error ? err.message : String(err) };
    }
    if (res.ok) setPhase({ kind: 'open' });
    else if (res.error === 'stopped') setPhase({ kind: 'idle' });
    else setPhase({ kind: 'error', text: t(res.error ?? '') });
  };

  const percent = phase.kind === 'downloading' && phase.total > 0 ? Math.min(100, Math.round((phase.done / phase.total) * 100)) : 0;
  return (
    <div className="update-card" role="status">
      <span className="update-icon" aria-hidden="true">
        <Icon name="download" size={16} />
      </span>
      <div className="update-body">
        <strong>{t('HeroFig {version} è disponibile', { version: info.version })}</strong>
        {phase.kind === 'idle' && (
          <button type="button" className="link-btn" onClick={() => openExternal(info.page)}>
            {t('Cosa c’è di nuovo')}
          </button>
        )}
        {phase.kind === 'downloading' && (
          <>
            <span className="update-bar" aria-hidden="true">
              <i style={{ width: `${percent}%` }} />
            </span>
            <small>{t('Scarico… {percent}%', { percent })}</small>
          </>
        )}
        {phase.kind === 'open' && (
          <small>{mac ? t('Si è aperto il disco: chiudi HeroFig e trascina la nuova versione in Applicazioni.') : t('HeroFig si chiude, si aggiorna e si riapre da sola.')}</small>
        )}
        {phase.kind === 'error' && <small className="update-error">{t('Aggiornamento non riuscito: {detail}', { detail: phase.text })}</small>}
      </div>
      <div className="update-actions">
        {phase.kind === 'idle' && (
          <>
            <button type="button" className="btn" onClick={() => setLater(info.version)}>
              {t('Più tardi')}
            </button>
            <button type="button" className="btn primary-fill" onClick={() => void install()}>
              {t('Aggiorna')}
            </button>
          </>
        )}
        {phase.kind === 'downloading' && (
          <button type="button" className="btn" onClick={() => updateStop()}>
            {t('Ferma')}
          </button>
        )}
        {phase.kind === 'open' && mac && (
          <button type="button" className="btn primary-fill" onClick={() => updateQuit()}>
            {t('Chiudi HeroFig')}
          </button>
        )}
        {phase.kind === 'error' && (
          <>
            <button type="button" className="btn" onClick={() => setLater(info.version)}>
              {t('Più tardi')}
            </button>
            <button type="button" className="btn" onClick={() => openExternal(info.page)}>
              {t('Apri la pagina')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
