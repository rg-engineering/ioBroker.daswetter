/* eslint-disable prefer-template */
/* eslint-disable quote-props */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState } from 'react';
import type { AdminConnection, IobTheme, ThemeName, ThemeType } from '@iobroker/adapter-react-v5';
import type { DasWetterAdapterConfig, SymbolDescription } from "../types";

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

    symboldescription: SymbolDescription[] | null;
}

export default function SymbolSettings(props: SettingsProps): React.JSX.Element {

    console.log("SymbolsSettings render: " + JSON.stringify(props.native));

    const onUpdate = (
        IconSet: number,
        CustomPath: string,
        UsePNGorSVG: boolean,
        PNGSize: number
    ) => {
        const newNative = { ...props.native };
        newNative.IconSet = IconSet;
        newNative.CustomPath = CustomPath;
        newNative.UsePNGorSVG = UsePNGorSVG;
        newNative.PNGSize = PNGSize;
        props.changeNative(newNative);
    };

  




    return (
        <div style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>
            <div style={{ marginBottom: 12 }}>

                <SelectIconSet
                    socket={props.socket}
                    adapterName={props.adapterName}

                    basepath="icons/weather/gallery"
                    NoOfGalleries={8}

                    IconSet={props.native.IconSet}
                    CustomPath={props.native.CustomPath}
                    UsePNGorSVG={props.native.UsePNGorSVG}
                    PNGSize={props.native.PNGSize}

                    onChange={onUpdate}

                    symboldescription={props.symboldescription}

                />
            </div>
        </div>
    );
}