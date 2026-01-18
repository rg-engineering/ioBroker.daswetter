/* eslint-disable prettier/prettier */
/* eslint-disable prefer-template */
/* eslint-disable quote-props */

import React from 'react';

import type { AdminConnection, IobTheme, ThemeName, ThemeType } from '@iobroker/adapter-react-v5';
import { type ConfigItemPanel, JsonConfigComponent } from '@iobroker/json-config';
import type { DasWetterAdapterConfig } from "../types";


interface SettingsProps {
    common: ioBroker.InstanceCommon;
    native: DasWetterAdapterConfig;
    instance: number;
    adapterName: string;
    socket: AdminConnection;
    changeNative: (native: ioBroker.AdapterConfig) => void;
    themeName: ThemeName;
    themeType: ThemeType;
    theme: IobTheme;
    systemConfig: ioBroker.SystemConfigObject;
    alive: boolean;
}


const schema: ConfigItemPanel = {
    "type": "panel",
    "label": "Main settings",
    "items": {
        "icontest": {
            "type": "staticImage",
            "src": "./daswettercom.png",
            "newLine": true,
            "xs": 12,
            "sm": 2,
            "md": 2,
            "lg": 1,
            "xl": 1
        },
        "meteoredURL": {
            "type": "staticInfo",
            "text": "<a href='https://dashboard.meteored.com/de' target='_blank'>🌤 Meteored Dashboard</a>",
            "icon": "info",
            "newLine": false,
            "data": "", 
            "xs": 12,
            "sm": 12,
            "md": 6,
            "lg": 4,
            "xl": 4
        },
        "dividerHdr1": {
            "newLine": true,
            "type": "header",
            "text": "general configuration",
            "size": 2
        },
        "ApiKey": {
            "newLine": true,
            "type": "text",
            "label": "api key",
            "help": "API key from DasWetter website",
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "parseInterval": {
            "newLine": true,
            "type": "number",
            "label": "parse_interval",
            "help": "parse interval in [min]",
            "min": 40,
            "max": 1440,
            "default": 240,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },
        "parseTimeout": {
            "newLine": false,
            "type": "number",
            "label": "parse_timeout",
            "help": "maximim parse timeout before no response error [sec]",
            "min": 10,
            "max": 60,
            "default": 10,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },

        "CopyCurrentHour": {
            "newLine": true,
            "type": "checkbox",
            "label": "copy current hour",
            "help": "copy data of current hour to separate DP's",
            "default": false,
            "xs": 12,
            "sm": 12,
            "md": 4,
            "lg": 4,
            "xl": 4
        },


        "dividerHdr2": {
            "newLine": true,
            "type": "header",
            "text": "location configuration",
            "size": 2
        },
        "locations": {
            "type": "table",
            "newLine": true,
            "xs": 12,
            "sm": 12,
            "md": 12,
            "lg": 12,
            "xl": 12,
            "label": "location settings",
            "showSecondAddAt": 5,
            "noDelete": false,
            "items": [
                {
                    "type": "checkbox",
                    "attr": "IsActive",
                    "width": "5% ",
                    "title": "IsActive",
                    "tooltip": "enable location",
                    "filter": false,
                    "sort": false,
                    "default": false
                },
                {
                    "type": "text",
                    "attr": "postcode",
                    "width": "20% ",
                    "title": "postcode",
                    "tooltip": "postcode of location",
                    "filter": false,
                    "sort": false,
                    "default": false
                },
                {
                    "type": "text",
                    "attr": "city",
                    "width": "25% ",
                    "title": "city",
                    "tooltip": "city of location",
                    "filter": false,
                    "sort": false,
                    "default": false
                },
                {
                    "type": "text",
                    "attr": "bundesland",
                    "width": "20% ",
                    "title": "bundesland",
                    "tooltip": "optional: bundesland/state for description filter (e.g. Saxony-Anhalt, Saxony, Baden-Württemberg, Bavaria, Thuringia, Brandenburg)",
                    "filter": false,
                    "sort": false,
                    "default": ""
                },
                {
                    "type": "checkbox",
                    "attr": "useDailyForecast",
                    "width": "5% ",
                    "title": "useDailyForecast",
                    "tooltip": "enable download of daily forecast",
                    "filter": false,
                    "sort": false,
                    "default": true
                },
                {
                    "type": "checkbox",
                    "attr": "useHourlyForecast",
                    "width": "5% ",
                    "title": "useHourlyForecast",
                    "tooltip": "enable download of hourly forecast",
                    "filter": false,
                    "sort": false,
                    "default": true
                }
            ]
        }
    }
}


export default function MainSettings(props: SettingsProps): React.JSX.Element {


    console.log("settings: " + JSON.stringify(props.native));

    return (
        <div style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>
            <JsonConfigComponent
                common={props.common}
                socket={props.socket}
                themeName={props.themeName}
                themeType={props.themeType}
                adapterName="daswetter"
                instance={props.instance || 0}
                isFloatComma={props.systemConfig.common.isFloatComma}
                dateFormat={props.systemConfig.common.dateFormat}
                schema={schema}
                onChange={(params): void => {

                    console.log("MainSettings onChange params: " + JSON.stringify(params));

                    const native: DasWetterAdapterConfig = JSON.parse(JSON.stringify(props.native));
                    //console.log("MainSettings onChange native: " + JSON.stringify(native));

                    //Daten kopieren

                    native.locations = params.locations;
                    native.ApiKey = params.ApiKey;
                    native.parseInterval = params.parseInterval;
                    native.parseTimeout = params.parseTimeout;
                    native.CopyCurrentHour = params.CopyCurrentHour;
                    
                    props.changeNative(native);
                }}
                //data={props.native.params}
                data={props.native}
                onError={() => {}}
                theme={props.theme}
                withoutSaveButtons
            />
        </div>
    );
}
