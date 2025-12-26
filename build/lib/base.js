"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Base {
    adapter;
    id;
    name;
    constructor(adapter, id, name) {
        this.adapter = adapter;
        this.id = id;
        this.name = name;
        this.logDebug("instance created");
    }
    logDebug(message) {
        if (this.adapter != null) {
            this.adapter.log.debug(this.name + ": " + message);
        }
    }
    logInfo(message) {
        if (this.adapter != null) {
            this.adapter.log.info(this.name + ": " + message);
        }
    }
    logError(message) {
        if (this.adapter != null) {
            this.adapter.log.error(this.name + ": " + message);
        }
    }
    logWarn(message) {
        if (this.adapter != null) {
            this.adapter.log.warn(this.name + ": " + message);
        }
    }
    async CreateDatapoint(key, type, common_role, common_type, common_unit, common_read, common_write, common_desc) {
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
                || obj.common.desc != common_desc) {
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
    async SetDefault(key, value) {
        const current = await this.adapter.getStateAsync(key);
        //set default only if nothing was set before
        if (current === null || current === undefined || current.val === undefined) {
            this.logInfo("set default " + key + " to " + value);
            await this.adapter.setState(key, { ack: true, val: value });
        }
    }
}
exports.default = Base;
//# sourceMappingURL=base.js.map