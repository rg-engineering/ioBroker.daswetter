import de from "../i18n/de.json";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
import fr from "../i18n/fr.json";
import it from "../i18n/it.json";
import pl from "../i18n/pl.json";
import pt from "../i18n/pt.json";
import ru from "../i18n/ru.json";
import uk from "../i18n/uk.json";
import cn from "../i18n/zh-cn.json";

const WEATHER_TRANSLATIONS = {
    de,
    en,
    es,
    fr,
    it,
    pl,
    pt,
    ru,
    uk,
    cn

} as const;

type Language = "de" | "en" | "es" | "fr" | "it" | "pl" | "pt" | "ru" | "uk" | "cn";

export class WeatherTranslator {
    private lang: Language = "de";

    SetLanguage(language: string): void {
        if (!language) {
            return;
        }

        const normalized = language.trim().toLowerCase().replace(/_/g, "-");
        const primary = normalized.split("-")[0];

        // Sonderfall: alle Varianten von Chinese ("zh", "zh-cn", ...) auf "cn" abbilden
        let code = primary;
        if (code === "zh" || code.startsWith("zh")) {
            code = "cn";
        }

        const allowed: Language[] = ["de", "en", "es", "fr", "it", "pl", "pt", "ru", "uk", "cn"];

        if (allowed.includes(code as Language)) {
            this.lang = code as Language;
        }
    }

    translateWeather(text: string): string {
        const translations = WEATHER_TRANSLATIONS[this.lang];

        return translations[text as keyof typeof translations] ?? text;
    }
}