// This file extends the AdapterConfig type from "@types/iobroker"


//Interface zu meteored
export interface MeteoredConfig {
	name: string; //translated names from enum in ioBroker
	API_key: string; //api key based on account
	postcode: string;//postcode for location
	city: string;
	bundesland: string;
	language: string | undefined;
	dateFormat: string;
	parseTimeout: number;
	useDailyForecast: boolean,
	useHourlyForecast: boolean

	IconSet: number,
	UsePNGorSVG: boolean,
    PNGSize: number,
	CustomPath: string,

	WindIconSet: number,
	WindUsePNGorSVG: boolean,
	WindPNGSize: number,
	WindCustomPath: string,

	MoonIconSet: number,
	MoonUsePNGorSVG: boolean,
	MoonPNGSize: number,
	MoonCustomPath: string,
}


interface locations {
	IsActive: boolean,
	postcode: string,
	city: string,
	bundesland: string,
	useDailyForecast: boolean,
	useHourlyForecast: boolean
}

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {

			locations: locations[],
			ApiKey: string,
			parseInterval: number,
			parseTimeout: number,

			iconSet: number,
			UsePNGorOriginalSVG: boolean,
			UseColorOrBW: boolean,
			CustomPath: string,
			CustomPathExt: string,

			windiconSet: number,
			WindCustomPath: string,
			WindCustomPathExt: string,

			mooniconSet: number,
			MoonCustomPath: string,
			MoonCustomPathExt: string

		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};