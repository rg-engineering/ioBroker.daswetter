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


interface SymbolDescription {
	id: number,
	description: string;
};   


export interface DasWetterAdapterConfig extends ioBroker.AdapterConfig {
    /** Configuration of the adapter */

	locations: locations[],
	ApiKey: string,
	parseInterval: number,
	parseTimeout: number,

	IconSet: number,
    IconType: number,
    PNGSize: number,
	CustomPath: string,
	
	WindIconSet: number,
	WindIconType:number,
    WindPNGSize: number,
	WindCustomPath: string,

	MoonIconSet: number,
	MoonIconType: number,
    MoonPNGSize: number,
	MoonCustomPath: string,

    CopyCurrentHour: boolean,


}