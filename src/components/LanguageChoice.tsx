import { useMemo } from 'react';
import { LANGUAGES, systemLanguage, t, useLanguage, type LanguagePreference } from '../i18n';
import { Icon } from './Icon';

export function LanguageChoice({ value, onChange }: {
  value: LanguagePreference;
  onChange: (language: LanguagePreference) => void;
}) {
  const language = useLanguage();
  const names = useMemo(() => {
    try { return new Intl.DisplayNames([language], { type: 'language' }); }
    catch { return undefined; }
  }, [language]);
  const current = LANGUAGES.find((item) => item.id === systemLanguage())!;
  const textDirection = language === 'ar' ? 'rtl' : 'ltr';
  const indicator = <span className="onboarding-language-indicator" aria-hidden="true"><Icon name="check" size={12} /></span>;

  return (
    <fieldset className="onboarding-language-options" dir="ltr">
      <legend className="onboarding-language-legend">{t('Lingua dell’app')}</legend>
      <label className="onboarding-language onboarding-language-system" data-selected={value === 'system'}>
        <input type="radio" name="language" value="system" checked={value === 'system'} onChange={() => onChange('system')} />
        <span className="onboarding-language-device" aria-hidden="true"><Icon name="monitor" size={20} /></span>
        <span className="onboarding-language-copy" dir={textDirection}>
          <strong>{t('Segui la lingua del dispositivo')}</strong>
          <small>{t('Lingua attuale: {language}', { language: names?.of(current.id === 'zh' ? 'zh-Hans' : current.id) ?? current.name })}</small>
        </span>
        {indicator}
      </label>
      <div className="onboarding-language-divider" aria-hidden="true"><span dir={textDirection}>{t('Oppure scegli una lingua')}</span></div>
      <div className="onboarding-languages">
        {LANGUAGES.map((item) => {
          const localized = names?.of(item.id === 'zh' ? 'zh-Hans' : item.id) ?? item.english;
          const showSecondary = localized.toLocaleLowerCase(language) !== item.name.toLocaleLowerCase(language);
          return (
            <label className="onboarding-language" key={item.id} data-selected={value === item.id}>
              <input type="radio" name="language" value={item.id} checked={value === item.id} onChange={() => onChange(item.id)} />
              <span className="onboarding-language-copy">
                <strong lang={item.id} dir="auto">{item.name}</strong>
                {showSecondary && <small dir="auto">{localized}</small>}
              </span>
              {indicator}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
