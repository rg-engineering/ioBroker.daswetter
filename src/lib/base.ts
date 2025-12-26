/* eslint-disable prefer-template */
import type { DasWetter } from "../main";

export default class Base {

    public adapter: DasWetter;
    id: number;
    name: string;

    constructor(adapter: DasWetter,id:number, name: string) {
        this.adapter = adapter;
        this.id = id;
        this.name = name;

        this.logDebug("instance created");

    }


    public logDebug(message: string): void {
        if (this.adapter != null) {
            this.adapter.log.debug(this.name + ": " + message);
        }
    }
    public logInfo(message: string): void {
        if (this.adapter != null) {
            this.adapter.log.info(this.name + ": " + message);
        }
    }
    public logError(message: string): void {
        if (this.adapter != null) {
            this.adapter.log.error(this.name + ": " + message);
        }
    }
    public logWarn(message: string): void {
        if (this.adapter != null) {
            this.adapter.log.warn(this.name + ": " + message);
        }
    }

    async CreateDatapoint(key: string, type: any, common_role: string, common_type: string, common_unit: string, common_read: boolean, common_write: boolean, common_desc: string): Promise<void> {

        const names = key.split(".");
        let idx = names.length;
        let name = key;
        if (idx > 0) {
            idx--;
            name = names[idx];
        }

        await this.adapter.setObjectNotExistsAsync(key, {
            type: type,
            common: {
                name: name,
                role: common_role,
                type: common_type,
                unit: common_unit,
                read: common_read,
                write: common_write,
                desc: common_desc
            },
            native: { id: key }
        });

        const obj = await this.adapter.getObjectAsync(key);

        if (obj != null) {

            if (obj.common.role != common_role
                || obj.common.type != common_type
                || obj.common.unit != common_unit
                || obj.common.read != common_read
                || obj.common.write != common_write
                || obj.common.name != name
                || obj.common.desc != common_desc
            ) {
                await this.adapter.extendObject(key, {
                    common: {
                        name: name,
                        role: common_role,
                        type: common_type,
                        unit: common_unit,
                        read: common_read,
                        write: common_write,
                        desc: common_desc
                    }
                });
            }
        }
    }

    async SetDefault(key: string, value: any): Promise<void> {
        const current = await this.adapter.getStateAsync(key);
        //set default only if nothing was set before
        if (current === null || current === undefined || current.val === undefined) {
            this.logInfo("set default " + key + " to " + value);
            await this.adapter.setState(key, { ack: true, val: value });
        }
    }
}