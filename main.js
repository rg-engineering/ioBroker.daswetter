/*
 * DasWetter.com adapter für iobroker
 *
 * Created: 21.03.2017 21:31:28
 *  Author: Rene

Copyright(C)[2017 - 2020][René Glaß]

*/

/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
"use strict";


const utils = require("@iobroker/adapter-core");

let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: "daswetter",
        ready: async function () {
            try {
                //adapter.log.debug("start");
                await main();
            }
            catch (e) {
                adapter.log.error("exception catch after ready [" + e + "]");
            }
        },
        //#######################################
        //  is called when adapter shuts down
        unload: function (callback) {
            try {
                adapter && adapter.log && adapter.log.info && adapter.log.info("cleaned everything up...");
                callback();
            } catch (e) {
                callback();
            }



        },
        //#######################################
        //
        //SIGINT: function () {
        //    adapter && adapter.log && adapter.log.info && adapter.log.info("cleaned everything up...");
        //},
        //#######################################
        //  is called if a subscribed object changes
        //objectChange: function (id, obj) {
        //    adapter.log.debug("[OBJECT CHANGE] ==== " + id + " === " + JSON.stringify(obj));
        //},
        //#######################################
        // is called if a subscribed state changes
        //stateChange: function (id, state) {
        //adapter.log.debug("[STATE CHANGE] ==== " + id + " === " + JSON.stringify(state));
        //HandleStateChange(id, state);
        //}
    });

    adapter = new utils.Adapter(options);

    return adapter;
}


//const bent = require("bent");
const axios = require('axios');
const xml2js = require("xml2json-light");

let killTimer;

async function main() {
    // force terminate
    let nParseTimeout = 60;
    if (adapter.config.parseTimeout > 0) {
        nParseTimeout = adapter.config.parseTimeout;
    }
    adapter.log.debug("set timeout to " + nParseTimeout + " sec");
    nParseTimeout = nParseTimeout * 1000;
    killTimer = setTimeout(function () {
        //adapter.log.error("force terminate, objects still in list: " + tasks.length);
        adapter.log.error("force terminate");
        adapter.terminate ? adapter.terminate(15) : process.exit(15);
    }, nParseTimeout);



    await getForecastData7Days();
    await getForecastData5Days();
    await getForecastDataHourly();
    await getForecastDataHourlyJSON();


    adapter.log.debug("exit, all done");

    if (killTimer) {
        clearTimeout(killTimer);
        adapter.log.debug("timer killed");
    }
    adapter.terminate ? adapter.terminate('All data handled, adapter stopped until next scheduled moment') : process.exit(0);
}

function getIconUrl(num) {
    const iconSet = parseInt(adapter.config.iconSet, 10) || 6;
    num = parseInt(num, 10) || 0;
    let url = "";
    let ext = "";
    if (num) {

        if (iconSet == 7) {//custom
            url = adapter.config.CustomPath;
            ext = adapter.config.CustomPathExt;
        }
        else {
            url = "/adapter/daswetter/icons/tiempo-weather/galeria" + iconSet + "/";
            ext = (iconSet < 5 || adapter.config.UsePNGorOriginalSVG) ? ".png" : ".svg";

            //adapter.log.debug('getIconURL ' + num + ' " + adapter.config.UsePNGorOriginalSVG + ' ' + adapter.config.UseColorOrBW);

            if (iconSet === 5) {
                if (adapter.config.UsePNGorOriginalSVG) {
                    url = url + "PNG/";
                } else {
                    url = url + "SVG/";
                }

                if (adapter.config.UseColorOrBW) {
                    url = url + "Color/";
                } else {
                    url = url + "White/";
                }
            }
        }
        url = url + num + ext;
    }
    return url;
}

function getWindIconUrl(num) {
    const iconSet = adapter.config.windiconSet;
    let url = "";
    let ext = "";
    num = parseInt(num, 10) || 0;
    if (num) {
        if (iconSet == "custom") {
            url = adapter.config.WindCustomPath;
            ext = adapter.config.WindCustomPathExt;
        }
        else {
            url = "/adapter/daswetter/icons/viento-wind/" + iconSet + "/";
            ext = ".png";
        }

        return url + num + ext;
        //return '/adapter/daswetter/icons/viento-wind/' + num + '.png';
    } else {
        return "";
    }
}

function getMoonIconUrl(num) {
    const iconSet = adapter.config.mooniconSet;
    let url = "";
    let ext = "";
    num = parseInt(num, 10) || 0;
    if (num) {
        if (iconSet == "custom") {
            url = adapter.config.MoonCustomPath;
            ext = adapter.config.MoonCustomPathExt;
        }
        else {
            url = "/adapter/daswetter/icons/luna-moon/";
            ext = ".png";
        }

        return url + num + ext;
    } else {
        return "";
    }
}

async function getprops(obj, keyName) {
    //rückwärts parsen, dann kommt unit for dem wert und kann somit in die liste eingetragen werden

    //adapter.log.debug("getprops " + JSON.stringify(obj) + " ### " + keyName);

    const arr = [];
    let unit = "";
    for (const prop in obj) {

        //adapter.log.debug("#### " + prop + " " + typeof obj[prop] + " " + JSON.stringify(obj[prop]));

        if (typeof obj[prop] !== "object" && prop !== "data_sequence") {
            arr.push(prop);
        }

    }

    //adapter.log.debug("array " + JSON.stringify(arr));


    for (let i = arr.length - 1; i >= 0; i--) {
        const dataValue = obj[arr[i]];
        if (arr[i] === "unit") {
            //parse unit
            unit = dataValue.replace(/\s/g, "_");

            //adapter.log.debug('got unit '  + dataValue);
        }
        else {
            const keyNameLong = keyName + "_" + arr[i].replace(/\s/g, "_");
            await insertIntoList(keyNameLong, dataValue, unit);
            unit = "";
        }
    }
}


