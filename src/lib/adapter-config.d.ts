// This file extends the AdapterConfig type from "@types/iobroker"

//ist das gleiche interface wie in types.d.ts
export interface DasWetterConfig {
	name: string; //translated names from enum in ioBroker
	API_key: string; //api key based on account
	postcode: string;//postcode for location
	city: string;
}


// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			dummy: string
			
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};