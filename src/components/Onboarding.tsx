import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { getProfile, updateProfile } from '../profile';
import { allPresets } from '../model';
import { closeOnboarding, completeOnboarding, getOnboarding } from '../onboarding';
import { PACKS, setInstalledPacks, usePacks } from '../packs';
import { allTemplates } from '../templates';
import { getUi, setUi, toast, type Theme } from '../ui';
import { Icon, type IconName } from './Icon';
import { WelcomeCloud } from './WelcomeCloud';
import { LanguageChoice } from './LanguageChoice';
import { getLanguagePreference, setLanguage, t, useLanguage, type LanguagePreference } from '../i18n';
import './onboarding.css';

const STEPS = ['La tua lingua', 'Il tuo profilo', 'La tua libreria', 'Il tuo spazio'];
const APPEARANCES: { id: Theme; label: string; icon: IconName }[] = [
  { id: 'system', label: 'Come il sistema', icon: 'monitor' },
  { id: 'light', label: 'Chiaro', icon: 'sun' },
  { id: 'dark', label: 'Scuro', icon: 'moon' },
];

/** Si monta a ogni apertura: le scelte restano una bozza fino alla conferma finale. */
export function Onboarding() {
  const language = useLanguage();
  const [originalLanguage] = useState(getLanguagePreference);
  const [chosenLanguage, setChosenLanguage] = useState<LanguagePreference>(getLanguagePreference);
  const installed = usePacks((s) => s.installed);
  const [selected, setSelected] = useState(() => new Set(PACKS.filter((pack) => installed.has(pack.id)).map((pack) => pack.id)));
  const [name, setName] = useState(() => getProfile().name);
  const [affiliation, setAffiliation] = useState(() => getProfile().affiliation);
  const [role, setRole] = useState(() => getProfile().role);
  const [theme, setTheme] = useState(getUi().theme);
  const [step, setStep] = useState(0);
  const [profileSaveFailed, setProfileSaveFailed] = useState(false);
  const [firstRun] = useState(() => getOnboarding().status === 'pending');
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const counts = useMemo(() => {
    const blocks = allPresets(), templates = allTemplates();
    return new Map(PACKS.map((pack) => [pack.id, {
      blocks: blocks.filter((block) => pack.categories.includes(block.category)).length,
      templates: templates.filter((template) => pack.sections.includes(template.section)).length,
    }]));
  }, []);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    content.current?.scrollTo({ top: 0 });
    if (step === 1) nameInput.current?.focus();
    else heading.current?.focus();
  }, [step]);

  const cancel = () => {
    if (step < 4) setLanguage(originalLanguage, { persist: false });
    closeOnboarding();
    if (firstRun && step < 4) toast(t('Puoi configurare HeroFig in seguito da File → Configura HeroFig'));
  };
  const finish = () => {
    const profileSaved = updateProfile({ name, affiliation, role });
    setInstalledPacks(selected);
    setUi({ theme });
    setLanguage(chosenLanguage);
    completeOnboarding();
    setStep(4);
    setProfileSaveFailed(!profileSaved);
    if (!profileSaved) toast(t('Il profilo è disponibile solo per questa sessione: non è stato possibile salvarlo sul dispositivo.'), 'info');
  };
  const titles = ['Scegli la lingua', 'Il tuo profilo', 'Scegli i tuoi ambiti', 'Fallo tuo', 'Il tuo spazio è pronto'];
  const descriptions = [
    'Scegli la lingua dell’app. L’interfaccia si aggiorna subito.',
    'Un profilo locale per ritrovare il tuo nome e le tue preferenze.',
    'Aggiungi alla libreria i pacchetti che usi nel tuo lavoro.',
    'Scegli l’aspetto dell’interfaccia. Potrai cambiarlo quando vuoi.',
    'La tua libreria è pronta per essere esplorata.',
  ];

  return (
    <dialog
      ref={dialog}
      className="onboarding"
      lang={language}
      dir={step !== 0 && language === 'ar' ? 'rtl' : 'ltr'}
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
      onCancel={(event) => { event.preventDefault(); cancel(); }}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      <aside className="onboarding-sidebar" aria-label={t('Configurazione iniziale')}>
        <div className="onboarding-brand"><img src="./favicon.svg" width="32" height="32" alt="" /> HeroFig</div>
        <p className="onboarding-tagline" dir="auto">{t('Dall’idea alla figura.')}<br />{t('Il tuo prossimo paper inizia qui.')}</p>
        <ol className="onboarding-steps">
          {STEPS.map((label, index) => (
            <li key={label} data-active={step === index} data-done={step > index} aria-current={step === index ? 'step' : undefined}>
              <span className="onboarding-step-number">{step > index ? <Icon name="check" size={14} /> : index + 1}</span>
              <span dir="auto">{t(label)}</span>
            </li>
          ))}
        </ol>
        <div className="onboarding-sidebar-note" dir="auto">{t('Tutto modificabile, anche dopo.')}<br />{t('File → Il tuo spazio')}</div>
      </aside>
      <form className="onboarding-main" onSubmit={(event) => {
        event.preventDefault();
        if (step < 3) setStep(step + 1);
        else if (step === 3) finish();
        else closeOnboarding();
      }}>
        <header className="onboarding-heading" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          <p className="onboarding-eyebrow">{step === 4 ? t('CONFIGURAZIONE COMPLETATA') : t('CONFIGURAZIONE · {step} DI 4', { step: step + 1 })}</p>
          <h1 id="onboarding-title" ref={heading} tabIndex={-1}>{t(titles[step])}</h1>
          <p className="onboarding-description" id="onboarding-description">{t(descriptions[step])}</p>
        </header>
        <div className="onboarding-content" ref={content}>
          <div className="onboarding-stage" key={step}>
          {step === 0 && <>
            <LanguageChoice value={chosenLanguage} onChange={(value) => { setChosenLanguage(value); setLanguage(value, { persist: false }); }} />
            <p className="onboarding-hint onboarding-language-hint" dir="auto">{t('Puoi cambiare lingua in qualsiasi momento da File → Il tuo spazio.')}</p>
          </>}
          {step === 1 && <>
            <label className="onboarding-name">
              <span>{t('Come ti chiami?')} <small>{t('Facoltativo')}</small></span>
              <input ref={nameInput} type="text" autoComplete="name" maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Il tuo nome o un soprannome')} aria-describedby="onboarding-name-hint" />
            </label>
            <p className="onboarding-hint" id="onboarding-name-hint">{t('Useremo questo nome nei commenti e quando collabori con altre persone.')}</p>
            <div className="onboarding-profile-details">
              <label className="onboarding-name">
                <span>{t('Istituzione o laboratorio')} <small>{t('Facoltativo')}</small></span>
                <input type="text" autoComplete="organization" maxLength={120} value={affiliation} onChange={(event) => setAffiliation(event.target.value)} aria-describedby="onboarding-profile-hint" />
              </label>
              <label className="onboarding-name">
                <span>{t('Ruolo')} <small>{t('Facoltativo')}</small></span>
                <input type="text" autoComplete="organization-title" maxLength={80} value={role} onChange={(event) => setRole(event.target.value)} aria-describedby="onboarding-profile-hint" />
              </label>
            </div>
            <p className="onboarding-hint" id="onboarding-profile-hint">{t('Istituzione e ruolo restano nel profilo locale e non vengono inclusi nelle figure.')}</p>
            <div className="onboarding-note"><Icon name="info" /><span>{t('Non serve un account. Le preferenze vengono salvate su questo dispositivo.')}</span></div>
          </>}
          {step === 2 && <>
            <div className="onboarding-base">
              <Icon name="blocks" size={22} />
              <div><strong>{t('Libreria di base')}</strong><p>{t('Forme, connessioni, reti e deep learning.')}</p></div>
              <span className="onboarding-badge">{t('Sempre inclusa')}</span>
            </div>
            <p className="onboarding-hint">{t('I pacchetti sono già inclusi nell’app: scegli quali mostrare, senza download. Puoi aggiungerli o rimuoverli anche dopo da Pacchetti.')}</p>
            <div className="onboarding-pack-tools">
              <span role="status">{t('{count} di {total} selezionati', { count: selected.size, total: PACKS.length })}</span>
              <div>
                <button type="button" onClick={() => setSelected(new Set(PACKS.map((pack) => pack.id)))}>{t('Tutti')}</button>
                <button type="button" onClick={() => setSelected(new Set())}>{t('Solo la base')}</button>
              </div>
            </div>
            <div className="onboarding-packs">
              {PACKS.map((pack) => {
                const count = counts.get(pack.id)!;
                return (
                  <label key={pack.id} className="onboarding-pack" data-selected={selected.has(pack.id)}>
                    <input type="checkbox" checked={selected.has(pack.id)} onChange={(event) => {
                      const next = new Set(selected);
                      if (event.target.checked) next.add(pack.id);
                      else next.delete(pack.id);
                      setSelected(next);
                    }} />
                    <div><strong>{t(pack.name)}</strong><p>{t(pack.blurb)}</p><small>{t('{blocks} blocchi · {templates} modelli', count)}</small></div>
                  </label>
                );
              })}
            </div>
          </>}
          {step === 3 && <>
            <fieldset className="onboarding-themes">
              <legend>{t('Aspetto dell’interfaccia')}</legend>
              <div className="onboarding-theme-options">
                {APPEARANCES.map((appearance) => (
                  <label key={appearance.id} className="onboarding-theme" data-selected={theme === appearance.id}>
                    <input type="radio" name="appearance" value={appearance.id} checked={theme === appearance.id} onChange={() => setTheme(appearance.id)} />
                    <span className="onboarding-theme-preview" data-appearance={appearance.id} aria-hidden="true"><i /><i /><i /></span>
                    <span><Icon name={appearance.icon} size={14} />{t(appearance.label)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="onboarding-summary">
              <strong>{name.trim() ? t('Ci siamo, {name}.', { name: name.trim() }) : t('Il tuo spazio è pronto.')}</strong>
              <p>{t('Libreria di base · pacchetti aggiuntivi: {count}. Nessun download necessario.', { count: selected.size })}</p>
            </div>
            <ol className="onboarding-tips">
              <li>{t('Trascina un blocco dalla libreria o parti da un modello.')}</li>
              <li>{t('Fai doppio clic su un blocco per scriverne l’etichetta.')}</li>
              <li>{t('Esporta la figura in PDF, SVG, PNG o TikZ.')}</li>
            </ol>
          </>}
          {step === 4 && <div className="onboarding-completion">
            <div className="onboarding-welcome-art">
              <WelcomeCloud language={language} />
            </div>
            <h2>{name.trim() ? t('Buon lavoro, {name}.', { name: name.trim() }) : t('Pronto per la prossima idea.')}</h2>
            <p>{t('Questi sono gli strumenti che troverai nella tua libreria.')}</p>
            <p className="onboarding-hint">{t('Ritrova profilo e preferenze da File → Il tuo spazio.')}</p>
            {profileSaveFailed && <div className="onboarding-note" role="status"><Icon name="info" /><span>{t('Il profilo è disponibile solo per questa sessione: non è stato possibile salvarlo sul dispositivo.')}</span></div>}
            <div className="onboarding-activated" aria-label={t('Pacchetti attivati')} lang={language}>
              {['Libreria di base', ...PACKS.filter((pack) => selected.has(pack.id)).map((pack) => pack.name)].map((label, index) => (
                <span key={label} style={{ '--chip-index': index } as CSSProperties}><Icon name="check" size={13} />{t(label)}</span>
              ))}
            </div>
          </div>}
          </div>
        </div>
        <footer className="onboarding-footer">
          {step < 4 ? <button type="button" className="onboarding-skip" onClick={cancel}>{t(firstRun ? 'Salta per ora' : 'Annulla')}</button> : <span />}
          <div className="onboarding-navigation">
            {step > 0 && step < 4 && <button type="button" className="btn" onClick={() => setStep(step - 1)}>{t('Indietro')}</button>}
            <button type="submit" className="btn primary-fill">{t(step === 4 ? 'Apri HeroFig' : step === 3 ? (firstRun ? 'Prepara HeroFig' : 'Salva preferenze') : 'Continua')}<Icon name={step === 3 ? 'check' : 'chevron'} size={14} /></button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
