/* eslint-disable prefer-template */
import axios from "axios";
import type { DasWetter } from "../main";

import Base from "./base";

import type { DasWetterConfig } from './adapter-config';


//API key: 32b5b47ddf0aefaecc45a1d0e17a057c582c58339264c798c5814819c9da8ca5
//location hash 7383011b46bae98d1b1277b8a71c1286

//todo
// Fehlerbehandlung (return vom server)
// Daten in OID übernehmen
// config vom admin holen

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
    "moon_out": 1766605550000,
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

    symbols: symbol_data[] = [];
    days_forecast: day_data[] = [];
    hours_forecast: hour_data[] = [];

    url = "";

    constructor(adapter: DasWetter, config: DasWetterConfig) {
        super(adapter, config.name);
        this.api_key = config.API_key;
        this.postcode = config.postcode;
        this.city = config.city;
    }

    CheckError(status:number): boolean{

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

        /*
        curl -X 'GET' \
            'https://api.meteored.com/api/location/v1/search/postalcode/08228' \
            -H 'accept: application/json' \
            -H 'x-api-key: 32b5b47ddf0aefaecc45a1d0e17a057c582c58339264c798c5814819c9da8ca5'
        */

        const url = "https://api.meteored.com/api/location/v1/search/postalcode/" + this.postcode;
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };

        try {
            const resp = await axios.get(url, {
                headers: headers,
                timeout: 10000
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
                /*
                {
  "ok": true,
  "expiracion": 1766561160547,
  "data": {
    "locations": [
      {
        "hash": "a79ecf2d85e1c63ace22d6d8299b2675",
        "name": "Terrassa",
        "description": "Barcelona, Katalonien",
        "country_name": "Spanien"
      },
      {
        "hash": "a79ecf2d85e1c63ace22d6d8299b2675",
        "name": "Terrassa",
        "description": "Provinz Barcelona",
        "country_name": "Spanien"
      },
      {
        "hash": "7383011b46bae98d1b1277b8a71c1286",
        "name": "Rodewisch",
        "description": "Sachsen",
        "country_name": "Deutschland"
      },
      {
        "hash": "b7698c3089cc23819247f5818b91215e",
        "name": "Vilnius",
        "description": "Bezirk Vilnius",
        "country_name": "Litauen"
      }
    ]
  }
}


                */
            } catch (e) {
                this.logError("exception in GetLocation data parse " + e);
            }
        } catch (e) {
            this.logError("exception in GetLocation " + e);
        }
    }



    async GetForecastDaily(): Promise<void> {
        this.logDebug("GetForecastDaily called");

        /*
        curl -X 'GET' \
            'https://api.meteored.com/api/forecast/v1/daily/7383011b46bae98d1b1277b8a71c1286' \
            -H 'accept: application/json' \
            -H 'x-api-key: 32b5b47ddf0aefaecc45a1d0e17a057c582c58339264c798c5814819c9da8ca5'
        */
        const url = "https://api.meteored.com/api/forecast/v1/daily/" + this.location_hash;
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };

        try {
            const resp = await axios.get(url, {
                headers: headers,
                timeout: 10000
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
                }
                /*
                {
                  "ok": true,
                  "expiracion": 1766566620000,
                  "data": {
                    "hash": "7383011b46bae98d1b1277b8a71c1286",
                    "name": "Rodewisch",
                    "url": "https://www.daswetter.com/wetter_Rodewisch-Europa-Deutschland-Sachsen--1-27287.html",
                    "days": [
                      {
                        "start": 1766530800000,
                        "symbol": 24,
                        "temperature_min": -5.69,
                        "temperature_max": -0.75,
                        "wind_speed": 26,
                        "wind_gust": 53,
                        "wind_direction": "NE",
                        "rain": 0.1,
                        "rain_probability": 30,
                        "humidity": 75,
                        "pressure": 1030,
                        "snowline": 0,
                        "uv_index_max": 0.4,
                        "sun_in": 1766560210000,
                        "sun_mid": 1766574602000,
                        "sun_out": 1766588998000,
                        "moon_in": 1766570292000,
                        "moon_out": 1766605550000,
                        "moon_symbol": 4,
                        "moon_illumination": 17.6
                      },
                      {
                        "start": 1766617200000,
                        "symbol": 1,
                        "temperature_min": -5.6,
                        "temperature_max": 1.42,
                        "wind_speed": 16,
                        "wind_gust": 32,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 62,
                        "pressure": 1032,
                        "snowline": 0,
                        "uv_index_max": 0.4,
                        "sun_in": 1766646630000,
                        "sun_mid": 1766661032000,
                        "sun_out": 1766675438000,
                        "moon_in": 1766657571000,
                        "moon_out": 1766696557000,
                        "moon_symbol": 5,
                        "moon_illumination": 26.05
                      },
                      {
                        "start": 1766703600000,
                        "symbol": 1,
                        "temperature_min": -4.94,
                        "temperature_max": 2.29,
                        "wind_speed": 9,
                        "wind_gust": 21,
                        "wind_direction": "N",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 67,
                        "pressure": 1031,
                        "snowline": 1500,
                        "uv_index_max": 0.5,
                        "sun_in": 1766733046000,
                        "sun_mid": 1766747462000,
                        "sun_out": 1766761882000,
                        "moon_in": 1766744751000,
                        "moon_out": 1766787595000,
                        "moon_symbol": 6,
                        "moon_illumination": 35.71
                      },
                      {
                        "start": 1766790000000,
                        "symbol": 4,
                        "temperature_min": -4.68,
                        "temperature_max": 1.12,
                        "wind_speed": 10,
                        "wind_gust": 22,
                        "wind_direction": "SW",
                        "rain": 0,
                        "rain_probability": 10,
                        "humidity": 77,
                        "pressure": 1033,
                        "snowline": 2800,
                        "uv_index_max": 0.5,
                        "sun_in": 1766819460000,
                        "sun_mid": 1766833891000,
                        "sun_out": 1766848329000,
                        "moon_in": 1766831908000,
                        "moon_out": 0,
                        "moon_symbol": 7,
                        "moon_illumination": 46.27
                      },
                      {
                        "start": 1766876400000,
                        "symbol": 9,
                        "temperature_min": -4.22,
                        "temperature_max": 0.89,
                        "wind_speed": 14,
                        "wind_gust": 32,
                        "wind_direction": "N",
                        "rain": 0,
                        "rain_probability": 20,
                        "humidity": 90,
                        "pressure": 1034,
                        "snowline": 0,
                        "uv_index_max": 0.5,
                        "sun_in": 1766905870000,
                        "sun_mid": 1766920321000,
                        "sun_out": 1766934778000,
                        "moon_in": 1766919118000,
                        "moon_out": 1766878747000,
                        "moon_symbol": 8,
                        "moon_illumination": 57.31
                      }
                    ]
                  }
                }
                */

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

        /*
        curl -X 'GET' \
            'https://api.meteored.com/api/forecast/v1/hourly/7383011b46bae98d1b1277b8a71c1286' \
            -H 'accept: application/json' \
            -H 'x-api-key: 32b5b47ddf0aefaecc45a1d0e17a057c582c58339264c798c5814819c9da8ca5'
        */
        const url = "https://api.meteored.com/api/forecast/v1/hourly/" + this.location_hash;
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };

        try {
            const resp = await axios.get(url, {
                headers: headers,
                timeout: 10000
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

                /*
                {
                  "ok": true,
                  "expiracion": 1766566620000,
                  "data": {
                    "hash": "7383011b46bae98d1b1277b8a71c1286",
                    "name": "Rodewisch",
                    "url": "https://www.daswetter.com/wetter_Rodewisch-Europa-Deutschland-Sachsen--1-27287.html",
                    "start": 1766530800000,
                    "hours": [
                      {
                        "end": 1766534400000,
                        "symbol": 5,
                        "night": true,
                        "temperature": -1.19,
                        "temperature_feels_like": -6.18,
                        "wind_speed": 19,
                        "wind_gust": 40,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 84,
                        "pressure": 1026,
                        "snowline": 200,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766538000000,
                        "symbol": 5,
                        "night": true,
                        "temperature": -1.23,
                        "temperature_feels_like": -6.31,
                        "wind_speed": 20,
                        "wind_gust": 41,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 81,
                        "pressure": 1026,
                        "snowline": 200,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766541600000,
                        "symbol": 5,
                        "night": true,
                        "temperature": -1.34,
                        "temperature_feels_like": -6.6,
                        "wind_speed": 21,
                        "wind_gust": 43,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 77,
                        "pressure": 1027,
                        "snowline": 200,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766545200000,
                        "symbol": 5,
                        "night": true,
                        "temperature": -1.49,
                        "temperature_feels_like": -6.88,
                        "wind_speed": 21,
                        "wind_gust": 44,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 76,
                        "pressure": 1027,
                        "snowline": 200,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766548800000,
                        "symbol": 5,
                        "night": true,
                        "temperature": -1.46,
                        "temperature_feels_like": -7.07,
                        "wind_speed": 23,
                        "wind_gust": 49,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 76,
                        "pressure": 1027,
                        "snowline": 200,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766552400000,
                        "symbol": 5,
                        "night": true,
                        "temperature": -1.31,
                        "temperature_feels_like": -7.21,
                        "wind_speed": 26,
                        "wind_gust": 52,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 73,
                        "pressure": 1028,
                        "snowline": 200,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766556000000,
                        "symbol": 5,
                        "night": true,
                        "temperature": -1.56,
                        "temperature_feels_like": -7,
                        "wind_speed": 22,
                        "wind_gust": 53,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 85,
                        "pressure": 1028,
                        "snowline": 200,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766559600000,
                        "symbol": 25,
                        "night": false,
                        "temperature": -1.96,
                        "temperature_feels_like": -7.4,
                        "wind_speed": 21,
                        "wind_gust": 45,
                        "wind_direction": "NE",
                        "rain": 0.1,
                        "rain_probability": 30,
                        "humidity": 89,
                        "pressure": 1028,
                        "snowline": 100,
                        "uv_index_max": 0,
                        "clouds": 100
                      },
                      {
                        "end": 1766563200000,
                        "symbol": 5,
                        "night": false,
                        "temperature": -1.71,
                        "temperature_feels_like": -7.36,
                        "wind_speed": 23,
                        "wind_gust": 47,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 10,
                        "humidity": 80,
                        "pressure": 1029,
                        "snowline": 200,
                        "uv_index_max": 0.1,
                        "clouds": 100
                      },
                      {
                        "end": 1766566800000,
                        "symbol": 5,
                        "night": false,
                        "temperature": -1.5,
                        "temperature_feels_like": -7.36,
                        "wind_speed": 25,
                        "wind_gust": 52,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 69,
                        "pressure": 1030,
                        "snowline": 200,
                        "uv_index_max": 0.2,
                        "clouds": 100
                      },
                      {
                        "end": 1766570400000,
                        "symbol": 5,
                        "night": false,
                        "temperature": -1.54,
                        "temperature_feels_like": -7.31,
                        "wind_speed": 24,
                        "wind_gust": 52,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 70,
                        "pressure": 1030,
                        "snowline": 200,
                        "uv_index_max": 0.3,
                        "clouds": 100
                      },
                      {
                        "end": 1766574000000,
                        "symbol": 5,
                        "night": false,
                        "temperature": -1.34,
                        "temperature_feels_like": -7.11,
                        "wind_speed": 25,
                        "wind_gust": 51,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 67,
                        "pressure": 1030,
                        "snowline": 200,
                        "uv_index_max": 0.4,
                        "clouds": 99
                      },
                      {
                        "end": 1766577600000,
                        "symbol": 5,
                        "night": false,
                        "temperature": -1.71,
                        "temperature_feels_like": -7.48,
                        "wind_speed": 24,
                        "wind_gust": 51,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 70,
                        "pressure": 1030,
                        "snowline": 200,
                        "uv_index_max": 0.4,
                        "clouds": 100
                      },
                      {
                        "end": 1766581200000,
                        "symbol": 4,
                        "night": false,
                        "temperature": -1.91,
                        "temperature_feels_like": -7.72,
                        "wind_speed": 24,
                        "wind_gust": 50,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 68,
                        "pressure": 1030,
                        "snowline": 100,
                        "uv_index_max": 0.2,
                        "clouds": 91
                      },
                      {
                        "end": 1766584800000,
                        "symbol": 4,
                        "night": false,
                        "temperature": -2.65,
                        "temperature_feels_like": -8.68,
                        "wind_speed": 24,
                        "wind_gust": 50,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 72,
                        "pressure": 1031,
                        "snowline": 0,
                        "uv_index_max": 0.1,
                        "clouds": 93
                      },
                      {
                        "end": 1766588400000,
                        "symbol": 4,
                        "night": false,
                        "temperature": -3.48,
                        "temperature_feels_like": -9.57,
                        "wind_speed": 23,
                        "wind_gust": 49,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 76,
                        "pressure": 1031,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 82
                      },
                      {
                        "end": 1766592000000,
                        "symbol": 3,
                        "night": true,
                        "temperature": -4.05,
                        "temperature_feels_like": -10.12,
                        "wind_speed": 22,
                        "wind_gust": 47,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 78,
                        "pressure": 1032,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 33
                      },
                      {
                        "end": 1766595600000,
                        "symbol": 3,
                        "night": true,
                        "temperature": -4.57,
                        "temperature_feels_like": -10.8,
                        "wind_speed": 22,
                        "wind_gust": 45,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 80,
                        "pressure": 1032,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 21
                      },
                      {
                        "end": 1766599200000,
                        "symbol": 1,
                        "night": true,
                        "temperature": -4.74,
                        "temperature_feels_like": -10.8,
                        "wind_speed": 20,
                        "wind_gust": 45,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 78,
                        "pressure": 1032,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 1
                      },
                      {
                        "end": 1766602800000,
                        "symbol": 1,
                        "night": true,
                        "temperature": -5.01,
                        "temperature_feels_like": -10.83,
                        "wind_speed": 19,
                        "wind_gust": 41,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 75,
                        "pressure": 1032,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 0
                      },
                      {
                        "end": 1766606400000,
                        "symbol": 1,
                        "night": true,
                        "temperature": -5.2,
                        "temperature_feels_like": -10.88,
                        "wind_speed": 18,
                        "wind_gust": 38,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 72,
                        "pressure": 1032,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 0
                      },
                      {
                        "end": 1766610000000,
                        "symbol": 1,
                        "night": true,
                        "temperature": -5.28,
                        "temperature_feels_like": -10.88,
                        "wind_speed": 17,
                        "wind_gust": 36,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 69,
                        "pressure": 1032,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 0
                      },
                      {
                        "end": 1766613600000,
                        "symbol": 1,
                        "night": true,
                        "temperature": -5.26,
                        "temperature_feels_like": -10.59,
                        "wind_speed": 16,
                        "wind_gust": 35,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 66,
                        "pressure": 1033,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 0
                      },
                      {
                        "end": 1766617200000,
                        "symbol": 1,
                        "night": true,
                        "temperature": -5.14,
                        "temperature_feels_like": -10.35,
                        "wind_speed": 15,
                        "wind_gust": 32,
                        "wind_direction": "NE",
                        "rain": 0,
                        "rain_probability": 0,
                        "humidity": 64,
                        "pressure": 1033,
                        "snowline": 0,
                        "uv_index_max": 0,
                        "clouds": 0
                      }
                    ]
                  }
                }
                
                */


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

        /*
        curl -X 'GET' \
      'https://api.meteored.com/api/doc/v1/forecast/symbol' \
      -H 'accept: application/json' \
      -H 'x-api-key: 32b5b47ddf0aefaecc45a1d0e17a057c582c58339264c798c5814819c9da8ca5'
        */
        const url = "https://api.meteored.com/api/doc/v1/forecast/symbol";
        const headers = {
            accept: "application/json",
            "x-api-key": this.api_key
        };

        try {
            const resp = await axios.get(url, {
                headers: headers,
                timeout: 10000
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
                            const dayObj: symbol_day |null = s && s.day ? s.day : null ;
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
}