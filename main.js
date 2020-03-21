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

// you have to require the utils module and call adapter function
//const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const utils = require("@iobroker/adapter-core");

let adapter;
function startAdapter(options) {
    options = options || {};
    Object.assign(options, {
        name: "daswetter",
        ready: () => main()
    });
    
    adapter = new utils.Adapter(options);

    return adapter;
}

//const request = require('request');
const bent = require("bent");
const parseString = require("xml2js").parseString;

let dbRunning = false;

async function startRead() {
   
    await getForecastData7Days();
    await getForecastData5Days();
    await getForecastDataHourly();
    await getForecastDataHourlyJSON();

    startDbUpdate();

}

async function main() {
    // force terminate 
    let nParseTimeout = 60;
    if (adapter.config.parseTimeout > 0) {
        nParseTimeout = adapter.config.parseTimeout;
    }
    adapter.log.debug("set timeout to " + nParseTimeout + " sec");
    nParseTimeout = nParseTimeout * 1000;
    setTimeout(() => {
        adapter.log.error("force terminate, objects still in list: " + tasks.length);
        adapter.terminate ? adapter.terminate(15) : process.exit(15);
    }, nParseTimeout);

    await startRead();

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

            //const maxIcons = (num < 5) ? 19 : 22;

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


function getProps(obj, keyName) {
    //rückwärts parsen, dann kommt unit for dem wert und kann somit in die liste eingetragen werden
    const arr = [];
    let unit = "";
    for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            arr.push(prop);
        }
    }
    for (let i = arr.length - 1; i >= 0; i--) {
        const dataValue = obj[arr[i]];
        if (arr[i] === "unit") {
            //parse unit
            unit = dataValue.replace(/\s/g, "_");

            //adapter.log.debug('got unit '  + dataValue);
        }
        else if (arr[i] !== "data_sequence") {
            const keyNameLong = keyName + "_" + arr[i].replace(/\s/g, "_");
            insertIntoList(keyNameLong, dataValue, unit);
            unit = "";
        }
    }
}


async function getForecastData7Days() {
    if (adapter.config.Days7Forecast) {
        const url = adapter.config.Days7Forecast;
        adapter.log.debug("calling forecast 7 days: " + url);

        const getBuffer = bent("string");
        const buffer = await getBuffer(url);

        adapter.log.debug("got response " + JSON.stringify(buffer));


        //request(url, (error, response, body) => {
        // adapter.log.debug("got response");

        //if (!error && response.statusCode === 200) {

        // adapter.log.debug("got data without error, now parsing");

        try {
            //convert xml to json first
            parseString(buffer, (err, result) => {

                const numOfLocations = result.report.location.length;

                adapter.log.debug("number of location " + numOfLocations);

                for (let l = 0; l < numOfLocations; l++) {
                    const ll = l + 1;

                    let location = result.report.location[l].$.city;
                    const pos = location.indexOf("[");
                    if (pos !== -1) {
                        location = location.substring(0, pos).trim();
                    }

                    insertIntoList("NextDays.Location_" + ll + ".Location", location);

                    // sometimes variable has name not const but var
                    const vars = result.report.location[l].const || result.report.location[l].var;


                    const numOfPeriods = vars[0].data[0].forecast.length;

                    tasks.push({
                        name: "add",
                        key: "NextDays.Location_" + ll,
                        obj: {
                            type: "device",
                            common: {
                                name: result.report.location[l].$.city,
                                role: "weather"
                            }
                        }
                    });


                    adapter.log.debug("number of periods " + numOfPeriods);

                    for (let p = 0; p < numOfPeriods; p++) {
                        const pp = p + 1;
                        tasks.push({
                            name: "add",
                            key: "NextDays.Location_" + ll + ".Day_" + pp,
                            obj: {
                                type: "channel",
                                common: {
                                    name: "Day " + pp,
                                    role: "weather"
                                }
                            }
                        });




                        const numOfDatapoints = vars.length;

                        adapter.log.debug("number of datapoints " + numOfDatapoints);

                        for (let d = 0; d < numOfDatapoints; d++) {
                            const datapointName = vars[d].name[0].replace(/\s/g, "_");
                            const keyName = "NextDays.Location_" + ll + ".Day_" + pp + "." + datapointName;
                            const value = vars[d].data[0].forecast[p].$;
                            getProps(value, keyName);
                            if (datapointName === "Wetter_Symbol" && value.id2) {
                                insertIntoList("NextDays.Location_" + ll + ".Day_" + pp + ".iconURL", getIconUrl(value.id2));
                            } else if (datapointName === "Wind" && value.idB) {
                                insertIntoList("NextDays.Location_" + ll + ".Day_" + pp + ".windIconURL", getWindIconUrl(value.idB));
                            }
                        }
                    }
                }

                adapter.log.debug("7 days forecast done, objects in list " + tasks.length);


            });
        } catch (e) {
            adapter.log.error("exception in 7DaysForecast [" + e + "]");

        }
        // } else {
        // ERROR
        //     adapter.log.error('DasWetter.com reported an error: ' + error + ' or response ' + response.statusCode);

        // }
        //});
    }
}

