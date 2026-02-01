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

export default function WindSymbolSettings(props: SettingsProps): React.JSX.Element {

    console.log("WindSymbolsSettings render: " + JSON.stringify(props.native));

    const onUpdate = (
        IconSet: number,
        CustomPath: string,
        IconType: number,
        PNGSize: number
    ) => {
        const newNative = { ...props.native };
        newNative.WindIconSet = IconSet;
        newNative.WindCustomPath = CustomPath;
        newNative.WindIconType = IconType;
        newNative.WindPNGSize = PNGSize;
        props.changeNative(newNative);
    };



    return (
        <div style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>

            <SelectIconSet

                socket={props.socket}
                adapterName={props.adapterName}
           
                basepath="icons/wind/gallery"
                NoOfGalleries={3}

                IconSet={props.native.WindIconSet}
                CustomPath={props.native.WindCustomPath}
                IconType={props.native.WindIconType}
                PNGSize={props.native.WindPNGSize}

                symboldescription={null}

                onChange={onUpdate}

            />
        </div>
    );
}