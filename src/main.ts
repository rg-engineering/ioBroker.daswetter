/* eslint-disable prefer-template */
/*
 * Created with @iobroker/create-adapter v2.6.5
 */

/*
 neuen api key generieren, wenn dev fertig!!
 */

//https://www.iobroker.net/#en/documentation/dev/adapterdev.md

import * as utils from "@iobroker/adapter-core";
import Meteored from "./lib/meteored";

export class DasWetter extends utils.Adapter {
	private meteored: Meteored[] = [];
	private parseInterval: NodeJS.Timeout | null =null;
	

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: "daswetter",
		});
		this.on("ready", this.onReady.bind(this));
		// this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Initialize your adapter here

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.debug("config : " + JSON.stringify(this.config));
		
		for (let l = 0; l < this.config.locations.length; l++) {

			if (this.config.locations[l].IsActive) {
				const config = {
					name: "DasWetter_" + l,

					API_key: this.config.ApiKey,
					postcode: this.config.locations[l].postcode,
					city: this.config.locations[l].city,
					bundesland: this.config.locations[l].bundesland,
					language: this.language,
					dateFormat: this.dateFormat,
					parseTimeout: this.config.parseTimeout,
					useDailyForecast: this.config.locations[l].useDailyForecast,
					useHourlyForecast: this.config.locations[l].useHourlyForecast,

					IconSet: this.config.IconSet,
					UsePNGorSVG: this.config.UsePNGorSVG,
                    PNGSize: this.config.PNGSize,
					CustomPath: this.config.CustomPath,


					WindIconSet: this.config.WindIconSet,
					WindUsePNGorSVG: this.config.WindUsePNGorSVG,
					WindPNGSize: this.config.WindPNGSize,
					WindCustomPath: this.config.WindCustomPath,


					MoonIconSet: this.config.MoonIconSet,
					MoonUsePNGorSVG: this.config.MoonUsePNGorSVG,
					MoonPNGSize: this.config.MoonPNGSize,
					MoonCustomPath: this.config.MoonCustomPath,
					

				}
				this.log.debug("create instance of Meteored");
				const instance = new Meteored(this, l+1, config);

				this.meteored.push(instance);
			}
		}

		for (let n = 0; n < this.meteored.length; n++) {
			//muss auch in den cron / intervall
			await this.meteored[n].Start();
			await this.meteored[n].GetForecastHourly();
			await this.meteored[n].GetForecastDaily();
		}

		if (this.parseInterval) {
			clearInterval(this.parseInterval);
			this.parseInterval = null;
		}

		this.parseInterval = setInterval(() => {
			// Aufruf der async-Funktion und Fehler protokollieren, damit das Intervall nicht wegen einer unbehandelten Exception abstürzt
			(this.updateForecast.bind(this)()).catch((err: unknown) => {
				this.log.error("updateForecast error: " + (err instanceof Error ? err.stack || err.message : String(err)));
			});
		}, this.config.parseInterval * 60 * 1000);


	}


	async updateForecast(): Promise<void> {
		if (this.meteored !== undefined) {
			for (let n = 0; n < this.meteored.length; n++) {
				try {
					await this.meteored[n].GetForecastHourly();
					await this.meteored[n].GetForecastDaily();
					await this.meteored[n].CalculateData();

				} catch (err) {
					// Loggen und weiter mit dem nächsten Eintrag
					this.log.error(`Fehler beim Aktualisieren von Meteored[${n}]: ${err instanceof Error ? err.stack || err.message : String(err)}`);
				}
			}
		}
	}



	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			if (this.parseInterval) {
				clearInterval(this.parseInterval);
				this.parseInterval = null;
			}
			

			callback();
		} catch (e) {
            this.log.error("exception in onUnload " + e);
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  */
	// private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 */
	/*
	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);

           

		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}
	*/

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  */
	// private onMessage(obj: ioBroker.Message): void {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }


}

if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new DasWetter(options);
} else {
	// otherwise start the instance directly
	(() => new DasWetter())();
}