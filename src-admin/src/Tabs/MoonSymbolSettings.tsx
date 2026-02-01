/* eslint-disable prefer-template */
/* eslint-disable quote-props */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState } from 'react';
import type { AdminConnection, IobTheme, ThemeName, ThemeType } from '@iobroker/adapter-react-v5';
import type { DasWetterAdapterConfig } from "../types";

import SelectIconSet from '../Components/SelectIconSet';

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
    rooms?: Record<string, ioBroker.EnumObject>;
    alive: boolean;
}

export default function MoonSymbolSettings(props: SettingsProps): React.JSX.Element {

    console.log("MoonSymbolsSettings render: " + JSON.stringify(props.native));

    const onUpdate = (
        IconSet: number,
        CustomPath: string,
        IconType: number,
        PNGSize: number
    ) => {
        const newNative = { ...props.native };
        newNative.MoonIconSet = IconSet;
        newNative.MoonCustomPath = CustomPath;
        newNative.MoonIconType = IconType;
        newNative.MoonPNGSize = PNGSize;
        props.changeNative(newNative);
    };

    return (
        <div style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>

            <SelectIconSet
                socket={props.socket}
                adapterName={props.adapterName}

                basepath="icons/moon/gallery"
                NoOfGalleries={1}

                IconSet={props.native.MoonIconSet}
                CustomPath={props.native.MoonCustomPath}
                IconType={props.native.MoonIconType}
                PNGSize={props.native.MoonPNGSize}
                symboldescription={null}

                onChange={onUpdate}
            />

       </div>     
    );
}