/* eslint-disable prettier/prettier */
//ist das gleiche interface wie in adapter-config.d.ts


interface locations {
    IsActive: boolean,
    postcode: string,
    city: string,
    bundesland: string,
    useDailyForecast: boolean,
    useHourlyForecast: boolean
}


export interface DasWetterAdapterConfig extends ioBroker.AdapterConfig {
    /** Configuration of the adapter */

	locations: locations[],
	ApiKey: string,
	parseInterval: number,
	parseTimeout: number,

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