"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeatherTranslator = void 0;
const de_json_1 = __importDefault(require("../i18n/de.json"));
const en_json_1 = __importDefault(require("../i18n/en.json"));
const es_json_1 = __importDefault(require("../i18n/es.json"));
const fr_json_1 = __importDefault(require("../i18n/fr.json"));
const it_json_1 = __importDefault(require("../i18n/it.json"));
const pl_json_1 = __importDefault(require("../i18n/pl.json"));
const pt_json_1 = __importDefault(require("../i18n/pt.json"));
const ru_json_1 = __importDefault(require("../i18n/ru.json"));
const uk_json_1 = __importDefault(require("../i18n/uk.json"));
const zh_cn_json_1 = __importDefault(require("../i18n/zh-cn.json"));
const WEATHER_TRANSLATIONS = {
    de: de_json_1.default,
    en: en_json_1.default,
    es: es_json_1.default,
    fr: fr_json_1.default,
    it: it_json_1.default,
    pl: pl_json_1.default,
    pt: pt_json_1.default,
    ru: ru_json_1.default,
    uk: uk_json_1.default,
    cn: zh_cn_json_1.default
};
class WeatherTranslator {
    lang = "de";
    SetLanguage(language) {
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
        const allowed = ["de", "en", "es", "fr", "it", "pl", "pt", "ru", "uk", "cn"];
        if (allowed.includes(code)) {
            this.lang = code;
        }
    }
    translateWeather(text) {
        const translations = WEATHER_TRANSLATIONS[this.lang];
        return translations[text] ?? text;
    }
}
exports.WeatherTranslator = WeatherTranslator;
//# sourceMappingURL=translation.js.map