async function getForecastData7Days() {
    if (adapter.config.Days7Forecast) {

        try {
            const url = adapter.config.Days7Forecast;
            adapter.log.debug("calling forecast 7 days: " + url);

            //const getBuffer = bent("string");
            //const buffer = await getBuffer(url);

            const buffer = await axios.get(url);

            adapter.log.debug("got response " + buffer.data);

            //convert xml to json first
            const result = xml2js.xml2json(buffer.data);
            //adapter.log.debug("result " + JSON.stringify(res));

            adapter.log.debug("result " + JSON.stringify(result));

            const numOfLocations = 1;

            adapter.log.debug("number of location " + numOfLocations);

            for (let l = 0; l < numOfLocations; l++) {
                const ll = l + 1;

                let location = result.report.location.city;
                const pos = location.indexOf("[");
                if (pos !== -1) {
                    location = location.substring(0, pos).trim();
                }

                await insertIntoList("NextDays.Location_" + ll + ".Location", location);

                // sometimes variable has name not const but var
                const vars = result.report.location.const || result.report.location.var;

                const numOfPeriods = vars[0].data.forecast.length;

                const obj = {
                    type: "device",
                    common: {
                        name: result.report.location.city,
                        role: "weather"
                    }
                };
                await insertIntoList("NextDays.Location_" + ll, null, "", obj);

                adapter.log.debug("number of periods " + numOfPeriods);

                for (let p = 0; p < numOfPeriods; p++) {
                    const pp = p + 1;


                    const obj = {
                        type: "channel",
                        common: {
                            name: "Day " + pp,
                            role: "weather"
                        }
                    };

                    await insertIntoList("NextDays.Location_" + ll + ".Day_" + pp, null, "", obj);

                    const numOfDatapoints = vars.length;

                    adapter.log.debug("number of datapoints " + numOfDatapoints);

                    for (let d = 0; d < numOfDatapoints; d++) {
                        const datapointName = vars[d].name.replace(/\s/g, "_");
                        const keyName = "NextDays.Location_" + ll + ".Day_" + pp + "." + datapointName;
                        const value = vars[d].data.forecast[p];
                        await getprops(value, keyName);
                        if (datapointName === "Wetter_Symbol" && value.id2) {
                            await insertIntoList("NextDays.Location_" + ll + ".Day_" + pp + ".iconURL", getIconUrl(value.id2));
                        } else if (datapointName === "Wind" && value.idB) {
                            await insertIntoList("NextDays.Location_" + ll + ".Day_" + pp + ".windIconURL", getWindIconUrl(value.idB));
                        }
                    }
                }
            }

            //adapter.log.debug("7 days forecast done, objects in list " + tasks.length);
            adapter.log.debug("7 days forecast done");

        } catch (e) {
            adapter.log.error("exception in 7DaysForecast [" + e + "]");

        }

    }
}

async function getForecastData5Days() {
    if (adapter.config.Days5Forecast) {
        try {
            const url = adapter.config.Days5Forecast;
            adapter.log.debug("calling forecast 5 days: " + url);

            //const getBuffer = bent("string");
            //const buffer = await getBuffer(url);
            const buffer = await axios.get(url);

            adapter.log.debug("got response " + buffer.data);



            //adapter.log.debug('got body: ' + body);
            const body1 = buffer.data.replace(/wind-gusts/g, "windgusts");

            const result = xml2js.xml2json(body1);

            adapter.log.debug("result " + JSON.stringify(result));

            //const numOfLocations = result.report.location.length;
            const numOfLocations = 1;

            adapter.log.debug("number of locations " + numOfLocations);

            for (let l = 0; l < numOfLocations; l++) {

                const ll = l + 1;

                let location = result.report.location.city;
                const pos = location.indexOf("[");
                if (pos !== -1) {
                    location = location.substring(0, pos).trim();
                }

                await insertIntoList("NextDaysDetailed.Location_" + ll + ".Location", location);

                const obj = {
                    type: "device",
                    common: {
                        name: result.report.location.city,
                        role: "weather"
                    }
                };

                await insertIntoList("NextDaysDetailed.Location_" + ll, null, "", obj);

                const numOfDays = result.report.location.day.length;

                adapter.log.debug("number of days " + numOfDays);

                for (let d = 0; d < numOfDays; d++) {

                    let keyName = "";

                    const dd = d + 1;

                    const obj = {
                        type: "channel",
                        common: {
                            name: "Day " + dd,
                            role: "weather"
                        }
                    };

                    await insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd, null, "", obj);

                    let value = result.report.location.day[d];
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".day";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].symbol;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".symbol";
                    await getprops(value, keyName);

                    //add url for icon
                    await insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".iconURL", getIconUrl(value.value));

                    value = result.report.location.day[d].tempmin;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".tempmin";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].tempmax;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".tempmax";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].wind;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".wind";
                    await getprops(value, keyName);

                    //add url for icon
                    await insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".windIconURL", getWindIconUrl(value.symbolB));

                    value = result.report.location.day[d].windgusts;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".windgusts";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].rain;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".rain";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].humidity;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".humidity";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].pressure;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".pressure";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].snowline;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".snowline";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].sun;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".sun";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].moon;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".moon";
                    await getprops(value, keyName);
                    //add url for icon
                    await insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".moonIconURL", getMoonIconUrl(value.symbol));

                    value = result.report.location.day[d].uv_index_max;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".uv_index_max";
                    await getprops(value, keyName);


                    value = result.report.location.day[d].local_info;
                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".local_info";
                    await getprops(value, keyName);

                    const numOfHours = result.report.location.day[d].hour.length;

                    adapter.log.debug("number of hours " + numOfHours);

                    for (let h = 0; h < numOfHours; h++) {

                        //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                        const hh = h + 1;


                        const obj = {
                            type: "channel",
                            common: {
                                common: {
                                    name: "Hour " + hh,
                                    role: "weather"
                                }
                            }
                        };

                        await insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh, null, "", obj);

                        value = result.report.location.day[d].hour[h];
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".hour";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].temp;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].symbol;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                        await getprops(value, keyName);

                        //add url for icon
                        await insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".iconURL", getIconUrl(value.value));

                        value = result.report.location.day[d].hour[h].wind;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind";
                        await getprops(value, keyName);

                        //add url for icon
                        await insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windIconURL", getWindIconUrl(value.symbolB));

                        value = result.report.location.day[d].hour[h].windgusts;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windgusts";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].rain;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].humidity;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].pressure;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].clouds;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].snowline;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".snowline";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].windchill;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                        await getprops(value, keyName);

                        value = result.report.location.day[d].hour[h].uv_index;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".uv_index";
                        await getprops(value, keyName);
                    }
                }
            }

            //adapter.log.debug("5 days forecast done, objects in list " + tasks.length);
            adapter.log.debug("5 days forecast done");

        } catch (e) {
            adapter.log.error("exception in 5DaysForecast [" + e + "]");

        }
    }
}

