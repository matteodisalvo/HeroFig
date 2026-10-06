const LANGUAGES = new Set(['it', 'en', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko', 'ar', 'hi']);
let labels = Object.create(null);

function setNativeLanguage(payload) {
  if (!payload || !LANGUAGES.has(payload.language) || !payload.labels || typeof payload.labels !== 'object' || Array.isArray(payload.labels)) return false;
  const entries = Object.entries(payload.labels);
  if (entries.length > 100 || entries.some(([key, value]) => key.length > 500 || typeof value !== 'string' || !value || value.length > 1000)) return false;
  labels = Object.assign(Object.create(null), payload.labels);
  return true;
}

function nativeText(source) {
  return labels[source] ?? (source === 'Annulla modifica' ? 'Annulla' : source);
}

function localizeMenu(items) {
  return items.map((item) => ({
    ...item,
    ...(item.label ? { label: nativeText(item.label) } : {}),
    ...(Array.isArray(item.submenu) ? { submenu: localizeMenu(item.submenu) } : {}),
  }));
}

module.exports = { setNativeLanguage, nativeText, localizeMenu };
