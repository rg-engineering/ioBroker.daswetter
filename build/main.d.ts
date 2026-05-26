import * as utils from "@iobroker/adapter-core";
export declare class DasWetter extends utils.Adapter {
    private meteored;
    private parseInterval;
    private updateInterval;
    private updateTimeout;
    constructor(options?: Partial<utils.AdapterOptions>);
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private onReady;
    updateForecast(): Promise<void>;
    scheduleHourlyTask(): void;
    runTask(): Promise<void>;
    copyCurrentHour(): Promise<void>;
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload;
    /**
     * Is called if a subscribed state changes
     */
    private onMessage;
}
