import type { DasWetter } from "../main";
import Base from "./base";
import type { MeteoredConfig } from './adapter-config';
interface day_data {
    "start": number;
    "symbol": number;
    "temperature_min": number;
    "temperature_max": number;
    "wind_speed": number;
    "wind_gust": number;
    "wind_direction": string;
    "rain": number;
    "rain_probability": number;
    "humidity": number;
    "pressure": number;
    "snowline": number;
    "uv_index_max": number;
    "sun_in": number;
    "sun_mid": number;
    "sun_out": number;
    "moon_in": number;
    "moon_out": number;
    "moon_symbol": number;
    "moon_illumination": number;
}
interface hour_data {
    "end": number;
    "symbol": number;
    "night": boolean;
    "temperature": number;
    "temperature_feels_like": number;
    "wind_speed": number;
    "wind_gust": number;
    "wind_direction": string;
    "rain": number;
    "rain_probability": number;
    "humidity": number;
    "pressure": number;
    "snowline": number;
    "uv_index_max": number;
    "clouds": number;
}
interface symbol_day {
    "short": string;
    "long": string;
}
interface symbol_data {
    "id": number;
    "day": symbol_day;
    "night"?: symbol_day;
}
export default class Meteored extends Base {
    api_key: string;
    postcode: string;
    city: string;
    bundesland: string;
    location_hash: string;
    location_description: string;
    location_country: string;
    language: string | undefined;
    dateFormat: string;
    parseTimeout: number;
    useDailyForecast: boolean;
    useHourlyForecast: boolean;
    expires_hour: number;
    expires_day: number;
    symbols: symbol_data[];
    days_forecast: day_data[];
    hours_forecast: hour_data[];
    IconSet: number;
    IconType: number;
    PNGSize: number;
    CustomPath: string;
    WindIconSet: number;
    WindIconType: number;
    WindPNGSize: number;
    WindCustomPath: string;
    MoonIconSet: number;
    MoonIconType: number;
    MoonPNGSize: number;
    MoonCustomPath: string;
    CopyCurrentHour: boolean;
    DecimalPlaces4Temps: number;
    url: string;
    constructor(adapter: DasWetter, id: number, config: MeteoredConfig);
    Start(): Promise<void>;
    CheckError(status: number): boolean;
    GetLocation(): Promise<void>;
    GetLocationPostcode(): Promise<void>;
    GetLocationFreetext(): Promise<void>;
    GetForecastDaily(): Promise<void>;
    GetForecastHourly(): Promise<void>;
    GetSymbols(): Promise<void>;
    CalculateData(): Promise<void>;
    private CalculateSunshineDuration;
    CreateObjects(): Promise<void>;
    CreateObjectsHourly(key: string): Promise<void>;
    SetData_Location(): Promise<void>;
    SetData_ForecastDaily(): Promise<void>;
    SetData_ForecastHourly(): Promise<void>;
    SetData_ForecastHourlyOneHour(key: string, h: number): Promise<void>;
    SetData_ForecastHourlyCurrent(): Promise<void>;
    FormatTimestampToLocal(timestamp: number): {
        formattedTimeval: string;
        formattedTimevalDate: string;
        formattedTimevalWeekday: string;
        formattedTimevalTime: string;
        isoString: string;
    };
    getSymbolLongDescription(num: number, isNight: boolean): string;
    getIconUrl(num: number): string;
    getWindBeaufort(num: number): number;
    getWindIconUrl(num: number, dir: string): string;
    getMoonIconUrl(num: number): string;
    GetSymbolDescription(): {
        id: number;
        description: string;
    }[];
    private formatTemperature;
}
export {};
