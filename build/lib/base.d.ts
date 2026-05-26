import type { DasWetter } from "../main";
export default class Base {
    adapter: DasWetter;
    id: number;
    name: string;
    constructor(adapter: DasWetter, id: number, name: string);
    logDebug(message: string): void;
    logInfo(message: string): void;
    logError(message: string): void;
    logWarn(message: string): void;
    CreateDatapoint(key: string, type: any, common_role: string, common_type: string, common_unit: string, common_read: boolean, common_write: boolean, common_desc: string): Promise<void>;
    SetDefault(key: string, value: any): Promise<void>;
}