async function getForecastDataHourly() {

    if (adapter.config.HourlyForecast) {

        try {
            const url = adapter.config.HourlyForecast;
            adapter.log.debug("calling forecast hourly: " + url);

            //const getBuffer = bent("string");
            //const buffer = await getBuffer(url);
            const buffer = await axios.get(url);

            adapter.log.debug("got response " + buffer.data);

            const body1 = buffer.data.replace(/wind-gusts/g, "windgusts");

            const result = xml2js.xml2json(body1);

            adapter.log.debug("result " + JSON.stringify(result));

            //const numOfLocations = result.report[0].location.length;
            const numOfLocations = 1;

            adapter.log.debug("number of locations " + numOfLocations);

            for (let l = 0; l < numOfLocations; l++) {

                const ll = l + 1;

                let location = result.report.location.city;
                const pos = location.indexOf("[");
                if (pos !== -1) {
                    location = location.substring(0, pos).trim();
                }

                await insertIntoList("NextHours.Location_" + ll + ".Location", location);

                const obj = {
                    type: "channel",
                    common: {
                        name: result.report.location.city,
                        role: "weather"
                    }
                };

                await insertIntoList("NextHours.Location_" + ll, null, "", obj);

                const numOfDays = result.report.location.day.length;

                const CurrentDate = new Date();
                const CurrentHour = CurrentDate.getHours();

                let inXhours = -1;
                let inXhours2Check = -1;
                let inXdays2Check = -1;
                if (parseInt(adapter.config.createInXHour) === 1) {
                    inXhours = 1;
                    if (CurrentHour < 23) {
                        inXhours2Check = CurrentHour + 1;
                        inXdays2Check = 1;
                    }
                    else {
                        inXhours2Check = 1;
                        inXdays2Check = 2;
                    }
                }
                else if (parseInt(adapter.config.createInXHour) === 2) {
                    inXhours = 2;
                    if (CurrentHour < 22) {
                        inXhours2Check = CurrentHour + 2;
                        inXdays2Check = 1;
                    }
                    else {
                        inXhours2Check = 24 - CurrentHour + 2;
                        inXdays2Check = 2;
                    }
                }
                else if (parseInt(adapter.config.createInXHour) === 3) {
                    inXhours = 3;
                    if (CurrentHour < 21) {
                        inXhours2Check = CurrentHour + 3;
                        inXdays2Check = 1;
                    }
                    else {
                        inXhours2Check = 24 - CurrentHour + 3;
                        inXdays2Check = 2;
                    }
                }
                else if (parseInt(adapter.config.createInXHour) === 4) {
                    inXhours = 6;
                    if (CurrentHour < 18) {
                        inXhours2Check = CurrentHour + 6;
                        inXdays2Check = 1;
                    }
                    else {
                        inXhours2Check = 24 - CurrentHour + 6;
                        inXdays2Check = 2;
                    }
                }

                adapter.log.debug("number of days " + numOfDays);

                for (let d = 0; d < numOfDays; d++) {

                    let keyName = "";

                    const dd = d + 1;

                    const obj = {
                        type: "channel",
                        common: {
                            name: "Day " + dd,
                            role: "weather"
                        }
                    };

                    await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd, null, "", obj);

                    //adapter.log.debug('loc: ' + l + ' day: ' + d + ' = ' + JSON.stringify(result.report.location.day[d]));

                    let value = result.report.location.day[d];
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".day";
                    //adapter.log.debug(JSON.stringify(result.report.location.day[d]));
                    await getprops(value, keyName);

                    value = result.report.location.day[d].symbol;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".symbol";
                    await getprops(value, keyName);

                    //add url for icon
                    await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".iconURL", getIconUrl(value.value));

                    value = result.report.location.day[d].tempmin;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".tempmin";
                    await getprops(value, keyName);


                    value = result.report.location.day[d].tempmax;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".tempmax";
                    await getprops(value, keyName);


                    value = result.report.location.day[d].wind;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".wind";
                    await getprops(value, keyName);

                    //add url for icon
                    await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".windIconURL", getWindIconUrl(value.symbolB));

                    value = result.report.location.day[d].windgusts;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".windgusts";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].rain;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".rain";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].humidity;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".humidity";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].pressure;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".pressure";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].snowline;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".snowline";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].uv_index_max;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".uv_index_max";
                    await getprops(value, keyName);

                    value = result.report.location.day[d].sun;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".sun";
                    await getprops(value, keyName);

                    const sSunInTime = result.report.location.day[d].sun.in;
                    const SunInTimeArr = sSunInTime.split(":");
                    const SunInHour = SunInTimeArr[0];
                    const sSunOutTime = result.report.location.day[d].sun.out;
                    const SunOutTimeArr = sSunOutTime.split(":");
                    const SunOutHour = SunOutTimeArr[0];

                    value = result.report.location.day[d].moon;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".moon";
                    await getprops(value, keyName);

                    //add url for icon
                    await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".moonIconURL", getMoonIconUrl(value.symbol));

                    value = result.report.location.day[d].local_info;
                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".local_info";
                    await getprops(value, keyName);

                    const numOfHours = result.report.location.day[d].hour.length;

                    let nSunHours = 0;
                    let nOldTime4Sun = -1;

                    adapter.log.debug("number of hours " + numOfHours);

                    for (let h = 0; h < numOfHours; h++) {

                        //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                        const hh = h + 1;

                        const obj = {
                            type: "channel",
                            common: {
                                name: "Hour " + hh,
                                role: "weather"
                            }
                        };

                        await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh, null, "", obj);

                        if (dd === 1) {

                            if (adapter.config.createCurrent) {
                                const obj = {
                                    type: "channel",
                                    common: {
                                        name: "current ",
                                        role: "weather"
                                    }
                                };
                                await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".current", null, "", obj);
                            }

                            if (parseInt(adapter.config.createInXHour) > 0) {
                                const obj = {
                                    type: "channel",
                                    common: {
                                        name: "in " + inXhours + " hours",
                                        role: "weather"
                                    }
                                };
                                await insertIntoList("NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours", null, "", obj);
                            }
                        }

                        value = result.report.location.day[d].hour[h];
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".hour";
                        await getprops(value, keyName);
                        const sHour4SunTime = result.report.location.day[d].hour[h].value;
                        const Hour4SunTimeArr = sHour4SunTime.split(":");
                        const Hour4SunTime = parseInt(Hour4SunTimeArr[0], 10);
                        //adapter.log.debug("+++ " + sHour4SunTime + " " + Hour4SunTimeArr + " " + Hour4SunTime);

                        if (adapter.config.createCurrent && dd == 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.hour";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.hour";
                            await getprops(value, keyName);
                        }

                        value = result.report.location.day[d].hour[h].temp;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.temp";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.temp";
                            await getprops(value, keyName);
                        }


                        value = result.report.location.day[d].hour[h].symbol;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.symbol";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.symbol";
                            await getprops(value, keyName);
                        }

                        //add url for icon
                        await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".iconURL", getIconUrl(value.value));
                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".current.iconURL", getIconUrl(value.value));
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            await insertIntoList("NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.iconURL", getIconUrl(value.value));
                        }

                        value = result.report.location.day[d].hour[h].wind;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.wind";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.wind";
                            await getprops(value, keyName);
                        }

                        //add url for icon
                        await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windIconURL", getWindIconUrl(value.symbolB));

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".current.windIconURL", getWindIconUrl(value.symbolB));
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            await insertIntoList("NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.windIconURL", getWindIconUrl(value.symbolB));
                        }

                        value = result.report.location.day[d].hour[h].windgusts;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windgusts";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.windgusts";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.windgusts";
                            await getprops(value, keyName);
                        }

                        value = result.report.location.day[d].hour[h].rain;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.rain";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.rains";
                            await getprops(value, keyName);
                        }

                        value = result.report.location.day[d].hour[h].humidity;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.humidity";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.humidity";
                            await getprops(value, keyName);
                        }

                        value = result.report.location.day[d].hour[h].pressure;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.pressure";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.pressure";
                            await getprops(value, keyName);
                        }

                        value = result.report.location.day[d].hour[h].clouds;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.clouds";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.clouds";
                            await getprops(value, keyName);
                        }

                        const CloudTime = parseInt(result.report.location.day[d].hour[h].clouds.value);
                        const SunTime = 100 - CloudTime;
                        if (SunTime > 0 && Hour4SunTime >= SunInHour && Hour4SunTime <= SunOutHour) {
                            let diff = 1;
                            if (nOldTime4Sun > -1) {
                                diff = Hour4SunTime - nOldTime4Sun;
                            }
                            else {
                                diff = Hour4SunTime;
                            }
                            const SunHours = diff * SunTime / 100.0;
                            nSunHours += SunHours;
                        }
                        nOldTime4Sun = Hour4SunTime;
                        //adapter.log.debug("### " + SunTime + "% = " + nSunHours + "SunIn " + SunInHour + " SunOut " + SunOutHour);

                        value = result.report.location.day[d].hour[h].snowline;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".snowline";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.snowline";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.snowline";
                            await getprops(value, keyName);
                        }

                        value = result.report.location.day[d].hour[h].uv_index;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".uv_index";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.uv_index";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.uv_index";
                            await getprops(value, keyName);
                        }


                        value = result.report.location.day[d].hour[h].windchill;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                        await getprops(value, keyName);

                        if (adapter.config.createCurrent && dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.windchill";
                            await getprops(value, keyName);
                        }
                        if (parseInt(adapter.config.createInXHour) > 0 && Hour4SunTime == inXhours2Check && dd == inXdays2Check) {
                            keyName = "NextHours.Location_" + ll + ".Day_1.in" + inXhours + "hours.windchill";
                            await getprops(value, keyName);
                        }
                    }

                    await insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".sunshineDuration", nSunHours);
                    //adapter.log.debug("### next day");
                }
            }
            //adapter.log.debug("hourly forecast done, objects in list " + tasks.length);
            adapter.log.debug("hourly forecast done");

        } catch (e) {
            adapter.log.error("exception in HourlyForecast [" + e + "]");

        }
    }
}