async function getForecastData5Days() {
    if (adapter.config.Days5Forecast) {
        const url = adapter.config.Days5Forecast;
        adapter.log.debug("calling forecast 5 days: " + url);

        const getBuffer = bent("string");
        const buffer = await getBuffer(url);

        adapter.log.debug("got response " + JSON.stringify(buffer));


        //request(url, (error, response, body) => {
        // adapter.log.debug("got response");

        // if (!error && response.statusCode === 200) {

        //   adapter.log.debug("got data without error, now parsing");
        try {
            //adapter.log.debug('got body: ' + body);
            const body1 = buffer.replace(/wind-gusts/g, "windgusts");

            parseString(body1, (err, result) => {

                const numOfLocations = result.report.location.length;

                adapter.log.debug("number of locations " + numOfLocations);

                for (let l = 0; l < numOfLocations; l++) {

                    const ll = l + 1;

                    let location = result.report.location[l].$.city;
                    const pos = location.indexOf("[");
                    if (pos !== -1) {
                        location = location.substring(0, pos).trim();
                    }

                    insertIntoList("NextDaysDetailed.Location_" + ll + ".Location", location);


                    tasks.push({
                        name: "add",
                        key: "NextDaysDetailed.Location_" + ll,
                        obj: {
                            type: "device",
                            common: {
                                name: result.report.location[l].$.city,
                                role: "weather"
                            }
                        }
                    });

                    const numOfDays = result.report.location[l].day.length;

                    adapter.log.debug("number of days " + numOfDays);

                    for (let d = 0; d < numOfDays; d++) {

                        let keyName = "";

                        const dd = d + 1;


                        tasks.push({
                            name: "add",
                            key: "NextDaysDetailed.Location_" + ll + ".Day_" + dd,
                            obj: {
                                type: "channel",
                                common: {
                                    name: "Day " + dd,
                                    role: "weather"
                                }
                            }
                        });




                        let value = result.report.location[l].day[d].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".day";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].symbol[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".symbol";
                        getProps(value, keyName);

                        //add url for icon
                        insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".iconURL", getIconUrl(value.value));


                        value = result.report.location[l].day[d].tempmin[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".tempmin";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].tempmax[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".tempmax";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].wind[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".wind";
                        getProps(value, keyName);

                        //add url for icon
                        insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".windIconURL", getWindIconUrl(value.symbolB));


                        value = result.report.location[l].day[d].windgusts[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".windgusts";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].rain[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".rain";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].humidity[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".humidity";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].pressure[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".pressure";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].snowline[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".snowline";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].sun[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".sun";
                        getProps(value, keyName);

                        value = result.report.location[l].day[d].moon[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".moon";
                        getProps(value, keyName);

                        //add url for icon
                        insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".moonIconURL", getMoonIconUrl(value.symbol));

                        value = result.report.location[l].day[d].local_info[0].$;
                        keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".local_info";
                        getProps(value, keyName);

                        const numOfHours = result.report.location[l].day[d].hour.length;

                        adapter.log.debug("number of hours " + numOfHours);

                        for (let h = 0; h < numOfHours; h++) {

                            //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                            const hh = h + 1;

                            tasks.push({
                                name: "add",
                                key: "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh,
                                obj: {
                                    type: "channel",
                                    common: {
                                        name: "Hour " + hh,
                                        role: "weather"
                                    }
                                }
                            });


                            value = result.report.location[l].day[d].hour[h].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".hour";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].temp[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].symbol[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                            getProps(value, keyName);

                            //add url for icon
                            insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".iconURL", getIconUrl(value.value));




                            value = result.report.location[l].day[d].hour[h].wind[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind";
                            getProps(value, keyName);

                            //add url for icon
                            insertIntoList("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windIconURL", getWindIconUrl(value.symbolB));

                            value = result.report.location[l].day[d].hour[h].windgusts[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windgusts";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].rain[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].humidity[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].pressure[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].clouds[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].snowline[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".snowline";
                            getProps(value, keyName);

                            value = result.report.location[l].day[d].hour[h].windchill[0].$;
                            keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                            getProps(value, keyName);
                        }
                    }
                }

                adapter.log.debug("5 days forecast done, objects in list " + tasks.length);

            });
        } catch (e) {
            adapter.log.error("exception in 5DaysForecast [" + e + "]");

        }
        //   } else {
        // ERROR
        //       adapter.log.error("DasWetter.com reported an error: " + error + " or response " + response.statusCode);

        //   }
        //   });
    }
    //if (cb) cb();
}

async function getForecastDataHourly() {

    if (adapter.config.HourlyForecast) {
        const url = adapter.config.HourlyForecast;
        adapter.log.debug("calling forecast hourly: " + url);

        const getBuffer = bent("string");
        const buffer = await getBuffer(url);

        adapter.log.debug("got response " + JSON.stringify(buffer));

        //const body = "";
        //request(url, (error, response, body) => {

        // adapter.log.debug("got response");

        // if (!error && response.statusCode === 200) {

        //adapter.log.debug("got data without error, now parsing");

        try {

            const body1 = buffer.replace(/wind-gusts/g, "windgusts");

            parseString(body1, (err, result) => {

                const numOfLocations = result.report.location.length;

                adapter.log.debug("number of locations " + numOfLocations);

                for (let l = 0; l < numOfLocations; l++) {

                    const ll = l + 1;

                    let location = result.report.location[l].$.city;
                    const pos = location.indexOf("[");
                    if (pos !== -1) {
                        location = location.substring(0, pos).trim();
                    }

                    insertIntoList("NextHours.Location_" + ll + ".Location", location);

                    tasks.push({
                        name: "add",
                        key: "NextHours.Location_" + ll,
                        obj: {
                            type: "device",
                            common: {
                                name: result.report.location[l].$.city,
                                role: "weather"
                            }
                        }
                    });


                    const numOfDays = result.report.location[l].day.length;

                    const CurrentDate = new Date();
                    const CurrentHour = CurrentDate.getHours();

                    adapter.log.debug("number of days " + numOfDays);

                    for (let d = 0; d < numOfDays; d++) {

                        let keyName = "";

                        const dd = d + 1;

                        tasks.push({
                            name: "add",
                            key: "NextHours.Location_" + ll + ".Day_" + dd,
                            obj: {
                                type: "channel",
                                common: {
                                    name: "Day " + dd,
                                    role: "weather"
                                }
                            }
                        });





                        //adapter.log.debug('loc: ' + l + ' day: ' + d + ' = ' + JSON.stringify(result.report.location[l].day[d]));

                        let value = result.report.location[l].day[d].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".day";
                        //adapter.log.debug(JSON.stringify(result.report.location[l].day[d].$));
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].symbol[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".symbol";
                        getProps(value, keyName);

                        //add url for icon
                        insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".iconURL", getIconUrl(value.value));

                        value = result.report.location[l].day[d].tempmin[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".tempmin";
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].tempmax[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".tempmax";
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].wind[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".wind";
                        getProps(value, keyName);

                        //add url for icon
                        insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".windIconURL", getWindIconUrl(value.symbolB));


                        value = result.report.location[l].day[d].windgusts[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".windgusts";
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].rain[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".rain";
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].humidity[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".humidity";
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].pressure[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".pressure";
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].snowline[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".snowline";
                        getProps(value, keyName);


                        value = result.report.location[l].day[d].sun[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".sun";
                        getProps(value, keyName);


                        const sSunInTime = result.report.location[l].day[d].sun[0].$.in;
                        const SunInTimeArr = sSunInTime.split(":");
                        const SunInHour = SunInTimeArr[0];
                        const sSunOutTime = result.report.location[l].day[d].sun[0].$.out;
                        const SunOutTimeArr = sSunOutTime.split(":");
                        const SunOutHour = SunOutTimeArr[0];

                        value = result.report.location[l].day[d].moon[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".moon";
                        getProps(value, keyName);

                        //add url for icon
                        insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".moonIconURL", getMoonIconUrl(value.symbol));


                        value = result.report.location[l].day[d].local_info[0].$;
                        keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".local_info";
                        getProps(value, keyName);


                        const numOfHours = result.report.location[l].day[d].hour.length;

                        let nSunHours = 0;
                        let nOldTime4Sun = -1;

                        adapter.log.debug("number of hours " + numOfHours);

                        for (let h = 0; h < numOfHours; h++) {

                            //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                            const hh = h + 1;

                            tasks.push({
                                name: "add",
                                key: "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh,
                                obj: {
                                    type: "channel",
                                    common: {
                                        name: "Hour " + hh,
                                        role: "weather"
                                    }
                                }
                            });

                            if (dd === 1) {
                                tasks.push({
                                    name: "add",
                                    key: "NextHours.Location_" + ll + ".Day_" + dd + ".current",
                                    obj: {
                                        type: "channel",
                                        common: {
                                            name: "current ",
                                            role: "weather"
                                        }
                                    }
                                });

                            }


                            value = result.report.location[l].day[d].hour[h].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".hour";
                            getProps(value, keyName);
                            const sHour4SunTime = result.report.location[l].day[d].hour[h].$.value;
                            const Hour4SunTimeArr = sHour4SunTime.split(":");
                            const Hour4SunTime = parseInt(Hour4SunTimeArr[0], 10);
                            //adapter.log.debug("+++ " + sHour4SunTime + " " + Hour4SunTimeArr + " " + Hour4SunTime);

                            if (dd == 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.hour";
                                getProps(value, keyName);
                            }


                            value = result.report.location[l].day[d].hour[h].temp[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.temp";
                                getProps(value, keyName);
                            }

                            value = result.report.location[l].day[d].hour[h].symbol[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.symbol";
                                getProps(value, keyName);
                            }

                            //add url for icon
                            insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".iconURL", getIconUrl(value.value));
                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".current.iconURL", getIconUrl(value.value));

                            }


                            value = result.report.location[l].day[d].hour[h].wind[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.wind";
                                getProps(value, keyName);

                            }

                            //add url for icon
                            insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windIconURL", getWindIconUrl(value.symbolB));

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".current.windIconURL", getWindIconUrl(value.symbolB));

                            }

                            value = result.report.location[l].day[d].hour[h].windgusts[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windgusts";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.windgusts";
                                getProps(value, keyName);

                            }

                            value = result.report.location[l].day[d].hour[h].rain[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.rain";
                                getProps(value, keyName);

                            }

                            value = result.report.location[l].day[d].hour[h].humidity[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.humidity";
                                getProps(value, keyName);

                            }

                            value = result.report.location[l].day[d].hour[h].pressure[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.pressure";
                                getProps(value, keyName);

                            }

                            value = result.report.location[l].day[d].hour[h].clouds[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.clouds";
                                getProps(value, keyName);

                            }


                            const CloudTime = parseInt(result.report.location[l].day[d].hour[h].clouds[0].$.value);
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

                            value = result.report.location[l].day[d].hour[h].snowline[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".snowline";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.snowline";
                                getProps(value, keyName);

                            }

                            value = result.report.location[l].day[d].hour[h].windchill[0].$;
                            keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                            getProps(value, keyName);

                            if (dd === 1 && Hour4SunTime === CurrentHour) {
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".current.windchill";
                                getProps(value, keyName);
                            }
                        }

                        insertIntoList("NextHours.Location_" + ll + ".Day_" + dd + ".sunshineDuration", nSunHours);
                        //adapter.log.debug("### next day");
                    }
                }

                adapter.log.debug("hourly forecast done, objects in list " + tasks.length);


            });
        } catch (e) {
            adapter.log.error("exception in HourlyForecast [" + e + "]");

        }
        //  } else {
        // ERROR
        //      adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);

        //  }
        //    });
    }

}




