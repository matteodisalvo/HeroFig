import { LANGUAGES, type Language } from '../i18n';
import { setupMessages } from '../locales/setup';

/** Use the same language catalog as setup, preserving complete shaped words. */
export const WELCOME_GREETINGS: { language: Language; text: string }[] = LANGUAGES.map(({ id }) => ({
  language: id,
  text: id === 'it' ? 'BENVENUTO' : setupMessages[id]['BENVENUTO'],
}));

export const WELCOME_SLOT_MS = 4_200;
const TRANSITION_MS = 1_200;

/** Each language appears once, beginning with the user's chosen language. */
export function welcomeSequence(first: Language) {
  const start = Math.max(0, WELCOME_GREETINGS.findIndex(({ language }) => language === first));
  return [...WELCOME_GREETINGS.slice(start), ...WELCOME_GREETINGS.slice(0, start)];
}

function smooth(value: number) {
  const bounded = Math.min(1, Math.max(0, value));
  return bounded * bounded * (3 - 2 * bounded);
}

/** A continuous clock: reveal for 1.2s, hold for 1.8s, dissolve for 1.2s. */
export function welcomeFrame(elapsed: number, count: number) {
  const length = Number.isFinite(count) ? Math.max(1, Math.floor(count)) : 1;
  const duration = WELCOME_SLOT_MS * length;
  const remainder = Number.isFinite(elapsed) ? elapsed % duration : 0;
  const loopTime = remainder < 0 ? remainder + duration : remainder;
  const index = Math.floor(loopTime / WELCOME_SLOT_MS);
  const slotTime = loopTime - index * WELCOME_SLOT_MS;
  const opacity = slotTime < TRANSITION_MS
    ? smooth(slotTime / TRANSITION_MS)
    : 1 - smooth((slotTime - (WELCOME_SLOT_MS - TRANSITION_MS)) / TRANSITION_MS);

  return {
    index,
    progress: slotTime / WELCOME_SLOT_MS,
    diffusion: 1 - opacity,
    opacity,
  };
}