async function getForecastDataHourlyJSON() {
    if (adapter.config.HourlyForecastJSON) {
        try {
            const url = adapter.config.HourlyForecastJSON;
            adapter.log.debug("calling forecast hourly JSON: " + url);

            //const getBuffer = bent("json");
            //let result = await getBuffer(url);
            const res = await axios.get(url);

            let result = res.data;

            adapter.log.debug("got response " + result);

            const numOfLocations = 1; //seems here we get only one location

            for (let l = 0; l < numOfLocations; l++) {

                const ll = l + 1;

                let location = result.location;

                adapter.log.debug("location " + location + " " + result.location);


                const pos = location.indexOf("[");
                if (pos !== -1) {
                    location = location.substring(0, pos).trim();
                }

                await insertIntoList("NextHours2.Location_" + ll + ".Location", location);

                const obj = {
                    type: "channel",
                    common: {
                        name: result.location,
                        role: "weather"
                    }
                };

                await insertIntoList("NextHours2.Location_" + ll, null, "", obj);

                // entspricht nicht der doku!!
                let numOfDays = result.day.length;
                //const numOfDays = 5;

                if (numOfDays === undefined) {
                    adapter.log.info("still wrong data structure from server received! repaired...");
                    //adapter.log.debug("got " + JSON.stringify(result.day));

                    //try to repair structure

                    let stringdata = JSON.stringify(result);

                    stringdata = stringdata.replace('{"1":', "[");
                    stringdata = stringdata.replace(',"2":', ",");
                    stringdata = stringdata.replace(',"3":', ",");
                    stringdata = stringdata.replace(',"4":', ",");
                    stringdata = stringdata.replace(',"5":', ",");
                    stringdata = stringdata.replace("}]}}}", "}]}]}");

                    //adapter.log.debug("--- " + stringdata);

                    result = JSON.parse(stringdata);

                    adapter.log.debug("copied, got " + result.day.length + " days");

                    numOfDays = result.day.length;
                    if (numOfDays === undefined) {
                        adapter.log.error("not repaired...");

                        adapter.log.debug("got " + JSON.stringify(result.day));
                    }
                }
                else {
                    adapter.log.debug("got " + numOfDays + " days");
                }

                const CurrentDate = new Date();
                const CurrentHour = CurrentDate.getHours();

                for (let d = 0; d < numOfDays; d++) {

                    let keyName = "";

                    const dd = d + 1;

                    const obj = {
                        type: "channel",
                        common: {
                            name: "Day " + dd,
                            role: "weather"
                        }
                    };
                    await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd, null, "", obj);

                    let value = result.day[d].name;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".day";
                    await insertIntoList(keyName, value);

                    value = result.day[d].date;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".date";
                    await insertIntoList(keyName, value);


                    const unit_temp = result.day[d].units.temp;
                    const unit_wind = result.day[d].units.wind;
                    const unit_rain = result.day[d].units.rain;
                    const unit_pressure = result.day[d].units.pressure;
                    const unit_snowline = result.day[d].units.snowline;

                    adapter.log.debug("got units " + unit_temp + " " + unit_wind + " " + unit_rain + " " + unit_wind + " " + unit_pressure + " " + unit_snowline);

                    value = result.day[d].symbol_value;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol";
                    await insertIntoList(keyName, value);

                    //add url for icon
                    await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".iconURL", getIconUrl(value));

                    value = result.day[d].symbol_description;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol_desc";
                    await insertIntoList(keyName, value);

                    value = result.day[d].symbol_value2;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol2";
                    await insertIntoList(keyName, value);

                    value = result.day[d].symbol_description2;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol_desc2";
                    await insertIntoList(keyName, value);

                    value = result.day[d].tempmin;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".tempmin";
                    await insertIntoList(keyName, value, unit_temp);

                    value = result.day[d].tempmax;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".tempmax";
                    await insertIntoList(keyName, value, unit_temp);

                    value = result.day[d].wind.speed;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_speed";
                    await insertIntoList(keyName, value, unit_wind);

                    value = result.day[d].wind.symbol;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_symbol";
                    await insertIntoList(keyName, value);

                    value = result.day[d].wind.symbolB;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_symbolB";
                    await insertIntoList(keyName, value);

                    //add url for icon
                    await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".windIconURL", getWindIconUrl(value));

                    value = result.day[d].wind.gusts;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_gusts";
                    await insertIntoList(keyName, value);

                    value = result.day[d].rain;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".rain";
                    await insertIntoList(keyName, value, unit_rain);

                    value = result.day[d].humidity;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".humidity";
                    await insertIntoList(keyName, value);

                    value = result.day[d].pressure;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".pressure";
                    await insertIntoList(keyName, value, unit_pressure);

                    value = result.day[d].snowline;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".snowline";
                    await insertIntoList(keyName, value, unit_snowline);

                    value = result.day[d].uv_index_max;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".uv_index_max";
                    await insertIntoList(keyName, value);

                    value = result.day[d].sun.in;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".sun_in";
                    await insertIntoList(keyName, value);

                    value = result.day[d].sun.mid;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".sun_mid";
                    await insertIntoList(keyName, value);

                    value = result.day[d].sun.out;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".sun_out";
                    await insertIntoList(keyName, value);

                    const sSunInTime = result.day[d].sun.in;
                    const SunInTimeArr = sSunInTime.split(":");
                    const SunInHour = SunInTimeArr[0];
                    const sSunOutTime = result.day[d].sun.out;
                    const SunOutTimeArr = sSunOutTime.split(":");
                    const SunOutHour = SunOutTimeArr[0];


                    value = result.day[d].moon.in;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_in";
                    await insertIntoList(keyName, value);

                    value = result.day[d].moon.out;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_out";
                    await insertIntoList(keyName, value);

                    value = result.day[d].moon.lumi;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_lumi";
                    await insertIntoList(keyName, value);

                    value = result.day[d].moon.desc;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_desc";
                    await insertIntoList(keyName, value);

                    value = result.day[d].moon.symbol;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_symbol";
                    await insertIntoList(keyName, value);

                    //add url for icon
                    await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".moonIconURL", getMoonIconUrl(value));

                    value = result.day[d].local_time;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".local_time";
                    await insertIntoList(keyName, value);

                    value = result.day[d].local_time_offset;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".local_time_offset";
                    await insertIntoList(keyName, value);

                    const numOfHours = result.day[d].hour.length;
                    adapter.log.debug("got " + numOfHours + " hours");

                    let nSunHours = 0;
                    let nOldTime4Sun = -1;

                    for (let h = 0; h < numOfHours; h++) {

                        //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                        const hh = h + 1;

                        const obj = {
                            type: "channel",
                            common: {
                                name: "Hour " + hh,
                                role: "weather"
                            }
                        };

                        await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh, null, "", obj);

                        if (dd === 1) {

                            const obj = {
                                type: "channel",
                                common: {
                                    name: "current ",
                                    role: "weather"
                                }
                            };
                            await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".current", null, "", obj);

                        }

                        value = result.day[d].hour[h].interval;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".hour";
                        await insertIntoList(keyName, value);

                        //adapter.log.debug("+++ " + result.day[d].hour[h].interval );

                        const sHour4SunTime = result.day[d].hour[h].interval;
                        const Hour4SunTimeArr = sHour4SunTime.split(":");
                        const Hour4SunTime = parseInt(Hour4SunTimeArr[0], 10);


                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.hour";
                            await insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].temp;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                        await insertIntoList(keyName, value, unit_temp);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.temp";
                            await insertIntoList(keyName, value, unit_temp);
                        }

                        value = result.day[d].hour[h].symbol_value;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                        await insertIntoList(keyName, value);

                        //add url for icon
                        await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".iconURL", getIconUrl(value));

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol";
                            await insertIntoList(keyName, value);

                            //add url for icon
                            await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".current.iconURL", getIconUrl(value));
                        }

                        value = result.day[d].hour[h].symbol_description;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol_desc";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol_desc";
                            await insertIntoList(keyName, value);
                        }


                        value = result.day[d].hour[h].symbol_value2;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol";
                            await insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].symbol_description2;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol_desc2";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol_desc2";
                            await insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].wind.speed;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_speed";
                        await insertIntoList(keyName, value, unit_wind);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_speed";
                            await insertIntoList(keyName, value, unit_wind);
                        }

                        value = result.day[d].hour[h].wind.dir;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_dir";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_dir";
                            await insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].wind.symbol;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_symbol";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_symbol";
                            await insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].wind.symbolB;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_symbolB";
                        await insertIntoList(keyName, value);

                        //add url for icon
                        await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windIconURL", getWindIconUrl(value));

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_symbolB";
                            await insertIntoList(keyName, value);

                            //add url for icon
                            await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".current.windIconURL", getWindIconUrl(value));

                        }

                        value = result.day[d].hour[h].wind.gusts;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_gusts";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_gusts";
                            await insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].rain;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                        await insertIntoList(keyName, value, unit_rain);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.rain";
                            await insertIntoList(keyName, value, unit_rain);
                        }

                        value = result.day[d].hour[h].humidity;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.humidity";
                            await insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].pressure;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                        await insertIntoList(keyName, value, unit_pressure);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.pressure";
                            await insertIntoList(keyName, value, unit_pressure);
                        }

                        value = result.day[d].hour[h].clouds;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.clouds";
                            await insertIntoList(keyName, value);
                        }

                        const CloudTime = parseInt(result.day[d].hour[h].clouds);
                        const SunTime = 100 - CloudTime;
                        if (SunTime > 0 && Hour4SunTime >= SunInHour && Hour4SunTime <= SunOutHour) {
                            let diff = 1;
                            if (nOldTime4Sun > -1) {
                                diff = Hour4SunTime - nOldTime4Sun;
                            }
                            else {
                                diff = Hour4SunTime;
                            }
                            const SunHours = diff * SunTime / 100.0;
                            nSunHours += SunHours;
                        }
                        nOldTime4Sun = Hour4SunTime;
                        //adapter.log.debug("### " + SunTime + "% = " + nSunHours + "SunIn " + SunInHour + " SunOut " + SunOutHour);

                        value = result.day[d].hour[h].snowline;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".snowline";
                        await insertIntoList(keyName, value, unit_snowline);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.snowline";
                            await insertIntoList(keyName, value, unit_snowline);
                        }


                        value = result.day[d].hour[h].uv_index;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".uv_index";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.uv_index";
                            await insertIntoList(keyName, value);
                        }


                        value = result.day[d].hour[h].windchill;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                        await insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.windchill";
                            await insertIntoList(keyName, value);
                        }
                    }
                    await insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".sunshineDuration", nSunHours);
                    //adapter.log.debug("### next day");

                }

            }


        } catch (e) {
            adapter.log.error("exception in getForecastDataHourlyJSON [" + e + "]");

        }
    }
}

