import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import ar from "./locales/ar.json";

/**
 * Feature areas can drop extra dictionaries at
 * `src/i18n/locales/<lang>/<area>.json` — they are merged automatically,
 * so multiple areas never edit the same file.
 */
const modules = import.meta.glob<Record<string, unknown>>("./locales/*/*.json", {
  eager: true,
  import: "default",
});

const merged: Record<string, Record<string, unknown>> = {
  en: { ...en },
  fr: { ...fr },
  ar: { ...ar },
};

for (const [path, dict] of Object.entries(modules)) {
  const lang = path.split("/")[2];
  if (merged[lang]) Object.assign(merged[lang], dict);
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: merged.en },
        fr: { translation: merged.fr },
        ar: { translation: merged.ar },
      },
      fallbackLng: "fr",
      supportedLngs: ["en", "fr", "ar"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "iyadati-locale",
      },
    });
}

export default i18n;