async function getForecastDataHourlyJSON() {
    if (adapter.config.HourlyForecastJSON) {

        const url = adapter.config.HourlyForecastJSON;
        adapter.log.debug("calling forecast hourly JSON: " + url);

        const getBuffer = bent("json");
        const buffer = await getBuffer(url);

        adapter.log.debug("got response " + JSON.stringify(buffer));


        //request(url, (error, response, body) => {
        //  if (!error && response.statusCode === 200) {

        try {

            //need to be const for repair
            let result = JSON.parse(buffer);

            //adapter.log.debug("got " + JSON.stringify(result));

            const numOfLocations = 1; //seems here we get only one location

            for (let l = 0; l < numOfLocations; l++) {

                const ll = l + 1;

                let location = result.location;
                const pos = location.indexOf("[");
                if (pos !== -1) {
                    location = location.substring(0, pos).trim();
                }

                insertIntoList("NextHours2.Location_" + ll + ".Location", location);

                tasks.push({
                    name: "add",
                    key: "NextHours2.Location_" + ll,
                    obj: {
                        type: "device",
                        common: {
                            name: result.location,
                            role: "weather"
                        }
                    }
                });

                // entspricht nicht der doku!!
                let numOfDays = result.day.length;
                //const numOfDays = 5;

                if (typeof numOfDays === "undefined") {
                    adapter.log.info("got wrong data structure! trying to repair...");
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
                    if (typeof numOfDays === "undefined") {
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

                    tasks.push({
                        name: "add",
                        key: "NextHours2.Location_" + ll + ".Day_" + dd,
                        obj: {
                            type: "channel",
                            common: {
                                name: "Day " + dd,
                                role: "weather"
                            }
                        }
                    });

                    /*
                    "units": { "temp": "\u00b0C", "wind": "km\/h", "rain": "mm", "pressure": "mb", "snowline": "m" },
                    */

                    let value = result.day[d].name;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".day";
                    insertIntoList(keyName, value);

                    value = result.day[d].date;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".date";
                    insertIntoList(keyName, value);


                    const unit_temp = result.day[d].units.temp;
                    const unit_wind = result.day[d].units.wind;
                    const unit_rain = result.day[d].units.rain;
                    const unit_pressure = result.day[d].units.pressure;
                    const unit_snowline = result.day[d].units.snowline;

                    adapter.log.debug("got units " + unit_temp + " " + unit_wind + " " + unit_rain + " " + unit_wind + " " + unit_pressure + " " + unit_snowline);

                    value = result.day[d].symbol_value;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol";
                    insertIntoList(keyName, value);

                    //add url for icon
                    insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".iconURL", getIconUrl(value));

                    value = result.day[d].symbol_description;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol_desc";
                    insertIntoList(keyName, value);

                    value = result.day[d].symbol_value2;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol2";
                    insertIntoList(keyName, value);

                    value = result.day[d].symbol_description2;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".symbol_desc2";
                    insertIntoList(keyName, value);

                    value = result.day[d].tempmin;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".tempmin";
                    insertIntoList(keyName, value, unit_temp);

                    value = result.day[d].tempmax;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".tempmax";
                    insertIntoList(keyName, value, unit_temp);

                    value = result.day[d].wind.speed;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_speed";
                    insertIntoList(keyName, value, unit_wind);

                    value = result.day[d].wind.symbol;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_symbol";
                    insertIntoList(keyName, value);

                    value = result.day[d].wind.symbolB;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_symbolB";
                    insertIntoList(keyName, value);

                    //add url for icon
                    insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".windIconURL", getWindIconUrl(value));


                    value = result.day[d].wind.gusts;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".wind_gusts";
                    insertIntoList(keyName, value);

                    value = result.day[d].rain;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".rain";
                    insertIntoList(keyName, value, unit_rain);

                    value = result.day[d].humidity;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".humidity";
                    insertIntoList(keyName, value);

                    value = result.day[d].pressure;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".pressure";
                    insertIntoList(keyName, value, unit_pressure);

                    value = result.day[d].snowline;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".snowline";
                    insertIntoList(keyName, value, unit_snowline);

                    value = result.day[d].sun.in;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".sun_in";
                    insertIntoList(keyName, value);

                    value = result.day[d].sun.mid;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".sun_mid";
                    insertIntoList(keyName, value);

                    value = result.day[d].sun.out;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".sun_out";
                    insertIntoList(keyName, value);

                    const sSunInTime = result.day[d].sun.in;
                    const SunInTimeArr = sSunInTime.split(":");
                    const SunInHour = SunInTimeArr[0];
                    const sSunOutTime = result.day[d].sun.out;
                    const SunOutTimeArr = sSunOutTime.split(":");
                    const SunOutHour = SunOutTimeArr[0];


                    value = result.day[d].moon.in;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_in";
                    insertIntoList(keyName, value);

                    value = result.day[d].moon.out;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_out";
                    insertIntoList(keyName, value);

                    value = result.day[d].moon.lumi;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_lumi";
                    insertIntoList(keyName, value);

                    value = result.day[d].moon.desc;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_desc";
                    insertIntoList(keyName, value);

                    value = result.day[d].moon.symbol;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".moon_symbol";
                    insertIntoList(keyName, value);

                    //add url for icon
                    insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".moonIconURL", getMoonIconUrl(value));

                    value = result.day[d].local_time;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".local_time";
                    insertIntoList(keyName, value);

                    value = result.day[d].local_time_offset;
                    keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".local_time_offset";
                    insertIntoList(keyName, value);

                    const numOfHours = result.day[d].hour.length;
                    adapter.log.debug("got " + numOfHours + " hours");

                    let nSunHours = 0;
                    let nOldTime4Sun = -1;

                    for (let h = 0; h < numOfHours; h++) {

                        //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                        const hh = h + 1;

                        tasks.push({
                            name: "add",
                            key: "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh,
                            obj: {
                                type: "channel",
                                common: {
                                    name: "Hour " + hh,
                                    role: "weather"
                                }
                            }
                        });

                        if (dd === 1) {
                            tasks.push({
                                name: "add",
                                key: "NextHours2.Location_" + ll + ".Day_" + dd + ".current",
                                obj: {
                                    type: "channel",
                                    common: {
                                        name: "current ",
                                        role: "weather"
                                    }
                                }
                            });
                        }

                        value = result.day[d].hour[h].interval;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".hour";
                        insertIntoList(keyName, value);

                        //adapter.log.debug("+++ " + result.day[d].hour[h].interval );

                        const sHour4SunTime = result.day[d].hour[h].interval;
                        const Hour4SunTimeArr = sHour4SunTime.split(":");
                        const Hour4SunTime = parseInt(Hour4SunTimeArr[0], 10);


                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.hour";
                            insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].temp;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                        insertIntoList(keyName, value, unit_temp);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.temp";
                            insertIntoList(keyName, value, unit_temp);
                        }

                        value = result.day[d].hour[h].symbol_value;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                        insertIntoList(keyName, value);

                        //add url for icon
                        insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".iconURL", getIconUrl(value));

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol";
                            insertIntoList(keyName, value);

                            //add url for icon
                            insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".current.iconURL", getIconUrl(value));
                        }

                        value = result.day[d].hour[h].symbol_description;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol_desc";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol_desc";
                            insertIntoList(keyName, value);
                        }


                        value = result.day[d].hour[h].symbol_value2;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol";
                            insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].symbol_description2;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol_desc2";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.symbol_desc2";
                            insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].wind.speed;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_speed";
                        insertIntoList(keyName, value, unit_wind);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_speed";
                            insertIntoList(keyName, value, unit_wind);
                        }

                        value = result.day[d].hour[h].wind.dir;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_dir";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_dir";
                            insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].wind.symbol;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_symbol";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_symbol";
                            insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].wind.symbolB;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_symbolB";
                        insertIntoList(keyName, value);

                        //add url for icon
                        insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windIconURL", getWindIconUrl(value));

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_symbolB";
                            insertIntoList(keyName, value);

                            //add url for icon
                            insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".current.windIconURL", getWindIconUrl(value));

                        }

                        value = result.day[d].hour[h].wind.gusts;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind_gusts";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.wind_gusts";
                            insertIntoList(keyName, value);
                        }

                        value = result.day[d].hour[h].rain;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                        insertIntoList(keyName, value, unit_rain);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.rain";
                            insertIntoList(keyName, value, unit_rain);
                        }

                        value = result.day[d].hour[h].humidity;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.humidity";
                            insertIntoList(keyName, value);

                        }

                        value = result.day[d].hour[h].pressure;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                        insertIntoList(keyName, value, unit_pressure);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.pressure";
                            insertIntoList(keyName, value, unit_pressure);
                        }

                        value = result.day[d].hour[h].clouds;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.clouds";
                            insertIntoList(keyName, value);
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
                        insertIntoList(keyName, value, unit_snowline);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.snowline";
                            insertIntoList(keyName, value, unit_snowline);
                        }

                        value = result.day[d].hour[h].windchill;
                        keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                        insertIntoList(keyName, value);

                        if (dd === 1 && Hour4SunTime === CurrentHour) {
                            keyName = "NextHours2.Location_" + ll + ".Day_" + dd + ".current.windchill";
                            insertIntoList(keyName, value);
                        }
                    }
                    insertIntoList("NextHours2.Location_" + ll + ".Day_" + dd + ".sunshineDuration", nSunHours);
                    //adapter.log.debug("### next day");

                }

            }


        } catch (e) {
            adapter.log.error("exception in getForecastDataHourlyJSON [" + e + "]");

        }
        // } else {
        // ERROR
        //     adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);

        // }


        //      });
    }
}


