import { createI18n } from 'vue-i18n';

import enUS from '../../../web/translation/en-US.json';

const FALLBACK = 'en-US';
const lazyModules = import.meta.glob([
  '../../../web/translation/*.json',
  '!../../../web/translation/en-US.json',
]);

function moduleKeyFor(code) {
  return `../../../web/translation/${code}.json`;
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: FALLBACK,
  fallbackLocale: FALLBACK,
  messages: { [FALLBACK]: enUS },
  warnHtmlMessage: false,
  missingWarn: false,
  fallbackWarn: false,
});

/** Ensure the initial locale is resolved (call once before relying on i18n). */
export function resolveInitialLocale() {
  // NOTE: dynamic import to avoid TDZ ReferenceError in Rollup shared chunks.
  // @/utils exports LanguageManager which @/i18n needs, but Rollup may
  // order @/i18n before @/utils in the same chunk, causing a live-binding
  // access failure.  Dynamic import resolves after all modules are evaluated.
  return import('@/utils').then(async ({ LanguageManager }) => {
    await loadLocale(LanguageManager.getLanguage());
  }).catch(() => { /* fallback locale already set */ });
}

export function t(key, params) {
  return i18n.global.t(key, params || {});
}

export async function loadLocale(code) {
  if (code === FALLBACK) {
    i18n.global.locale.value = FALLBACK;
    return true;
  }
  const loader = lazyModules[moduleKeyFor(code)];
  if (!loader) return false;
  const mod = await loader();
  i18n.global.setLocaleMessage(code, mod.default || mod);
  i18n.global.locale.value = code;
  return true;
}

export async function readyI18n() {
  await resolveInitialLocale();
  // NOTE: 'active' was deliberately removed — static import of LanguageManager
  // from @/utils caused a TDZ error in Rollup shared chunks.  The locale is
  // now resolved lazily via dynamic import in resolveInitialLocale().
  return i18n;
}
