/* eslint-disable prefer-template */
import axios from "axios";
import type { DasWetter } from "../main";

import Base from "./base";

import type { MetoredConfig } from './adapter-config';


//todo
// neuen API key erzeugen

// symbole abgleich mit return und Pfad
// rollen für datenpunkte

//siehe https://dashboard.meteored.com/de/api#documentation


interface location_data {
    "hash": string,
    "name": string,
    "description": string,
    "country_name": string
}

interface day_data {
    "start": number,
    "symbol": number,
    "temperature_min": number,
    "temperature_max": number,
    "wind_speed": number,
    "wind_gust": number,
    "wind_direction": string,
    "rain": number,
    "rain_probability": number,
    "humidity": number,
    "pressure": number,
    "snowline": number,
    "uv_index_max": number,
    "sun_in": number,
    "sun_mid": number,
    "sun_out": number,
    "moon_in": number,
    "moon_out": number,
    "moon_symbol": number,
    "moon_illumination": number
}

interface hour_data {
    "end": number,
    "symbol": number,
    "night": boolean,
    "temperature": number,
    "temperature_feels_like": number,
    "wind_speed": number,
    "wind_gust": number,
    "wind_direction": string,
    "rain": number,
    "rain_probability": number,
    "humidity": number,
    "pressure": number,
    "snowline": number,
    "uv_index_max": number,
    "clouds": number
}

interface symbol_day {
    "short": string,
    "long": string
}

interface symbol_data {
    "id": number,
    "day": symbol_day
}

export default class Meteored extends Base {

    api_key = "";
    postcode = "";
    city = "";
    location_hash = "";
    location_description = "";
    location_country = "";
    language: string | undefined = "";
    dateFormat = "";
    parseTimeout = 10;

    symbols: symbol_data[] = [];
    days_forecast: day_data[] = [];
    hours_forecast: hour_data[] = [];

    iconSet= 0;
    UsePNGorOriginalSVG = true;
    UseColorOrBW= true;
    CustomPath = "";
    CustomPathExt = "";

    windiconSet = 0;
    WindCustomPath = "";
    WindCustomPathExt = "";

    mooniconSet = 0;
    MoonCustomPath = "";
    MoonCustomPathExt = "";


    url = "";

    constructor(adapter: DasWetter, id: number, config: MetoredConfig) {
        super(adapter, id, config.name);
        this.api_key = typeof config.API_key === "string" ? config.API_key : "";
        this.postcode = typeof config.postcode === "string" ? config.postcode : "";
        this.city = typeof config.city === "string" ? config.city : "";
        this.language = typeof config.language === "string" ? config.language : "DE";
        this.dateFormat = typeof config.dateFormat === "string" ? config.dateFormat : "YYMMDD";
        this.parseTimeout = typeof config.parseTimeout === "number" ? config.parseTimeout : 10;

        this.iconSet = config.iconSet;
        this.UsePNGorOriginalSVG = config.UsePNGorOriginalSVG;
        this.UseColorOrBW = config.UseColorOrBW;
        this.CustomPath = config.CustomPath;
        this.CustomPathExt = config.CustomPathExt;

        this.windiconSet = config.windiconSet;
        this.WindCustomPath = config.WindCustomPath;
        this.WindCustomPathExt = config.WindCustomPathExt;

        this.mooniconSet = config.mooniconSet;
        this.MoonCustomPath = config.MoonCustomPath;
        this.MoonCustomPathExt = config.MoonCustomPathExt;
    }

    async Start(): Promise<void> {
        await this.CreateObjects();

        await this.GetLocation();
        await this.GetSymbols();
    }


