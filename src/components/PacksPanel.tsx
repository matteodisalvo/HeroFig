import { t, useLanguage } from '../i18n';
// Finestra «Pacchetti»: installare o togliere gli ambiti della libreria e chiederne di nuovi.
import { useEffect, useMemo, useRef } from 'react';
import { openFeedback, type FeedbackKind } from '../feedback';
import { allPresets } from '../model';
import { IDEAS, PACKS, closePacks, setInstalled, usePacks } from '../packs';
import { allTemplates } from '../templates';
import { toast } from '../ui';
import { keepTabInside } from './FeedbackPanel';
import { Icon } from './Icon';
import './packs.css';

export function PacksPanel() {
  useLanguage();
  const open = usePacks((s) => s.open);
  const installed = usePacks((s) => s.installed);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus();
    return () => { if (opener?.isConnected) opener.focus(); };
  }, [open]);

  const request = (kind: FeedbackKind, title = '') => {
    closePacks();
    openFeedback(kind, title);
  };

  const counts = useMemo(() => {
    const presets = allPresets(), templates = allTemplates();
    return new Map(
      PACKS.map((p) => [
        p.id,
        { blocks: presets.filter((x) => p.categories.includes(x.category)).length, templates: templates.filter((t) => p.sections.includes(t.section)).length },
      ]),
    );
  }, []);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onPointerDown={closePacks}>
      <div
        className="modal packs"
        role="dialog"
        aria-modal="true"
        aria-label={t("Pacchetti")}
        tabIndex={-1}
        ref={ref}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') closePacks();
          keepTabInside(e, ref.current);
        }}
      >
        <header>
          <h2>{t("Pacchetti")}</h2>
          <button className="tool icon-only" onClick={closePacks} aria-label={t("Chiudi")} data-tip={t("Chiudi")} data-keys="Esc">
            <Icon name="close" />
          </button>
        </header>
        <p className="hint">{t("La libreria di base ha forme, reti, layer e deep learning. Gli altri ambiti li aggiungi tu: tieni solo quelli che usi.")}</p>
        <section className="packs-feedback">
          <strong>{t('Non trovi quello che ti serve?')}</strong>
          <p className="hint">{t('Richiedi un pacchetto o un’aggiunta direttamente dall’app.')}</p>
          <div className="packs-actions">
            <button className="btn primary-fill" onClick={() => request('package')}>{t('Chiedi un pacchetto')}</button>
            <button className="btn" onClick={() => request('addition')}>{t('Proponi un’aggiunta')}</button>
          </div>
        </section>
        <div className="packs-list">
          {PACKS.map((p) => {
            const on = installed.has(p.id);
            const c = counts.get(p.id)!;
            return (
              <div key={p.id} className={on ? 'pack on' : 'pack'}>
                <div className="pack-text">
                  <strong>{t(p.name)}</strong>
                  <span>{t(p.blurb)}</span>
                  <small>
                    {t('{blocks} blocchi · {templates} modelli', { blocks: c.blocks, templates: c.templates })}
                  </small>
                </div>
                <button
                  className={on ? 'btn' : 'btn primary-fill'}
                  onClick={() => {
                    setInstalled(p.id, !on);
                    toast(on ? t('Pacchetto «{name}» tolto dalla libreria', { name: t(p.name) }) : t('Pacchetto «{name}» installato: lo trovi nella libreria', { name: t(p.name) }));
                  }}
                >
                  {on ? t('Rimuovi') : t('Installa')}
                </button>
              </div>
            );
          })}
        </div>

        <h3>{t("Non c'è il tuo ambito? Chiedilo")}</h3>
        <div className="packs-ideas">
          {IDEAS.map((idea) => ( <button key={idea} onClick={() => request('package', t(idea))} data-tip={t("Non esiste ancora: clicca per chiederlo")}>
              {t(idea)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