async function insertIntoList(key, value, unit, newObj = null) {

    try {

        let valueType = "unknown";

        let sUnit = "";
        if (unit !== undefined) {
            sUnit = unit;
        }

        if (typeof value === "object" && value !== null) {
            adapter.log.error("insert " + key + " with " + JSON.stringify(value) + " " + sUnit + " " + (newObj != null ? JSON.stringify(newObj) : ""));
        }
        else {
            adapter.log.debug("insert " + key + " with " + value + " " + sUnit + " " + (newObj != null ? JSON.stringify(newObj) : ""));
        }
        let obj;

        if (newObj !== null) {
            obj = newObj;
            //adapter.log.debug("using newObj");
        }
        else {
            let d = key.match(/Day_(\d)\./);
            if (d) {
                d = parseInt(d[1], 10) - 1;
                if (key.match(/\.Maximale_Temperatur_value$/) || key.match(/\.tempmax_value$/) || key.match(/\.tempmax/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "Maximal day temperature",
                            type: "number",
                            role: "value.temperature.max.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "°C"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.Minimale_Temperatur_value$/) || key.match(/\.tempmin_value$/) || key.match(/\.tempmin/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "Minimal day temperature",
                            type: "number",
                            role: "value.temperature.min.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "°C"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.Tag_value/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Day name",
                            type: "string",
                            role: "dayofweek.forecast." + d,
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.Wetter_Symbol_id/) || key.match(/\.Wetter_Symbol_id2/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "Weather icon name",
                            type: "number",
                            role: "weather.icon.name.forecast." + d,

                            read: true,
                            write: false
                        }
                    };

                } else if (key.match(/\.symbol_desc/) || key.match(/\.symbol_desc2/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Weather state",
                            type: "string",
                            role: "weather.symbol.desc.forecast." + d,

                            read: true,
                            write: false
                        }
                    };

                } else if (key.match(/\.Wetter_Symbol_value2/) || key.match(/\.Wetter_Symbol_value/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Weather state URL",
                            type: "string",
                            role: "weather.title.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.symbol_value2/) || key.match(/\.symbol_value/) || key.match(/\.symbol/) || key.match(/\.symbol2/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "Weather state URL",
                            type: "number",
                            role: "weather.title.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.Wetterbedingungen_value/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Weather description",
                            type: "string",
                            role: "weather.state.forecast." + d,
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.wind_value/) || key.match(/\.Wind_value/) || key.match(/\.Wind_dir/) || key.match(/\.wind_dir/) || key.match(/\.Wind_valueB/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Wind description",
                            type: "string",
                            role: "weather.direction.wind.forecast." + d,
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.Wind_idB/) || key.match(/\.Wind_id/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Wind id",
                            type: "string",
                            role: "weather.direction.wind.forecast." + d,
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.iconURL/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Weather icon URL",
                            type: "string",
                            role: "weather.icon.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.moonIconURL/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Moon icon URL",
                            type: "string",
                            role: "weather.icon.moon.forecast." + d,
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.windIconURL/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "Wind icon URL",
                            type: "string",
                            role: "weather.icon.wind.forecast." + d,
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.sunshineDuration/)) {
                    valueType = "float";
                    obj = {
                        type: "state",
                        common: {
                            name: "Sunshine Duration",
                            type: "number",
                            role: "weather.sunshineduration." + d,
                            unit: ("h"),
                            read: true,
                            write: false
                        }
                    };

                } else if (key.match(/\.date/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "day",
                            type: "string",
                            role: "weather.day.name" + d,

                            read: true,
                            write: false
                        }
                    };

                } else if (key.match(/\.day_name/) || key.match(/\.day/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "day name",
                            type: "string",
                            role: "weather.day.name" + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.hour_value/) || key.match(/\.hour/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "hour value",
                            type: "string",
                            role: "weather.hour.value" + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.day_value/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "day value",
                            type: "string",
                            role: "weather.day.value" + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.clouds_value/) || key.match(/\.clouds/)) {

                    //sometimes % comes with value
                    value = value.replace(/%/g, "");
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "clouds",
                            type: "number",
                            role: "weather.clouds.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "%"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.humidity_value/) || key.match(/\.humidity/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "humidity",
                            type: "number",
                            role: "weather.humidity.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "%"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.pressure_value/) || key.match(/\.pressure/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "pressure",
                            type: "number",
                            role: "weather.pressure.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "mBar"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.rain_value/) || key.match(/\.rain/)) {
                    valueType = "float";
                    obj = {
                        type: "state",
                        common: {
                            name: "rain",
                            type: "number",
                            role: "weather.rain.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "mm"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.snowline_value/) || key.match(/\.snowline/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "snowline",
                            type: "number",
                            role: "weather.snowline.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "m"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.uv_index_max_value/) || key.match(/\.uv_index_max/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "max UV index",
                            type: "number",
                            role: "weather.uv_index_max.forecast." + d,
                            unit: "",
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.uv_index_value/) || key.match(/\.uv_index/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "UV index",
                            type: "number",
                            role: "weather.uv_index.forecast." + d,
                            unit: "",
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.temp_value/) || key.match(/\.temp/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "temperature",
                            type: "number",
                            role: "weather.temperature.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "°C"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.wind_dir/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "wind direction",
                            type: "string",
                            role: "weather.wind.direction.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.wind_symbol/) || key.match(/\.wind_symbolB/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "wind symbol",
                            type: "number",
                            role: "weather.wind.symbol.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.wind_speed/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "wind value",
                            type: "number",
                            role: "weather.wind.value.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "km/h"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.windchill_value/) || key.match(/\.windchill/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "windchill",
                            type: "number",
                            role: "weather.wind.windchill.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "°C"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.windgusts_value/) || key.match(/\.wind_gusts/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "windgusts",
                            type: "number",
                            role: "weather.wind.windgusts.forecast." + d,
                            unit: (sUnit.length > 0 ? sUnit : "km/h"),
                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.local_time_offset/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "local time offset",
                            type: "number",
                            role: "weather.locale.offset.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                }
                else if (key.match(/\.local_info_offset/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "local info offset",
                            type: "number",
                            role: "weather.locale.offset.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.local_info_local_time/) || key.match(/\.local_time/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "local time",
                            type: "string",
                            role: "weather.locale.time.forecast." + d,

                            read: true,
                            write: false
                        }
                    };

                } else if (key.match(/\.moon_desc/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "moon description",
                            type: "string",
                            role: "weather.moon.description.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.moon_in/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "moon raise",
                            type: "string",
                            role: "weather.moon.in.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.moon_lumi/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "moon lumi",
                            type: "string",
                            role: "weather.moon.lumi.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.moon_out/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "moon set",
                            type: "string",
                            role: "weather.moon.out.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.moon_symbol/)) {
                    valueType = "int";
                    obj = {
                        type: "state",
                        common: {
                            name: "moon symbol",
                            type: "number",
                            role: "weather.moon.symbol.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.sun_in/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "sun raise",
                            type: "string",
                            role: "weather.sun.in.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.sun_mid/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "sun mid",
                            type: "string",
                            role: "weather.sun.mid.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                } else if (key.match(/\.sun_out/)) {
                    valueType = "string";
                    obj = {
                        type: "state",
                        common: {
                            name: "sun set",
                            type: "string",
                            role: "weather.sun.out.forecast." + d,

                            read: true,
                            write: false
                        }
                    };
                }
            }

            else if (key.match(/\.Location$/)) {
                valueType = "string";
                obj = {
                    type: "state",
                    common: {
                        name: "Location",
                        type: "string",
                        role: "location",
                        read: true,
                        write: false
                    }
                };
            }
        }

        obj = obj || {
            type: "state",
            common: {
                name: "data",
                type: "string",
                role: "state",
                unit: "",
                read: true,
                write: false
            }
        };

        await adapter.setObjectNotExistsAsync(key, obj);

        const obj_new = await adapter.getObjectAsync(key);
        //adapter.log.warn("got object " + JSON.stringify(obj_new));


        if (obj_new != null) {

            if ((obj_new.common.role != obj.common.role
                || obj_new.common.type != obj.common.type
                || (obj_new.common.unit != obj.common.unit && obj.common.unit != null)
                || obj_new.common.read != obj.common.read
                || obj_new.common.write != obj.common.write
                || obj_new.common.name != obj.common.name)
                && obj.type === "state"
            ) {
                adapter.log.warn("change object " + JSON.stringify(obj) + " " + JSON.stringify(obj_new));
                await adapter.extendObject(key, {
                    common: {
                        name: obj.common.name,
                        role: obj.common.role,
                        type: obj.common.type,
                        unit: obj.common.unit,
                        read: obj.common.read,
                        write: obj.common.write
                    }
                });
            }
        }





        if (typeof value !== "object" && value !== null) {

            let val;

            if (valueType == "string") {
                val = value;
            }
            else if (valueType == "int") {
                val = parseInt(value);
            }
            else if (valueType == "float") {
                val = parseFloat(value);
            }
            else {
                val = value;
                adapter.log.error("unkown type " + valueType + " for " + key);
            }


            await adapter.setStateAsync(key, { ack: true, val: val });
        }


    } catch (e) {
        adapter.log.error("exception in await insertIntoList [" + e + "]");
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}

