"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable prefer-template */
const axios_1 = __importDefault(require("axios"));
const base_1 = __importDefault(require("./base"));
const translation_1 = require("./translation");
class Meteored extends base_1.default {
    api_key = "";
    postcode = "";
    city = "";
    bundesland = "";
    location_hash = "";
    location_description = "";
    location_country = "";
    language = "";
    dateFormat = "";
    parseTimeout = 10;
    useDailyForecast = true;
    useHourlyForecast = true;
    expires_hour = 0;
    expires_day = 0;
    symbols = [];
    days_forecast = [];
    hours_forecast = [];
    IconSet = 0;
    IconType = 1;
    PNGSize = 2;
    CustomPath = "";
    WindIconSet = 0;
    WindIconType = 1;
    WindPNGSize = 2;
    WindCustomPath = "";
    MoonIconSet = 0;
    MoonIconType = 1;
    MoonPNGSize = 2;
    MoonCustomPath = "";
    CopyCurrentHour = false;
    DecimalPlaces4Temps = 2;
    url = "";
    constructor(adapter, id, config) {
        super(adapter, id, config.name);
        this.api_key = typeof config.API_key === "string" ? config.API_key : "";
        this.postcode = typeof config.postcode === "string" ? config.postcode : "";
        this.city = typeof config.city === "string" ? config.city : "";
        this.bundesland = typeof config.bundesland === "string" ? config.bundesland : "";
        this.language = typeof config.language === "string" ? config.language : "DE";
        this.dateFormat = typeof config.dateFormat === "string" ? config.dateFormat : "YYMMDD";
        this.parseTimeout = typeof config.parseTimeout === "number" ? config.parseTimeout : 10;
        this.useDailyForecast = typeof config.useDailyForecast === "boolean" ? config.useDailyForecast : true;
        this.useHourlyForecast = typeof config.useHourlyForecast === "boolean" ? config.useHourlyForecast : true;
        this.IconSet = config.IconSet;
        this.IconType = config.IconType;
        this.PNGSize = config.PNGSize;
        this.CustomPath = config.CustomPath;
        this.WindIconSet = config.WindIconSet;
        this.WindIconType = config.WindIconType;
        this.WindPNGSize = config.WindPNGSize;
        this.WindCustomPath = config.WindCustomPath;
        this.MoonIconSet = config.MoonIconSet;
        this.MoonIconType = config.MoonIconType;
        this.MoonPNGSize = config.MoonPNGSize;
        this.MoonCustomPath = config.MoonCustomPath;
        this.CopyCurrentHour = config.CopyCurrentHour;
        this.DecimalPlaces4Temps = config.DecimalPlaces4Temps;
    }
    async Start() {
        await this.CreateObjects();
        await this.GetLocation();
        await this.GetSymbols();
    }
    CheckError(status) {
        if (!status || typeof status !== "number") {
            this.logError(" no response or invalid status");
            return true;
        }
        let ret = true;
        switch (status) {
            case 200:
                ret = false;
                break;
            case 400:
                this.logError(" 400 Bad Request");
                break;
            case 401:
                this.logError(" 401 Unauthorized");
                break;
            case 404:
                this.logError(" 404 Not Found");
                break;
            case 429:
                this.logError(" 429 Too Many Requests - rate limited");
                break;
            case 500:
                this.logError(" 500 Internal Server Error");
                break;
            default:
                this.logError(" unexpected HTTP status " + status);
                break;
        }
        return ret;
    }
    async GetLocation() {
        this.logDebug("GetLocation called");
        await this.GetLocationPostcode();
        if (this.location_hash === undefined || this.location_hash == "") {
            await this.GetLocationFreetext();
        }
    }
    async GetLocationPostcode() {
        this.logDebug("GetLocationPostcode called");
        if (this.api_key === undefined || this.api_key == "") {
            this.logError("no api key available, please check settings");
            return;
        }
        // Prüfen auf unsichtbare oder ungültige Zeichen
        const invalidChars = this.api_key.split('').filter(c => {
            const code = c.charCodeAt(0);
            // erlaubte ASCII-Zeichen 32-126 (sichtbare Zeichen) plus Tab (9)
            return !(code >= 32 && code <= 126) && code !== 9;
        });
        if (invalidChars.length > 0) {
            this.logError(`API key contains ${invalidChars.length} invalid characters: [${invalidChars.map(c => '\\u' + c.charCodeAt(0).toString(16)).join(', ')}]`);
            return;
        }
        else {
            this.logDebug("API key is clean");
        }
        if (this.postcode === undefined || this.postcode == "") {
            this.logInfo("Postcode not set, skipping GetLocationPostcode");
            return;
        }
        const url = "https://api.meteored.com/api/location/v1/search/postalcode/" + this.postcode;
        this.logDebug("calling " + url);
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };
        try {
            let resp;
            try {
                resp = await axios_1.default.get(url, {
                    headers: headers,
                    timeout: this.parseTimeout * 1000
                });
            }
            catch (err) {
                if (axios_1.default.isAxiosError(err)) {
                    this.logError("axios error in GetLocationPostcode: message=" + err.message + ", code=" + (err.name || "") + ", status=" + (err.response?.status || "no-response") + ", data=" + (err.response ? JSON.stringify(err.response.data) : "undefined"));
                }
                else {
                    this.logError("exception in GetLocationPostcode (non-axios): " + String(err));
                }
                return;
            }
            if (this.CheckError(resp.status)) {
                return;
            }
            try {
                // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                this.logDebug("Meteored GetLocationPostcode response: " + JSON.stringify(resp.data));
                // Sicher extrahieren: resp.data.data.locations
                const locations = resp && resp.data && resp.data.data && Array.isArray(resp.data.data.locations)
                    ? resp.data.data.locations
                    : [];
                if (locations.length === 0) {
                    this.logInfo("Meteored GetLocationPostcode: no locations in response");
                }
                else {
                    this.logInfo("Meteored GetLocationPostcode: found " + locations.length + " locations:");
                    locations.forEach((loc) => {
                        const name = loc && loc.name ? String(loc.name) : "";
                        const desc = loc && loc.description ? String(loc.description) : "";
                        const country = loc && loc.country_name ? String(loc.country_name) : "";
                        this.logInfo("  Name: " + name + ", Description: " + desc + ", Country: " + country);
                    });
                    const cityNormalized = (this.city || "").toString().trim().toLowerCase();
                    const bundeslandNormalized = (this.bundesland || "").toString().trim().toLowerCase();
                    const match = locations.find((loc) => {
                        const name = loc && loc.name ? String(loc.name).trim().toLowerCase() : "";
                        const description = loc && loc.description ? String(loc.description).trim().toLowerCase() : "";
                        const nameMatches = name === cityNormalized;
                        const descriptionMatches = bundeslandNormalized === "" || description === bundeslandNormalized;
                        return nameMatches && descriptionMatches;
                    });
                    if (match) {
                        this.location_hash = match.hash ? String(match.hash) : "";
                        this.location_description = match.description ? String(match.description) : "";
                        this.location_country = match.country_name ? String(match.country_name) : "";
                        this.logInfo("Meteored GetLocationPostcode: matched city \"" + this.city +
                            "\" => hash=" + this.location_hash +
                            ", description=" + this.location_description +
                            ", country=" + this.location_country);
                    }
                    else {
                        this.logError("Meteored GetLocationPostcode: no matching location for city \"" + this.city + "\"" +
                            (bundeslandNormalized ? " and bundesland \"" + this.bundesland + "\"" : ""));
                        this.logInfo("found the following locations:");
                        // Für jede gefundene Location eine separate Zeile loggen (Name, description, country)
                        locations.forEach((loc) => {
                            const name = loc && loc.name ? String(loc.name) : "";
                            const desc = loc && loc.description ? String(loc.description) : "";
                            const country = loc && loc.country_name ? String(loc.country_name) : "";
                            this.logInfo("Name: " + name + ", description: " + desc + ", country: " + country);
                        });
                    }
                }
                await this.SetData_Location();
            }
            catch (e) {
                this.logError("exception in GetLocationPostcode data parse " + String(e));
            }
        }
        catch (e) {
            this.logError("exception in GetLocationPostcode " + String(e));
        }
    }
    async GetLocationFreetext() {
        this.logDebug("GetLocationFreetext called");
        if (this.api_key === undefined || this.api_key == "") {
            this.logError("no api key available, please check settings");
            return;
        }
        const url = "https://api.meteored.com/api/location/v1/search/txt/" + this.city;
        this.logDebug("calling " + url);
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };
        try {
            let resp;
            try {
                resp = await axios_1.default.get(url, {
                    headers: headers,
                    timeout: this.parseTimeout * 1000
                });
            }
            catch (err) {
                if (axios_1.default.isAxiosError(err)) {
                    this.logError("axios error in GetLocationFreetext: message=" + err.message + ", code=" + (err.code || "") + ", status=" + (err.response?.status || "no-response") + ", data=" + (err.response ? JSON.stringify(err.response.data) : "undefined"));
                }
                else {
                    this.logError("exception in GetLocationFreetext (non-axios): " + String(err));
                }
                return;
            }
            if (this.CheckError(resp.status)) {
                return;
            }
            try {
                // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                this.logDebug("Meteored GetLocationFreetext response: " + JSON.stringify(resp.data));
                // Sicher extrahieren: resp.data.data.locations
                const locations = resp && resp.data && resp.data.data && Array.isArray(resp.data.data.locations)
                    ? resp.data.data.locations
                    : [];
                if (locations.length === 0) {
                    this.logError("Meteored GetLocationFreetext: no locations in response");
                }
                else {
                    this.logInfo("Meteored GetLocationFreetext: found " + locations.length + " locations:");
                    locations.forEach((loc) => {
                        const name = loc && loc.name ? String(loc.name) : "";
                        const desc = loc && loc.description ? String(loc.description) : "";
                        const country = loc && loc.country_name ? String(loc.country_name) : "";
                        this.logInfo("  Name: " + name + ", Description: " + desc + ", Country: " + country);
                    });
                    const cityNormalized = (this.city || "").toString().trim().toLowerCase();
                    const bundeslandNormalized = (this.bundesland || "").toString().trim().toLowerCase();
                    const match = locations.find((loc) => {
                        const name = loc && loc.name ? String(loc.name).trim().toLowerCase() : "";
                        const description = loc && loc.description ? String(loc.description).trim().toLowerCase() : "";
                        const nameMatches = name === cityNormalized;
                        const descriptionMatches = bundeslandNormalized === "" || description === bundeslandNormalized;
                        return nameMatches && descriptionMatches;
                    });
                    if (match) {
                        this.location_hash = match.hash ? String(match.hash) : "";
                        this.location_description = match.description ? String(match.description) : "";
                        this.location_country = match.country_name ? String(match.country_name) : "";
                        this.logInfo("Meteored GetLocationFreetext: matched city \"" + this.city +
                            "\" => hash=" + this.location_hash +
                            ", description=" + this.location_description +
                            ", country=" + this.location_country);
                    }
                    else {
                        this.logError("Meteored GetLocationFreetext: no matching location for city \"" + this.city + "\"" +
                            (bundeslandNormalized ? " and bundesland \"" + this.bundesland + "\"" : ""));
                        this.logInfo("found the following locations:");
                        // Für jede gefundene Location eine separate Zeile loggen (Name, description, country)
                        locations.forEach((loc) => {
                            const name = loc && loc.name ? String(loc.name) : "";
                            const desc = loc && loc.description ? String(loc.description) : "";
                            const country = loc && loc.country_name ? String(loc.country_name) : "";
                            this.logInfo("Name: " + name + ", description: " + desc + ", country: " + country);
                        });
                    }
                }
                await this.SetData_Location();
            }
            catch (e) {
                this.logError("exception in GetLocationFreetext data parse " + String(e));
            }
        }
        catch (e) {
            this.logError("exception in GetLocationFreetext " + String(e));
        }
    }
    async GetForecastDaily() {
        if (this.useDailyForecast) {
            this.logDebug("GetForecastDaily called");
            const now = Date.now();
            if (this.expires_day > now) {
                this.logDebug("GetForecastDaily: cached data still valid until " + new Date(this.expires_day).toISOString() + ", skipping fetch");
                return;
            }
            if (this.location_hash === undefined || this.location_hash == "") {
                this.logError("no location hash available, please check postcode and city settings");
                return;
            }
            if (this.api_key === undefined || this.api_key == "") {
                this.logError("no api key available, please check settings");
                return;
            }
            const url = "https://api.meteored.com/api/forecast/v2/daily/" + this.location_hash;
            this.logDebug("calling " + url);
            const headers = {
                accept: "application/json",
                "x-api-key": this.api_key
            };
            try {
                let resp;
                try {
                    resp = await axios_1.default.get(url, {
                        headers: headers,
                        timeout: this.parseTimeout * 1000
                    });
                }
                catch (err) {
                    if (axios_1.default.isAxiosError(err)) {
                        this.logError("axios error in GetForecastDaily: message=" + err.message + ", code=" + (err.code || "") + ", status=" + (err.response?.status || "no-response") + ", data=" + (err.response ? JSON.stringify(err.response.data) : "undefined"));
                    }
                    else {
                        this.logError("exception in GetForecastDaily (non-axios): " + String(err));
                    }
                    return;
                }
                if (this.CheckError(resp.status)) {
                    return;
                }
                try {
                    // Logge die rohe Antwortdaten zur weitere Verarbeitung/Debug
                    this.logDebug("Meteored GetForecastDaily response: " + JSON.stringify(resp.data));
                    this.expires_day = resp && resp.data && resp.data.expiracion ? Number(resp.data.expiracion) : 0;
                    // Sicher extrahieren der URL aus resp.data.data.url und kopiere nach this.url
                    const extractedUrl = resp && resp.data && resp.data.data && resp.data.data.url
                        ? String(resp.data.data.url)
                        : "";
                    if (extractedUrl) {
                        this.url = extractedUrl;
                        this.logDebug("Meteored GetForecastDaily: url=" + this.url);
                    }
                    // Sicher extrahieren: resp.data.data.days
                    const rawDays = resp && resp.data && resp.data.data && Array.isArray(resp.data.data.days)
                        ? resp.data.data.days
                        : [];
                    if (rawDays.length === 0) {
                        this.logError("Meteored GetForecastDaily: no days array in response, setting empty days_forecast");
                        this.days_forecast = [];
                    }
                    else {
                        // Mappe rohe Objekte auf das definierte day_data-Interface mit sicheren Typen/Defaults
                        try {
                            const mapped = rawDays.map((d) => {
                                return {
                                    start: typeof d.start === "number" ? d.start : Number(d.start) || 0,
                                    symbol: typeof d.symbol === "number" ? d.symbol : Number(d.symbol) || 0,
                                    temperature: typeof d.temperature === "object" && d.temperature ? {
                                        min: typeof d.temperature.min === "number" ? d.temperature.min : Number(d.temperature.min) || 0,
                                        max: typeof d.temperature.max === "number" ? d.temperature.max : Number(d.temperature.max) || 0
                                    } : {
                                        min: 0,
                                        max: 0
                                    },
                                    wind: typeof d.wind === "object" && d.wind ? {
                                        speed: typeof d.wind.speed === "number" ? d.wind.speed : Number(d.wind.speed) || 0,
                                        gust: typeof d.wind.gust === "number" ? d.wind.gust : Number(d.wind.gust) || 0,
                                        direction: d.wind.direction ? String(d.wind.direction) : ""
                                    } : {
                                        speed: 0,
                                        gust: 0,
                                        direction: ""
                                    },
                                    precipitation: typeof d.precipitation === "object" && d.precipitation ? {
                                        total: typeof d.precipitation.total === "number" ? d.precipitation.total : Number(d.precipitation.total) || 0,
                                        probability: typeof d.precipitation.probability === "number" ? d.precipitation.probability : Number(d.precipitation.probability) || 0
                                    } : {
                                        total: 0,
                                        probability: 0
                                    },
                                    humidity: typeof d.humidity === "number" ? d.humidity : Number(d.humidity) || 0,
                                    pressure: typeof d.pressure === "number" ? d.pressure : Number(d.pressure) || 0,
                                    snowline: typeof d.snowline === "number" ? d.snowline : Number(d.snowline) || 0,
                                    uv_index_max: typeof d.uv_index_max === "number" ? d.uv_index_max : Number(d.uv_index_max) || 0,
                                    sun: typeof d.sun === "object" && d.sun ? {
                                        in: typeof d.sun.in === "number" ? d.sun.in : Number(d.sun.in) || 0,
                                        mid: typeof d.sun.mid === "number" ? d.sun.mid : Number(d.sun.mid) || 0,
                                        out: typeof d.sun.out === "number" ? d.sun.out : Number(d.sun.out) || 0,
                                    } : {
                                        in: 0,
                                        mid: 0,
                                        out: 0
                                    },
                                    moon: typeof d.moon === "object" && d.moon ? {
                                        in: typeof d.moon.in === "number" ? d.moon.in : Number(d.moon.in) || 0,
                                        out: typeof d.moon.out === "number" ? d.moon.out : Number(d.moon.out) || 0,
                                        symbol: typeof d.moon.symbol === "number" ? d.moon.symbol : Number(d.moon.symbol) || 0,
                                        illumination: typeof d.moon.illumination === "number" ? d.moon.illumination : Number(d.moon.illumination) || 0
                                    } : {
                                        in: 0,
                                        out: 0,
                                        symbol: 0,
                                        illumination: 0
                                    }
                                };
                            });
                            this.days_forecast = mapped;
                            this.logDebug("Meteored GetForecastDaily: parsed days_forecast count=" + this.days_forecast.length);
                        }
                        catch (e) {
                            this.logError("Meteored GetForecastDaily: error mapping days array: " + String(e));
                            this.days_forecast = [];
                        }
                        await this.SetData_ForecastDaily();
                    }
                }
                catch (e) {
                    // Falls JSON.stringify fehlschlägt, logge eine kurze Meldung
                    this.logError("exception in GetForecastDaily data parse " + String(e));
                }
            }
            catch (e) {
                this.logError("exception in GetForecastDaily " + String(e));
            }
        }
        else {
            this.logDebug("GetForecastDaily called, but skipped");
        }
    }
    async GetForecastHourly() {
        if (this.useHourlyForecast) {
            this.logDebug("GetForecastHourly called");
            const now = Date.now();
            if (this.expires_hour > now) {
                this.logDebug("GetForecastHourly: cached data still valid until " + new Date(this.expires_day).toISOString() + ", skipping fetch");
                return;
            }
            if (this.location_hash === undefined || this.location_hash == "") {
                this.logError("no location hash available, please check postcode and city settings");
                return;
            }
            if (this.api_key === undefined || this.api_key == "") {
                this.logError("no api key available, please check settings");
                return;
            }
            const url = "https://api.meteored.com/api/forecast/v2/hourly/" + this.location_hash;
            this.logDebug("calling " + url);
            const headers = {
                accept: "application/json",
                "x-api-key": this.api_key
            };
            try {
                let resp;
                try {
                    resp = await axios_1.default.get(url, {
                        headers: headers,
                        timeout: this.parseTimeout * 1000
                    });
                }
                catch (err) {
                    if (axios_1.default.isAxiosError(err)) {
                        this.logError("axios error in GetForecastHourly: message=" + err.message + ", code=" + (err.code || "") + ", status=" + (err.response?.status || "no-response") + ", data=" + (err.response ? JSON.stringify(err.response.data) : "undefined"));
                    }
                    else {
                        this.logError("exception in GetForecastHourly (non-axios): " + String(err));
                    }
                    return;
                }
                if (this.CheckError(resp.status)) {
                    return;
                }
                try {
                    // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                    this.logDebug("Meteored GetForecastHourly response: " + JSON.stringify(resp.data));
                    this.expires_hour = resp && resp.data && resp.data.expiracion ? Number(resp.data.expiracion) : 0;
                    // Sicher extrahieren: resp.data.data.hours
                    const rawHours = resp && resp.data && resp.data.data && Array.isArray(resp.data.data.hours)
                        ? resp.data.data.hours
                        : [];
                    if (rawHours.length === 0) {
                        this.logError("Meteored GetForecastHourly: no hours array in response, setting empty hours_forecast");
                        this.hours_forecast = [];
                    }
                    else {
                        try {
                            const mapped = rawHours.map((h) => {
                                return {
                                    end: typeof h.end === "number" ? h.end : Number(h.end) || 0,
                                    symbol: typeof h.symbol === "object" && h.symbol ? {
                                        value: typeof h.symbol.value === "number" ? h.symbol.value : Number(h.symbol.value) || 0,
                                        night: typeof h.symbol.night === "boolean" ? h.symbol.night : (h.symbol.night === "true" || h.symbol.night === true) || false,
                                    } : {
                                        value: 0,
                                        night: false
                                    },
                                    temperature: typeof h.temperature === "object" && h.temperature ? {
                                        value: typeof h.temperature.value === "number" ? h.temperature.value : Number(h.temperature.value) || 0,
                                        feels_like: typeof h.temperature.feels_like === "number" ? h.temperature.feels_like : Number(h.temperature.feels_like) || 0,
                                    } : {
                                        value: 0,
                                        feels_like: 0
                                    },
                                    wind: typeof h.wind === "object" && h.wind ? {
                                        speed: typeof h.wind.speed === "number" ? h.wind.speed : Number(h.wind.speed) || 0,
                                        gust: typeof h.wind.gust === "number" ? h.wind.gust : Number(h.wind.gust) || 0,
                                        direction: h.wind.direction ? String(h.wind.direction) : "",
                                    } : {
                                        speed: 0,
                                        gust: 0,
                                        direction: "?"
                                    },
                                    precipitation: typeof h.precipitation === "object" && h.precipitation ? {
                                        total: typeof h.precipitation.total === "number" ? h.precipitation.total : Number(h.precipitation.total) || 0,
                                        probability: typeof h.precipitation.probability === "number" ? h.precipitation.probability : Number(h.precipitation.probability) || 0
                                    } : {
                                        total: 0,
                                        probability: 0
                                    },
                                    humidity: typeof h.humidity === "number" ? h.humidity : Number(h.humidity) || 0,
                                    pressure: typeof h.pressure === "number" ? h.pressure : Number(h.pressure) || 0,
                                    snow: typeof h.snow === "object" && h.snow ? {
                                        snowline: typeof h.snow.snowline === "number" ? h.snow.snowline : Number(h.snow.snowline) || 0,
                                    } : {
                                        snowline: 0
                                    },
                                    uv_index_max: typeof h.uv_index_max === "number" ? h.uv_index_max : Number(h.uv_index_max) || 0,
                                    clouds: typeof h.clouds === "number" ? h.clouds : Number(h.clouds) || 0
                                };
                            });
                            this.hours_forecast = mapped;
                            this.logDebug("Meteored GetForecastHourly: parsed hours_forecast count=" + this.hours_forecast.length);
                        }
                        catch (e) {
                            this.logError("Meteored GetForecastHourly: error mapping hours array: " + String(e));
                            this.hours_forecast = [];
                        }
                    }
                    await this.SetData_ForecastHourly();
                }
                catch (e) {
                    // Falls JSON.stringify fehlschlägt, logge eine kurze Meldung
                    this.logError("exception in GetForecastHourly data parse " + String(e));
                }
            }
            catch (e) {
                this.logError("exception in GetForecastHourly " + String(e));
            }
        }
        else {
            this.logDebug("GetForecastHourly called, but skipped");
        }
    }
    async GetSymbols() {
        this.logDebug("GetSymbols called");
        if (this.api_key === undefined || this.api_key == "") {
            this.logError("no api key available, please check settings");
            return;
        }
        const url = "https://api.meteored.com/api/doc/v1/forecast/symbol";
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };
        try {
            let resp;
            try {
                resp = await axios_1.default.get(url, {
                    headers: headers,
                    timeout: this.parseTimeout * 1000
                });
            }
            catch (err) {
                if (axios_1.default.isAxiosError(err)) {
                    this.logError("axios error in GetSymbols: message=" + err.message + ", code=" + (err.code || "") + ", status=" + (err.response?.status || "no-response") + ", data=" + (err.response ? JSON.stringify(err.response.data) : "undefined"));
                }
                else {
                    this.logError("exception in GetSymbols (non-axios): " + String(err));
                }
                return;
            }
            if (this.CheckError(resp.status)) {
                return;
            }
            try {
                // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                this.logDebug("Meteored GetSymbols response: " + JSON.stringify(resp.data));
                // Sicher extrahieren: resp.data.data.symbols
                const rawSymbols = resp && resp.data && resp.data.data && Array.isArray(resp.data.data.symbols)
                    ? resp.data.data.symbols
                    : [];
                if (rawSymbols.length === 0) {
                    this.logError("Meteored GetSymbols: no symbols array in response, setting empty symbols");
                    this.symbols = [];
                }
                else {
                    try {
                        const mapped = rawSymbols.map((s) => {
                            const id = (s && (typeof s.id === "number" ? s.id : Number(s.id))) || 0;
                            const dayObj = s && s.day ? s.day : null;
                            const dayShort = dayObj && dayObj.short ? String(dayObj.short) : "";
                            const dayLong = dayObj && dayObj.long ? String(dayObj.long) : "";
                            return {
                                id: id,
                                day: {
                                    short: dayShort,
                                    long: dayLong
                                }
                            };
                        });
                        this.symbols = mapped;
                        this.logDebug("Meteored GetSymbols: parsed symbols count=" + this.symbols.length);
                    }
                    catch (e) {
                        this.logError("Meteored GetSymbols: error mapping symbols array: " + String(e));
                        this.symbols = [];
                    }
                }
            }
            catch (e) {
                // Falls JSON.stringify fehlschlägt, logge eine kurze Meldung
                this.logError("exception in GetSymbols data parse " + String(e));
            }
        }
        catch (e) {
            this.logError("exception in GetSymbols " + String(e));
        }
    }
    async CalculateData() {
        try {
            // Berechne Sonnenscheindauer für heute und schreibe den Wert in den entsprechenden Datenpunkt.
            const sunDuration = this.CalculateSunshineDuration();
            const key = "location_" + this.id + ".ForecastDaily.Day_1.sunshineduration";
            await this.adapter.setState(key, sunDuration, true);
        }
        catch (e) {
            this.logError("CalculateData error: " + String(e));
        }
        //todo
        //Wind-symbol aus Richtung und Stärke berechnen
    }
    CalculateSunshineDuration() {
        try {
            if (!Array.isArray(this.days_forecast) || this.days_forecast.length === 0) {
                this.logDebug("CalculateSunshineDuration: no days_forecast available");
                return 0;
            }
            const today = this.days_forecast[0];
            if (!today) {
                this.logDebug("CalculateSunshineDuration: today forecast missing");
                return 0;
            }
            let sunIn = typeof today.sun.in === "number" ? today.sun.in : Number(today.sun.in) || 0;
            let sunOut = typeof today.sun.out === "number" ? today.sun.out : Number(today.sun.out) || 0;
            if (!sunIn || !sunOut || sunOut <= sunIn) {
                this.logDebug("CalculateSunshineDuration: invalid sun_in/sun_out values: sun_in=" + sunIn + " sun_out=" + sunOut);
                return 0;
            }
            // Normalisiere: falls Werte in Sekunden vorliegen, in ms umwandeln
            if (sunIn > 0 && sunIn < 10000000000) {
                sunIn = sunIn * 1000;
            }
            if (sunOut > 0 && sunOut < 10000000000) {
                sunOut = sunOut * 1000;
            }
            if (!Array.isArray(this.hours_forecast) || this.hours_forecast.length === 0) {
                this.logDebug("CalculateSunshineDuration: no hours_forecast available");
                return 0;
            }
            let totalHours = 0;
            for (const h of this.hours_forecast) {
                if (!h || (h.end === undefined || h.end === null)) {
                    continue;
                }
                let hourEnd = typeof h.end === "number" ? h.end : Number(h.end) || 0;
                if (hourEnd === 0) {
                    continue;
                }
                // normalize end to ms if necessary
                if (hourEnd > 0 && hourEnd < 10000000000) {
                    hourEnd = hourEnd * 1000;
                }
                const hourStart = hourEnd - 3600000; // eine Stunde vorher
                // Berechne Überlappung mit Tageslichtintervall
                const overlapStart = Math.max(hourStart, sunIn);
                const overlapEnd = Math.min(hourEnd, sunOut);
                const overlapMs = Math.max(0, overlapEnd - overlapStart);
                if (overlapMs <= 0) {
                    continue;
                }
                const overlapHours = overlapMs / 3600000;
                // Wolkenanteil in Prozent (0..100)
                const clouds = (h.clouds === undefined || h.clouds === null) ? 0 : (typeof h.clouds === "number" ? h.clouds : Number(h.clouds) || 0);
                const cloudFactor = 1 - Math.max(0, Math.min(100, clouds)) / 100;
                const effectiveSunHours = overlapHours * cloudFactor;
                totalHours += effectiveSunHours;
            }
            // Runde auf 2 Dezimalstellen
            const rounded = Math.round(totalHours * 100) / 100;
            this.logDebug("CalculateSunshineDuration: computed sunshineduration=" + rounded + " hours");
            return rounded;
        }
        catch (e) {
            this.logError("CalculateSunshineDuration error: " + String(e));
            return 0;
        }
    }
    async CreateObjects() {
        let key = "location_" + this.id;
        await this.CreateDatapoint(key, "channel", "", "", "", false, false, "location");
        await this.CreateDatapoint(key + ".Location", "state", "location", "string", "", true, false, "Location name");
        await this.CreateDatapoint(key + ".URL", "state", "weather.chart.url.forecast", "string", "", true, false, "Location default site URL");
        await this.CreateDatapoint(key + ".LastDownloadTime", "state", "date", "string", "", true, false, "time of last data update from server");
        if (this.useDailyForecast) {
            key = "location_" + this.id + ".ForecastDaily";
            await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily");
            for (let d = 1; d < 6; d++) {
                // The ioBroker forecast roles are 0 based, so "...forecast.0" is today (Day_1).
                // Without that index every day carries the very same role and consumers like the
                // type-detector cannot tell the days apart.
                const f = d - 1;
                key = "location_" + this.id + ".ForecastDaily.Day_" + d;
                await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily Day_" + d);
                await this.CreateDatapoint(key + ".date_full", "state", `date.forecast.${f}`, "string", "", true, false, "full date of forecast period (ISO string)");
                await this.CreateDatapoint(key + ".date", "state", "date", "string", "", true, false, "date of forecast period (simple string)");
                await this.CreateDatapoint(key + ".NameOfDay", "state", `dayofweek.forecast.${f}`, "string", "", true, false, "weekday of date");
                if (d == 1) {
                    //only for today
                    await this.CreateDatapoint(key + ".sunshineduration", "state", "value", "number", "hours", true, false, "sunshine duration of the day, based on daylight and clouds");
                }
                else {
                    if (await this.adapter.objectExists(key + ".sunshineduration")) {
                        this.logWarn("unused DP " + key + ".sunshineduration deleted");
                        await this.adapter.delObjectAsync(key + ".sunshineduration");
                    }
                }
                //date based time values for further calculation
                await this.CreateDatapoint(key + ".start", "state", "date", "number", "", true, false, "start of forecast period [UNIX timestamp]");
                await this.CreateDatapoint(key + ".symbol", "state", "value", "number", "", true, false, "Identifier for weather symbol");
                await this.CreateDatapoint(key + ".symbol_URL", "state", `weather.icon.forecast.${f}`, "string", "", true, false, "URL to weather symbol");
                await this.CreateDatapoint(key + ".symbol_description", "state", `weather.state.forecast.${f}`, "string", "", true, false, "symbol long description");
                await this.CreateDatapoint(key + ".Temperature_Min", "state", `value.temperature.min.forecast.${f}`, "number", "°C", true, false, "Minimum temperature");
                await this.CreateDatapoint(key + ".Temperature_Max", "state", `value.temperature.max.forecast.${f}`, "number", "°C", true, false, "Maximum temperature");
                await this.CreateDatapoint(key + ".Wind_Speed", "state", `value.speed.wind.forecast.${f}`, "number", "km/h", true, false, "Wind speed");
                await this.CreateDatapoint(key + ".Wind_Speed_Beauforts", "state", "value", "number", "", true, false, "Wind speed acc. Beauforts scale");
                await this.CreateDatapoint(key + ".Wind_Gust", "state", "value.speed.wind.gust", "number", "km/h", true, false, "Wind gust");
                await this.CreateDatapoint(key + ".Wind_Direction", "state", `weather.direction.wind.forecast.${f}`, "string", "", true, false, "Wind direction");
                await this.CreateDatapoint(key + ".Wind_symbol_URL", "state", `weather.icon.wind.forecast.${f}`, "string", "", true, false, "URL to wind symbol");
                await this.CreateDatapoint(key + ".Rain", "state", `value.precipitation.forecast.${f}`, "number", "mm", true, false, "Accumulated rain");
                await this.CreateDatapoint(key + ".Rain_Probability", "state", `value.precipitation.forecast.${f}`, "number", "%", true, false, "Rain probability for accumulated rain");
                await this.CreateDatapoint(key + ".Humidity", "state", `value.humidity.forecast.${f}`, "number", "%", true, false, "Humidity");
                await this.CreateDatapoint(key + ".Pressure", "state", `value.pressure.forecast.${f}`, "number", "hPa", true, false, "Pressure expressed in Millibars / hPa");
                await this.CreateDatapoint(key + ".Snowline", "state", "value", "number", "m", true, false, "Snowline cote expressed in meters");
                await this.CreateDatapoint(key + ".UV_index_max", "state", "value.uv", "number", "", true, false, "Maximum UV index for day");
                //string based time values for direct display
                await this.CreateDatapoint(key + ".Sun_in", "state", `date.sunrise.forecast.${f}`, "string", "", true, false, "sunrise time [string]");
                await this.CreateDatapoint(key + ".Sun_mid", "state", "date", "string", "", true, false, "sun noon time [string]");
                await this.CreateDatapoint(key + ".Sun_out", "state", `date.sunset.forecast.${f}`, "string", "", true, false, "sunset time [string]");
                await this.CreateDatapoint(key + ".Moon_in", "state", "date", "string", "", true, false, "moonrise time [string]");
                await this.CreateDatapoint(key + ".Moon_out", "state", "date", "string", "", true, false, "moonset time [string]");
                //date based time values for further calculation
                await this.CreateDatapoint(key + ".Sun_in_full", "state", "date", "number", "", true, false, "sunrise time [Unix timestamp]");
                await this.CreateDatapoint(key + ".Sun_mid_full", "state", "date", "number", "", true, false, "sun noon time [Unix timestamp]");
                await this.CreateDatapoint(key + ".Sun_out_full", "state", "date", "number", "", true, false, "sunset time [Unix timestamp]");
                await this.CreateDatapoint(key + ".Moon_in_full", "state", "date", "number", "", true, false, "moonrise time [Unix timestamp]");
                await this.CreateDatapoint(key + ".Moon_out_full", "state", "date", "number", "", true, false, "moonset time [Unix timestamp]");
                await this.CreateDatapoint(key + ".Moon_symbol", "state", "value", "number", "", true, false, "Identifier for moon symbol");
                await this.CreateDatapoint(key + ".Moon_symbol_URL", "state", "text", "string", "", true, false, "URL to moon symbol");
                await this.CreateDatapoint(key + ".Moon_illumination", "state", "value", "number", "%", true, false, "Percentage of illuminated moon");
            }
        }
        if (this.useHourlyForecast) {
            key = "location_" + this.id + ".ForecastHourly";
            await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastHourly");
            await this.CreateDatapoint(key + ".date_full", "state", "date", "string", "", true, false, "full date of forecast periods [ISO string]");
            await this.CreateDatapoint(key + ".date", "state", "date", "string", "", true, false, "date of forecast periods [simple string]");
            for (let h = 1; h < 25; h++) {
                key = "location_" + this.id + ".ForecastHourly.Hour_" + h;
                await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily Hour_" + h);
                await this.CreateObjectsHourly(key);
            }
            if (this.CopyCurrentHour) {
                key = "location_" + this.id + ".ForecastHourly.Current";
                await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily Current Hour");
                await this.CreateObjectsHourly(key);
            }
        }
    }
    async CreateObjectsHourly(key) {
        //daswetter.0.location_2.ForecastHourly.Hour_1.end  -> 31.12.2025, 01:00:00
        await this.CreateDatapoint(key + ".end", "state", "date", "number", "", true, false, "end of forecast period [Unix timestamp]");
        //daswetter.0.location_2.ForecastHourly.Hour_1.time  -> 01:00:00
        await this.CreateDatapoint(key + ".time", "state", "date", "string", "", true, false, "end of forecast period [time string only}");
        await this.CreateDatapoint(key + ".symbol", "state", "value", "number", "", true, false, "Identifier for weather symbol");
        await this.CreateDatapoint(key + ".symbol_URL", "state", "weather.icon", "string", "", true, false, "URL to weather symbol");
        await this.CreateDatapoint(key + ".symbol_description", "state", "text", "string", "", true, false, "weather symbol long description");
        await this.CreateDatapoint(key + ".night", "state", "state", "boolean", "", true, false, "Flag that indicates if the hour is at night");
        await this.CreateDatapoint(key + ".temperature", "state", "value.temperature", "number", "°C", true, false, "Temperature value");
        await this.CreateDatapoint(key + ".temperature_feels_like", "state", "value.temperature.feelslike", "number", "°C", true, false, "Temperature feels like value");
        await this.CreateDatapoint(key + ".wind_speed", "state", "value.speed.wind", "number", "km/h", true, false, "Wind speed");
        await this.CreateDatapoint(key + ".wind_speed_Beauforts", "state", "value", "number", "", true, false, "Wind speed acc Beauforts scale");
        await this.CreateDatapoint(key + ".wind_gust", "state", "value.speed.wind.gust", "number", "km/h", true, false, "Wind gust");
        await this.CreateDatapoint(key + ".wind_direction", "state", "weather.direction.wind", "string", "", true, false, "Wind direction");
        await this.CreateDatapoint(key + ".Wind_symbol_URL", "state", "weather.icon.wind", "string", "", true, false, "URL to wind symbol");
        await this.CreateDatapoint(key + ".rain", "state", "value.precipitation", "number", "mm", true, false, "Accumulated rain");
        await this.CreateDatapoint(key + ".rain_probability", "state", "value.precipitation", "number", "%", true, false, "Rain probability for accumulated rain");
        await this.CreateDatapoint(key + ".humidity", "state", "value.humidity", "number", "%", true, false, "Humidity");
        await this.CreateDatapoint(key + ".pressure", "state", "value.pressure", "number", "hPa", true, false, "Pressure expressed in Millibars / hPa");
        await this.CreateDatapoint(key + ".snowline", "state", "value.snowline", "number", "m", true, false, "Snowline cote expressed in meters");
        await this.CreateDatapoint(key + ".uv_index_max", "state", "value.uv", "number", "", true, false, "Maximum UV index for day");
        await this.CreateDatapoint(key + ".clouds", "state", "value.clouds", "number", "%", true, false, "Percentage of clouds");
    }
    async SetData_Location() {
        const key = "location_" + this.id;
        await this.adapter.setState(key + ".Location", this.city, true);
    }
    async SetData_ForecastDaily() {
        let key = "location_" + this.id;
        await this.adapter.setState(key + ".URL", this.url, true);
        await this.adapter.setState(key + ".LastDownloadTime", new Date().getTime(), true);
        for (let d = 1; d < 6; d++) {
            key = "location_" + this.id + ".ForecastDaily.Day_" + d;
            const day = this.days_forecast[d - 1];
            const timeval = day && day.start ? day.start : 0;
            const startParts = timeval ? this.FormatTimestampToLocal(timeval) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", isoString: "" };
            await this.adapter.setState(key + ".start", timeval, true);
            await this.adapter.setState(key + ".date_full", startParts.isoString, true);
            await this.adapter.setState(key + ".date", startParts.formattedTimevalDate, true);
            await this.adapter.setState(key + ".NameOfDay", startParts.formattedTimevalWeekday, true);
            await this.adapter.setState(key + ".symbol", day ? day.symbol : 0, true);
            await this.adapter.setState(key + ".symbol_URL", this.getIconUrl(day ? day.symbol : 0), true);
            await this.adapter.setState(key + ".symbol_description", this.getSymbolLongDescription(day ? day.symbol : 0, false), true);
            await this.adapter.setState(key + ".Temperature_Min", day ? this.formatTemperature(day.temperature.min) : 0, true);
            await this.adapter.setState(key + ".Temperature_Max", day ? this.formatTemperature(day.temperature.max) : 0, true);
            await this.adapter.setState(key + ".Wind_Speed", day ? day.wind.speed : 0, true);
            await this.adapter.setState(key + ".Wind_Speed_Beauforts", this.getWindBeaufort(day ? day.wind.speed : 0), true);
            await this.adapter.setState(key + ".Wind_Gust", day ? day.wind.gust : 0, true);
            await this.adapter.setState(key + ".Wind_Direction", day ? day.wind.direction : "", true);
            await this.adapter.setState(key + ".Wind_symbol_URL", this.getWindIconUrl(day ? day.wind.speed : 0, day ? day.wind.direction : ""), true);
            await this.adapter.setState(key + ".Rain", day ? day.precipitation.total : 0, true);
            await this.adapter.setState(key + ".Rain_Probability", day ? day.precipitation.probability : 0, true);
            await this.adapter.setState(key + ".Humidity", day ? day.humidity : 0, true);
            await this.adapter.setState(key + ".Pressure", day ? day.pressure : 0, true);
            await this.adapter.setState(key + ".Snowline", day ? day.snowline : 0, true);
            await this.adapter.setState(key + ".UV_index_max", day ? day.uv_index_max : 0, true);
            // Sun in
            const sunInRaw = day && day.sun.in ? day.sun.in : 0;
            const sunInParts = sunInRaw ? this.FormatTimestampToLocal(sunInRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", formattedTimevalTime: "", isoString: "" };
            await this.adapter.setState(key + ".Sun_in", sunInParts.formattedTimevalTime, true);
            await this.adapter.setState(key + ".Sun_in_full", sunInRaw, true);
            // Sun mid
            const sunMidRaw = day && day.sun.mid ? day.sun.mid : 0;
            const sunMidParts = sunMidRaw ? this.FormatTimestampToLocal(sunMidRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", formattedTimevalTime: "", isoString: "" };
            await this.adapter.setState(key + ".Sun_mid", sunMidParts.formattedTimevalTime, true);
            await this.adapter.setState(key + ".Sun_mid_full", sunMidRaw, true);
            // Sun out
            const sunOutRaw = day && day.sun.out ? day.sun.out : 0;
            const sunOutParts = sunOutRaw ? this.FormatTimestampToLocal(sunOutRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", formattedTimevalTime: "", isoString: "" };
            await this.adapter.setState(key + ".Sun_out", sunOutParts.formattedTimevalTime, true);
            await this.adapter.setState(key + ".Sun_out_full", sunOutRaw, true);
            // Moon in
            const moonInRaw = day && day.moon.in ? day.moon.in : 0;
            const moonInParts = moonInRaw ? this.FormatTimestampToLocal(moonInRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", formattedTimevalTime: "", isoString: "" };
            await this.adapter.setState(key + ".Moon_in", moonInParts.formattedTimevalTime, true);
            await this.adapter.setState(key + ".Moon_in_full", moonInRaw, true);
            // Moon out
            const moonOutRaw = day && day.moon.out ? day.moon.out : 0;
            const moonOutParts = moonOutRaw ? this.FormatTimestampToLocal(moonOutRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", formattedTimevalTime: "", isoString: "" };
            await this.adapter.setState(key + ".Moon_out", moonOutParts.formattedTimevalTime, true);
            await this.adapter.setState(key + ".Moon_out_full", moonOutRaw, true);
            await this.adapter.setState(key + ".Moon_symbol", day ? day.moon.symbol : 0, true);
            await this.adapter.setState(key + ".Moon_symbol_URL", this.getMoonIconUrl(day ? day.moon.symbol : 0), true);
            await this.adapter.setState(key + ".Moon_illumination", day ? day.moon.illumination : 0, true);
        }
    }
    async SetData_ForecastHourly() {
        let key = "location_" + this.id + ".ForecastHourly";
        const hour = this.hours_forecast[0];
        const timeval = hour && hour.end ? hour.end : 0;
        const endParts = timeval ? this.FormatTimestampToLocal(timeval) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", formattedTimevalTime: "", isoString: "" };
        await this.adapter.setState(key + ".date_full", endParts.isoString, true);
        await this.adapter.setState(key + ".date", endParts.formattedTimevalDate, true);
        for (let h = 1; h < 25; h++) {
            key = "location_" + this.id + ".ForecastHourly.Hour_" + h;
            await this.SetData_ForecastHourlyOneHour(key, h);
        }
        if (this.CopyCurrentHour) {
            await this.SetData_ForecastHourlyCurrent();
        }
    }
    async SetData_ForecastHourlyOneHour(key, h) {
        try {
            if (h > 0) {
                const hour = this.hours_forecast[h - 1];
                const timeval = hour && hour.end ? hour.end : 0;
                const endParts = timeval ? this.FormatTimestampToLocal(timeval) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "", formattedTimevalTime: "", isoString: "" };
                await this.adapter.setState(key + ".end", timeval, true);
                await this.adapter.setState(key + ".time", endParts.formattedTimevalTime, true);
                await this.adapter.setState(key + ".symbol", hour ? hour.symbol.value : 0, true);
                await this.adapter.setState(key + ".symbol_URL", this.getIconUrl(hour ? hour.symbol.value : 0), true);
                await this.adapter.setState(key + ".symbol_description", this.getSymbolLongDescription(hour ? hour.symbol.value : 0, hour.symbol.night), true);
                await this.adapter.setState(key + ".night", hour ? hour.symbol.night : false, true);
                await this.adapter.setState(key + ".temperature", hour ? this.formatTemperature(hour.temperature.value) : 0, true);
                await this.adapter.setState(key + ".temperature_feels_like", hour ? this.formatTemperature(hour.temperature.feels_like) : 0, true);
                await this.adapter.setState(key + ".wind_speed", hour ? hour.wind.speed : 0, true);
                await this.adapter.setState(key + ".wind_speed_Beauforts", this.getWindBeaufort(hour ? hour.wind.speed : 0), true);
                await this.adapter.setState(key + ".wind_gust", hour ? hour.wind.gust : 0, true);
                await this.adapter.setState(key + ".wind_direction", hour ? hour.wind.direction : "", true);
                await this.adapter.setState(key + ".Wind_symbol_URL", this.getWindIconUrl(hour ? hour.wind.speed : 0, hour ? hour.wind.direction : ""), true);
                await this.adapter.setState(key + ".rain", hour ? hour.precipitation.total : 0, true);
                await this.adapter.setState(key + ".rain_probability", hour ? hour.precipitation.probability : 0, true);
                await this.adapter.setState(key + ".humidity", hour ? hour.humidity : 0, true);
                await this.adapter.setState(key + ".pressure", hour ? hour.pressure : 0, true);
                await this.adapter.setState(key + ".snowline", hour ? hour.snow.snowline : 0, true);
                await this.adapter.setState(key + ".uv_index_max", hour ? hour.uv_index_max : 0, true);
                await this.adapter.setState(key + ".clouds", hour ? hour.clouds : 0, true);
            }
        }
        catch (e) {
            this.logError("SetData_ForecastHourlyOneHour error for hour " + h + " with key " + key + ": " + String(e));
        }
    }
    async SetData_ForecastHourlyCurrent() {
        //see issue #534: forecast period is end of hour
        try {
            const key = "location_" + this.id + ".ForecastHourly.Current";
            const d = new Date();
            const h = d.getHours() + 1; //next hour is the current forecast period, because forecast is always end of hour (e.g. 01:00:00 for 00:00-01:00)
            //check if data for today available
            const hour = this.hours_forecast[h - 1];
            const timeval = hour && hour.end ? hour.end : 0;
            const end = timeval ? new Date(timeval) : 0;
            if (end != 0 && end.getDate() == d.getDate() && end.getMonth() == d.getMonth() && end.getFullYear() == d.getFullYear()) {
                await this.SetData_ForecastHourlyOneHour(key, h);
            }
            else {
                this.logDebug("SetData_ForecastHourlyCurrent: current not copied because data from yesterday");
            }
        }
        catch (e) {
            this.logError("SetData_ForecastHourlyCurrent error: " + String(e));
        }
    }
    FormatTimestampToLocal(timestamp) {
        try {
            if (timestamp === null || timestamp === undefined || Number.isNaN(Number(timestamp))) {
                return {
                    formattedTimeval: "",
                    formattedTimevalDate: "",
                    formattedTimevalWeekday: "",
                    formattedTimevalTime: "",
                    isoString: ""
                };
            }
            let ms = Number(timestamp);
            // Wenn der Zeitstempel offensichtlich in Sekunden vorliegt
            if (ms > 0 && ms < 10000000000) {
                ms = ms * 1000;
            }
            const d = new Date(ms);
            if (isNaN(d.getTime())) {
                return {
                    formattedTimeval: "",
                    formattedTimevalDate: "",
                    formattedTimevalWeekday: "",
                    formattedTimevalTime: "",
                    isoString: ""
                };
            }
            // Resolve locale
            const locale = (this.language && typeof this.language === "string" && this.language.trim())
                ? this.language
                : "de-DE";
            // Intl-DateTimeFormat
            const dtfFull = new Intl.DateTimeFormat(locale, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });
            const dtfDate = new Intl.DateTimeFormat(locale, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });
            const dtfTime = new Intl.DateTimeFormat(locale, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });
            const dtfWeekday = new Intl.DateTimeFormat(locale, {
                weekday: "long"
            });
            // Formatiert für Anzeige
            const formattedTimeval = dtfFull.format(d);
            const formattedTimevalDate = dtfDate.format(d);
            const formattedTimevalTime = dtfTime.format(d);
            const formattedTimevalWeekday = dtfWeekday.format(d);
            // Für Datenpunkt vom Typ "date" → immer ISO 8601
            const isoString = d.toISOString(); // UTC korrekt, Admin zeigt lokale Zeit
            //this.logDebug("FormatTimestampToLocal : " +
            //    formattedTimeval + " | " +
            //    formattedTimevalDate + " | " +
            //    formattedTimevalWeekday + " | " +
            //    formattedTimevalTime + " | ISO: " + isoString
            //);
            return {
                formattedTimeval,
                formattedTimevalDate,
                formattedTimevalWeekday,
                formattedTimevalTime,
                isoString
            };
        }
        catch (e) {
            this.logError("FormatTimestampToLocal error: " + String(e));
            return {
                formattedTimeval: "",
                formattedTimevalDate: "",
                formattedTimevalWeekday: "",
                formattedTimevalTime: "",
                isoString: ""
            };
        }
    }
    // symbol functions
    getSymbolLongDescription(num, isNight) {
        this.logDebug("getSymbolLongDescription called called for: " + num);
        const translator = new translation_1.WeatherTranslator();
        const lang = (this.language && typeof this.language === "string" && this.language.trim()) ? this.language : "de-DE";
        this.logDebug("getSymbolLongDescription translator created for " + lang);
        translator.SetLanguage(lang);
        try {
            // sichere Konvertierung und Normalisierung
            const id = typeof num === "number" ? num : Number(num);
            if (Number.isNaN(id)) {
                this.logDebug("getSymbolLongDescription called with invalid num: " + num);
                return "";
            }
            // Suche in der symbols-Liste nach passender id
            const found = Array.isArray(this.symbols)
                ? this.symbols.find((s) => s !== undefined && s !== null && typeof s.id === "number" && s.id === id)
                : undefined;
            if (isNight) {
                if (found && found.night && typeof found.night.long === "string") {
                    const ret = translator.translateWeather(found.night.long);
                    this.logDebug("getSymbolLongDescription got night description for: " + num + " " + ret);
                    return ret;
                }
            }
            //if night-value not provided or it's day:
            if (found && found.day && typeof found.day.long === "string") {
                const ret = translator.translateWeather(found.day.long);
                this.logDebug("getSymbolLongDescription got day description for: " + num + " " + ret);
                return ret;
            }
            // Kein Eintrag gefunden -> leerer String
            this.logDebug("getSymbolLongDescription: no matching symbol for id " + id);
            return "";
        }
        catch (e) {
            this.logError("getSymbolLongDescription error: " + String(e));
            return "";
        }
    }
    getIconUrl(num) {
        const iconSet = this.IconSet;
        let url = "";
        let ext = ".png";
        if (this.IconType == 1) {
            ext = ".png";
        }
        else if (this.IconType == 2) {
            ext = ".svg";
        }
        else if (this.IconType == 3) {
            ext = ".gif";
        }
        if (num) {
            if (iconSet == 99) { //custom
                url = this.CustomPath;
            }
            else {
                url = "/daswetter.admin/icons/weather/gallery" + iconSet + "/";
                if (this.IconType == 1) {
                    if (this.PNGSize == 1) {
                        url = url + "png/28x28/";
                    }
                    else if (this.PNGSize == 2) {
                        url = url + "png/64x64/";
                    }
                    else if (this.PNGSize == 3) {
                        url = url + "png/128x128/";
                    }
                }
                else {
                    url = url + "svg/";
                }
            }
            let sNum = num.toString();
            if (num < 10) {
                sNum = "0" + sNum;
            }
            url = url + sNum + ext;
        }
        return url;
    }
    getWindBeaufort(num) {
        let result = 0;
        if (num < 1) {
            result = 0;
        }
        else if (num < 6) {
            result = 1;
        }
        else if (num < 12) {
            result = 2;
        }
        else if (num < 20) {
            result = 3;
        }
        else if (num < 29) {
            result = 4;
        }
        else if (num < 39) {
            result = 5;
        }
        else if (num < 50) {
            result = 6;
        }
        else if (num < 62) {
            result = 7;
        }
        else if (num < 75) {
            result = 8;
        }
        else if (num < 89) {
            result = 9;
        }
        else if (num < 103) {
            result = 10;
        }
        else if (num < 118) {
            result = 11;
        }
        else {
            result = 12;
        }
        return result;
    }
    getWindIconUrl(num, dir) {
        const bft = this.getWindBeaufort(num);
        // wind_bft9_NW_dark.svg
        const name = "wind_bft" + bft + "_" + dir;
        const iconSet = this.WindIconSet;
        let url = "";
        let ext = ".png";
        if (this.WindIconType == 1) {
            ext = ".png";
        }
        else if (this.WindIconType == 2) {
            ext = ".svg";
        }
        else if (this.WindIconType == 3) {
            ext = ".gif";
        }
        if (num != null && typeof num == "number" && num >= 0) {
            if (iconSet == 99) { //custom
                url = this.WindCustomPath;
            }
            else {
                url = "/daswetter.admin/icons/wind/gallery" + iconSet + "/";
                if (this.WindIconType == 1) {
                    if (this.WindPNGSize == 1) {
                        url = url + "png/28x28/";
                    }
                    else if (this.WindPNGSize == 2) {
                        url = url + "png/64x64/";
                    }
                    else if (this.WindPNGSize == 3) {
                        url = url + "png/128x128/";
                    }
                }
                else {
                    url = url + "svg/";
                }
            }
            url = url + name + ext;
        }
        return url;
    }
    getMoonIconUrl(num) {
        const iconSet = this.MoonIconSet;
        let url = "";
        let ext = ".png";
        if (this.MoonIconType == 1) {
            ext = ".png";
        }
        else if (this.MoonIconType == 2) {
            ext = ".svg";
        }
        else if (this.MoonIconType == 3) {
            ext = ".gif";
        }
        if (num) {
            if (iconSet == 99) { //custom
                url = this.MoonCustomPath;
            }
            else {
                url = "/daswetter.admin/icons/moon/gallery" + iconSet + "/";
                if (this.MoonIconType == 1) {
                    if (this.MoonPNGSize == 1) {
                        url = url + "png/28x28/";
                    }
                    else if (this.MoonPNGSize == 2) {
                        url = url + "png/64x64/";
                    }
                    else if (this.MoonPNGSize == 3) {
                        url = url + "png/128x128/";
                    }
                }
                else {
                    url = url + "svg/";
                }
            }
            url = url + num + ext;
        }
        return url;
    }
    GetSymbolDescription() {
        const description = [];
        const translator = new translation_1.WeatherTranslator();
        const lang = (this.language && typeof this.language === "string" && this.language.trim()) ? this.language : "de-DE";
        translator.SetLanguage(lang);
        if (this.symbols && this.symbols.length > 0) {
            for (const sym of this.symbols) {
                description.push({
                    id: sym.id,
                    description: translator.translateWeather(sym.day.long)
                });
            }
        }
        this.logDebug("GetSymbolDescription: send data to admin" + JSON.stringify(description));
        return description;
    }
    formatTemperature(temp) {
        const decimalPlaces = typeof this.DecimalPlaces4Temps === "number" ? this.DecimalPlaces4Temps : 2;
        if (typeof temp !== "number" || isNaN(temp)) {
            return 0;
        }
        return Number(temp.toFixed(decimalPlaces));
    }
}
exports.default = Meteored;
//# sourceMappingURL=meteored.js.map