const tasks = [];

function insertIntoList(key, value, unit) {

    try {

        let sUnit = "";
        if (unit !== undefined) {
            sUnit = unit;
        }

        //adapter.log.debug('insert ' + key + ' with ' + value + ' ' + sUnit );

        let obj;
        let d = key.match(/Day_(\d)\./);
        if (d) {
            d = parseInt(d[1], 10) - 1;
            if (key.match(/\.Location$/)) {
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
            } if (key.match(/\.Maximale_Temperatur_value$/) || key.match(/\.tempmax_value$/) || key.match(/\.tempmax/)) {
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

            } else if (key.match(/\.Wetter_Symbol_value2/)  || key.match(/\.Wetter_Symbol_value/) ) {
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
            } else if (key.match(/\.symbol_value2/)  || key.match(/\.symbol_value/) || key.match(/\.symbol/) || key.match(/\.symbol2/)) {
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
            } else if (key.match(/\.wind_value/) || key.match(/\.Wind_valueB/)) {
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
            } else if (key.match(/\.iconURL/)) {
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



            } else if (key.match(/\.day_name/) || key.match(/\.day/)) {
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
            
            } else if (key.match(/\.temp_value/) || key.match(/\.temp/)) {
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
            } else if ( key.match(/\.wind_speed/)) {
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
            } else if (key.match(/\.local_info_local_time/) || key.match(/\.local_time/)) {
                obj = {
                    type: "state",
                    common: {
                        name: "local time",
                        type: "string",
                        role: "weather.locale.info.time.forecast." + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.local_info_offset/) || key.match(/\.local_time_offset/)) {
                obj = {
                    type: "state",
                    common: {
                        name: "local offset",
                        type: "string",
                        role: "weather.locale.info.offset.forecast." + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.moon_desc/)) {
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

        tasks.push({
            name: "add",
            key: key,
            obj: obj,
            value: value
        });

    } catch (e) {
        adapter.log.error("exception in insertIntoList [" + e + "]");
    }
}

let LastLogObjects = -1;

function startDbUpdate() {
    if (!dbRunning) {

        LastLogObjects = tasks.length;
        adapter.log.debug("objects in list: " + tasks.length);
        processTasks(tasks);
    } else {
        adapter.log.debug("update already running");
    }
}



function processTasks(tasks) {
    if (!tasks || !tasks.length) {
        adapter.log.debug("nothing to do");
        dbRunning = false;

        adapter.log.debug("exit, all done");
        adapter.terminate ? adapter.terminate(0) : process.exit(0);
    } else {
        dbRunning = true;
        const task = tasks.shift();
        // console.log(`${tasks.length} Task ${task.name}: ${task.key}`);
        if (task.name === "add") {
            createExtendObject(task.key, task.obj, task.value, () => setImmediate(processTasks, tasks));
        } else if (task.name === "update") {
            updateExtendObject(task.key, task.value, () => setImmediate(processTasks, tasks));
        } else if (task.name === "delete_channel") {
            deleteChannel(task.key, () => setImmediate(processTasks, tasks));
        } else if (task.name === "delete_state") {
            deleteState(task.key, () => setImmediate(processTasks, tasks));
        } else {
            throw "Unknown task";
        } 

        if (LastLogObjects - tasks.length > 100) {
            adapter.log.debug("objects in list: " + tasks.length);
            LastLogObjects = tasks.length;
        }

    }
}

function createExtendObject(key, objData, value, callback) {
    try {
        adapter.getObject(key, (err, obj) => {
            if (!obj) {
                if (value !== undefined) {
                    adapter.log.debug("back to list: " + key + " " + value);
                    insertIntoList(key, value);
                }
                objData.native = objData.native || {};
                adapter.setObject(key, objData, callback);
            } else if (value !== undefined) {
                if (obj.common.type === "number") {
                    value = parseFloat(value);
                }
                adapter.setState(key, {ack: true, val: value}, callback);
            } else if (typeof callback === "function") {
                callback();
            }
        });
    }
    catch (e) {
        adapter.log.error("exception in createExtendObject [" + e + "]");
    }
}

function updateExtendObject(key, value, callback) {
    try {
        adapter.setState(key, { ack: true, val: value }, callback);
    }
    catch (e) {
        adapter.log.error("exception in updateExtendObject [" + e + "]");
    }
}

/*
function deleteIntoList(type, key) {
    try {
        let name = '';
        if (type === 'channel') {
            name = 'delete_channel';
        } else if (type === 'state') {
            name = 'delete_state';
        }

        tasks.push({
            name: name,
            key: key
        });
    } catch (e) {
        adapter.log.error('exception in deleteIntoList [' + e + ']');
    }
}
*/

function deleteChannel(channel, callback) {

    try {
        adapter.log.debug("try deleting channel " + channel);
        //just do nothing at the moment
        //if (callback) callback();

        adapter.delObject(channel, err =>
            adapter.deleteChannel(channel, callback));

    }
    catch (e) {
        adapter.log.error("exception in deleteChannel [" + e + "]");
    }
}

function deleteState(state, callback) {
    try {
        adapter.log.debug("try deleting state " + state);
        //just do nothing at the moment
        //if (callback) callback();

        adapter.delObject(state, err =>
            // Delete state
            adapter.delState(state, callback));
    }
    catch (e) {
        adapter.log.error("exception in deleteState [" + e + "]");
    }
}

//============================================================================================
// old functions for compatibility

/*
function setObjectNotExistsDelayed(id, obj) {
    tasks.push({
        name: 'add',
        key: id,
        obj: obj
    });
}
*/



// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 

