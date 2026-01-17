/* eslint-disable prefer-template */
/* eslint-disable quote-props */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState } from 'react';
import type { AdminConnection } from '@iobroker/adapter-react-v5';
import { I18n } from '@iobroker/adapter-react-v5';


import type { SelectChangeEvent } from '@mui/material';

import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    TextField
} from '@mui/material';

interface SettingsProps {
   
    adapterName: string;
    socket: AdminConnection;
    basepath: string;
    NoOfGalleries: number;

    IconSet?: number;
    CustomPath?: string;
    UsePNGorSVG?: boolean;
    PNGSize?: number;

    onChange: (IconSet: number,
        CustomPath: string,
        UsePNGorSVG: boolean,
        PNGSize: number) => void;
}

export default function SymbolSettings(props: SettingsProps): React.JSX.Element {

    // Initiale Werte: erst aus props.native, dann aus Einzelprops, sonst Defaults
    const [IconSet, setIconSet] = useState<number>(() =>  props.IconSet ?? 1);
    const [CustomPath, setCustomPath] = useState<string>(() =>  props.CustomPath ?? '');
    const [UsePNGorSVG, setUsePNGorSVG] = useState<boolean>(() =>  props.UsePNGorSVG ?? true);
    const [PNGSize, setPNGSize] = useState<number>(() =>  props.PNGSize ?? 1);

    // state für geladene dateien
    const [iconFiles, setIconFiles] = useState<string[]>([]);

    

    // Lädt Dateien aus dem Adapter-Ordner
    const loadIconFiles = async (): Promise<void> => {
        let basePath = '';
        if (IconSet !== 99) {
            basePath = `${props.basepath}${IconSet}/`;
            if (UsePNGorSVG) {
                basePath += 'png/';
                if (PNGSize === 1) {
                    basePath += '28x28';
                } else if (PNGSize === 2) {
                    basePath += '64x64';
                } else if (PNGSize === 3) {
                    basePath += '128x128';
                }
            } else {
                basePath += 'svg';
            }
        } else {
            basePath = CustomPath && CustomPath.length > 0
                ? CustomPath.replace(/\/$/, '')
                : `${props.basepath}1/svg`;
        }

        try {
            // eslint-disable-next-line no-console
            console.log(`adapter.${props.adapterName}`);
            const entries = await props.socket.readDir(`${props.adapterName}.admin`, basePath);

            let ext = '.svg';
            if (UsePNGorSVG) {
                ext = '.png';
            }

            const svgs = entries
                .filter(e => !e.isDir && e.file?.endsWith(ext))
                .map(e => `${basePath}/${e.file}`);

            // eslint-disable-next-line no-console
            console.log(`Loaded ${svgs.length} icons from ${basePath}`);
            // eslint-disable-next-line no-console
            console.log(svgs);
            setIconFiles(svgs);

        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`Failed to load icons from ${basePath}`, err);
            setIconFiles([]);
        }
    };

    // Effekte: initial und bei Änderungen relevanter States
    useEffect(() => {
        loadIconFiles()
            .catch(err => {
                // eslint-disable-next-line no-console
                console.error(err);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [IconSet, CustomPath, UsePNGorSVG, PNGSize, props.basepath, props.adapterName]);

    // Handler: ändern lokalen State + Parent informieren (wenn vorhanden)
    const handleChangeSymbol = (event: SelectChangeEvent<number>) => {
        const value = Number(event.target.value);
        setIconSet(value);

        // notify parent with full argument list
        props.onChange(value, CustomPath, UsePNGorSVG, PNGSize);
    };

    const handleChangePngOrSvg = (event: React.ChangeEvent<HTMLInputElement>, checked: boolean): void => {
        const value = typeof checked === 'boolean' ? checked : event.target.checked;
        setUsePNGorSVG(value);

        props.onChange(IconSet, CustomPath, value, PNGSize);
    };

    const handleChangeCustomPath = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
        const value = event.target.value ?? '';
        setCustomPath(value);

        props.onChange(IconSet, value, UsePNGorSVG, PNGSize);
    };

    const handleChangePNGSize = (event: SelectChangeEvent<number>) => {
        const value = Number(event.target.value);
        setPNGSize(value);

        props.onChange(IconSet, CustomPath, UsePNGorSVG, value);
    };

    // Galerie Items
    const galleryCount = Math.max(0, props.NoOfGalleries ?? 0);
    const galleryItems = Array.from({ length: galleryCount }, (_, idx) => {
        const i = idx + 1;
        return (
            <MenuItem value={i} key={i}>
                <em>{I18n.t('gallery' + i)}</em>
            </MenuItem>
        );
    });



    return (
        <div style={{ width: 'calc(100% - 8px)', minHeight: '100%' }}>
            <div style={{ marginBottom: 12 }}>
                <FormControl variant="standard" sx={{ minWidth: '40%', maxWidth: '60%' }} >
                    <InputLabel id="room-selector-label">{I18n.t('select a icon set')}</InputLabel>
                    <Select <number>
                        labelId="room-selector-label"
                        value={IconSet ?? 1}
                        onChange={handleChangeSymbol}
                        displayEmpty
                    >
                        {galleryItems}

                        <MenuItem value={99}>
                            <em>{I18n.t('custom')}</em>
                        </MenuItem>

                    </Select>
                </FormControl>
            </div>

            <div>
                <FormControlLabel
                    control={
                        <Checkbox
                            color="primary"
                            checked={UsePNGorSVG}
                            onChange={handleChangePngOrSvg}
                            aria-label="use_png_or_svg"
                        />
                    }
                    label={I18n.t('use_png_or_svg')}
                />

                {UsePNGorSVG && IconSet !== 99 && (
                    <FormControl variant="standard" sx={{ minWidth: '40%', maxWidth: '60%' }} >
                        <InputLabel id="PNGSize-selector-label">{I18n.t('select a PNG size')}</InputLabel>
                        <Select
                            labelId="PNGSize-selector-label"
                            value={PNGSize ?? 1}
                            onChange={handleChangePNGSize}
                            displayEmpty
                        >
                            <MenuItem value={1}>
                                <em>{I18n.t('28*28')}</em>
                            </MenuItem>
                            <MenuItem value={2}>
                                <em>{I18n.t('64*64')}</em>
                            </MenuItem>
                            <MenuItem value={3}>
                                <em>{I18n.t('128*128')}</em>
                            </MenuItem>

                        </Select>
                    </FormControl>
                )}


            </div>

            {IconSet === 99 && (
                <TextField
                    style={{ marginBottom: 16 }}
                    id='CustomPath'
                    label={I18n.t('custom_path')}
                    variant="standard"
                    value={CustomPath ? String(CustomPath) : ""}
                    onChange={handleChangeCustomPath}
                    sx={{ mb: 2, maxWidth: '30%' }}
                />
            )}

            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {iconFiles.length === 0 ? (
                    <div style={{ color: '#888' }}>{I18n.t('no_icons_found')}</div>
                ) : (
                    iconFiles.map((src) => (
                        <div key={src} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <img
                                src={src}
                                alt={src}
                                style={{ width: 48, height: 48, objectFit: 'contain', border: '1px solid #ccc', padding: 4, background: '#fff' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />
                            <div style={{ maxWidth: 120, fontSize: 11, color: '#666', textAlign: 'center', wordBreak: 'break-all' }}>{src}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}