"use strict";
/* eslint-disable prefer-template */
/*
 * Created with @iobroker/create-adapter v2.6.5
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DasWetter = void 0;
/*
 neuen api key generieren, wenn dev fertig!!
 */
//https://www.iobroker.net/#en/documentation/dev/adapterdev.md
const utils = __importStar(require("@iobroker/adapter-core"));
const meteored_1 = __importDefault(require("./lib/meteored"));
class DasWetter extends utils.Adapter {
    meteored = [];
    parseInterval = null;
    constructor(options = {}) {
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
    async onReady() {
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
                    iconSet: this.config.iconSet,
                    UsePNGorOriginalSVG: this.config.UsePNGorOriginalSVG,
                    UseColorOrBW: this.config.UseColorOrBW,
                    CustomPath: this.config.CustomPath,
                    CustomPathExt: this.config.CustomPathExt,
                    windiconSet: this.config.windiconSet,
                    WindCustomPath: this.config.WindCustomPath,
                    WindCustomPathExt: this.config.WindCustomPathExt,
                    mooniconSet: this.config.mooniconSet,
                    MoonCustomPath: this.config.MoonCustomPath,
                    MoonCustomPathExt: this.config.MoonCustomPathExt
                };
                this.log.debug("create instance of Meteored");
                const instance = new meteored_1.default(this, l + 1, config);
                this.meteored.push(instance);
            }
        }
        for (let n = 0; n < this.meteored.length; n++) {
            //muss auch in den cron / intervall
            await this.meteored[n].Start();
            await this.meteored[n].GetForecastDaily();
            await this.meteored[n].GetForecastHourly();
        }
        this.parseInterval = setInterval(() => {
            // Aufruf der async-Funktion und Fehler protokollieren, damit das Intervall nicht wegen einer unbehandelten Exception abstürzt
            (this.updateForecast.bind(this)()).catch((err) => {
                this.log.error("updateForecast error: " + (err instanceof Error ? err.stack || err.message : String(err)));
            });
        }, this.config.parseInterval * 60 * 1000);
    }
    async updateForecast() {
        if (this.meteored !== undefined) {
            for (let n = 0; n < this.meteored.length; n++) {
                try {
                    await this.meteored[n].GetForecastDaily();
                    await this.meteored[n].GetForecastHourly();
                }
                catch (err) {
                    // Loggen und weiter mit dem nächsten Eintrag
                    this.log.error(`Fehler beim Aktualisieren von Meteored[${n}]: ${err instanceof Error ? err.stack || err.message : String(err)}`);
                }
            }
        }
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            if (this.parseInterval) {
                clearInterval(this.parseInterval);
            }
            callback();
        }
        catch (e) {
            this.log.error("exception in onUnload " + e);
            callback();
        }
    }
}
exports.DasWetter = DasWetter;
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new DasWetter(options);
}
else {
    // otherwise start the instance directly
    (() => new DasWetter())();
}
//# sourceMappingURL=main.js.map