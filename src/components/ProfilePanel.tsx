import { useEffect, useRef, useState, type FormEvent } from 'react';
import { getLanguagePreference, LANGUAGES, setLanguage, t, useLanguage, type LanguagePreference } from '../i18n';
import { openOnboarding } from '../onboarding';
import { PACKS, usePacks } from '../packs';
import { getProfile, PROFILE_COLORS, profileInitials, updateProfile, type ProfileColor } from '../profile';
import { getUi, setUi, toast, useUi, type GridStyle, type Theme } from '../ui';
import { Icon } from './Icon';
import './profile.css';

const COLOR_LABELS: Record<ProfileColor, string> = {
  violet: 'Viola', blue: 'Blu', teal: 'Verde acqua', rose: 'Rosa', amber: 'Ambra',
};

/** Mounted only while open: edits remain a draft until the user saves. */
export function ProfilePanel() {
  const language = useLanguage();
  const [profile, setProfile] = useState(getProfile);
  const [preferences, setPreferences] = useState(() => {
    const { theme, gridStyle, pngScale } = getUi();
    return { theme, gridStyle, pngScale };
  });
  const [chosenLanguage, setChosenLanguage] = useState<LanguagePreference>(getLanguagePreference);
  const favorites = useUi((state) => state.favorites.length);
  const installed = usePacks((state) => PACKS.filter((pack) => state.installed.has(pack.id)).length);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const close = () => setUi({ profile: false });

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    nameRef.current?.focus();
    return () => {
      dialog?.close();
      const target = opener?.isConnected ? opener : document.querySelector<HTMLElement>('[data-profile-launcher]');
      target?.focus();
    };
  }, []);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const persisted = updateProfile(profile);
    setUi(preferences);
    setLanguage(chosenLanguage);
    close();
    toast(persisted
      ? t('Profilo aggiornato')
      : t('Profilo aggiornato solo per questa sessione: il salvataggio su questo dispositivo non è disponibile.'),
    persisted ? 'ok' : 'info');
  };

  return (
    <dialog
      ref={dialogRef}
      className="profile-dialog"
      aria-labelledby="profile-title"
      aria-describedby="profile-local-description"
      dir={language === 'ar' ? 'rtl' : 'ltr'}
      onCancel={(event) => { event.preventDefault(); close(); }}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <form onSubmit={save}>
        <header className="profile-header">
          <div>
            <h2 id="profile-title">{t('Il tuo spazio')}</h2>
            <p id="profile-local-description">{t('Salvato su questo dispositivo, senza account o password.')}</p>
          </div>
          <button type="button" className="tool icon-only" onClick={close} aria-label={t('Chiudi')}>
            <Icon name="close" />
          </button>
        </header>

        <div className="profile-content">
          <section className="profile-identity" aria-labelledby="profile-identity-title">
            <div className="profile-person">
              <span className="profile-avatar" data-profile-color={profile.color} aria-hidden="true">{profileInitials(profile.name)}</span>
              <div>
                <h3 id="profile-identity-title">{t('Profilo utente')}</h3>
                <p>{t('Personalizza il tuo spazio di lavoro.')}</p>
              </div>
            </div>

            <fieldset className="profile-colors">
              <legend>{t('Colore del profilo')}</legend>
              <div>
                {PROFILE_COLORS.map((color) => (
                  <label key={color} className="profile-color" data-profile-color={color} title={t(COLOR_LABELS[color])}>
                    <input type="radio" name="profile-color" value={color} checked={profile.color === color}
                      aria-label={t(COLOR_LABELS[color])} onChange={() => setProfile({ ...profile, color })} />
                    <span aria-hidden="true">{profile.color === color && <Icon name="check" size={15} />}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="profile-fields">
              <label htmlFor="profile-name">{t('Il tuo nome')} <small>{t('Facoltativo')}</small></label>
              <input ref={nameRef} id="profile-name" type="text" autoComplete="name" maxLength={80}
                value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                aria-describedby="profile-name-description" />
              <p className="profile-hint" id="profile-name-description">{t('Il nome viene mostrato nei commenti e nella collaborazione.')}</p>

              <label htmlFor="profile-affiliation">{t('Istituzione o laboratorio')} <small>{t('Facoltativo')}</small></label>
              <input id="profile-affiliation" type="text" autoComplete="organization" maxLength={120}
                value={profile.affiliation} onChange={(event) => setProfile({ ...profile, affiliation: event.target.value })} />

              <label htmlFor="profile-role">{t('Ruolo')} <small>{t('Facoltativo')}</small></label>
              <input id="profile-role" type="text" autoComplete="organization-title" maxLength={80}
                value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })}
                aria-describedby="profile-details-description" />
              <p className="profile-hint" id="profile-details-description">{t('Istituzione e ruolo restano nel profilo locale e non vengono inclusi nelle figure.')}</p>
            </div>
          </section>

          <section className="profile-preferences" aria-labelledby="profile-preferences-title">
            <h3 id="profile-preferences-title">{t('Preferenze personali')}</h3>
            <p className="profile-hint">{t('Le tue scelte vengono ricordate alla prossima apertura.')}</p>
            <div className="profile-fields">
              <label htmlFor="profile-language">{t('Lingua dell’app')}</label>
              <select id="profile-language" value={chosenLanguage} onChange={(event) => setChosenLanguage(event.target.value as LanguagePreference)}>
                <option value="system">{t('Segui la lingua del dispositivo')}</option>
                {LANGUAGES.map((item) => <option key={item.id} value={item.id} lang={item.id}>{item.name}</option>)}
              </select>

              <label htmlFor="profile-theme">{t('Aspetto')}</label>
              <select id="profile-theme" value={preferences.theme} onChange={(event) => setPreferences({ ...preferences, theme: event.target.value as Theme })}>
                <option value="system">{t('Come il sistema')}</option>
                <option value="light">{t('Chiaro')}</option>
                <option value="dark">{t('Scuro')}</option>
              </select>

              <label htmlFor="profile-grid">{t('Griglia del foglio')}</label>
              <select id="profile-grid" value={preferences.gridStyle} onChange={(event) => setPreferences({ ...preferences, gridStyle: event.target.value as GridStyle })}>
                <option value="lines">{t('Linee')}</option>
                <option value="cross">{t('Croci')}</option>
                <option value="dots">{t('Puntini')}</option>
              </select>

              <label htmlFor="profile-png">{t('Risoluzione PNG')}</label>
              <select id="profile-png" value={preferences.pngScale} onChange={(event) => setPreferences({ ...preferences, pngScale: Number(event.target.value) })}>
                {[1, 2, 3, 4].map((scale) => <option key={scale} value={scale}>{scale}×</option>)}
              </select>
            </div>

            <dl className="profile-library-summary">
              <div><dt>{t('Pacchetti installati')}</dt><dd>{installed}</dd></div>
              <div><dt>{t('Preferiti')}</dt><dd>{favorites}</dd></div>
            </dl>
          </section>
        </div>

        <footer className="profile-footer">
          <button type="button" className="profile-setup-link" onClick={() => { close(); openOnboarding(); }}>
            {t('Riapri la configurazione')}
          </button>
          <div className="profile-actions">
            <button type="button" className="btn" onClick={close}>{t('Annulla')}</button>
            <button type="submit" className="btn primary-fill">{t('Salva')}</button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