    CheckError(status: number): boolean {

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


    async GetLocation(): Promise<void> {
        this.logDebug("GetLocation called");

        if (this.api_key === undefined || this.api_key == "") {
            this.logError("no api key available, please check settings");
            return;
        }

        const url = "https://api.meteored.com/api/location/v1/search/postalcode/" + this.postcode;
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };

        try {
            const resp = await axios.get(url, {
                headers: headers,
                timeout: this.parseTimeout * 1000
            });

            if (this.CheckError(resp.status)) {
                return;
            }

            try {
                // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                this.logDebug("Meteored GetLocation response: " + JSON.stringify(resp.data));

                // Sicher extrahieren: resp.data.data.locations
                const locations: location_data[] =
                    resp && resp.data && resp.data.data && Array.isArray(resp.data.data.locations)
                        ? resp.data.data.locations
                        : [];

                if (locations.length === 0) {
                    this.logError("Meteored GetLocation: no locations in response");
                } else {
                    const cityNormalized = (this.city || "").toString().trim().toLowerCase();
                    const match = locations.find((loc: location_data) => {
                        const name = loc && loc.name ? String(loc.name).trim().toLowerCase() : "";
                        return name === cityNormalized;
                    });

                    if (match) {
                        this.location_hash = match.hash ? String(match.hash) : "";
                        this.location_description = match.description ? String(match.description) : "";
                        this.location_country = match.country_name ? String(match.country_name) : "";

                        this.logDebug(
                            "Meteored GetLocation: matched city \"" + this.city +
                            "\" => hash=" + this.location_hash +
                            ", description=" + this.location_description +
                            ", country=" + this.location_country
                        );
                    } else {
                        this.logError("Meteored GetLocation: no matching location for city \"" + this.city + "\"");
                    }
                }

                await this.SetData_Location();

            } catch (e) {
                this.logError("exception in GetLocation data parse " + e);
            }
        } catch (e) {
            this.logError("exception in GetLocation " + e);
        }
    }



    async GetForecastDaily(): Promise<void> {
        this.logDebug("GetForecastDaily called");

        if (this.location_hash === undefined || this.location_hash == "") {
            this.logError("no location hash available, please check postcode and city settings");
            return;
        }
        if (this.api_key === undefined || this.api_key == "") {
            this.logError("no api key available, please check settings");
            return;
        }

        const url = "https://api.meteored.com/api/forecast/v1/daily/" + this.location_hash;
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };

