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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DasWetter = void 0;
//import { Adapter, type AdapterOptions, getAbsoluteDefaultDataDir } from '@iobroker/adapter-core';
const utils = __importStar(require("@iobroker/adapter-core"));
// Load your modules here, e.g.:
// import * as fs from "fs";
class DasWetter extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: "daswetter",
        });
        this.on("ready", this.onReady.bind(this));
        this.on("stateChange", this.onStateChange.bind(this));
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
        this.log.info("config : " + JSON.stringify(this.config));
        //this.log.info("config option2: " + this.config.option2);
        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */
        /*
        await this.setObjectNotExistsAsync("testVariable", {
            type: "state",
            common: {
                name: "testVariable",
                type: "boolean",
                role: "indicator",
                read: true,
                write: true,
            },
            native: {},
        });
        */
        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        //this.subscribeStates("testVariable");
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates("lights.*");
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates("*");
        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        //await this.setStateAsync("testVariable", true);
        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync("testVariable", { val: true, ack: true });
        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });
        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync("admin", "iobroker");
        //this.log.info("check user admin pw iobroker: " + result);
        //result = await this.checkGroupAsync("admin", "admin");
        //this.log.info("check group user admin group admin: " + result)
        //create path if  not exists
        // /opt/iobroker/iobroker-data/files/ai-heatingcontrol/data
        //try {
        //	await this.mkdirAsync(null, "files/ai-heatingcontrol/data");
        //} catch (err) {
        //	this.log.warn("exception while creating folder " + err);
        //}
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
            // clearInterval(interval1);
            callback();
        }
        catch (e) {
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
    async onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        }
        else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
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