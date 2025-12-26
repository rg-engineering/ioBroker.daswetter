/* eslint-disable prefer-template */
import axios from "axios";
import type { DasWetter } from "../main";

import Base from "./base";

import type { MetoredConfig } from './adapter-config';



//todo
// neuen API key erzeugen

// symbole abgleich mit return und Pfad


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
                // Logge die rohe Antwortdaten zur weitere Verarbeitung/Debug
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
        await this.CreateDatapoint(key + ".Location", "state", "location", "string", "", true, false, "location name");
        await this.CreateDatapoint(key + ".URL", "state", "weather.chart.url.forecast", "string", "", true, false, "location Web URL");

        key = "location_" + this.id + ".ForecastDaily";
        await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily");

        for (let d = 1; d < 6; d++) {
            key = "location_" + this.id + ".ForecastDaily.Day_" + d;
            await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily Day_" + d);

           
            await this.CreateDatapoint(key + ".date", "state", "date", "string", "", true, false, "date of forecast period");
            await this.CreateDatapoint(key + ".NameOfDay", "state", "dayofweek", "string", "", true, false, "weekday of date");
            await this.CreateDatapoint(key + ".sunshineduration", "state", "value", "number", "hours", true, false, "sunshine duration of the day");


            await this.CreateDatapoint(key + ".start", "state", "date", "string", "", true, false, "start of forecast period");
            await this.CreateDatapoint(key + ".symbol", "state", "value", "number", "", true, false, "symbol id");
            await this.CreateDatapoint(key + ".symbol_URL", "state", "value", "string", "", true, false, "symbol URL");
            await this.CreateDatapoint(key + ".Temperature_Min", "state", "value.temperature.min.forecast.0", "number", "°C", true, false, "minimum temperature");
            await this.CreateDatapoint(key + ".Temperature_Max", "state", "value.temperature.max.forecast.0", "number", "°C", true, false, "maximum temperature");
            await this.CreateDatapoint(key + ".Wind_Speed", "state", "value.speed.wind.forecast.0", "number", "km/h", true, false, "wind speed");
            await this.CreateDatapoint(key + ".Wind_Gust", "state", "value.speed.wind.gust", "number", "km/h", true, false, "wind gust");
            await this.CreateDatapoint(key + ".Wind_Direction", "state", "weather.direction.wind.forecast.0", "string", "", true, false, "wind direction");
            await this.CreateDatapoint(key + ".Rain", "state", "value", "number", "mm", true, false, "rain");
            await this.CreateDatapoint(key + ".Rain_Probability", "state", "value.precipitation.chance", "number", "%", true, false, "rain probability");
            await this.CreateDatapoint(key + ".Humidity", "state", "value.humidity", "number", "%", true, false, "humidity");
            await this.CreateDatapoint(key + ".Pressure", "state", "value", "number", "kPa", true, false, "pressure");
            await this.CreateDatapoint(key + ".Snowline", "state", "value", "number", "", true, false, "snowline");
            await this.CreateDatapoint(key + ".UV_index_max", "state", "value", "number", "", true, false, "maximum UV index");
            await this.CreateDatapoint(key + ".Sun_in", "state", "date.sunrise", "string", "", true, false, "sunrise time");
            await this.CreateDatapoint(key + ".Sun_mid", "state", "value", "string", "", true, false, "sun peak time");
            await this.CreateDatapoint(key + ".Sun_out", "state", "date.sunset", "string", "", true, false, "sunset time");
            await this.CreateDatapoint(key + ".Moon_in", "state", "value", "string", "", true, false, "moonrise time");
            await this.CreateDatapoint(key + ".Moon_out", "state", "value", "string", "", true, false, "moonset time");
            await this.CreateDatapoint(key + ".Moon_symbol", "state", "value", "number", "", true, false, "moon symbol");
            await this.CreateDatapoint(key + ".Moon_symbol_URL", "state", "value", "string", "", true, false, "moon symbol URL");
            await this.CreateDatapoint(key + ".Moon_illumination", "state", "value", "number", "%", true, false, "moon illumination");
        }

        key = "location_" + this.id + ".ForecastHourly";
        await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastHourly");

        for (let h = 1; h < 25; h++) {
            key = "location_" + this.id + ".ForecastHourly.Hour_" + h;
            await this.CreateDatapoint(key, "channel", "", "", "", false, false, "ForecastDaily Hour_" + h);

            await this.CreateDatapoint(key + ".end", "state", "date", "string", "", true, false, "end of forecast period");
            await this.CreateDatapoint(key + ".symbol", "state", "value", "number", "", true, false, "weather symbol");
            await this.CreateDatapoint(key + ".symbol_URL", "state", "value", "string", "", true, false, "weather symbol URL");
            await this.CreateDatapoint(key + ".night", "state", "value", "boolean", "", true, false, "is night");
            await this.CreateDatapoint(key + ".temperature", "state", "value.temperature.max.forecast.0", "number", "°C", true, false, "temperature");
            await this.CreateDatapoint(key + ".temperature_feels_like", "state", "value.temperature.feelslike", "number", "°C", true, false, "temperature feels like");
            await this.CreateDatapoint(key + ".wind_speed", "state", "value.speed.wind.forecast.0", "number", "km/h", true, false, "wind speed");
            await this.CreateDatapoint(key + ".wind_gust", "state", "value.speed.wind.gust", "number", "km/h", true, false, "wind gust");
            await this.CreateDatapoint(key + ".wind_direction", "state", "weather.direction.wind.forecast.0", "string", "", true, false, "wind direction");
            await this.CreateDatapoint(key + ".rain", "state", "value", "number", "mm", true, false, "rain");
            await this.CreateDatapoint(key + ".rain_probability", "state", "value", "number", "°C", true, false, "rain probability");
            await this.CreateDatapoint(key + ".humidity", "state", "value.humidity", "number", "%", true, false, "humidity");
            await this.CreateDatapoint(key + ".pressure", "state", "value", "number", "kPa", true, false, "pressure");
            await this.CreateDatapoint(key + ".snowline", "state", "value", "number", "", true, false, "snowline");
            await this.CreateDatapoint(key + ".uv_index_max", "state", "value", "number", "", true, false, "maximum UV index");
            await this.CreateDatapoint(key + ".clouds", "state", "value.clouds", "number", "%", true, false, "clouds");
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

            // Berechne sunshineduration aus sun_in / sun_out falls vorhanden
            const day = this.days_forecast[d - 1];
            let sunDuration = 0;
            if (day) {
                const sunInRaw = day.sun_in || 0;
                const sunOutRaw = day.sun_out || 0;
                if (sunInRaw && sunOutRaw) {
                    let sIn = Number(sunInRaw);
                    let sOut = Number(sunOutRaw);
                    if (sIn > 0 && sIn < 10000000000) {
                        sIn = sIn * 1000;
                    }
                    if (sOut > 0 && sOut < 10000000000) {
                        sOut = sOut * 1000;
                    }
                    sunDuration = Math.max(0, (sOut - sIn) / 3600000);
                    // runden auf 2 Nachkommastellen
                    sunDuration = Math.round(sunDuration * 100) / 100;

                    //und jetzt noch mit den Wolken verrechnen, wir wollen einen forecast für PV
                    //to do
                }
            }
            await this.adapter.setState(key + ".sunshineduration", sunDuration, true);


            const timeval = day && day.start ? day.start : 0;
            const startParts = timeval ? this.FormatTimestampToLocal(timeval) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "" };
            await this.adapter.setState(key + ".start", startParts.formattedTimeval, true);

            await this.adapter.setState(key + ".date", startParts.formattedTimevalDate, true);
            await this.adapter.setState(key + ".NameOfDay", startParts.formattedTimevalWeekday, true);


            await this.adapter.setState(key + ".symbol", day ? day.symbol : 0, true);
            await this.adapter.setState(key + ".symbol_URL", this.getIconUrl(day ? day.symbol : 0), true);
            await this.adapter.setState(key + ".Temperature_Min", day ? day.temperature_min : 0, true);
            await this.adapter.setState(key + ".Temperature_Max", day ? day.temperature_max : 0, true);
            await this.adapter.setState(key + ".Wind_Speed", day ? day.wind_speed : 0, true);
            await this.adapter.setState(key + ".Wind_Gust", day ? day.wind_gust : 0, true);
            await this.adapter.setState(key + ".Wind_Direction", day ? day.wind_direction : "", true);
            await this.adapter.setState(key + ".Rain", day ? day.rain : 0, true);
            await this.adapter.setState(key + ".Rain_Probability", day ? day.rain_probability : 0, true);
            await this.adapter.setState(key + ".Humidity", day ? day.humidity : 0, true);
            await this.adapter.setState(key + ".Pressure", day ? day.pressure : 0, true);
            await this.adapter.setState(key + ".Snowline", day ? day.snowline : 0, true);
            await this.adapter.setState(key + ".UV_index_max", day ? day.uv_index_max : 0, true);


            // Sun in
            const sunInRaw = day && day.sun_in ? day.sun_in : 0;
            const sunInParts = sunInRaw ? this.FormatTimestampToLocal(sunInRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "" };
            await this.adapter.setState(key + ".Sun_in", sunInParts.formattedTimeval, true);

            // Sun mid
            const sunMidRaw = day && day.sun_mid ? day.sun_mid : 0;
            const sunMidParts = sunMidRaw ? this.FormatTimestampToLocal(sunMidRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "" };
            await this.adapter.setState(key + ".Sun_mid", sunMidParts.formattedTimeval, true);

            // Sun out
            const sunOutRaw = day && day.sun_out ? day.sun_out : 0;
            const sunOutParts = sunOutRaw ? this.FormatTimestampToLocal(sunOutRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "" };
            await this.adapter.setState(key + ".Sun_out", sunOutParts.formattedTimeval, true);

            // Moon in
            const moonInRaw = day && day.moon_in ? day.moon_in : 0;
            const moonInParts = moonInRaw ? this.FormatTimestampToLocal(moonInRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "" };
            await this.adapter.setState(key + ".Moon_in", moonInParts.formattedTimeval, true);

            // Moon out
            const moonOutRaw = day && day.moon_out ? day.moon_out : 0;
            const moonOutParts = moonOutRaw ? this.FormatTimestampToLocal(moonOutRaw) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "" };
            await this.adapter.setState(key + ".Moon_out", moonOutParts.formattedTimeval, true);

            await this.adapter.setState(key + ".Moon_symbol", day ? day.moon_symbol : 0, true);
            await this.adapter.setState(key + ".Moon_symbol_URL", this.getMoonIconUrl(day ? day.moon_symbol : 0), true);

            await this.adapter.setState(key + ".Moon_illumination", day ? day.moon_illumination : 0, true);
        }



    }


    async SetData_ForecastHourly(): Promise<void> {

        for (let h = 1; h < 25; h++) {
            const key = "location_" + this.id + ".ForecastHourly.Hour_" + h;

            const hour = this.hours_forecast[h - 1];
            const timeval = hour && hour.end ? hour.end : 0;
            const endParts = timeval ? this.FormatTimestampToLocal(timeval) : { formattedTimeval: "", formattedTimevalDate: "", formattedTimevalWeekday: "" };
            await this.adapter.setState(key + ".end", endParts.formattedTimeval, true);

            await this.adapter.setState(key + ".symbol", hour ? hour.symbol : 0, true);
            await this.adapter.setState(key + ".symbol_URL", this.getIconUrl(hour ? hour.symbol : 0), true);
            await this.adapter.setState(key + ".night", hour ? hour.night : false, true);
            await this.adapter.setState(key + ".temperature", hour ? hour.temperature : 0, true);
            await this.adapter.setState(key + ".temperature_feels_like", hour ? hour.temperature_feels_like : 0, true);
            await this.adapter.setState(key + ".wind_speed", hour ? hour.wind_speed : 0, true);
            await this.adapter.setState(key + ".wind_gust", hour ? hour.wind_gust : 0, true);
            await this.adapter.setState(key + ".wind_direction", hour ? hour.wind_direction : "", true);
            await this.adapter.setState(key + ".rain", hour ? hour.rain : 0, true);
            await this.adapter.setState(key + ".rain_probability", hour ? hour.rain_probability : 0, true);
            await this.adapter.setState(key + ".humidity", hour ? hour.humidity : 0, true);
            await this.adapter.setState(key + ".pressure", hour ? hour.pressure : 0, true);
            await this.adapter.setState(key + ".snowline", hour ? hour.snowline : 0, true);
            await this.adapter.setState(key + ".uv_index_max", hour ? hour.uv_index_max : 0, true);
            await this.adapter.setState(key + ".clouds", hour ? hour.clouds : 0, true);
        }
    }
    FormatTimestampToLocal(timestamp: number): {
        formattedTimeval: string,
        formattedTimevalDate: string,
        formattedTimevalWeekday: string
    } {
        try {
            if (timestamp === null || timestamp === undefined || Number.isNaN(Number(timestamp))) {
                return {
                    formattedTimeval: "",
                    formattedTimevalDate: "",
                    formattedTimevalWeekday: ""
                };
            }

            let ms = Number(timestamp);

            // Wenn der Zeitstempel offensichtlich in Sekunden vorliegt (kleiner als 10^10),
            // dann in Millisekunden umwandeln.
            if (ms > 0 && ms < 10000000000) { // ~ cutoff für Sekunden
                ms = ms * 1000;
            }

            const d = new Date(ms);
            if (isNaN(d.getTime())) {
                return {
                    formattedTimeval: "",
                    formattedTimevalDate: "",
                    formattedTimevalWeekday: ""
                };
            }

            // Resolve locale
            const locale = (this.language && typeof this.language === "string" && this.language.trim()) ? this.language : "de-DE";

            // formattedTimeval: Datum + Uhrzeit
            const formattedTimeval = d.toLocaleString(locale, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit"
            });

            // formattedTimevalDate: nur Datum im Locale-Format
            const formattedTimevalDate = d.toLocaleDateString(locale, {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });

            // formattedTimevalWeekday: Name des Wochentags im Locale
            const formattedTimevalWeekday = d.toLocaleDateString(locale, {
                weekday: "long"
            });

            return {
                formattedTimeval,
                formattedTimevalDate,
                formattedTimevalWeekday
            };

        } catch (e) {
            this.logError("FormatTimestampToLocal error: " + e);
            return {
                formattedTimeval: "",
                formattedTimevalDate: "",
                formattedTimevalWeekday: ""
            };
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