        try {
            const resp = await axios.get(url, {
                headers: headers,
                timeout: this.parseTimeout * 1000
            });
            if (this.CheckError(resp.status)) {
                return;
            }

            try {
                // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                this.logDebug("Meteored GetForecastDaily response: " + JSON.stringify(resp.data));

                // Sicher extrahieren der URL aus resp.data.data.url und kopiere nach this.url
                const extractedUrl: string =
                    resp && resp.data && resp.data.data && resp.data.data.url
                        ? String(resp.data.data.url)
                        : "";

                if (extractedUrl) {
                    this.url = extractedUrl;
                    this.logDebug("Meteored GetForecastDaily: url=" + this.url);
                }

                // Sicher extrahieren: resp.data.data.days
                const rawDays: day_data[] =
                    resp && resp.data && resp.data.data && Array.isArray(resp.data.data.days)
                        ? resp.data.data.days
                        : [];

                if (rawDays.length === 0) {
                    this.logError("Meteored GetForecastDaily: no days array in response, setting empty days_forecast");
                    this.days_forecast = [];
                } else {
                    // Mappe rohe Objekte auf das definierte day_data-Interface mit sicheren Typen/Defaults
                    try {
                        const mapped: day_data[] = rawDays.map((d: day_data) => {
                            return {
                                start: typeof d.start === "number" ? d.start : Number(d.start) || 0,
                                symbol: typeof d.symbol === "number" ? d.symbol : Number(d.symbol) || 0,
                                temperature_min: typeof d.temperature_min === "number" ? d.temperature_min : Number(d.temperature_min) || 0,
                                temperature_max: typeof d.temperature_max === "number" ? d.temperature_max : Number(d.temperature_max) || 0,
                                wind_speed: typeof d.wind_speed === "number" ? d.wind_speed : Number(d.wind_speed) || 0,
                                wind_gust: typeof d.wind_gust === "number" ? d.wind_gust : Number(d.wind_gust) || 0,
                                wind_direction: d.wind_direction ? String(d.wind_direction) : "",
                                rain: typeof d.rain === "number" ? d.rain : Number(d.rain) || 0,
                                rain_probability: typeof d.rain_probability === "number" ? d.rain_probability : Number(d.rain_probability) || 0,
                                humidity: typeof d.humidity === "number" ? d.humidity : Number(d.humidity) || 0,
                                pressure: typeof d.pressure === "number" ? d.pressure : Number(d.pressure) || 0,
                                snowline: typeof d.snowline === "number" ? d.snowline : Number(d.snowline) || 0,
                                uv_index_max: typeof d.uv_index_max === "number" ? d.uv_index_max : Number(d.uv_index_max) || 0,
                                sun_in: typeof d.sun_in === "number" ? d.sun_in : Number(d.sun_in) || 0,
                                sun_mid: typeof d.sun_mid === "number" ? d.sun_mid : Number(d.sun_mid) || 0,
                                sun_out: typeof d.sun_out === "number" ? d.sun_out : Number(d.sun_out) || 0,
                                moon_in: typeof d.moon_in === "number" ? d.moon_in : Number(d.moon_in) || 0,
                                moon_out: typeof d.moon_out === "number" ? d.moon_out : Number(d.moon_out) || 0,
                                moon_symbol: typeof d.moon_symbol === "number" ? d.moon_symbol : Number(d.moon_symbol) || 0,
                                moon_illumination: typeof d.moon_illumination === "number" ? d.moon_illumination : Number(d.moon_illumination) || 0
                            } as day_data;
                        });

                        this.days_forecast = mapped;
                        this.logDebug("Meteored GetForecastDaily: parsed days_forecast count=" + this.days_forecast.length);
                    } catch (e) {
                        this.logError("Meteored GetForecastDaily: error mapping days array: " + e);
                        this.days_forecast = [];
                    }

                    await this.SetData_ForecastDaily();
                }
            } catch (e) {
                // Falls JSON.stringify fehlschlägt, logge eine kurze Meldung
                this.logError("exception in GetForecastDaily data parse " + e);
            }
        } catch (e) {

            this.logError("exception in GetForecastDaily " + e);
        }
    }

    async GetForecastHourly(): Promise<void> {
        this.logDebug("GetForecastHourly called");

        if (this.location_hash === undefined || this.location_hash == "") {
            this.logError("no location hash available, please check postcode and city settings");
            return;
        }
        if (this.api_key === undefined || this.api_key == "") {
            this.logError("no api key available, please check settings");
            return;
        }

        const url = "https://api.meteored.com/api/forecast/v1/hourly/" + this.location_hash;
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };

        try {
            const resp = await axios.get(url, {
                headers: headers,
                timeout: this.parseTimeout * 1000
            });
            if (this.CheckError(resp.status)) {
                return;
            }

            try {
                // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                this.logDebug("Meteored GetForecastHourly response: " + JSON.stringify(resp.data));


                // Sicher extrahieren: resp.data.data.hours
                const rawHours: hour_data[] =
                    resp && resp.data && resp.data.data && Array.isArray(resp.data.data.hours)
                        ? resp.data.data.hours
                        : [];

                if (rawHours.length === 0) {
                    this.logError("Meteored GetForecastHourly: no hours array in response, setting empty hours_forecast");
                    this.hours_forecast = [];
                } else {
                    try {
                        const mapped: hour_data[] = rawHours.map((h: hour_data) => {
                            return {
                                end: typeof h.end === "number" ? h.end : Number(h.end) || 0,
                                symbol: typeof h.symbol === "number" ? h.symbol : Number(h.symbol) || 0,
                                night: typeof h.night === "boolean" ? h.night : (h.night === "true" || h.night === true) || false,
                                temperature: typeof h.temperature === "number" ? h.temperature : Number(h.temperature) || 0,
                                temperature_feels_like: typeof h.temperature_feels_like === "number" ? h.temperature_feels_like : Number(h.temperature_feels_like) || 0,
                                wind_speed: typeof h.wind_speed === "number" ? h.wind_speed : Number(h.wind_speed) || 0,
                                wind_gust: typeof h.wind_gust === "number" ? h.wind_gust : Number(h.wind_gust) || 0,
                                wind_direction: h.wind_direction ? String(h.wind_direction) : "",
                                rain: typeof h.rain === "number" ? h.rain : Number(h.rain) || 0,
                                rain_probability: typeof h.rain_probability === "number" ? h.rain_probability : Number(h.rain_probability) || 0,
                                humidity: typeof h.humidity === "number" ? h.humidity : Number(h.humidity) || 0,
                                pressure: typeof h.pressure === "number" ? h.pressure : Number(h.pressure) || 0,
                                snowline: typeof h.snowline === "number" ? h.snowline : Number(h.snowline) || 0,
                                uv_index_max: typeof h.uv_index_max === "number" ? h.uv_index_max : Number(h.uv_index_max) || 0,
                                clouds: typeof h.clouds === "number" ? h.clouds : Number(h.clouds) || 0
                            } as hour_data;
                        });

                        this.hours_forecast = mapped;
                        this.logDebug("Meteored GetForecastHourly: parsed hours_forecast count=" + this.hours_forecast.length);
                    } catch (e) {
                        this.logError("Meteored GetForecastHourly: error mapping hours array: " + e);
                        this.hours_forecast = [];
                    }
                }

                await this.SetData_ForecastHourly();


            } catch (e) {
                // Falls JSON.stringify fehlschlägt, logge eine kurze Meldung
                this.logError("exception in GetForecastHourly data parse " + e);
            }
        } catch (e) {

            this.logError("exception in GetForecastHourly " + e);
        }
    }

    async GetSymbols(): Promise<void> {
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
            const resp = await axios.get(url, {
                headers: headers,
                timeout: this.parseTimeout * 1000
            });
            if (this.CheckError(resp.status)) {
                return;
            }

            try {
                // Logge die rohe Antwortdaten zur weiteren Verarbeitung/Debug
                this.logDebug("Meteored GetSymbols response: " + JSON.stringify(resp.data));

                // Sicher extrahieren: resp.data.data.symbols
                const rawSymbols: symbol_data[] =
                    resp && resp.data && resp.data.data && Array.isArray(resp.data.data.symbols)
                        ? resp.data.data.symbols
                        : [];

                if (rawSymbols.length === 0) {
                    this.logError("Meteored GetSymbols: no symbols array in response, setting empty symbols");
                    this.symbols = [];
                } else {
                    try {
                        const mapped: symbol_data[] = rawSymbols.map((s: symbol_data) => {
                            const id = (s && (typeof s.id === "number" ? s.id : Number(s.id))) || 0;
                            const dayObj: symbol_day | null = s && s.day ? s.day : null;
                            const dayShort = dayObj && dayObj.short ? String(dayObj.short) : "";
                            const dayLong = dayObj && dayObj.long ? String(dayObj.long) : "";

                            return {
                                id: id,
                                day: {
                                    short: dayShort,
                                    long: dayLong
                                }
                            } as symbol_data;
                        });

                        this.symbols = mapped;
                        this.logDebug("Meteored GetSymbols: parsed symbols count=" + this.symbols.length);
                    } catch (e) {
                        this.logError("Meteored GetSymbols: error mapping symbols array: " + e);
                        this.symbols = [];
                    }
                }

            } catch (e) {
                // Falls JSON.stringify fehlschlägt, logge eine kurze Meldung
                this.logError("exception in GetSymbols data parse " + e);
            }
        } catch (e) {

            this.logError("exception in GetSymbols " + e);
        }
    }

    async CreateObjects(): Promise<void> {

        let key = "location_" + this.id;
        await this.CreateDatapoint(key, "channel", "", "", "", false, false, "location");
        await this.CreateDatapoint(key + ".Location", "state", "value", "string", "", true, false, "location name");
        await this.CreateDatapoint(key + ".URL", "state", "value", "string", "", true, false, "location Web URL");

        key = "location_" + this.id + ".ForecastDaily";
        await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily");

        for (let d = 1; d < 6; d++) {
            key = "location_" + this.id + ".ForecastDaily.Day_" + d;
            await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily Day_" + d);

            await this.CreateDatapoint(key + ".start", "state", "value", "string", "", true, false, "start of forecast");
            await this.CreateDatapoint(key + ".symbol", "state", "value", "number", "", true, false, "symbol id");
            await this.CreateDatapoint(key + ".symbol_URL", "state", "value", "string", "", true, false, "symbol URL");
            await this.CreateDatapoint(key + ".Temperature_Min", "state", "value", "number", "°C", true, false, "minimum temperature");
            await this.CreateDatapoint(key + ".Temperature_Max", "state", "value", "number", "°C", true, false, "maximum temperature");
            await this.CreateDatapoint(key + ".Wind_Speed", "state", "value", "number", "km/h", true, false, "Wind Speed");
            await this.CreateDatapoint(key + ".Wind_Gust", "state", "value", "number", "km/h", true, false, "Wind Gust");
            await this.CreateDatapoint(key + ".Wind_Direction", "state", "value", "string", "", true, false, "Wind Direction");
            await this.CreateDatapoint(key + ".Rain", "state", "value", "number", "mm", true, false, "Rain");
            await this.CreateDatapoint(key + ".Rain_Probability", "state", "value", "number", "%", true, false, "Rain");
            await this.CreateDatapoint(key + ".Humidity", "state", "value", "number", "%", true, false, "Humidity");
            await this.CreateDatapoint(key + ".Pressure", "state", "value", "number", "kPa", true, false, "Pressure");
            await this.CreateDatapoint(key + ".Snowline", "state", "value", "number", "", true, false, "Snowline");
            await this.CreateDatapoint(key + ".UV_index_max", "state", "value", "number", "", true, false, "UV_index_max");
            await this.CreateDatapoint(key + ".Sun_in", "state", "value", "string", "", true, false, "Sun_in");
            await this.CreateDatapoint(key + ".Sun_mid", "state", "value", "string", "", true, false, "Sun_mid");
            await this.CreateDatapoint(key + ".Sun_out", "state", "value", "string", "", true, false, "Sun_out");
            await this.CreateDatapoint(key + ".Moon_in", "state", "value", "string", "", true, false, "Moon_in");
            await this.CreateDatapoint(key + ".Moon_out", "state", "value", "string", "", true, false, "Moon_out");
            await this.CreateDatapoint(key + ".Moon_symbol", "state", "value", "number", "", true, false, "Moon_symbol");
            await this.CreateDatapoint(key + ".Moon_symbol_URL", "state", "value", "string", "", true, false, "Moon symbol URL");
            await this.CreateDatapoint(key + ".Moon_illumination", "state", "value", "number", "%", true, false, "Moon_illumination");
        }

        key = "location_" + this.id + ".ForecastHourly";
        await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastHourly");

        for (let h = 1; h < 25; h++) {
            key = "location_" + this.id + ".ForecastHourly.Hour_" + h;
            await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily Hour_" + h);

            await this.CreateDatapoint(key + ".end", "state", "value", "string", "", true, false, "Start");
            await this.CreateDatapoint(key + ".symbol", "state", "value", "number", "", true, false, "Symbol");
            await this.CreateDatapoint(key + ".symbol_URL", "state", "value", "string", "", true, false, "Symbol URL");
            await this.CreateDatapoint(key + ".night", "state", "value", "boolean", "", true, false, "is night");
            await this.CreateDatapoint(key + ".temperature", "state", "value", "number", "°C", true, false, "Temperature");
            await this.CreateDatapoint(key + ".temperature_feels_like", "state", "value", "number", "°C", true, false, "temperature feels like");
            await this.CreateDatapoint(key + ".wind_speed", "state", "value", "number", "km/h", true, false, "wind speed");
            await this.CreateDatapoint(key + ".wind_gust", "state", "value", "number", "km/h", true, false, "wind gust");
            await this.CreateDatapoint(key + ".wind_direction", "state", "value", "string", "", true, false, "wind direction");
            await this.CreateDatapoint(key + ".rain", "state", "value", "number", "mm", true, false, "rain");
            await this.CreateDatapoint(key + ".rain_probability", "state", "value", "number", "°C", true, false, "rain probability");
            await this.CreateDatapoint(key + ".humidity", "state", "value", "number", "%", true, false, "humidity");
            await this.CreateDatapoint(key + ".pressure", "state", "value", "number", "kPa", true, false, "pressure");
            await this.CreateDatapoint(key + ".snowline", "state", "value", "number", "", true, false, "snowline");
            await this.CreateDatapoint(key + ".uv_index_max", "state", "value", "number", "", true, false, "uv_index_max");
            await this.CreateDatapoint(key + ".clouds", "state", "value", "number", "%", true, false, "clouds");
        }
    }

    async SetData_Location(): Promise<void> {

        const key = "location_" + this.id;
        await this.adapter.setState(key + ".Location", this.city, true);

    }

    async SetData_ForecastDaily(): Promise<void> {

        let key = "location_" + this.id;

        await this.adapter.setState(key + ".URL", this.url, true);

        for (let d = 1; d < 6; d++) {

            key = "location_" + this.id + ".ForecastDaily.Day_" + d;

            let timeval = this.days_forecast[d - 1] && this.days_forecast[d - 1].start ? this.days_forecast[d - 1].start : 0;
            let formattedTimeval = timeval ? this.FormatTimestampToLocal(timeval) : "";
            await this.adapter.setState(key + ".start", formattedTimeval, true);

            await this.adapter.setState(key + ".symbol", this.days_forecast[d - 1].symbol, true);
            await this.adapter.setState(key + ".symbol_URL", this.getIconUrl(this.days_forecast[d - 1].symbol), true);
            await this.adapter.setState(key + ".Temperature_Min", this.days_forecast[d - 1].temperature_min, true);
            await this.adapter.setState(key + ".Temperature_Max", this.days_forecast[d - 1].temperature_max, true);
            await this.adapter.setState(key + ".Wind_Speed", this.days_forecast[d - 1].wind_speed, true);
            await this.adapter.setState(key + ".Wind_Gust", this.days_forecast[d - 1].wind_gust, true);
            await this.adapter.setState(key + ".Wind_Direction", this.days_forecast[d - 1].wind_direction, true);
            await this.adapter.setState(key + ".Rain", this.days_forecast[d - 1].rain, true);
            await this.adapter.setState(key + ".Rain_Probability", this.days_forecast[d - 1].rain_probability, true);
            await this.adapter.setState(key + ".Humidity", this.days_forecast[d - 1].humidity, true);
            await this.adapter.setState(key + ".Pressure", this.days_forecast[d - 1].pressure, true);
            await this.adapter.setState(key + ".Snowline", this.days_forecast[d - 1].snowline, true);
            await this.adapter.setState(key + ".UV_index_max", this.days_forecast[d - 1].uv_index_max, true);


            timeval = this.days_forecast[d - 1] && this.days_forecast[d - 1].sun_in ? this.days_forecast[d - 1].sun_in : 0;
            formattedTimeval = timeval ? this.FormatTimestampToLocal(timeval) : "";
            await this.adapter.setState(key + ".Sun_in", formattedTimeval, true);

            timeval = this.days_forecast[d - 1] && this.days_forecast[d - 1].sun_mid ? this.days_forecast[d - 1].sun_mid : 0;
            formattedTimeval = timeval ? this.FormatTimestampToLocal(timeval) : "";
            await this.adapter.setState(key + ".Sun_mid", formattedTimeval, true);

            timeval = this.days_forecast[d - 1] && this.days_forecast[d - 1].sun_out ? this.days_forecast[d - 1].sun_out : 0;
            formattedTimeval = timeval ? this.FormatTimestampToLocal(timeval) : "";
            await this.adapter.setState(key + ".Sun_out", formattedTimeval, true);

            timeval = this.days_forecast[d - 1] && this.days_forecast[d - 1].moon_in ? this.days_forecast[d - 1].moon_in : 0;
            formattedTimeval = timeval ? this.FormatTimestampToLocal(timeval) : "";
            await this.adapter.setState(key + ".Moon_in", formattedTimeval, true);

            timeval = this.days_forecast[d - 1] && this.days_forecast[d - 1].moon_out ? this.days_forecast[d - 1].moon_out : 0;
            formattedTimeval = timeval ? this.FormatTimestampToLocal(timeval) : "";
            await this.adapter.setState(key + ".Moon_out", formattedTimeval, true);

            await this.adapter.setState(key + ".Moon_symbol", this.days_forecast[d - 1].moon_symbol, true);
            await this.adapter.setState(key + ".Moon_symbol_URL", this.getMoonIconUrl(this.days_forecast[d - 1].moon_symbol), true);

            await this.adapter.setState(key + ".Moon_illumination", this.days_forecast[d - 1].moon_illumination, true);
        }



    }


    async SetData_ForecastHourly(): Promise<void> {

        for (let h = 1; h < 25; h++) {
            const key = "location_" + this.id + ".ForecastHourly.Hour_" + h;

            const timeval = this.hours_forecast[h - 1] && this.hours_forecast[h - 1].end ? this.hours_forecast[h - 1].end : 0;
            const formattedTimeval = timeval ? this.FormatTimestampToLocal(timeval) : "";
            await this.adapter.setState(key + ".end", formattedTimeval, true);

            await this.adapter.setState(key + ".symbol", this.hours_forecast[h - 1].symbol, true);
            await this.adapter.setState(key + ".symbol_URL", this.getIconUrl(this.hours_forecast[h - 1].symbol), true);
            await this.adapter.setState(key + ".night", this.hours_forecast[h - 1].night, true);
            await this.adapter.setState(key + ".temperature", this.hours_forecast[h - 1].temperature, true);
            await this.adapter.setState(key + ".temperature_feels_like", this.hours_forecast[h - 1].temperature_feels_like, true);
            await this.adapter.setState(key + ".wind_speed", this.hours_forecast[h - 1].wind_speed, true);
            await this.adapter.setState(key + ".wind_gust", this.hours_forecast[h - 1].wind_gust, true);
            await this.adapter.setState(key + ".wind_direction", this.hours_forecast[h - 1].wind_direction, true);
            await this.adapter.setState(key + ".rain", this.hours_forecast[h - 1].rain, true);
            await this.adapter.setState(key + ".rain_probability", this.hours_forecast[h - 1].rain_probability, true);
            await this.adapter.setState(key + ".humidity", this.hours_forecast[h - 1].humidity, true);
            await this.adapter.setState(key + ".pressure", this.hours_forecast[h - 1].pressure, true);
            await this.adapter.setState(key + ".snowline", this.hours_forecast[h - 1].snowline, true);
            await this.adapter.setState(key + ".uv_index_max", this.hours_forecast[h - 1].uv_index_max, true);
            await this.adapter.setState(key + ".clouds", this.hours_forecast[h - 1].clouds, true);
        }
    }
    FormatTimestampToLocal(timestamp: number): string {
        try {
            if (timestamp === null || timestamp === undefined || Number.isNaN(Number(timestamp))) {
                return "";
            }

            let ms = Number(timestamp);

            // Wenn der Zeitstempel offensichtlich in Sekunden vorliegt (kleiner als 10^10),
            // dann in Millisekunden umwandeln.
            if (ms > 0 && ms < 10000000000) { // ~ Sat Nov 20 2286, safe cutoff for seconds
                ms = ms * 1000;
            }

            const d = new Date(ms);
            if (isNaN(d.getTime())) {
                return "";
            }

            // Resolve locale
            const locale = (this.language && typeof this.language === "string" && this.language.trim()) ? this.language : "de-DE";

            /*
            // If a custom dateFormat is provided, perform token replacement
            if (this.dateFormat && typeof this.dateFormat === "string" && this.dateFormat.trim() !== "") {
                const year = d.getFullYear();
                const month = d.getMonth() + 1;
                const day = d.getDate();
                const hours = d.getHours();
                const minutes = d.getMinutes();
                const seconds = d.getSeconds();

                const pad = (n: number, len = 2): string => String(n).padStart(len, "0");

                // Token replacements (common patterns)
                const replacements: { [token: string]: string } = {
                    "YYYY": String(year),
                    "YY": String(year).slice(-2),
                    "MM": pad(month),
                    "M": String(month),
                    "DD": pad(day),
                    "D": String(day),
                    "HH": pad(hours),
                    "H": String(hours),
                    "hh": pad(hours),
                    "h": String(hours),
                    "mm": pad(minutes),
                    "m": String(minutes),
                    "ss": pad(seconds),
                    "s": String(seconds)
                };

                // Perform replacement - replace longest tokens first to avoid partial matches
                const tokens = Object.keys(replacements).sort((a, b) => b.length - a.length);
                let formatted = String(this.dateFormat);
                for (const t of tokens) {
                    // Use split/join to avoid RegExp escape issues
                    formatted = formatted.split(t).join(replacements[t]);
                }

                return formatted;
            }
            */
            // Default formatting using locale with date+time and seconds (fallback behavior)
            return d.toLocaleString(locale, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });


        } catch (e) {
            this.logError("FormatTimestampToLocal error: " + e);
            return "";
        }
    }



    // symbol functions

    getIconUrl(num:number):string {
        const iconSet = this.iconSet;
        
        let url = "";
        let ext = "";
        if (num) {

            if (iconSet == 7) {//custom
                url = this.CustomPath;
                ext = this.CustomPathExt;
            } else {
                url = "/adapter/daswetter/icons/tiempo-weather/galeria" + iconSet + "/";
                ext = (iconSet < 5 || this.UsePNGorOriginalSVG) ? ".png" : ".svg";

                //this.logDebug("getIconURL " + num + " " + this.UsePNGorOriginalSVG + " " + this.UseColorOrBW);

                if (iconSet === 5) {
                    if (this.UsePNGorOriginalSVG) {
                        url = url + "PNG/";
                    } else {
                        url = url + "SVG/";
                    }

                    if (this.UseColorOrBW) {
                        url = url + "Color/";
                    } else {
                        url = url + "White/";
                    }
                }
            }
            url = url + num + ext;
        }
        return url;
    }

    /*
    getWindIconUrl(num: number): string {

        let url = "";
        let ext = "";

        switch (this.windiconSet) {
            case 1:
                url = "/adapter/daswetter/icons/viento-wind/Beaufort-White/";
                ext = ".png";
                break;
            case 2:
                url = "/adapter/daswetter/icons/viento-wind/galeria2-Beaufort/";
                ext = ".png";
                break;
            case 3:
                url = "/adapter/daswetter/icons/viento-wind/galeria1/";
                ext = ".png";
                break;
            case 4:
                url = this.WindCustomPath;
                ext = this.WindCustomPathExt;
                break;

        }
        return url + num + ext;
    }
    */

    getMoonIconUrl(num: number): string {
        const iconSet = this.mooniconSet;
        let url = "";
        let ext = "";

        if (iconSet == 2) {
            url = this.MoonCustomPath;
            ext = this.MoonCustomPathExt;
        } else {
            url = "/adapter/daswetter/icons/luna-moon/";
            ext = ".png";
        }

        return url + num + ext;
    }
}