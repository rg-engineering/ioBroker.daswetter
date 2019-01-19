/*
 * DasWetter.com adapter für iobroker
 *
 * Created: 21.03.2017 21:31:28
 *  Author: Rene

Copyright(C)[2016, 2017, 2018][René Glaß]

*/

/* jshint -W097 */
/* jshint strict: false */
/* jslint node: true */
'use strict';

// you have to require the utils module and call adapter function
const utils = require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
const adapter = utils.Adapter('daswetter');
const request = require('request');
const parseString = require('xml2js').parseString;

let dbRunning = false;
let allDone = false;


// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', main);

function main() {
    // force terminate 
    var nParseTimeout = 60;
    if (adapter.config.parseTimeout > 0) {
        nParseTimeout = adapter.config.parseTimeout;
    }
    adapter.log.debug('set timeout to ' + nParseTimeout + ' sec');
    nParseTimeout = nParseTimeout * 1000;
    setTimeout(() => {
        adapter.log.error('force terminate, objects still in list: ' + Object.keys(tasks).length);
        process.exit(15);
    }, nParseTimeout);
    
    allDone = false;

    if (adapter.config.DeleteUnusedDataset) {
        
        deleteOldData(adapter.config.UseNewDataset);
        //should be done only once

        adapter.log.debug('deleting unused dataset, reset to ' + adapter.config.DeleteUnusedDataset);
    }

    if (adapter.config.UseNewDataset == false && adapter.config.HourlyForecastJSON) {
        adapter.log.error('path 4 will not be parsed with old data structure! Please use new data structure!');
    }


    if (adapter.config.UseNewDataset) {
        adapter.log.debug('using new datastructure');
        getForecastData7Days();
    } else {
        adapter.log.debug('using old datastructure');
        checkWeatherVariablesOld();
        getForecastData7DaysOld();
    }
}

function getIconUrl(num) {
    const iconSet = adapter.config.iconSet || 6;
    num = parseInt(num, 10) || 0;
    if (num && iconSet > 4 && !adapter.config.UsePNGorOriginalSVG) {
        return '/adapter/daswetter/icons/tiempo-weather/galeria' + iconSet + '/' + num + '.svg';
    } else if (num) {
        return '/adapter/daswetter/icons/tiempo-weather/galeria' + iconSet + '/' + num + '.png';
    } else {
        return '';
    }
}

function getWindIconUrl(num) {
    num = parseInt(num, 10) || 0;
    if (num) {
        return '/adapter/daswetter/icons/viento-wind/' + num + '.png';
    } else {
        return '';
    }
}



function getProps(obj, keyName) {
    //rückwärts parsen, dann kommt unit for dem wert und kann somit in die liste eingetragen werden
    var arr = [];
    var unit = "";
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            arr.push(prop);
        }
    }
    for (var i = arr.length - 1; i >= 0; i--) {
        const dataValue = obj[arr[i]];
        if (arr[i] === 'unit') {
            //parse unit
            unit = dataValue.replace(/\s/g, '_');

            //adapter.log.debug('got unit '  + dataValue);
        }
        else if (arr[i] !== 'data_sequence') {
            const keyNameLong = keyName + '_' + arr[i].replace(/\s/g, '_');
            insertIntoList(keyNameLong, dataValue, unit);
            unit = "";
        }
    }
}


function getForecastData7Days(cb) {
    if (adapter.config.Days7Forecast) {
        const url = adapter.config.Days7Forecast;
        adapter.log.debug('calling forecast 7 days: ' + url);

        request(url, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                try {
                    //convert xml to json first
                    parseString(body, (err, result) => {
                        
                        const numOfLocations = result.report.location.length;

                        for (let l = 0; l < numOfLocations; l++) {
                            const ll = l + 1;

                            let location = result.report.location[l].$.city;
                            const pos = location.indexOf('[');
                            if (pos !== -1) {
                                location = location.substring(0, pos).trim();
                            }

                            insertIntoList('NextDays.Location_' + ll +  '.Location', location);


                            const numOfPeriods = result.report.location[l].var[0].data[0].forecast.length;

                            tasks.push({
                                name: 'add',
                                key: 'NextDays.Location_' + ll,
                                obj: {
                                    type: 'device',
                                    common: {
                                        name: result.report.location[l].$.city,
                                        role: 'weather'
                                    }
                                }
                            });
                           

                            for (let p = 0; p < numOfPeriods; p++) {
                                const pp = p + 1;
                                tasks.push({
                                    name: 'add',
                                    key: 'NextDays.Location_' + ll + '.Day_' + pp,
                                    obj: {
                                        type: 'channel',
                                        common: {
                                            name: 'Day ' + pp,
                                            role: 'weather'
                                        }
                                    }
                                });
                                
                                
                                

                                const numOfDatapoints = result.report.location[l].var.length;
                                for (let d = 0; d < numOfDatapoints; d++) {
                                    const datapointName = result.report.location[l].var[d].name[0].replace(/\s/g, '_');
                                    const keyName = 'NextDays.Location_' + ll + '.Day_' + pp + '.' + datapointName;
                                    const value = result.report.location[l].var[d].data[0].forecast[p].$;
                                    getProps(value, keyName);
                                    if (datapointName === 'Wetter_Symbol' && value.id2) {
                                        insertIntoList('NextDays.Location_' + ll + '.Day_' + pp + '.iconURL', getIconUrl(value.id2));
                                    } else if (datapointName === 'Wind' && value.idB) {
                                        insertIntoList('NextDays.Location_' + ll + '.Day_' + pp + '.windIconURL', getWindIconUrl(value.idB));
                                    }
                                }
                            }
                        }

                        adapter.log.debug('7 days forecast done, objects in list ' + Object.keys(tasks).length);

                        if (!dbRunning) {
                            startDbUpdate();
                        } else {
                            adapter.log.debug('update already running');
                        }
                        getForecastData5Days(cb);
                    });
                } catch (e) {
                    adapter.log.error('exception in 7DaysForecast [' + e + ']');
                    getForecastData5Days(cb);
                }
            } else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);
                getForecastData5Days(cb);
            }
        });
    } else {
        getForecastData5Days(cb);
    }
    cb && cb();
}

function getForecastData5Days(cb) {
    if (adapter.config.Days5Forecast) {
        const url = adapter.config.Days5Forecast;
        adapter.log.debug('calling forecast 5 days: ' + url);

        request(url, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                try {
                    //adapter.log.debug('got body: ' + body);
                    const body1 = body.replace(/wind-gusts/g, 'windgusts');

                    parseString(body1, (err, result) => {
                        
                        const numOfLocations = result.report.location.length;

                        for (let l = 0; l < numOfLocations; l++) {

                            const ll = l + 1;

                            let location = result.report.location[l].$.city;
                            const pos = location.indexOf('[');
                            if (pos !== -1) {
                                location = location.substring(0, pos).trim();
                            }

                            insertIntoList('NextDaysDetailed.Location_' + ll  + '.Location', location);


                            tasks.push({
                                name: 'add',
                                key: 'NextDaysDetailed.Location_' + ll,
                                obj: {
                                    type: 'device',
                                    common: {
                                        name: result.report.location[l].$.city,
                                        role: 'weather'
                                    }
                                }
                            });

                            const numOfDays = result.report.location[l].day.length;

                            for (let d = 0; d < numOfDays; d++) {

                                let keyName = '';
                                
                                const dd = d + 1;


                                tasks.push({
                                    name: 'add',
                                    key: 'NextDaysDetailed.Location_' + ll + '.Day_' + dd,
                                    obj: {
                                        type: 'channel',
                                        common: {
                                            name: 'Day ' + dd,
                                            role: 'weather'
                                        }
                                    }
                                });

                                
                                

                                let value = result.report.location[l].day[d].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.day';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].symbol[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.symbol';
                                getProps(value, keyName);

                                //add url for icon
                                insertIntoList('NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.iconURL', getIconUrl(value.value));


                                value = result.report.location[l].day[d].tempmin[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.tempmin';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].tempmax[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.tempmax';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].wind[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.wind';
                                getProps(value, keyName);

                                //add url for icon
                                insertIntoList('NextDaysDetailed.Location_' + ll + '.Day_' + dd  + '.windIconURL', getWindIconUrl(value.symbolB));


                                value = result.report.location[l].day[d].windgusts[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.windgusts';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].rain[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.rain';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].humidity[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.humidity';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].pressure[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.pressure';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].snowline[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.snowline';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].sun[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.sun';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].moon[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.moon';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].local_info[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.local_info';
                                getProps(value, keyName);

                                const numOfHours = result.report.location[l].day[d].hour.length;

                                for (let h = 0; h < numOfHours; h++) {

                                    //adapter.log.debug('location: ' + l + ' day: ' + d + ' hour ' + h);
                                    const hh = h + 1;

                                    tasks.push({
                                        name: 'add',
                                        key: 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh,
                                        obj: {
                                            type: 'channel',
                                            common: {
                                                name: 'Hour ' + hh,
                                                role: 'weather'
                                            }
                                        }
                                    });


                                    value = result.report.location[l].day[d].hour[h].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + ".hour";
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].temp[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.temp';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].symbol[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol';
                                    getProps(value, keyName);

                                    //add url for icon
                                    insertIntoList('NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.iconURL', getIconUrl(value.value));
                                    



                                    value = result.report.location[l].day[d].hour[h].wind[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind';
                                    getProps(value, keyName);

                                    //add url for icon
                                    insertIntoList('NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windIconURL', getWindIconUrl(value.symbolB));

                                    value = result.report.location[l].day[d].hour[h].windgusts[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windgusts';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].rain[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.rain';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].humidity[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.humidity';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].pressure[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.pressure';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].clouds[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.clouds';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].snowline[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.snowline';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].windchill[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windchill';
                                    getProps(value, keyName);
                                }
                            }
                        }

                        adapter.log.debug('5 days forecast done, objects in list ' + Object.keys(tasks).length);
                        if (!dbRunning) {
                            startDbUpdate();
                        } else {
                            adapter.log.debug('update already running');
                        }
                        getForecastDataHourly(cb);
                    });
                } catch (e) {
                    adapter.log.error('exception in 5DaysForecast [' + e + ']');
                    getForecastDataHourly(cb);
                }
            } else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);
                getForecastDataHourly(cb);
            }
        });
    } else {
        getForecastDataHourly(cb);
    }
    //if (cb) cb();
}

function getForecastDataHourly(cb) {

    if (adapter.config.HourlyForecast) {
        const url = adapter.config.HourlyForecast;
        adapter.log.debug('calling forecast hourly: ' + url);

        request(url, (error, response, body) => {
            if (!error && response.statusCode === 200) {

                try {

                    const body1 = body.replace(/wind-gusts/g, 'windgusts');

                    parseString(body1, (err, result) => {

                        const numOfLocations = result.report.location.length;

                        for (let l = 0; l < numOfLocations; l++) {

                            const ll = l + 1;

                            let location = result.report.location[l].$.city;
                            const pos = location.indexOf('[');
                            if (pos !== -1) {
                                location = location.substring(0, pos).trim();
                            }

                            insertIntoList('NextHours.Location_' + ll + '.Location', location);

                            tasks.push({
                                name: 'add',
                                key: 'NextHours.Location_' + ll,
                                obj: {
                                    type: 'device',
                                    common: {
                                        name: result.report.location[l].$.city,
                                        role: 'weather'
                                    }
                                }
                            });


                            const numOfDays = result.report.location[l].day.length;

                            var CurrentDate = new Date();
                            var CurrentHour = CurrentDate.getHours();

                            for (let d = 0; d < numOfDays; d++) {

                                let keyName = '';

                                const dd = d + 1;

                                tasks.push({
                                    name: 'add',
                                    key: 'NextHours.Location_' + ll + '.Day_' + dd,
                                    obj: {
                                        type: 'channel',
                                        common: {
                                            name: 'Day ' + dd,
                                            role: 'weather'
                                        }
                                    }
                                });





                                //adapter.log.debug('loc: ' + l + ' day: ' + d + ' = ' + JSON.stringify(result.report.location[l].day[d]));

                                let value = result.report.location[l].day[d].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + ".day";
                                //adapter.log.debug(JSON.stringify(result.report.location[l].day[d].$));
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].symbol[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.symbol';
                                getProps(value, keyName);

                                //add url for icon
                                insertIntoList('NextHours.Location_' + ll + '.Day_' + dd + '.iconURL', getIconUrl(value.value));

                                value = result.report.location[l].day[d].tempmin[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.tempmin';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].tempmax[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.tempmax';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].wind[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.wind';
                                getProps(value, keyName);

                                //add url for icon
                                insertIntoList('NextHours.Location_' + ll + '.Day_' + dd + '.windIconURL', getWindIconUrl(value.symbolB));


                                value = result.report.location[l].day[d].windgusts[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.windgusts';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].rain[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.rain';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].humidity[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.humidity';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].pressure[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.pressure';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].snowline[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.snowline';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].sun[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.sun';
                                getProps(value, keyName);


                                var sSunInTime = result.report.location[l].day[d].sun[0].$.in;
                                var SunInTimeArr = sSunInTime.split(":");
                                var SunInHour = SunInTimeArr[0];
                                var sSunOutTime = result.report.location[l].day[d].sun[0].$.out;
                                var SunOutTimeArr = sSunOutTime.split(":");
                                var SunOutHour = SunOutTimeArr[0];

                                value = result.report.location[l].day[d].moon[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.moon';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].local_info[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.local_info';
                                getProps(value, keyName);


                                const numOfHours = result.report.location[l].day[d].hour.length;

                                var nSunHours = 0;
                                var nOldTime4Sun = -1;



                                for (let h = 0; h < numOfHours; h++) {

                                    //adapter.log.debug('location: ' + l + ' day: ' + d + ' hour ' + h);
                                    const hh = h + 1;

                                    tasks.push({
                                        name: 'add',
                                        key: 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh,
                                        obj: {
                                            type: 'channel',
                                            common: {
                                                name: 'Hour ' + hh,
                                                role: 'weather'
                                            }
                                        }
                                    });

                                    if (dd == 1) {
                                        tasks.push({
                                            name: 'add',
                                            key: 'NextHours.Location_' + ll + '.Day_' + dd + '.current',
                                            obj: {
                                                type: 'channel',
                                                common: {
                                                    name: 'current ',
                                                    role: 'weather'
                                                }
                                            }
                                        });

                                    }


                                    value = result.report.location[l].day[d].hour[h].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + ".hour";
                                    getProps(value, keyName);
                                    var sHour4SunTime = result.report.location[l].day[d].hour[h].$.value;
                                    var Hour4SunTimeArr = sHour4SunTime.split(":");
                                    var Hour4SunTime = Hour4SunTimeArr[0];
                                    //adapter.log.debug("+++ " + sHour4SunTime + " " + Hour4SunTimeArr + " " + Hour4SunTime);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.hour';
                                        getProps(value, keyName);
                                    }


                                    value = result.report.location[l].day[d].hour[h].temp[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.temp';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.temp';
                                        getProps(value, keyName);
                                    }

                                    value = result.report.location[l].day[d].hour[h].symbol[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.symbol';
                                        getProps(value, keyName);
                                    }

                                    //add url for icon
                                    insertIntoList('NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.iconURL', getIconUrl(value.value));
                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        insertIntoList('NextHours.Location_' + ll + '.Day_' + dd + '.current.iconURL', getIconUrl(value.value));

                                    }


                                    value = result.report.location[l].day[d].hour[h].wind[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.wind';
                                        getProps(value, keyName);

                                    }

                                    //add url for icon
                                    insertIntoList('NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windIconURL', getWindIconUrl(value.symbolB));

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        insertIntoList('NextHours.Location_' + ll + '.Day_' + dd + '.current.windIconURL', getWindIconUrl(value.symbolB));

                                    }

                                    value = result.report.location[l].day[d].hour[h].windgusts[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windgusts';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.windgusts';
                                        getProps(value, keyName);

                                    }

                                    value = result.report.location[l].day[d].hour[h].rain[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.rain';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.rain';
                                        getProps(value, keyName);

                                    }

                                    value = result.report.location[l].day[d].hour[h].humidity[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.humidity';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.humidity';
                                        getProps(value, keyName);

                                    }

                                    value = result.report.location[l].day[d].hour[h].pressure[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.pressure';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.pressure';
                                        getProps(value, keyName);

                                    }

                                    value = result.report.location[l].day[d].hour[h].clouds[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.clouds';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.clouds';
                                        getProps(value, keyName);

                                    }


                                    var CloudTime = parseInt(result.report.location[l].day[d].hour[h].clouds[0].$.value);
                                    var SunTime = 100 - CloudTime;
                                    if (SunTime > 0 && Hour4SunTime >= SunInHour && Hour4SunTime <= SunOutHour) {
                                        var diff = 1;
                                        if (nOldTime4Sun > -1) {
                                            diff = Hour4SunTime - nOldTime4Sun;
                                        }
                                        else {
                                            diff = Hour4SunTime;
                                        }
                                        var SunHours = diff * SunTime / 100.0;
                                        nSunHours += SunHours;
                                    }
                                    nOldTime4Sun = Hour4SunTime;
                                    //adapter.log.debug("### " + SunTime + "% = " + nSunHours + "SunIn " + SunInHour + " SunOut " + SunOutHour);

                                    value = result.report.location[l].day[d].hour[h].snowline[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.snowline';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.snowline';
                                        getProps(value, keyName);

                                    }

                                    value = result.report.location[l].day[d].hour[h].windchill[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windchill';
                                    getProps(value, keyName);

                                    if (dd == 1 && Hour4SunTime == CurrentHour) {
                                        keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.current.windchill';
                                        getProps(value, keyName);
                                    }
                                }

                                insertIntoList('NextHours.Location_' + ll + '.Day_' + dd + '.sunshineDuration', nSunHours);
                                //adapter.log.debug("### next day");
                            }
                        }

                        adapter.log.debug('hourly forecast done, objects in list ' + Object.keys(tasks).length);

                        if (!dbRunning) {
                            startDbUpdate();
                        } else {
                            adapter.log.debug('update already running');
                        }
                        getForecastDataHourlyJSON(cb);
                    });
                } catch (e) {
                    adapter.log.error('exception in HourlyForecast [' + e + ']');
                    getForecastDataHourlyJSON(cb);
                }
            } else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);
                getForecastDataHourlyJSON(cb);
            }
        });
    }
    else {
        getForecastDataHourlyJSON(cb);
    }
}

/*
daswetter.0 got { 
"1": { 
    "date": "20190112", 
    "name": "Samstag", 
    "month": "", 
    "symbol_value": "19", 
    "symbol_description": "Bedeckt mit Schneeschauern", 
    "symbol_value2": "22", 
    "symbol_description2": 
    "Bedeckt mit Schneeregen", 
    "tempmin": "0", 
    "tempmax": "3", 
    "wind": { 
        "speed": "24", 
        "symbol": "14", 
        "symbolB": "54", 
        "gusts": "49" 
    }, 
    "rain": "4.8", 
    "humidity": "92", 
    "pressure": "1016", 
    "snowline": "500", 
    "sun": { 
        "in": "08:07", 
        "mid": "12:17", 
        "out": "16:29" 
    }, 
    "moon": { 
        "in": "11:15", 
        "out": "23:03", 
        "lumi": "32.59%", 
        "desc": "zunehm. Mond, 32.59% Beleuchtet", 
        "symbol": "5" 
    }, 
    "units": { 
        "temp": "°C", 
        "wind": "km/h", 
        "rain": "mm", 
        "pressure": "mb", 
        "snowline": "m" 
    }, 
    "local_time": "13:10", 
    "local_time_offset": 1, 
    "hour": [
        { 
            "interval": "02:00", 
            "temp": "1", 
            "symbol_value": "4", 
            "symbol_description": "Bedeckt", 
            "symbol_value2": "4", 
            "symbol_description2": "Bedeckt", 
            "wind": { 
                "speed": "11", 
                "dir": "W", 
                "symbol": "15", 
                "symbolB": "47", 
                "gusts": "30" 
            }, 
            "rain": "0", 
            "humidity": "99", 
            "pressure": "1021", 
            "clouds": "100%", 
            "snowline": "500", 
            "windchill": "-3" 
        }, 
        { "interval": "05:00", "temp": "1", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "16", "dir": "W", "symbol": "15", "symbolB": "47", "gusts": "34" }, "rain": "0.2", "humidity": "98", "pressure": "1019", "clouds": "100%", "snowline": "700", "windchill": "-2" }, { "interval": "08:00", "temp": "2", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "20", "dir": "W", "symbol": "15", "symbolB": "47", "gusts": "38" }, "rain": "0.6", "humidity": "94", "pressure": "1018", "clouds": "95%", "snowline": "800", "windchill": "-2" }, { "interval": "11:00", "temp": "2", "symbol_value": "6", "symbol_description": "Bewölkt mit leichtem Regen", "symbol_value2": "6", "symbol_description2": "Bewölkt mit leichtem Regen", "wind": { "speed": "21", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "43" }, "rain": "0.1", "humidity": "88", "pressure": "1018", "clouds": "91%", "snowline": "800", "windchill": "-2" }, { "interval": "14:00", "temp": "2", "symbol_value": "4", "symbol_description": "Bedeckt", "symbol_value2": "4", "symbol_description2": "Bedeckt", "wind": { "speed": "21", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "42" }, "rain": "0", "humidity": "89", "pressure": "1015", "clouds": "99%", "snowline": "700", "windchill": "-2" }, { "interval": "17:00", "temp": "2", "symbol_value": "19", "symbol_description": "Bedeckt mit Schneeschauern", "symbol_value2": "22", "symbol_description2": "Bedeckt mit Schneeregen", "wind": { "speed": "24", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "47" }, "rain": "0.9", "humidity": "88", "pressure": "1013", "clouds": "100%", "snowline": "700", "windchill": "-3" }, { "interval": "20:00", "temp": "1", "symbol_value": "19", "symbol_description": "Bedeckt mit Schneeschauern", "symbol_value2": "22", "symbol_description2": "Bedeckt mit Schneeregen", "wind": { "speed": "23", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "49" }, "rain": "1.8", "humidity": "91", "pressure": "1011", "clouds": "97%", "snowline": "700", "windchill": "-3" }, { "interval": "23:00", "temp": "2", "symbol_value": "6", "symbol_description": "Bewölkt mit leichtem Regen", "symbol_value2": "6", "symbol_description2": "Bewölkt mit leichtem Regen", "wind": { "speed": "19", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "45" }, "rain": "1.2", "humidity": "93", "pressure": "1010", "clouds": "93%", "snowline": "700", "windchill": "-3" }] }, 
"2": { "date": "20190113", "name": "Sonntag", "month": "", "symbol_value": "10", "symbol_description": "Bedeckt mit mäßigem Regen", "symbol_value2": "10", "symbol_description2": "Bedeckt mit mäßigem Regen", "tempmin": "1", "tempmax": "5", "wind": { "speed": "30", "symbol": "23", "symbolB": "71", "gusts": "69" }, "rain": "13", "humidity": "91", "pressure": "1001", "snowline": "700", "sun": { "in": "08:06", "mid": "12:18", "out": "16:30" }, "moon": { "in": "11:35", "out": "--:--", "lumi": "41.98%", "desc": "zunehm. Mond, 41.98% Beleuchtet", "symbol": "6" }, "units": { "temp": "°C", "wind": "km/h", "rain": "mm", "pressure": "mb", "snowline": "m" }, "local_time": "13:10", "local_time_offset": 1, "hour": [{ "interval": "02:00", "temp": "2", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "18", "dir": "W", "symbol": "15", "symbolB": "47", "gusts": "37" }, "rain": "0.9", "humidity": "94", "pressure": "1009", "clouds": "99%", "snowline": "700", "windchill": "-2" }, { "interval": "05:00", "temp": "2", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "19", "dir": "W", "symbol": "15", "symbolB": "47", "gusts": "37" }, "rain": "0.3", "humidity": "92", "pressure": "1008", "clouds": "100%", "snowline": "800", "windchill": "-2" }, { "interval": "08:00", "temp": "2", "symbol_value": "4", "symbol_description": "Bedeckt", "symbol_value2": "4", "symbol_description2": "Bedeckt", "wind": { "speed": "20", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "41" }, "rain": "0", "humidity": "92", "pressure": "1006", "clouds": "100%", "snowline": "800", "windchill": "-2" }, { "interval": "11:00", "temp": "3", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "21", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "44" }, "rain": "1.5", "humidity": "93", "pressure": "1003", "clouds": "100%", "snowline": "1000", "windchill": "-2" }, { "interval": "14:00", "temp": "3", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "22", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "47" }, "rain": "3.3", "humidity": "92", "pressure": "1000", "clouds": "100%", "snowline": "1100", "windchill": "-1" }, { "interval": "17:00", "temp": "4", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "21", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "46" }, "rain": "2.8", "humidity": "89", "pressure": "997", "clouds": "100%", "snowline": "1300", "windchill": "0" }, { "interval": "20:00", "temp": "4", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "26", "dir": "W", "symbol": "23", "symbolB": "63", "gusts": "54" }, "rain": "2.2", "humidity": "88", "pressure": "994", "clouds": "98%", "snowline": "1200", "windchill": "0" }, { "interval": "23:00", "temp": "4", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "30", "dir": "W", "symbol": "23", "symbolB": "71", "gusts": "69" }, "rain": "1.7", "humidity": "89", "pressure": "994", "clouds": "97%", "snowline": "1000", "windchill": "-1" }] }, 
"3": { "date": "20190114", "name": "Montag", "month": "", "symbol_value": "18", "symbol_description": "Bewölkt mit Schnee", "symbol_value2": "18", "symbol_description2": "Bewölkt mit Schnee", "tempmin": "-2", "tempmax": "4", "wind": { "speed": "30", "symbol": "24", "symbolB": "72", "gusts": "70" }, "rain": "6.3", "humidity": "85", "pressure": "1005", "snowline": "100", "sun": { "in": "08:05", "mid": "12:18", "out": "16:31" }, "moon": { "in": "11:55", "out": "00:09", "lumi": "51.89%", "desc": "zunehm. Mond, 51.89% Beleuchtet", "symbol": "7" }, "units": { "temp": "°C", "wind": "km/h", "rain": "mm", "pressure": "mb", "snowline": "m" }, "local_time": "13:10", "local_time_offset": 1, "hour": [{ "interval": "01:00", "temp": "2", "symbol_value": "7", "symbol_description": "Bedeckt mit leichtem Regen", "symbol_value2": "7", "symbol_description2": "Bedeckt mit leichtem Regen", "wind": { "speed": "28", "dir": "NW", "symbol": "24", "symbolB": "72", "gusts": "69" }, "rain": "1.5", "humidity": "91", "pressure": "995", "clouds": "99%", "snowline": "800", "windchill": "-3" }, { "interval": "04:00", "temp": "1", "symbol_value": "18", "symbol_description": "Bewölkt mit Schnee", "symbol_value2": "18", "symbol_description2": "Bewölkt mit Schnee", "wind": { "speed": "30", "dir": "NW", "symbol": "24", "symbolB": "72", "gusts": "69" }, "rain": "1.2", "humidity": "88", "pressure": "999", "clouds": "58%", "snowline": "600", "windchill": "-5" }, { "interval": "07:00", "temp": "0", "symbol_value": "18", "symbol_description": "Bewölkt mit Schnee", "symbol_value2": "18", "symbol_description2": "Bewölkt mit Schnee", "wind": { "speed": "23", "dir": "NW", "symbol": "24", "symbolB": "72", "gusts": "68" }, "rain": "0.9", "humidity": "85", "pressure": "1003", "clouds": "87%", "snowline": "400", "windchill": "-5" }, { "interval": "10:00", "temp": "0", "symbol_value": "19", "symbol_description": "Bedeckt mit Schneeschauern", "symbol_value2": "19", "symbol_description2": "Bedeckt mit Schneeschauern", "wind": { "speed": "20", "dir": "W", "symbol": "23", "symbolB": "71", "gusts": "62" }, "rain": "0.8", "humidity": "88", "pressure": "1005", "clouds": "97%", "snowline": "400", "windchill": "-5" }, { "interval": "13:00", "temp": "0", "symbol_value": "19", "symbol_description": "Bedeckt mit Schneeschauern", "symbol_value2": "19", "symbol_description2": "Bedeckt mit Schneeschauern", "wind": { "speed": "26", "dir": "NW", "symbol": "24", "symbolB": "72", "gusts": "70" }, "rain": "1.2", "humidity": "85", "pressure": "1007", "clouds": "96%", "snowline": "400", "windchill": "-6" }, { "interval": "16:00", "temp": "-1", "symbol_value": "17", "symbol_description": "Teils bewölkt mit Schnee", "symbol_value2": "17", "symbol_description2": "Teils bewölkt mit Schnee", "wind": { "speed": "19", "dir": "NW", "symbol": "24", "symbolB": "64", "gusts": "57" }, "rain": "0.7", "humidity": "78", "pressure": "1008", "clouds": "14%", "snowline": "300", "windchill": "-6" }, { "interval": "19:00", "temp": "-2", "symbol_value": "2", "symbol_description": "Teils bewölkt", "symbol_value2": "2", "symbol_description2": "Teils bewölkt", "wind": { "speed": "21", "dir": "NW", "symbol": "16", "symbolB": "56", "gusts": "42" }, "rain": "0", "humidity": "85", "pressure": "1011", "clouds": "30%", "snowline": "100", "windchill": "-7" }, { "interval": "22:00", "temp": "-2", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "20", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "43" }, "rain": "0", "humidity": "85", "pressure": "1013", "clouds": "71%", "snowline": "100", "windchill": "-7" }] }, 
"4": { "date": "20190115", "name": "Dienstag", "month": "", "symbol_value": "18", "symbol_description": "Bewölkt mit Schnee", "symbol_value2": "18", "symbol_description2": "Bewölkt mit Schnee", "tempmin": "-2", "tempmax": "1", "wind": { "speed": "24", "symbol": "23", "symbolB": "63", "gusts": "52" }, "rain": "4.3", "humidity": "83", "pressure": "1017", "snowline": "100", "sun": { "in": "08:05", "mid": "12:19", "out": "16:33" }, "moon": { "in": "12:18", "out": "01:19", "lumi": "62.02%", "desc": "zunehm. Mond, 62.02% Beleuchtet", "symbol": "8" }, "units": { "temp": "°C", "wind": "km/h", "rain": "mm", "pressure": "mb", "snowline": "m" }, "local_time": "13:10", "local_time_offset": 1, "hour": [{ "interval": "01:00", "temp": "-2", "symbol_value": "19", "symbol_description": "Bedeckt mit Schneeschauern", "symbol_value2": "19", "symbol_description2": "Bedeckt mit Schneeschauern", "wind": { "speed": "22", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "44" }, "rain": "0.3", "humidity": "85", "pressure": "1014", "clouds": "98%", "snowline": "100", "windchill": "-7" }, { "interval": "04:00", "temp": "-2", "symbol_value": "18", "symbol_description": "Bewölkt mit Schnee", "symbol_value2": "18", "symbol_description2": "Bewölkt mit Schnee", "wind": { "speed": "24", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "49" }, "rain": "0.6", "humidity": "81", "pressure": "1014", "clouds": "93%", "snowline": "200", "windchill": "-8" }, { "interval": "07:00", "temp": "-2", "symbol_value": "18", "symbol_description": "Bewölkt mit Schnee", "symbol_value2": "18", "symbol_description2": "Bewölkt mit Schnee", "wind": { "speed": "23", "dir": "NW", "symbol": "24", "symbolB": "64", "gusts": "52" }, "rain": "1", "humidity": "83", "pressure": "1016", "clouds": "85%", "snowline": "200", "windchill": "-8" }, { "interval": "10:00", "temp": "-1", "symbol_value": "18", "symbol_description": "Bewölkt mit Schnee", "symbol_value2": "18", "symbol_description2": "Bewölkt mit Schnee", "wind": { "speed": "20", "dir": "NW", "symbol": "16", "symbolB": "56", "gusts": "47" }, "rain": "1.5", "humidity": "87", "pressure": "1018", "clouds": "93%", "snowline": "200", "windchill": "-6" }, { "interval": "13:00", "temp": "1", "symbol_value": "17", "symbol_description": "Teils bewölkt mit Schnee", "symbol_value2": "17", "symbol_description2": "Teils bewölkt mit Schnee", "wind": { "speed": "20", "dir": "NW", "symbol": "16", "symbolB": "56", "gusts": "43" }, "rain": "0.5", "humidity": "78", "pressure": "1019", "clouds": "52%", "snowline": "500", "windchill": "-4" }, { "interval": "16:00", "temp": "0", "symbol_value": "19", "symbol_description": "Bedeckt mit Schneeschauern", "symbol_value2": "19", "symbol_description2": "Bedeckt mit Schneeschauern", "wind": { "speed": "19", "dir": "W", "symbol": "15", "symbolB": "55", "gusts": "40" }, "rain": "0.4", "humidity": "88", "pressure": "1019", "clouds": "96%", "snowline": "500", "windchill": "-4" }, { "interval": "19:00", "temp": "0", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "24", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "46" }, "rain": "0", "humidity": "82", "pressure": "1018", "clouds": "92%", "snowline": "500", "windchill": "-5" }, { "interval": "22:00", "temp": "0", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "23", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "47" }, "rain": "0", "humidity": "84", "pressure": "1018", "clouds": "80%", "snowline": "500", "windchill": "-5" }] }, 
"5": { "date": "20190116", "name": "Mittwoch", "month": "", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "tempmin": "-1", "tempmax": "1", "wind": { "speed": "22", "symbol": "14", "symbolB": "54", "gusts": "45" }, "rain": "0", "humidity": "90", "pressure": "1015", "snowline": "300", "sun": { "in": "08:04", "mid": "12:19", "out": "16:34" }, "moon": { "in": "12:44", "out": "02:30", "lumi": "71.97%", "desc": "zunehm. Mond, 71.97% Beleuchtet", "symbol": "9" }, "units": { "temp": "°C", "wind": "km/h", "rain": "mm", "pressure": "mb", "snowline": "m" }, "local_time": "13:10", "local_time_offset": 1, "hour": [{ "interval": "01:00", "temp": "-1", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "22", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "45" }, "rain": "0", "humidity": "91", "pressure": "1018", "clouds": "71%", "snowline": "300", "windchill": "-6" }, { "interval": "04:00", "temp": "-1", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "20", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "43" }, "rain": "0", "humidity": "93", "pressure": "1017", "clouds": "90%", "snowline": "300", "windchill": "-6" }, { "interval": "07:00", "temp": "-1", "symbol_value": "4", "symbol_description": "Bedeckt", "symbol_value2": "4", "symbol_description2": "Bedeckt", "wind": { "speed": "17", "dir": "SW", "symbol": "14", "symbolB": "46", "gusts": "38" }, "rain": "0", "humidity": "94", "pressure": "1016", "clouds": "98%", "snowline": "300", "windchill": "-6" }, { "interval": "10:00", "temp": "-1", "symbol_value": "4", "symbol_description": "Bedeckt", "symbol_value2": "4", "symbol_description2": "Bedeckt", "wind": { "speed": "19", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "39" }, "rain": "0", "humidity": "93", "pressure": "1016", "clouds": "99%", "snowline": "300", "windchill": "-6" }, { "interval": "13:00", "temp": "1", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "21", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "42" }, "rain": "0", "humidity": "86", "pressure": "1015", "clouds": "82%", "snowline": "500", "windchill": "-4" }, { "interval": "16:00", "temp": "0", "symbol_value": "2", "symbol_description": "Teils bewölkt", "symbol_value2": "2", "symbol_description2": "Teils bewölkt", "wind": { "speed": "19", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "41" }, "rain": "0", "humidity": "87", "pressure": "1013", "clouds": "34%", "snowline": "500", "windchill": "-4" }, { "interval": "19:00", "temp": "-1", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "20", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "39" }, "rain": "0", "humidity": "89", "pressure": "1012", "clouds": "88%", "snowline": "600", "windchill": "-6" }, { "interval": "22:00", "temp": "-1", "symbol_value": "3", "symbol_description": "Bewölkt", "symbol_value2": "3", "symbol_description2": "Bewölkt", "wind": { "speed": "22", "dir": "SW", "symbol": "14", "symbolB": "54", "gusts": "42" }, "rain": "0", "humidity": "81", "pressure": "1011", "clouds": "83%", "snowline": "1100", "windchill": "-6" }] } 
}

*/

/*
daswetter.0 --- {
    "status":0,
    "location":"Rodewisch [Sachsen;Deutschland]",
    "url":"https://www.daswetter.com/wetter_Rodewisch-Europa-Deutschland-Sachsen--1-27287.html",
    "day":[
        {"date":"20190113","name":"Sonntag","month":"","symbol_value":"10","symbol_description":"Bedeckt mit mäßigem Regen","symbol_value2":"10","symbol_description2":"Bedeckt mit mäßigem Regen","tempmin":"1","tempmax":"6","wind":{"speed":"30","symbol":"24","symbolB":"72","gusts":"69"},"rain":"12","humidity":"92","pressure":"1002","snowline":"600","sun":{"in":"08:06","mid":"12:18","out":"16:30"},"moon":{"in":"11:35","out":"--:--","lumi":"41.98%","desc":"zunehm. Mond, 41.98% Beleuchtet","symbol":"6"},"units":{"temp":"°C","wind":"km/h","rain":"mm","pressure":"mb","snowline":"m"},"local_time":"11:48","local_time_offset":1,"hour":[{"interval":"02:00","temp":"1","symbol_value":"7","symbol_description":"Bedeckt mit leichtem Regen","symbol_value2":"7","symbol_description2":"Bedeckt mit leichtem Regen","wind":{"speed":"17","dir":"W","symbol":"15","symbolB":"47","gusts":"37"},"rain":"0.6","humidity":"98","pressure":"1010","clouds":"100%","snowline":"600","windchill":"-3"},{"interval":"05:00","temp":"2","symbol_value":"7","symbol_description":"Bedeckt mit leichtem Regen","symbol_value2":"7","symbol_description2":"Bedeckt mit leichtem Regen","wind":{"speed":"19","dir":"W","symbol":"15","symbolB":"55","gusts":"39"},"rain":"1.3","humidity":"93","pressure":"1009","clouds":"100%","snowline":"700","windchill":"-3"},{"interval":"08:00","temp":"2","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"20","dir":"W","symbol":"15","symbolB":"55","gusts":"40"},"rain":"0","humidity":"91","pressure":"1008","clouds":"98%","snowline":"800","windchill":"-2"},{"interval":"11:00","temp":"3","symbol_value":"7","symbol_description":"Bedeckt mit leichtem Regen","symbol_value2":"7","symbol_description2":"Bedeckt mit leichtem Regen","wind":{"speed":"21","dir":"SW","symbol":"14","symbolB":"54","gusts":"43"},"rain":"1.1","humidity":"93","pressure":"1005","clouds":"100%","snowline":"900","windchill":"-2"},{"interval":"14:00","temp":"3","symbol_value":"7","symbol_description":"Bedeckt mit leichtem Regen","symbol_value2":"7","symbol_description2":"Bedeckt mit leichtem Regen","wind":{"speed":"25","dir":"SW","symbol":"22","symbolB":"62","gusts":"51"},"rain":"2.5","humidity":"94","pressure":"1001","clouds":"100%","snowline":"1000","windchill":"-2"},{"interval":"17:00","temp":"4","symbol_value":"7","symbol_description":"Bedeckt mit leichtem Regen","symbol_value2":"7","symbol_description2":"Bedeckt mit leichtem Regen","wind":{"speed":"25","dir":"SW","symbol":"22","symbolB":"62","gusts":"55"},"rain":"2.9","humidity":"90","pressure":"997","clouds":"100%","snowline":"1200","windchill":"-1"},{"interval":"20:00","temp":"5","symbol_value":"7","symbol_description":"Bedeckt mit leichtem Regen","symbol_value2":"7","symbol_description2":"Bedeckt mit leichtem Regen","wind":{"speed":"26","dir":"W","symbol":"23","symbolB":"71","gusts":"63"},"rain":"2.3","humidity":"90","pressure":"994","clouds":"96%","snowline":"1300","windchill":"1"},{"interval":"23:00","temp":"3","symbol_value":"6","symbol_description":"Bewölkt mit leichtem Regen","symbol_value2":"6","symbol_description2":"Bewölkt mit leichtem Regen","wind":{"speed":"30","dir":"NW","symbol":"24","symbolB":"72","gusts":"67"},"rain":"1.5","humidity":"92","pressure":"995","clouds":"91%","snowline":"1000","windchill":"-2"}]},
        {"date":"20190114","name":"Montag","month":"","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"21","symbol_description2":"Bewölkt mit Schneeregen","tempmin":"-2","tempmax":"4","wind":{"speed":"27","symbol":"23","symbolB":"71","gusts":"67"},"rain":"7.2","humidity":"84","pressure":"1006","snowline":"200","sun":{"in":"08:05","mid":"12:18","out":"16:31"},"moon":{"in":"11:55","out":"00:09","lumi":"51.89%","desc":"zunehm. Mond, 51.89% Beleuchtet","symbol":"7"},"units":{"temp":"°C","wind":"km/h","rain":"mm","pressure":"mb","snowline":"m"},"local_time":"11:48","local_time_offset":1,"hour":[{"interval":"02:00","temp":"2","symbol_value":"17","symbol_description":"Teils bewölkt mit Schnee","symbol_value2":"20","symbol_description2":"Teils bewölkt mit Schneeregen","wind":{"speed":"27","dir":"NW","symbol":"24","symbolB":"64","gusts":"61"},"rain":"1.5","humidity":"88","pressure":"997","clouds":"72%","snowline":"800","windchill":"-3"},{"interval":"05:00","temp":"1","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"18","symbol_description2":"Bewölkt mit Schnee","wind":{"speed":"25","dir":"NW","symbol":"24","symbolB":"72","gusts":"64"},"rain":"0.6","humidity":"84","pressure":"1000","clouds":"46%","snowline":"600","windchill":"-5"},{"interval":"08:00","temp":"0","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"18","symbol_description2":"Bewölkt mit Schnee","wind":{"speed":"23","dir":"NW","symbol":"24","symbolB":"64","gusts":"55"},"rain":"0.8","humidity":"82","pressure":"1004","clouds":"86%","snowline":"400","windchill":"-6"},{"interval":"11:00","temp":"0","symbol_value":"19","symbol_description":"Bedeckt mit Schneeschauern","symbol_value2":"19","symbol_description2":"Bedeckt mit Schneeschauern","wind":{"speed":"23","dir":"NW","symbol":"24","symbolB":"64","gusts":"60"},"rain":"1.8","humidity":"87","pressure":"1006","clouds":"93%","snowline":"400","windchill":"-6"},{"interval":"14:00","temp":"-1","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"18","symbol_description2":"Bewölkt mit Schnee","wind":{"speed":"23","dir":"NW","symbol":"24","symbolB":"72","gusts":"64"},"rain":"1.1","humidity":"85","pressure":"1008","clouds":"77%","snowline":"300","windchill":"-6"},{"interval":"17:00","temp":"-1","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"18","symbol_description2":"Bewölkt mit Schnee","wind":{"speed":"22","dir":"NW","symbol":"24","symbolB":"64","gusts":"61"},"rain":"0.5","humidity":"81","pressure":"1010","clouds":"67%","snowline":"300","windchill":"-7"},{"interval":"20:00","temp":"-2","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"18","symbol_description2":"Bewölkt mit Schnee","wind":{"speed":"23","dir":"NW","symbol":"16","symbolB":"56","gusts":"48"},"rain":"0.3","humidity":"82","pressure":"1012","clouds":"91%","snowline":"200","windchill":"-7"},{"interval":"23:00","temp":"-2","symbol_value":"19","symbol_description":"Bedeckt mit Schneeschauern","symbol_value2":"19","symbol_description2":"Bedeckt mit Schneeschauern","wind":{"speed":"21","dir":"NW","symbol":"16","symbolB":"56","gusts":"46"},"rain":"0.6","humidity":"86","pressure":"1013","clouds":"98%","snowline":"200","windchill":"-7"}]},
        {"date":"20190115","name":"Dienstag","month":"","symbol_value":"19","symbol_description":"Bedeckt mit Schneeschauern","symbol_value2":"19","symbol_description2":"Bedeckt mit Schneeschauern","tempmin":"-2","tempmax":"2","wind":{"speed":"27","symbol":"22","symbolB":"62","gusts":"55"},"rain":"2.3","humidity":"85","pressure":"1016","snowline":"200","sun":{"in":"08:05","mid":"12:19","out":"16:33"},"moon":{"in":"12:18","out":"01:19","lumi":"62.02%","desc":"zunehm. Mond, 62.02% Beleuchtet","symbol":"8"},"units":{"temp":"°C","wind":"km/h","rain":"mm","pressure":"mb","snowline":"m"},"local_time":"11:48","local_time_offset":1,"hour":[{"interval":"01:00","temp":"-2","symbol_value":"19","symbol_description":"Bedeckt mit Schneeschauern","symbol_value2":"19","symbol_description2":"Bedeckt mit Schneeschauern","wind":{"speed":"20","dir":"W","symbol":"15","symbolB":"55","gusts":"43"},"rain":"0.8","humidity":"88","pressure":"1014","clouds":"100%","snowline":"200","windchill":"-7"},{"interval":"04:00","temp":"-1","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"18","symbol_description2":"Bewölkt mit Schnee","wind":{"speed":"25","dir":"W","symbol":"15","symbolB":"63","gusts":"50"},"rain":"0.6","humidity":"83","pressure":"1015","clouds":"96%","snowline":"200","windchill":"-7"},{"interval":"07:00","temp":"-1","symbol_value":"18","symbol_description":"Bewölkt mit Schnee","symbol_value2":"18","symbol_description2":"Bewölkt mit Schnee","wind":{"speed":"21","dir":"NW","symbol":"16","symbolB":"56","gusts":"49"},"rain":"0.7","humidity":"87","pressure":"1017","clouds":"83%","snowline":"200","windchill":"-7"},{"interval":"10:00","temp":"-1","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"19","dir":"W","symbol":"15","symbolB":"55","gusts":"42"},"rain":"0","humidity":"85","pressure":"1018","clouds":"100%","snowline":"300","windchill":"-6"},{"interval":"13:00","temp":"1","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"23","dir":"SW","symbol":"14","symbolB":"54","gusts":"46"},"rain":"0","humidity":"82","pressure":"1017","clouds":"99%","snowline":"500","windchill":"-4"},{"interval":"16:00","temp":"1","symbol_value":"19","symbol_description":"Bedeckt mit Schneeschauern","symbol_value2":"19","symbol_description2":"Bedeckt mit Schneeschauern","wind":{"speed":"26","dir":"SW","symbol":"22","symbolB":"62","gusts":"51"},"rain":"0.2","humidity":"82","pressure":"1015","clouds":"99%","snowline":"600","windchill":"-4"},{"interval":"19:00","temp":"1","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"27","dir":"SW","symbol":"22","symbolB":"62","gusts":"55"},"rain":"0","humidity":"89","pressure":"1014","clouds":"99%","snowline":"700","windchill":"-4"},{"interval":"22:00","temp":"2","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"25","dir":"SW","symbol":"22","symbolB":"62","gusts":"53"},"rain":"0","humidity":"91","pressure":"1014","clouds":"98%","snowline":"800","windchill":"-3"}]},
        {"date":"20190116","name":"Mittwoch","month":"","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","tempmin":"0","tempmax":"3","wind":{"speed":"22","symbol":"23","symbolB":"63","gusts":"50"},"rain":"0","humidity":"92","pressure":"1014","snowline":"700","sun":{"in":"08:04","mid":"12:19","out":"16:34"},"moon":{"in":"12:44","out":"02:30","lumi":"71.97%","desc":"zunehm. Mond, 71.97% Beleuchtet","symbol":"9"},"units":{"temp":"°C","wind":"km/h","rain":"mm","pressure":"mb","snowline":"m"},"local_time":"11:48","local_time_offset":1,"hour":[{"interval":"01:00","temp":"2","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"22","dir":"W","symbol":"23","symbolB":"63","gusts":"50"},"rain":"0","humidity":"94","pressure":"1014","clouds":"99%","snowline":"800","windchill":"-2"},{"interval":"04:00","temp":"2","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","wind":{"speed":"21","dir":"SW","symbol":"14","symbolB":"54","gusts":"43"},"rain":"0","humidity":"94","pressure":"1014","clouds":"96%","snowline":"800","windchill":"-2"},{"interval":"07:00","temp":"2","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"19","dir":"SW","symbol":"14","symbolB":"54","gusts":"42"},"rain":"0","humidity":"95","pressure":"1014","clouds":"98%","snowline":"700","windchill":"-2"},{"interval":"10:00","temp":"2","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","wind":{"speed":"17","dir":"SW","symbol":"14","symbolB":"46","gusts":"37"},"rain":"0","humidity":"95","pressure":"1015","clouds":"93%","snowline":"700","windchill":"-2"},{"interval":"13:00","temp":"2","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"16","dir":"SW","symbol":"14","symbolB":"46","gusts":"38"},"rain":"0","humidity":"91","pressure":"1014","clouds":"100%","snowline":"800","windchill":"-1"},{"interval":"16:00","temp":"3","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","wind":{"speed":"18","dir":"SW","symbol":"14","symbolB":"46","gusts":"36"},"rain":"0","humidity":"90","pressure":"1013","clouds":"74%","snowline":"1100","windchill":"-1"},{"interval":"19:00","temp":"1","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","wind":{"speed":"18","dir":"SW","symbol":"14","symbolB":"46","gusts":"35"},"rain":"0","humidity":"89","pressure":"1012","clouds":"81%","snowline":"1200","windchill":"-3"},{"interval":"22:00","temp":"1","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","wind":{"speed":"18","dir":"S","symbol":"13","symbolB":"45","gusts":"35"},"rain":"0","humidity":"91","pressure":"1012","clouds":"61%","snowline":"1100","windchill":"-4"}]},
        {"date":"20190117","name":"Donnerstag","month":"","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","tempmin":"-1","tempmax":"3","wind":{"speed":"24","symbol":"14","symbolB":"62","gusts":"50"},"rain":"0","humidity":"87","pressure":"1010","snowline":"600","sun":{"in":"08:03","mid":"12:19","out":"16:36"},"moon":{"in":"13:16","out":"03:44","lumi":"81.26%","desc":"zunehm. Mond, 81.26% Beleuchtet","symbol":"10"},"units":{"temp":"°C","wind":"km/h","rain":"mm","pressure":"mb","snowline":"m"},"local_time":"11:48","local_time_offset":1,"hour":[{"interval":"01:00","temp":"0","symbol_value":"2","symbol_description":"Teils bewölkt","symbol_value2":"2","symbol_description2":"Teils bewölkt","wind":{"speed":"22","dir":"S","symbol":"13","symbolB":"53","gusts":"43"},"rain":"0","humidity":"82","pressure":"1010","clouds":"55%","snowline":"2000","windchill":"-5"},{"interval":"04:00","temp":"0","symbol_value":"2","symbol_description":"Teils bewölkt","symbol_value2":"2","symbol_description2":"Teils bewölkt","wind":{"speed":"22","dir":"SW","symbol":"14","symbolB":"54","gusts":"43"},"rain":"0","humidity":"82","pressure":"1009","clouds":"39%","snowline":"1800","windchill":"-5"},{"interval":"07:00","temp":"0","symbol_value":"2","symbol_description":"Teils bewölkt","symbol_value2":"2","symbol_description2":"Teils bewölkt","wind":{"speed":"23","dir":"SW","symbol":"14","symbolB":"54","gusts":"46"},"rain":"0","humidity":"84","pressure":"1009","clouds":"44%","snowline":"1500","windchill":"-5"},{"interval":"10:00","temp":"1","symbol_value":"3","symbol_description":"Bewölkt","symbol_value2":"3","symbol_description2":"Bewölkt","wind":{"speed":"24","dir":"SW","symbol":"14","symbolB":"54","gusts":"49"},"rain":"0","humidity":"88","pressure":"1010","clouds":"80%","snowline":"700","windchill":"-4"},{"interval":"13:00","temp":"2","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"21","dir":"SW","symbol":"14","symbolB":"62","gusts":"50"},"rain":"0","humidity":"89","pressure":"1009","clouds":"97%","snowline":"800","windchill":"-2"},{"interval":"16:00","temp":"3","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"18","dir":"SW","symbol":"14","symbolB":"54","gusts":"47"},"rain":"0","humidity":"87","pressure":"1010","clouds":"100%","snowline":"800","windchill":"-1"},{"interval":"19:00","temp":"3","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"16","dir":"SW","symbol":"14","symbolB":"46","gusts":"36"},"rain":"0","humidity":"91","pressure":"1012","clouds":"100%","snowline":"900","windchill":"-1"},{"interval":"22:00","temp":"2","symbol_value":"4","symbol_description":"Bedeckt","symbol_value2":"4","symbol_description2":"Bedeckt","wind":{"speed":"9","dir":"W","symbol":"15","symbolB":"47","gusts":"31"},"rain":"0","humidity":"94","pressure":"1013","clouds":"100%","snowline":"800","windchill":"0"}]}
        ]}
*/



function getForecastDataHourlyJSON(cb) {
    if (adapter.config.HourlyForecastJSON) {

        const url = adapter.config.HourlyForecastJSON;
        adapter.log.debug('calling forecast hourly JSON: ' + url);

        request(url, (error, response, body) => {
            if (!error && response.statusCode === 200) {

                try {
                    
                    //need to be var for repair
                    var result = JSON.parse(body);

                    //adapter.log.debug("got " + JSON.stringify(result));

                    const numOfLocations = 1; //seems here we get only one location

                    for (let l = 0; l < numOfLocations; l++) {

                        const ll = l + 1;

                        let location = result.location;
                        const pos = location.indexOf('[');
                        if (pos !== -1) {
                            location = location.substring(0, pos).trim();
                        }

                        insertIntoList('NextHours2.Location_' + ll + '.Location', location);

                        tasks.push({
                            name: 'add',
                            key: 'NextHours2.Location_' + ll,
                            obj: {
                                type: 'device',
                                common: {
                                    name: result.location,
                                    role: 'weather'
                                }
                            }
                        });

                        // entspricht nicht der doku!!
                        var numOfDays = result.day.length;
                        //const numOfDays = 5;

                        if (typeof (numOfDays) == 'undefined') {
                            adapter.log.info('got wrong data structure! trying to repair...');
                            //adapter.log.debug("got " + JSON.stringify(result.day));

                            //try to repair structure
                        
                            var stringdata = JSON.stringify(result);
                            
                            stringdata = stringdata.replace('{"1":', '['); 
                            stringdata = stringdata.replace(',"2":', ',');
                            stringdata = stringdata.replace(',"3":', ',');
                            stringdata = stringdata.replace(',"4":', ',');
                            stringdata = stringdata.replace(',"5":', ',');
                            stringdata = stringdata.replace('}]}}}', '}]}]}'); 

                            //adapter.log.debug("--- " + stringdata);

                            result = JSON.parse(stringdata);

                            adapter.log.debug("copied, got " + result.day.length + ' days' );

                            numOfDays = result.day.length;
                            if (typeof (numOfDays) == 'undefined') {
                                adapter.log.error('not repaired...');


                                adapter.log.debug("got " + JSON.stringify(result.day));

                            }

                        }
                        else {
                            adapter.log.debug('got ' + numOfDays + ' days');
                        }

                        var CurrentDate = new Date();
                        var CurrentHour = CurrentDate.getHours();

                        for (let d = 0; d < numOfDays; d++) {

                            let keyName = '';

                            const dd = d + 1;

                            tasks.push({
                                name: 'add',
                                key: 'NextHours2.Location_' + ll + '.Day_' + dd,
                                obj: {
                                    type: 'channel',
                                    common: {
                                        name: 'Day ' + dd,
                                        role: 'weather'
                                    }
                                }
                            });

                            /*
                            "units": { "temp": "\u00b0C", "wind": "km\/h", "rain": "mm", "pressure": "mb", "snowline": "m" },
                            */

                            let value = result.day[d].name;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + ".day";
                            insertIntoList(keyName, value);

                            value = result.day[d].date;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + ".date";
                            insertIntoList(keyName, value);


                            let unit_temp = result.day[d].units.temp;
                            let unit_wind = result.day[d].units.wind;
                            let unit_rain = result.day[d].units.rain;
                            let unit_pressure = result.day[d].units.pressure;
                            let unit_snowline = result.day[d].units.snowline;

                            adapter.log.debug("got units " + unit_temp + " " + unit_wind + " " + unit_rain + " " + unit_wind + " " + unit_pressure + " " + unit_snowline);

                            value = result.day[d].symbol_value;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.symbol';
                            insertIntoList(keyName, value);

                            //add url for icon
                            insertIntoList('NextHours2.Location_' + ll + '.Day_' + dd + '.iconURL', getIconUrl(value));

                            value = result.day[d].symbol_description;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.symbol_desc';
                            insertIntoList(keyName, value);

                            value = result.day[d].symbol_value2;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.symbol2';
                            insertIntoList(keyName, value);

                            value = result.day[d].symbol_description2;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.symbol_desc2';
                            insertIntoList(keyName, value);

                            value = result.day[d].tempmin;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.tempmin';
                            insertIntoList(keyName, value, unit_temp);

                            value = result.day[d].tempmax;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.tempmax';
                            insertIntoList(keyName, value, unit_temp);

                            value = result.day[d].wind.speed;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.wind_speed';
                            insertIntoList(keyName, value, unit_wind);

                            value = result.day[d].wind.symbol;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.wind_symbol';
                            insertIntoList(keyName, value);

                            value = result.day[d].wind.symbolB;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.wind_symbolB';
                            insertIntoList(keyName, value);

                            //add url for icon
                            insertIntoList('NextHours2.Location_' + ll + '.Day_' + dd + '.windIconURL', getWindIconUrl(value));


                            value = result.day[d].wind.gusts;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.wind_gusts';
                            insertIntoList(keyName, value);

                            value = result.day[d].rain;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.rain';
                            insertIntoList(keyName, value, unit_rain);

                            value = result.day[d].humidity;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.humidity';
                            insertIntoList(keyName, value);

                            value = result.day[d].pressure;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.pressure';
                            insertIntoList(keyName, value, unit_pressure);

                            value = result.day[d].snowline;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.snowline';
                            insertIntoList(keyName, value, unit_snowline);

                            value = result.day[d].sun.in;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.sun_in';
                            insertIntoList(keyName, value);

                            value = result.day[d].sun.mid;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.sun_mid';
                            insertIntoList(keyName, value);

                            value = result.day[d].sun.out;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.sun_out';
                            insertIntoList(keyName, value);

                            var sSunInTime = result.day[d].sun.in;
                            var SunInTimeArr = sSunInTime.split(":");
                            var SunInHour = SunInTimeArr[0];
                            var sSunOutTime = result.day[d].sun.out;
                            var SunOutTimeArr = sSunOutTime.split(":");
                            var SunOutHour = SunOutTimeArr[0];


                            value = result.day[d].moon.in;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.moon_in';
                            insertIntoList(keyName, value);

                            value = result.day[d].moon.out;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.moon_out';
                            insertIntoList(keyName, value);

                            value = result.day[d].moon.lumi;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.moon_lumi';
                            insertIntoList(keyName, value);

                            value = result.day[d].moon.desc;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.moon_desc';
                            insertIntoList(keyName, value);

                            value = result.day[d].moon.symbol;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.moon_symbol';
                            insertIntoList(keyName, value);

                            value = result.day[d].local_time;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.local_time';
                            insertIntoList(keyName, value);

                            value = result.day[d].local_time_offset;
                            keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.local_time_offset';
                            insertIntoList(keyName, value);

                            const numOfHours = result.day[d].hour.length;
                            adapter.log.debug('got ' + numOfHours + ' hours');

                            var nSunHours = 0;
                            var nOldTime4Sun = -1;

                            for (let h = 0; h < numOfHours; h++) {

                                //adapter.log.debug('location: ' + l + ' day: ' + d + ' hour ' + h);
                                const hh = h + 1;

                                tasks.push({
                                    name: 'add',
                                    key: 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh,
                                    obj: {
                                        type: 'channel',
                                        common: {
                                            name: 'Hour ' + hh,
                                            role: 'weather'
                                        }
                                    }
                                });

                                if (dd == 1) {
                                    tasks.push({
                                        name: 'add',
                                        key: 'NextHours2.Location_' + ll + '.Day_' + dd + '.current',
                                        obj: {
                                            type: 'channel',
                                            common: {
                                                name: 'current ',
                                                role: 'weather'
                                            }
                                        }
                                    });

                                }

                                value = result.day[d].hour[h].interval;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.hour';
                                insertIntoList(keyName, value);

                                //adapter.log.debug("+++ " + result.day[d].hour[h].interval );

                                var sHour4SunTime = result.day[d].hour[h].interval;
                                var Hour4SunTimeArr = sHour4SunTime.split(":");
                                var Hour4SunTime = Hour4SunTimeArr[0];


                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.hour';
                                    insertIntoList(keyName, value);
                                }

                                value = result.day[d].hour[h].temp;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.temp';
                                insertIntoList(keyName, value, unit_temp);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.temp';
                                    insertIntoList(keyName, value, unit_temp);
                                }

                                value = result.day[d].hour[h].symbol_value;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol';
                                insertIntoList(keyName, value);

                                //add url for icon
                                insertIntoList('NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.iconURL', getIconUrl(value));

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.symbol';
                                    insertIntoList(keyName, value);

                                    //add url for icon
                                    insertIntoList('NextHours2.Location_' + ll + '.Day_' + dd + '.current.iconURL', getIconUrl(value));
                                }

                                value = result.day[d].hour[h].symbol_description;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol_desc';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.symbol_desc';
                                    insertIntoList(keyName, value);
                                }


                                value = result.day[d].hour[h].symbol_value2;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.symbol';
                                    insertIntoList(keyName, value);
                                }

                                value = result.day[d].hour[h].symbol_description2;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol_desc2';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.symbol_desc2';
                                    insertIntoList(keyName, value);
                                }

                                value = result.day[d].hour[h].wind.speed;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind_speed';
                                insertIntoList(keyName, value, unit_wind);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.wind_speed';
                                    insertIntoList(keyName, value, unit_wind);
                                }

                                value = result.day[d].hour[h].wind.dir;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind_dir';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.wind_dir';
                                    insertIntoList(keyName, value);
                                }

                                value = result.day[d].hour[h].wind.symbol;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind_symbol';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.wind_symbol';
                                    insertIntoList(keyName, value);
                                }

                                value = result.day[d].hour[h].wind.symbolB;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind_symbolB';
                                insertIntoList(keyName, value);

                                //add url for icon
                                insertIntoList('NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windIconURL', getWindIconUrl(value));

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.wind_symbolB';
                                    insertIntoList(keyName, value);

                                    //add url for icon
                                    insertIntoList('NextHours2.Location_' + ll + '.Day_' + dd + '.current.windIconURL', getWindIconUrl(value));

                                }

                                value = result.day[d].hour[h].wind.gusts;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind_gusts';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.wind_gusts';
                                    insertIntoList(keyName, value);
                                }

                                value = result.day[d].hour[h].rain;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.rain';
                                insertIntoList(keyName, value, unit_rain);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.rain';
                                    insertIntoList(keyName, value, unit_rain);
                                }

                                value = result.day[d].hour[h].humidity;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.humidity';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.humidity';
                                    insertIntoList(keyName, value);

                                }

                                value = result.day[d].hour[h].pressure;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.pressure';
                                insertIntoList(keyName, value, unit_pressure);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.pressure';
                                    insertIntoList(keyName, value, unit_pressure);
                                }

                                value = result.day[d].hour[h].clouds;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.clouds';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.clouds';
                                    insertIntoList(keyName, value);
                                }

                                var CloudTime = parseInt(result.day[d].hour[h].clouds);
                                var SunTime = 100 - CloudTime;
                                if (SunTime > 0 && Hour4SunTime >= SunInHour && Hour4SunTime <= SunOutHour) {
                                    var diff = 1;
                                    if (nOldTime4Sun > -1) {
                                        diff = Hour4SunTime - nOldTime4Sun;
                                    }
                                    else {
                                        diff = Hour4SunTime;
                                    }
                                    var SunHours = diff * SunTime / 100.0;
                                    nSunHours += SunHours;
                                }
                                nOldTime4Sun = Hour4SunTime;
                                //adapter.log.debug("### " + SunTime + "% = " + nSunHours + "SunIn " + SunInHour + " SunOut " + SunOutHour);



                                value = result.day[d].hour[h].snowline;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.snowline';
                                insertIntoList(keyName, value, unit_snowline);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.snowline';
                                    insertIntoList(keyName, value, unit_snowline);
                                }

                                value = result.day[d].hour[h].windchill;
                                keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windchill';
                                insertIntoList(keyName, value);

                                if (dd == 1 && Hour4SunTime == CurrentHour) {
                                    keyName = 'NextHours2.Location_' + ll + '.Day_' + dd + '.current.windchill';
                                    insertIntoList(keyName, value);
                                }
                            }
                            insertIntoList('NextHours2.Location_' + ll + '.Day_' + dd + '.sunshineDuration', nSunHours);
                            //adapter.log.debug("### next day");

                        }

                    }


                } catch (e) {
                    adapter.log.error('exception in getForecastDataHourlyJSON [' + e + ']');
                    
                }
            } else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);
                
            }

            allDone = true;
            if (!dbRunning) {
                startDbUpdate();
            } else {
                adapter.log.debug('update already running');
            }

        });
       
    }
    else {
        allDone = true;
        if (!dbRunning) {
            startDbUpdate();
        } else {
            adapter.log.debug('update already running');
        }
    }
}


const tasks = [];

function insertIntoList(key, value, unit) {

    try {

        var sUnit = "";
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
                    type: 'state',
                    common: {
                        name: 'Location',
                        type: 'string',
                        role: 'location',
                        read: true,
                        write: false
                    }
                };
            } if (key.match(/\.Maximale_Temperatur_value$/) || key.match(/\.tempmax_value$/) || key.match(/\.tempmax/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Maximal day temperature',
                        type: 'number',
                        role: 'value.temperature.max.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : '°C'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.Minimale_Temperatur_value$/) || key.match(/\.tempmin_value$/) || key.match(/\.tempmin/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Minimal day temperature',
                        type: 'number',
                        role: 'value.temperature.min.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : '°C'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.Tag_value/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Day name',
                        type: 'string',
                        role: 'dayofweek.forecast.' + d,
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.Wetter_Symbol_id/) || key.match(/\.Wetter_Symbol_id2/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Weather icon name',
                        type: 'string',
                        role: 'weather.icon.name.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.Wetter_Symbol_value2/) || key.match(/\.symbol_value2/) || key.match(/\.Wetter_Symbol_value/) || key.match(/\.symbol_value/) || key.match(/\.symbol/) || key.match(/\.symbol2/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Weather state URL',
                        type: 'string',
                        role: 'weather.title.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.Wetterbedingungen_value/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Weather description',
                        type: 'string',
                        role: 'weather.state.forecast.' + d,
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.Wind_valueB/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Wind description',
                        type: 'string',
                        role: 'weather.direction.wind.forecast.' + d,
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.iconURL/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Weather icon URL',
                        type: 'string',
                        role: 'weather.icon.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.windIconURL/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Wind icon URL',
                        type: 'string',
                        role: 'weather.icon.wind.forecast.' + d,
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.sunshineDuration/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Sunshine Duration',
                        type: 'string',
                        role: 'weather.sunshineduration.' + d,
                        unit: ('h'),
                        read: true,
                        write: false
                    }
                };



            } else if (key.match(/\.day_name/) || key.match(/\.day/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'day name',
                        type: 'string',
                        role: 'weather.day.name' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.hour_value/) || key.match(/\.hour/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'hour value',
                        type: 'string',
                        role: 'weather.hour.value' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.day_value/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'day value',
                        type: 'string',
                        role: 'weather.day.value' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.clouds_value/) || key.match(/\.clouds/)) {

                //sometimes % comes with value
                value = value.replace(/%/g, '');

                obj = {
                    type: 'state',
                    common: {
                        name: 'clouds',
                        type: 'string',
                        role: 'weather.clouds.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : '%'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.humidity_value/) || key.match(/\.humidity/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'humidity',
                        type: 'string',
                        role: 'weather.humidity.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : '%'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.pressure_value/) || key.match(/\.pressure/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'pressure',
                        type: 'string',
                        role: 'weather.pressure.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : 'mBar'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.rain_value/) || key.match(/\.rain/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'rain',
                        type: 'string',
                        role: 'weather.rain.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : 'mm'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.snowline_value/) || key.match(/\.snowline/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'snowline',
                        type: 'string',
                        role: 'weather.snowline.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : 'm'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.symbol_desc/) || key.match(/\.symbol_desc2/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'Weather state',
                        type: 'string',
                        role: 'weather.symbol.desc.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.temp_value/) || key.match(/\.temp/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'temperature',
                        type: 'string',
                        role: 'weather.temperature.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : '°C'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.wind_dir/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'wind direction',
                        type: 'string',
                        role: 'weather.wind.direction.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.wind_symbol/) || key.match(/\.wind_symbolB/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'wind symbol',
                        type: 'string',
                        role: 'weather.wind.symbol.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.wind_value/) || key.match(/\.wind_speed/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'wind value',
                        type: 'string',
                        role: 'weather.wind.value.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : 'km/h'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.windchill_value/) || key.match(/\.windchill/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'windchill',
                        type: 'string',
                        role: 'weather.wind.windchill.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : '°C'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.windgusts_value/) || key.match(/\.wind_gusts/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'windgusts',
                        type: 'string',
                        role: 'weather.wind.windgusts.forecast.' + d,
                        unit: (sUnit.length > 0 ? sUnit : 'km/h'),
                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.local_info_local_time/) || key.match(/\.local_time/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'local time',
                        type: 'string',
                        role: 'weather.locale.info.time.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.local_info_offset/) || key.match(/\.local_time_offset/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'local offset',
                        type: 'string',
                        role: 'weather.locale.info.offset.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.moon_desc/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'moon description',
                        type: 'string',
                        role: 'weather.moon.description.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.moon_in/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'moon raise',
                        type: 'string',
                        role: 'weather.moon.in.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.moon_lumi/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'moon lumi',
                        type: 'string',
                        role: 'weather.moon.lumi.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.moon_out/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'moon set',
                        type: 'string',
                        role: 'weather.moon.out.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.moon_symbol/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'moon symbol',
                        type: 'string',
                        role: 'weather.moon.symbol.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.sun_in/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'sun raise',
                        type: 'string',
                        role: 'weather.sun.in.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.sun_mid/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'sun mid',
                        type: 'string',
                        role: 'weather.sun.mid.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            } else if (key.match(/\.sun_out/)) {
                obj = {
                    type: 'state',
                    common: {
                        name: 'sun set',
                        type: 'string',
                        role: 'weather.sun.out.forecast.' + d,

                        read: true,
                        write: false
                    }
                };
            }
        }

        obj = obj || {
            type: 'state',
            common: {
                name: 'data',
                type: 'string',
                role: 'state',
                unit: '',
                read: true,
                write: false
            }
        };

        tasks.push({
            name: 'add',
            key: key,
            obj: obj,
            value: value
        });

    }

    catch (e) {
        adapter.log.error('exception in insertIntoList [' + e + ']');
    }
}

function startDbUpdate() {
    adapter.log.debug('objects in list: ' + Object.keys(tasks).length);
    processTasks(tasks);
}

function processTasks(tasks) {
    if (!tasks || !tasks.length) {
        adapter.log.debug('nothing to do');
        dbRunning = false;

        if (allDone) {
            adapter.log.debug('exit, all done');
            process.exit(0);
        }
    } else {
        dbRunning = true;
        const task = tasks.shift();
        if (task.name === 'add') {
            createExtendObject(task.key, task.obj, task.value, function () {
                setImmediate(processTasks, tasks);
            });
        } else if (task.name === 'update') {
            updateExtendObject(task.key, task.value, function () {
                setImmediate(processTasks, tasks);
            });
        } else if (task.name === 'delete_channel') {
            DeleteChannel(task.key, function () {
                setImmediate(processTasks, tasks);
            });
        } else if (task.name === 'delete_state') {
            DeleteState(task.key, function () {
                setImmediate(processTasks, tasks);
            });
        } else {
            throw 'Unknown task';
        } 
    }
}

function createExtendObject(key, objData, value, callback) {

    try {
        adapter.getObject(key, (err, obj) => {
            if (!obj) {
                if (value !== undefined) {
                    adapter.log.debug('back to list: ' + key + ' ' + value);
                    insertIntoList(key, value);
                }
                adapter.setObjectNotExists(key, objData, callback);
            } else if (value !== undefined) {
                adapter.setState(key, { ack: true, val: value }, callback);
            } else if (callback) {
                callback();
            }
        });
    }
    catch (e) {
        adapter.log.error('exception in createExtendObject [' + e + ']');
    }
}

function updateExtendObject(key, value, callback) {
    try {
        adapter.setState(key, { ack: true, val: value }, callback);
    }
    catch (e) {
        adapter.log.error('exception in updateExtendObject [' + e + ']');
    }
}

function DeleteIntoList(type, key) {
    try {
        var name = "";
        if (type == "channel") {
            name = "delete_channel";
        } else if (type == "state") {
            name = "delete_state";
        }

        tasks.push({
            name: name,
            key: key
        });
    }
    catch (e) {
        adapter.log.error('exception in DeleteIntoList [' + e + ']');
    }
}


function DeleteChannel(channel, callback) {

    try {
        adapter.log.debug("try deleting channel " + channel);
        //just do nothing at the moment
        //if (callback) callback();

        adapter.delObject(channel, function (err) {
            adapter.deleteChannel(channel, callback);
        });

    }
    catch (e) {
        adapter.log.error('exception in DeleteChannel [' + e + ']');
    }
}

function DeleteState(state, callback) {
    try {
        adapter.log.debug("try deleting state " + state);
        //just do nothing at the moment
        //if (callback) callback();

        adapter.delObject(state, function (err) {
            // Delete state
            adapter.delState(state, callback);
        });
    }
    catch (e) {
        adapter.log.error('exception in DeleteState [' + e + ']');
    }
}





//============================================================================================
// old functions for compatibility
function getForecastData7DaysOld(cb) {
    if (adapter.config.Days7Forecast) {
        const url = adapter.config.Days7Forecast;
        adapter.log.debug('calling forecast: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);
                    parseString(body, function (err, result) {
                        //adapter.log.debug('parsed7: ' + JSON.stringify(result));
                        for (let d = 0; d < 7; d++) {
                            const id = 'NextDays.' + d + 'd.';

                            insertIntoList(id + 'Temperature_Min', result.report.location[0].const[0].data[0].forecast[d].$.value);
                            insertIntoList(id + 'Temperature_Max', result.report.location[0].const[1].data[0].forecast[d].$.value);
                            insertIntoList(id + 'WindID', result.report.location[0].const[2].data[0].forecast[d].$.id);
                            insertIntoList(id + 'WindIDB', result.report.location[0].const[2].data[0].forecast[d].$.idB);
                            insertIntoList(id + 'Wind', result.report.location[0].const[2].data[0].forecast[d].$.value);
                            insertIntoList(id + 'WindB', result.report.location[0].const[2].data[0].forecast[d].$.valueB);
                            insertIntoList(id + 'ConditionID', result.report.location[0].const[3].data[0].forecast[d].$.id);
                            insertIntoList(id + 'Condition', result.report.location[0].const[3].data[0].forecast[d].$.value);
                            insertIntoList(id + 'ConditionID2', result.report.location[0].const[3].data[0].forecast[d].$.id2);
                            insertIntoList(id + 'Condition2', result.report.location[0].const[3].data[0].forecast[d].$.value2);
                            insertIntoList(id + 'day', result.report.location[0].const[4].data[0].forecast[d].$.value);
                            insertIntoList(id + 'atmosphere', result.report.location[0].const[5].data[0].forecast[d].$.value);
                            /*
                            adapter.setState(id + 'Temperature_Min', { ack: true, val: result.report.location[0].const[0].data[0].forecast[d].$.value });
                            adapter.setState(id + 'Temperature_Max', { ack: true, val: result.report.location[0].const[1].data[0].forecast[d].$.value });
                            adapter.setState(id + 'WindID', { ack: true, val: result.report.location[0].const[2].data[0].forecast[d].$.id });
                            adapter.setState(id + 'WindIDB', { ack: true, val: result.report.location[0].const[2].data[0].forecast[d].$.idB });
                            adapter.setState(id + 'Wind', { ack: true, val: result.report.location[0].const[2].data[0].forecast[d].$.value });
                            adapter.setState(id + 'WindB', { ack: true, val: result.report.location[0].const[2].data[0].forecast[d].$.valueB });
                            adapter.setState(id + 'ConditionID', { ack: true, val: result.report.location[0].const[3].data[0].forecast[d].$.id });
                            adapter.setState(id + 'Condition', { ack: true, val: result.report.location[0].const[3].data[0].forecast[d].$.value });
                            adapter.setState(id + 'ConditionID2', { ack: true, val: result.report.location[0].const[3].data[0].forecast[d].$.id2 });
                            adapter.setState(id + 'Condition2', { ack: true, val: result.report.location[0].const[3].data[0].forecast[d].$.value2 });
                            adapter.setState(id + 'day', { ack: true, val: result.report.location[0].const[4].data[0].forecast[d].$.value });
                            adapter.setState(id + 'atmosphere', { ack: true, val: result.report.location[0].const[5].data[0].forecast[d].$.value });
                            */
                        }
                        adapter.log.debug('7 days forecast done, objects in list ' + Object.keys(tasks).length);
                        getForecastData5DaysOld(cb);


                        if (!dbRunning) {
                            startDbUpdate();
                        }
                        else {
                            adapter.log.debug('update already running');
                        }
                    });
                }
                catch (e) {
                    adapter.log.error('exception in 7DaysForecast [' + e + ']');
                }
            }
            else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);
            }
        });
    }
    else {
        getForecastData5DaysOld(cb);
    }
    if (cb) cb();
}

function getForecastData5DaysOld(cb) {
    if (adapter.config.Days5Forecast) {
        const url = adapter.config.Days5Forecast;
        adapter.log.debug('calling forecast: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);
                    const body1 = body.replace(/wind-gusts/g, 'windgusts');

                    parseString(body1, function (err, result) {
                        //adapter.log.debug('parsed5: ' + JSON.stringify(result));


                        for (let d = 0; d < 5; d++) {
                            const id = 'NextDaysDetailed.' + d + 'd.';

                            insertIntoList(id + 'Weekday', result.report.location[0].day[d].$.name);
                            insertIntoList(id + 'date', result.report.location[0].day[d].$.value);
                            insertIntoList(id + 'SymbolID', result.report.location[0].day[d].symbol[0].$.value);
                            insertIntoList(id + 'Symbol', result.report.location[0].day[d].symbol[0].$.desc);
                            insertIntoList(id + 'SymbolID2', result.report.location[0].day[d].symbol[0].$.value2);
                            insertIntoList(id + 'Symbol2', result.report.location[0].day[d].symbol[0].$.desc2);
                            insertIntoList(id + 'Temperature_Min', result.report.location[0].day[d].tempmin[0].$.value);
                            insertIntoList(id + 'Temperature_Max', result.report.location[0].day[d].tempmax[0].$.value);
                            insertIntoList(id + 'Wind_Max', result.report.location[0].day[d].wind[0].$.value);
                            insertIntoList(id + 'WindSymbol', result.report.location[0].day[d].wind[0].$.symbol);
                            insertIntoList(id + 'WindSymbolB', result.report.location[0].day[d].wind[0].$.symbolB);
                            insertIntoList(id + 'WindGusts', result.report.location[0].day[d].windgusts[0].$.value);
                            insertIntoList(id + 'Rain', result.report.location[0].day[d].rain[0].$.value);
                            insertIntoList(id + 'Humidity', result.report.location[0].day[d].humidity[0].$.value);
                            insertIntoList(id + 'Pressure', result.report.location[0].day[d].pressure[0].$.value);
                            insertIntoList(id + 'Snowline', result.report.location[0].day[d].snowline[0].$.value);


                            /*
                            adapter.setState(id + 'Weekday', { ack: true, val: result.report.location[0].day[d].$.name });
                            adapter.setState(id + 'date', { ack: true, val: result.report.location[0].day[d].$.value });
                            adapter.setState(id + 'SymbolID', { ack: true, val: result.report.location[0].day[d].symbol[0].$.value });
                            adapter.setState(id + 'Symbol', { ack: true, val: result.report.location[0].day[d].symbol[0].$.desc });
                            adapter.setState(id + 'SymbolID2', { ack: true, val: result.report.location[0].day[d].symbol[0].$.value2 });
                            adapter.setState(id + 'Symbol2', { ack: true, val: result.report.location[0].day[d].symbol[0].$.desc2 });
                            adapter.setState(id + 'Temperature_Min', { ack: true, val: result.report.location[0].day[d].tempmin[0].$.value });
                            adapter.setState(id + 'Temperature_Max', { ack: true, val: result.report.location[0].day[d].tempmax[0].$.value });
                            adapter.setState(id + 'Wind_Max', { ack: true, val: result.report.location[0].day[d].wind[0].$.value });
                            adapter.setState(id + 'WindSymbol', { ack: true, val: result.report.location[0].day[d].wind[0].$.symbol });
                            adapter.setState(id + 'WindSymbolB', { ack: true, val: result.report.location[0].day[d].wind[0].$.symbolB });
                            adapter.setState(id + 'WindGusts', { ack: true, val: result.report.location[0].day[d].windgusts[0].$.value });
                            adapter.setState(id + 'Rain', { ack: true, val: result.report.location[0].day[d].rain[0].$.value });
                            adapter.setState(id + 'Humidity', { ack: true, val: result.report.location[0].day[d].humidity[0].$.value });
                            adapter.setState(id + 'Pressure', { ack: true, val: result.report.location[0].day[d].pressure[0].$.value });
                            adapter.setState(id + 'Snowline', { ack: true, val: result.report.location[0].day[d].snowline[0].$.value });
                            */

                            for (let h = 0; h < 8; h++) {
                                const id1 = 'NextDaysDetailed.' + d + 'd.' + h + 'h.';

                                insertIntoList(id1 + 'hour', result.report.location[0].day[d].hour[h].$.value);
                                insertIntoList(id1 + 'Temperature', result.report.location[0].day[d].hour[h].temp[0].$.value);
                                insertIntoList(id1 + 'SymbolID', result.report.location[0].day[d].hour[h].symbol[0].$.value);
                                insertIntoList(id1 + 'Symbol', result.report.location[0].day[d].hour[h].symbol[0].$.desc);
                                insertIntoList(id1 + 'SymbolID2', result.report.location[0].day[d].hour[h].symbol[0].$.value2);
                                insertIntoList(id1 + 'Symbol2', result.report.location[0].day[d].hour[h].symbol[0].$.desc2);
                                insertIntoList(id1 + 'Wind', result.report.location[0].day[d].hour[h].wind[0].$.value);
                                insertIntoList(id1 + 'WindDir', result.report.location[0].day[d].hour[h].wind[0].$.dir);
                                insertIntoList(id1 + 'WindSymbol', result.report.location[0].day[d].hour[h].wind[0].$.symbol);
                                insertIntoList(id1 + 'WindSymbolB', result.report.location[0].day[d].hour[h].wind[0].$.symbolB);
                                insertIntoList(id1 + 'WindGusts', result.report.location[0].day[d].hour[h].windgusts[0].$.value);
                                insertIntoList(id1 + 'Rain', result.report.location[0].day[d].hour[h].rain[0].$.value);
                                insertIntoList(id1 + 'Humidity', result.report.location[0].day[d].hour[h].humidity[0].$.value);
                                insertIntoList(id1 + 'Pressure', result.report.location[0].day[d].hour[h].pressure[0].$.value);
                                insertIntoList(id1 + 'Snowline', result.report.location[0].day[d].hour[h].snowline[0].$.value);
                                insertIntoList(id1 + 'Clouds', result.report.location[0].day[d].hour[h].clouds[0].$.value);
                                insertIntoList(id1 + 'Windchill', result.report.location[0].day[d].hour[h].windchill[0].$.value);
                                /*
                                adapter.setState(id1 + 'hour', { ack: true, val: result.report.location[0].day[d].hour[h].$.value });
                                adapter.setState(id1 + 'Temperature', { ack: true, val: result.report.location[0].day[d].hour[h].temp[0].$.value });
                                adapter.setState(id1 + 'SymbolID', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.value });
                                adapter.setState(id1 + 'Symbol', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.desc });
                                adapter.setState(id1 + 'SymbolID2', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.value2 });
                                adapter.setState(id1 + 'Symbol2', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.desc2 });
                                adapter.setState(id1 + 'Wind', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.value });
                                adapter.setState(id1 + 'WindDir', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.dir });
                                adapter.setState(id1 + 'WindSymbol', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.symbol });
                                adapter.setState(id1 + 'WindSymbolB', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.symbolB });
                                adapter.setState(id1 + 'WindGusts', { ack: true, val: result.report.location[0].day[d].hour[h].windgusts[0].$.value });
                                adapter.setState(id1 + 'Rain', { ack: true, val: result.report.location[0].day[d].hour[h].rain[0].$.value });
                                adapter.setState(id1 + 'Humidity', { ack: true, val: result.report.location[0].day[d].hour[h].humidity[0].$.value });
                                adapter.setState(id1 + 'Pressure', { ack: true, val: result.report.location[0].day[d].hour[h].pressure[0].$.value });
                                adapter.setState(id1 + 'Snowline', { ack: true, val: result.report.location[0].day[d].hour[h].snowline[0].$.value });
                                adapter.setState(id1 + 'Clouds', { ack: true, val: result.report.location[0].day[d].hour[h].clouds[0].$.value });
                                adapter.setState(id1 + 'Windchill', { ack: true, val: result.report.location[0].day[d].hour[h].windchill[0].$.value });
                                */

                            }
                        }
                        adapter.log.debug('5 days forecast done, objects in list ' + Object.keys(tasks).length);
                        getForecastDataHourlyOld(cb);


                        if (!dbRunning) {
                            startDbUpdate();
                        }
                        else {
                            adapter.log.debug('update already running');
                        }
                    });
                }
                catch (e) {
                    adapter.log.error('exception in 5DaysForecast [' + e + ']');
                }
            }
            else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);
            }
        });
    }
    else {
        getForecastDataHourlyOld(cb);
    }
    if (cb) cb();
}

function getForecastDataHourlyOld(cb) {
    if (adapter.config.HourlyForecast) {
        const url = adapter.config.HourlyForecast;
        adapter.log.debug('calling forecast: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);

                    const body1 = body.replace(/wind-gusts/g, 'windgusts');
                    //adapter.log.debug('got body: ' + body);

                    parseString(body1, function (err, result) {
                        //adapter.log.debug('parsedhourly: ' + JSON.stringify(result));


                        for (let d = 0; d < 2; d++) {

                            const id = 'hourly.' + d + 'd.';

                            insertIntoList(id + 'Weekday', result.report.location[0].day[d].$.name);
                            insertIntoList(id + 'date', result.report.location[0].day[d].$.value);
                            insertIntoList(id + 'SymbolID', result.report.location[0].day[d].symbol[0].$.value);
                            insertIntoList(id + 'Symbol', result.report.location[0].day[d].symbol[0].$.desc);
                            insertIntoList(id + 'SymbolID2', result.report.location[0].day[d].symbol[0].$.value2);
                            insertIntoList(id + 'Symbol2', result.report.location[0].day[d].symbol[0].$.desc2);
                            insertIntoList(id + 'Temperature_Min', result.report.location[0].day[d].tempmin[0].$.value);
                            insertIntoList(id + 'Temperature_Max', result.report.location[0].day[d].tempmax[0].$.value);
                            insertIntoList(id + 'Wind_Max', result.report.location[0].day[d].wind[0].$.value);
                            insertIntoList(id + 'WindSymbol', result.report.location[0].day[d].wind[0].$.symbol);
                            insertIntoList(id + 'WindSymbolB', result.report.location[0].day[d].wind[0].$.symbolB);
                            insertIntoList(id + 'WindGusts', result.report.location[0].day[d].windgusts[0].$.value);
                            insertIntoList(id + 'Rain', result.report.location[0].day[d].rain[0].$.value);
                            insertIntoList(id + 'Humidity', result.report.location[0].day[d].humidity[0].$.value);
                            insertIntoList(id + 'Pressure', result.report.location[0].day[d].pressure[0].$.value);
                            insertIntoList(id + 'Snowline', result.report.location[0].day[d].snowline[0].$.value);

                            /*
                            adapter.setState(id + 'Weekday', { ack: true, val: result.report.location[0].day[d].$.name });
                            adapter.setState(id + 'date', { ack: true, val: result.report.location[0].day[d].$.value });
                            adapter.setState(id + 'SymbolID', { ack: true, val: result.report.location[0].day[d].symbol[0].$.value });
                            adapter.setState(id + 'Symbol', { ack: true, val: result.report.location[0].day[d].symbol[0].$.desc });
                            adapter.setState(id + 'SymbolID2', { ack: true, val: result.report.location[0].day[d].symbol[0].$.value2 });
                            adapter.setState(id + 'Symbol2', { ack: true, val: result.report.location[0].day[d].symbol[0].$.desc2 });
                            adapter.setState(id + 'Temperature_Min', { ack: true, val: result.report.location[0].day[d].tempmin[0].$.value });
                            adapter.setState(id + 'Temperature_Max', { ack: true, val: result.report.location[0].day[d].tempmax[0].$.value });
                            adapter.setState(id + 'Wind_Max', { ack: true, val: result.report.location[0].day[d].wind[0].$.value });
                            adapter.setState(id + 'WindSymbol', { ack: true, val: result.report.location[0].day[d].wind[0].$.symbol });
                            adapter.setState(id + 'WindSymbolB', { ack: true, val: result.report.location[0].day[d].wind[0].$.symbolB });
                            adapter.setState(id + 'WindGusts', { ack: true, val: result.report.location[0].day[d].windgusts[0].$.value });
                            adapter.setState(id + 'Rain', { ack: true, val: result.report.location[0].day[d].rain[0].$.value });
                            adapter.setState(id + 'Humidity', { ack: true, val: result.report.location[0].day[d].humidity[0].$.value });
                            adapter.setState(id + 'Pressure', { ack: true, val: result.report.location[0].day[d].pressure[0].$.value });
                            adapter.setState(id + 'Snowline', { ack: true, val: result.report.location[0].day[d].snowline[0].$.value });
                            */

                            for (let h = 0; h < 24; h++) {
                                const id1 = 'hourly.' + d + 'd.' + h + 'h.';

                                insertIntoList(id1 + 'hour', result.report.location[0].day[d].hour[h].$.value);
                                insertIntoList(id1 + 'Temperature', result.report.location[0].day[d].hour[h].temp[0].$.value);
                                insertIntoList(id1 + 'SymbolID', result.report.location[0].day[d].hour[h].symbol[0].$.value);
                                insertIntoList(id1 + 'Symbol', result.report.location[0].day[d].hour[h].symbol[0].$.desc);

                                insertIntoList(id1 + 'SymbolID2', result.report.location[0].day[d].hour[h].symbol[0].$.value2);
                                insertIntoList(id1 + 'Symbol2', result.report.location[0].day[d].hour[h].symbol[0].$.desc2);

                                insertIntoList(id1 + 'Wind', result.report.location[0].day[d].hour[h].wind[0].$.value);
                                insertIntoList(id1 + 'WindDir', result.report.location[0].day[d].hour[h].wind[0].$.dir);
                                insertIntoList(id1 + 'WindSymbol', result.report.location[0].day[d].hour[h].wind[0].$.symbol);
                                insertIntoList(id1 + 'WindSymbolB', result.report.location[0].day[d].hour[h].wind[0].$.symbolB);
                                insertIntoList(id1 + 'WindGusts', result.report.location[0].day[d].hour[h].windgusts[0].$.value);
                                insertIntoList(id1 + 'Rain', result.report.location[0].day[d].hour[h].rain[0].$.value);
                                insertIntoList(id1 + 'Humidity', result.report.location[0].day[d].hour[h].humidity[0].$.value);
                                insertIntoList(id1 + 'Pressure', result.report.location[0].day[d].hour[h].pressure[0].$.value);
                                insertIntoList(id1 + 'Snowline', result.report.location[0].day[d].hour[h].snowline[0].$.value);
                                insertIntoList(id1 + 'Clouds', result.report.location[0].day[d].hour[h].clouds[0].$.value);
                                insertIntoList(id1 + 'Windchill', result.report.location[0].day[d].hour[h].windchill[0].$.value);

                                /*
                                adapter.setState(id1 + 'hour', { ack: true, val: result.report.location[0].day[d].hour[h].$.value });
                                adapter.setState(id1 + 'Temperature', { ack: true, val: result.report.location[0].day[d].hour[h].temp[0].$.value });
                                adapter.setState(id1 + 'SymbolID', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.value });
                                adapter.setState(id1 + 'Symbol', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.desc });

                                adapter.setState(id1 + 'SymbolID2', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.value2 });
                                adapter.setState(id1 + 'Symbol2', { ack: true, val: result.report.location[0].day[d].hour[h].symbol[0].$.desc2 });

                                adapter.setState(id1 + 'Wind', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.value });
                                adapter.setState(id1 + 'WindDir', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.dir });
                                adapter.setState(id1 + 'WindSymbol', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.symbol });
                                adapter.setState(id1 + 'WindSymbolB', { ack: true, val: result.report.location[0].day[d].hour[h].wind[0].$.symbolB });
                                adapter.setState(id1 + 'WindGusts', { ack: true, val: result.report.location[0].day[d].hour[h].windgusts[0].$.value });
                                adapter.setState(id1 + 'Rain', { ack: true, val: result.report.location[0].day[d].hour[h].rain[0].$.value });
                                adapter.setState(id1 + 'Humidity', { ack: true, val: result.report.location[0].day[d].hour[h].humidity[0].$.value });
                                adapter.setState(id1 + 'Pressure', { ack: true, val: result.report.location[0].day[d].hour[h].pressure[0].$.value });
                                adapter.setState(id1 + 'Snowline', { ack: true, val: result.report.location[0].day[d].hour[h].snowline[0].$.value });
                                adapter.setState(id1 + 'Clouds', { ack: true, val: result.report.location[0].day[d].hour[h].clouds[0].$.value });
                                adapter.setState(id1 + 'Windchill', { ack: true, val: result.report.location[0].day[d].hour[h].windchill[0].$.value });
                                */
                            }
                        }
                        adapter.log.debug('hourly forecast done, objects in list ' + Object.keys(tasks).length);
                        allDone = true;
                        if (!dbRunning) {
                            startDbUpdate();
                        }
                        else {
                            adapter.log.debug('update already running');
                        }
                    });
                }
                catch (e) {
                    adapter.log.error('exception in HourlyForecast [' + e + ']');
                }
            }
            else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error + " or response " + response.statusCode);
            }
        });
    }
    else {
        allDone = true;
        if (!dbRunning) {
            startDbUpdate();
        }
        else {
            adapter.log.debug('update already running');
        }
    }
    if (cb) cb();
}

function deleteOldData(bUseNewDataset) {

    adapter.log.debug('checking data structures');

    //erst alle states 
    adapter.getStatesOf( function (err, states) {
        if (err) {
            adapter.log.error("error in  deleteOldData " + err);
        }
        else {
            adapter.log.debug("got " + states.length + " states ");

            //we delete max. 500 per call to reduce work load!!

            var Cnt2Delete = 0;

            for (var i = 0; i < states.length; i++) {
                var state = states[i]._id;

                //adapter.log.debug("check state: " + state);

                //und jetzt prüfen, welche states gelöscht werden müssen

                if (bUseNewDataset) {
                    if (Cnt2Delete < 500 && (state.match(/\.NextDays.0d/)
                        || state.match(/\.NextDays.1d/)
                        || state.match(/\.NextDays.2d/)
                        || state.match(/\.NextDays.3d/)
                        || state.match(/\.NextDays.4d/)
                        || state.match(/\.NextDays.5d/)
                        || state.match(/\.NextDays.6d/)

                        || state.match(/\.NextDaysDetailed.0d/)
                        || state.match(/\.NextDaysDetailed.1d/)
                        || state.match(/\.NextDaysDetailed.2d/)
                        || state.match(/\.NextDaysDetailed.3d/)
                        || state.match(/\.NextDaysDetailed.3d/)
                        || state.match(/\.NextDaysDetailed.4d/)

                        || state.match(/\.hourly.0d/)
                        || state.match(/\.hourly.1d/))

                    ) {
                        //adapter.log.debug("---delete state: " + state);
                        DeleteIntoList("state", state);
                        Cnt2Delete++;
                    }
                }
                else {
                    if (Cnt2Delete < 500 && (state.match(/\.NextDays.Location_/)
                        || state.match(/\.NextDaysDetailed.Location_/)
                        || state.match(/\.NextHours.Location_/)
                        || state.match(/\.NextHours2.Location_/))
                    ) {
                        //adapter.log.debug("+++delete state: " + state);
                        DeleteIntoList("state", state);
                        Cnt2Delete++;
                    }
                }

            }
        }

    });
    
    //dann noch die channels
    adapter.getChannels(function (err, channels) {
        if (err) {
            adapter.log.error("error in  deleteOldData " + key + " " + err);
        }
        else {
            adapter.log.debug("got " + channels.length + " channels");
            for (var i = 0; i < channels.length; i++) {
                var channel = channels[i]._id;

                //adapter.log.debug("check channel: " + channel);

                //und jetzt prüfen, welche channels gelöscht werden müssen

                if (bUseNewDataset) {
                    if (channel.match(/\.NextDays.0d/)
                        || channel.match(/\.NextDays.1d/)
                        || channel.match(/\.NextDays.2d/)
                        || channel.match(/\.NextDays.3d/)
                        || channel.match(/\.NextDays.4d/)
                        || channel.match(/\.NextDays.5d/)
                        || channel.match(/\.NextDays.6d/)

                        || channel.match(/\.NextDaysDetailed.0d/)
                        || channel.match(/\.NextDaysDetailed.1d/)
                        || channel.match(/\.NextDaysDetailed.2d/)
                        || channel.match(/\.NextDaysDetailed.3d/)
                        || channel.match(/\.NextDaysDetailed.3d/)
                        || channel.match(/\.NextDaysDetailed.4d/)

                        || channel.match(/\.hourly.0d/)
                        || channel.match(/\.hourly.1d/)

                    ) {
                        //adapter.log.debug("---delete channel: " + channel);
                        DeleteIntoList("channel", channel);
                    }
                }
                else {
                    if (channel.match(/\.NextDays.Location_/)
                        || channel.match(/\.NextDaysDetailed.Location_/)
                        || channel.match(/\.NextHours.Location_/)
                    ) {
                        //adapter.log.debug("+++delete channel: " + channel);
                        DeleteIntoList("channel",channel);
                    }
                }
            }
        }
    });
    

    
}

function checkWeatherVariablesOld() {

    //7 days forecast
    if (adapter.config.Days7Forecast) {
        adapter.setObjectNotExists('NextDays', {
            type: 'channel',
            role: 'weather',
            common: { name: '7 days forecast' },
            native: { location: adapter.config.location }
        });
        // all states for all 7 days...
        for (let d = 0; d < 7; d++) {
            const id = 'NextDays.' + d + 'd.';
            adapter.setObjectNotExists('NextDays.' + d + 'd', {
                type: 'channel',
                role: 'forecast',
                common: { name: 'in ' + d + ' days' },
                native: { location: adapter.config.location }
            });
            adapter.setObjectNotExists(id + 'Temperature_Min', {
                type: 'state',
                common: {
                    name: 'Temperature_Min',
                    type: 'number',
                    role: 'temperature',
                    unit: '°C',
                    read: true,
                    write: false
                },
                native: { id: id + 'Temperature_Min' }
            });
            adapter.setObjectNotExists(id + 'Temperature_Max', {
                type: 'state',
                common: {
                    name: 'Temperature_Max',
                    type: 'number',
                    role: 'temperature',
                    unit: '°C',
                    read: true,
                    write: false
                },
                native: { id: id + 'Temperature_Max' }
            });
            adapter.setObjectNotExists(id + 'WindID', {
                type: 'state',
                common: { name: 'WindID', type: 'number', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'Wind_ID' }
            });
            adapter.setObjectNotExists(id + 'WindIDB', {
                type: 'state',
                common: { name: 'WindIDB', type: 'number', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'Wind_IDB' }
            });

            adapter.setObjectNotExists(id + 'Wind', {
                type: 'state',
                common: { name: 'Wind', type: 'string', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'Wind' }
            });
            adapter.setObjectNotExists(id + 'WindB', {
                type: 'state',
                common: { name: 'WindB', type: 'string', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'WindB' }
            });
            adapter.setObjectNotExists(id + 'ConditionID', {
                type: 'state',
                common: { name: 'ConditionID', type: 'number', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'ConditionID' }
            });
            adapter.setObjectNotExists(id + 'Condition', {
                type: 'state',
                common: { name: 'Condition', type: 'string', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'Condition' }
            });

            adapter.setObjectNotExists(id + 'ConditionID2', {
                type: 'state',
                common: { name: 'ConditionID2', type: 'number', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'ConditionID2' }
            });
            adapter.setObjectNotExists(id + 'Condition2', {
                type: 'state',
                common: { name: 'Condition2', type: 'string', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'Condition2' }
            });

            adapter.setObjectNotExists(id + 'day', {
                type: 'state',
                common: { name: 'day', type: 'string', role: 'day', unit: '', read: true, write: false },
                native: { id: id + 'day' }
            });
            adapter.setObjectNotExists(id + 'atmosphere', {
                type: 'state',
                common: { name: 'atmosphere', type: 'string', role: 'atmosphere', unit: '', read: true, write: false },
                native: { id: id + 'atmosphere' }
            });
        }
    }
    //5 days forecast
    if (adapter.config.Days5Forecast) {
        adapter.setObjectNotExists('NextDaysDetailed', {
            type: 'channel',
            role: 'weather',
            common: { name: '5 days detailed forecast' },
            native: { location: adapter.config.location }
        });
        // all states for all 5 days...
        for (let d = 0; d < 5; d++) {
            const id = 'NextDaysDetailed.' + d + 'd.';
            adapter.setObjectNotExists('NextDaysDetailed.' + d + 'd', {
                type: 'channel',
                role: 'forecast',
                common: { name: 'in ' + d + ' days' },
                native: { location: adapter.config.location }
            });

            adapter.setObjectNotExists(id + 'Weekday', {
                type: 'state',
                common: { name: 'Weekday', type: 'string', role: 'day', unit: '', read: true, write: false },
                native: { id: id + 'Weekday' }
            });
            adapter.setObjectNotExists(id + 'date', {
                type: 'state',
                common: { name: 'date', type: 'string', role: 'day', unit: '', read: true, write: false },
                native: { id: id + 'date' }
            });
            adapter.setObjectNotExists(id + 'SymbolID', {
                type: 'state',
                common: { name: 'SymbolID', type: 'number', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'SymbolID' }
            });
            adapter.setObjectNotExists(id + 'Symbol', {
                type: 'state',
                common: { name: 'Symbol', type: 'string', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'Symbol' }
            });

            adapter.setObjectNotExists(id + 'SymbolID2', {
                type: 'state',
                common: { name: 'SymbolID2', type: 'number', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'SymbolID2' }
            });
            adapter.setObjectNotExists(id + 'Symbol2', {
                type: 'state',
                common: { name: 'Symbol2', type: 'string', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'Symbol2' }
            });

            adapter.setObjectNotExists(id + 'Temperature_Min', {
                type: 'state',
                common: {
                    name: 'Temperature_Min',
                    type: 'number',
                    role: 'temperature',
                    unit: '°C',
                    read: true,
                    write: false
                },
                native: { id: id + 'Temperature_Min' }
            });
            adapter.setObjectNotExists(id + 'Temperature_Max', {
                type: 'state',
                common: {
                    name: 'Temperature_Max',
                    type: 'number',
                    role: 'temperature',
                    unit: '°C',
                    read: true,
                    write: false
                },
                native: { id: id + 'Temperature_Max' }
            });

            adapter.setObjectNotExists(id + 'Wind_Max', {
                type: 'state',
                common: { name: 'Wind_Max', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                native: { id: id + 'Wind_Max' }
            });
            adapter.setObjectNotExists(id + 'WindSymbol', {
                type: 'state',
                common: { name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'WindSymbol' }
            });
            adapter.setObjectNotExists(id + 'WindSymbolB', {
                type: 'state',
                common: { name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'WindSymbolB' }
            });
            adapter.setObjectNotExists(id + 'WindGusts', {
                type: 'state',
                common: { name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                native: { id: id + 'WindGusts' }
            });
            adapter.setObjectNotExists(id + 'Rain', {
                type: 'state',
                common: { name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false },
                native: { id: id + 'Rain' }
            });
            adapter.setObjectNotExists(id + 'Humidity', {
                type: 'state',
                common: { name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false },
                native: { id: id + 'Humidity' }
            });

            adapter.setObjectNotExists(id + 'Pressure', {
                type: 'state',
                common: { name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false },
                native: { id: id + 'Pressure' }
            });
            adapter.setObjectNotExists(id + 'Snowline', {
                type: 'state',
                common: { name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false },
                native: { id: id + 'Snowline' }
            });

            for (let h = 0; h < 8; h++) {
                const id1 = 'NextDaysDetailed.' + d + 'd.' + h + 'h.';
                adapter.setObjectNotExists('NextDaysDetailed.' + d + 'd.' + h + 'h', {
                    type: 'channel',
                    role: 'forecast',
                    common: { name: h + ' period' },
                    native: { location: adapter.config.location }
                });

                adapter.setObjectNotExists(id1 + 'hour', {
                    type: 'state',
                    common: { name: 'hour', type: 'number', role: 'hour', unit: '', read: true, write: false },
                    native: { id: id1 + 'hour' }
                });
                adapter.setObjectNotExists(id1 + 'Temperature', {
                    type: 'state',
                    common: {
                        name: 'Temperature',
                        type: 'number',
                        role: 'temperature',
                        unit: '°C',
                        read: true,
                        write: false
                    },
                    native: { id: id1 + 'Temperature' }
                });
                adapter.setObjectNotExists(id1 + 'SymbolID', {
                    type: 'state',
                    common: { name: 'SymbolID', type: 'number', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'SymbolID' }
                });
                adapter.setObjectNotExists(id1 + 'Symbol', {
                    type: 'state',
                    common: { name: 'Symbol', type: 'string', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'Symbol' }
                });

                adapter.setObjectNotExists(id1 + 'SymbolID2', {
                    type: 'state',
                    common: { name: 'SymbolID2', type: 'number', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'SymbolID2' }
                });
                adapter.setObjectNotExists(id1 + 'Symbol2', {
                    type: 'state',
                    common: { name: 'Symbol2', type: 'string', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'Symbol2' }
                });


                adapter.setObjectNotExists(id1 + 'Wind', {
                    type: 'state',
                    common: { name: 'Wind', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                    native: { id: id1 + 'Wind' }
                });
                adapter.setObjectNotExists(id1 + 'WindDir', {
                    type: 'state',
                    common: { name: 'WindDir', type: 'string', role: 'wind', unit: '', read: true, write: false },
                    native: { id: id1 + 'WindDir' }
                });
                adapter.setObjectNotExists(id1 + 'WindSymbol', {
                    type: 'state',
                    common: { name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false },
                    native: { id: id1 + 'WindSymbol' }
                });
                adapter.setObjectNotExists(id1 + 'WindSymbolB', {
                    type: 'state',
                    common: { name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false },
                    native: { id: id1 + 'WindSymbolB' }
                });
                adapter.setObjectNotExists(id1 + 'WindGusts', {
                    type: 'state',
                    common: { name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                    native: { id: id1 + 'WindGusts' }
                });
                adapter.setObjectNotExists(id1 + 'Rain', {
                    type: 'state',
                    common: { name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false },
                    native: { id: id1 + 'Rain' }
                });
                adapter.setObjectNotExists(id1 + 'Humidity', {
                    type: 'state',
                    common: { name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false },
                    native: { id: id1 + 'Humidity' }
                });

                adapter.setObjectNotExists(id1 + 'Pressure', {
                    type: 'state',
                    common: { name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false },
                    native: { id: id1 + 'Pressure' }
                });
                adapter.setObjectNotExists(id1 + 'Snowline', {
                    type: 'state',
                    common: { name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false },
                    native: { id: id1 + 'Snowline' }
                });
                adapter.setObjectNotExists(id1 + 'Clouds', {
                    type: 'state',
                    common: { name: 'Clouds', type: 'number', role: 'clouds', unit: '', read: true, write: false },
                    native: { id: id1 + 'Clouds' }
                });
                adapter.setObjectNotExists(id1 + 'Windchill', {
                    type: 'state',
                    common: {
                        name: 'Windchill',
                        type: 'number',
                        role: 'windchill',
                        unit: '°C',
                        read: true,
                        write: false
                    },
                    native: { id: id1 + 'Windchill' }
                });
            }

        }
    }

    //hourly forecast
    if (adapter.config.HourlyForecast) {
        adapter.setObjectNotExists('hourly', {
            type: 'channel',
            role: 'weather',
            common: { name: 'hourly detailed forecast' },
            native: { location: adapter.config.location }
        });
        // all states for all hours... (2 days only...)
        for (let d = 0; d < 2; d++) {
            const id = 'hourly.' + d + 'd.';
            adapter.setObjectNotExists('hourly.' + d + 'd', {
                type: 'channel',
                role: 'forecast',
                common: { name: 'in ' + d + ' days' },
                native: { location: adapter.config.location }
            });

            adapter.setObjectNotExists(id + 'Weekday', {
                type: 'state',
                common: { name: 'Weekday', type: 'string', role: 'day', unit: '', read: true, write: false },
                native: { id: id + 'Weekday' }
            });
            adapter.setObjectNotExists(id + 'date', {
                type: 'state',
                common: { name: 'date', type: 'string', role: 'day', unit: '', read: true, write: false },
                native: { id: id + 'date' }
            });
            adapter.setObjectNotExists(id + 'SymbolID', {
                type: 'state',
                common: { name: 'SymbolID', type: 'number', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'SymbolID' }
            });
            adapter.setObjectNotExists(id + 'Symbol', {
                type: 'state',
                common: { name: 'Symbol', type: 'string', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'Symbol' }
            });

            adapter.setObjectNotExists(id + 'SymbolID2', {
                type: 'state',
                common: { name: 'SymbolID2', type: 'number', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'SymbolID2' }
            });
            adapter.setObjectNotExists(id + 'Symbol2', {
                type: 'state',
                common: { name: 'Symbol2', type: 'string', role: 'condition', unit: '', read: true, write: false },
                native: { id: id + 'Symbol2' }
            });

            adapter.setObjectNotExists(id + 'Temperature_Min', {
                type: 'state',
                common: {
                    name: 'Temperature_Min',
                    type: 'number',
                    role: 'temperature',
                    unit: '°C',
                    read: true,
                    write: false
                },
                native: { id: id + 'Temperature_Min' }
            });
            adapter.setObjectNotExists(id + 'Temperature_Max', {
                type: 'state',
                common: {
                    name: 'Temperature_Max',
                    type: 'number',
                    role: 'temperature',
                    unit: '°C',
                    read: true,
                    write: false
                },
                native: { id: id + 'Temperature_Max' }
            });

            adapter.setObjectNotExists(id + 'Wind_Max', {
                type: 'state',
                common: { name: 'Wind_Max', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                native: { id: id + 'Wind_Max' }
            });
            adapter.setObjectNotExists(id + 'WindSymbol', {
                type: 'state',
                common: { name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'WindSymbol' }
            });
            adapter.setObjectNotExists(id + 'WindSymbolB', {
                type: 'state',
                common: { name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false },
                native: { id: id + 'WindSymbolB' }
            });
            adapter.setObjectNotExists(id + 'WindGusts', {
                type: 'state',
                common: { name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                native: { id: id + 'WindGusts' }
            });
            adapter.setObjectNotExists(id + 'Rain', {
                type: 'state',
                common: { name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false },
                native: { id: id + 'Rain' }
            });
            adapter.setObjectNotExists(id + 'Humidity', {
                type: 'state',
                common: { name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false },
                native: { id: id + 'Humidity' }
            });

            adapter.setObjectNotExists(id + 'Pressure', {
                type: 'state',
                common: { name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false },
                native: { id: id + 'Pressure' }
            });
            adapter.setObjectNotExists(id + 'Snowline', {
                type: 'state',
                common: { name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false },
                native: { id: id + 'Snowline' }
            });

            for (let h = 0; h < 24; h++) {
                const id1 = 'hourly.' + d + 'd.' + h + 'h.';
                adapter.setObjectNotExists('hourly.' + d + 'd.' + h + 'h', {
                    type: 'channel',
                    role: 'forecast',
                    common: { name: h + ' period' },
                    native: { location: adapter.config.location }
                });

                adapter.setObjectNotExists(id1 + 'hour', {
                    type: 'state',
                    common: { name: 'hour', type: 'number', role: 'hour', unit: '', read: true, write: false },
                    native: { id: id1 + 'hour' }
                });
                adapter.setObjectNotExists(id1 + 'Temperature', {
                    type: 'state',
                    common: {
                        name: 'Temperature',
                        type: 'number',
                        role: 'temperature',
                        unit: '°C',
                        read: true,
                        write: false
                    },
                    native: { id: id1 + 'Temperature' }
                });
                adapter.setObjectNotExists(id1 + 'SymbolID', {
                    type: 'state',
                    common: { name: 'SymbolID', type: 'number', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'SymbolID' }
                });
                adapter.setObjectNotExists(id1 + 'Symbol', {
                    type: 'state',
                    common: { name: 'Symbol', type: 'string', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'Symbol' }
                });

                adapter.setObjectNotExists(id1 + 'SymbolID2', {
                    type: 'state',
                    common: { name: 'SymbolID2', type: 'number', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'SymbolID2' }
                });
                adapter.setObjectNotExists(id1 + 'Symbol2', {
                    type: 'state',
                    common: { name: 'Symbol2', type: 'string', role: 'symbol', unit: '', read: true, write: false },
                    native: { id: id1 + 'Symbol2' }
                });


                adapter.setObjectNotExists(id1 + 'Wind', {
                    type: 'state',
                    common: { name: 'Wind', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                    native: { id: id1 + 'Wind' }
                });
                adapter.setObjectNotExists(id1 + 'WindDir', {
                    type: 'state',
                    common: { name: 'WindDir', type: 'string', role: 'wind', unit: '', read: true, write: false },
                    native: { id: id1 + 'WindDir' }
                });
                adapter.setObjectNotExists(id1 + 'WindSymbol', {
                    type: 'state',
                    common: { name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false },
                    native: { id: id1 + 'WindSymbol' }
                });
                adapter.setObjectNotExists(id1 + 'WindSymbolB', {
                    type: 'state',
                    common: { name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false },
                    native: { id: id1 + 'WindSymbolB' }
                });
                adapter.setObjectNotExists(id1 + 'WindGusts', {
                    type: 'state',
                    common: { name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false },
                    native: { id: id1 + 'WindGusts' }
                });
                adapter.setObjectNotExists(id1 + 'Rain', {
                    type: 'state',
                    common: { name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false },
                    native: { id: id1 + 'Rain' }
                });
                adapter.setObjectNotExists(id1 + 'Humidity', {
                    type: 'state',
                    common: { name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false },
                    native: { id: id1 + 'Humidity' }
                });

                adapter.setObjectNotExists(id1 + 'Pressure', {
                    type: 'state',
                    common: { name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false },
                    native: { id: id1 + 'Pressure' }
                });
                adapter.setObjectNotExists(id1 + 'Snowline', {
                    type: 'state',
                    common: { name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false },
                    native: { id: id1 + 'Snowline' }
                });
                adapter.setObjectNotExists(id1 + 'Clouds', {
                    type: 'state',
                    common: { name: 'Clouds', type: 'number', role: 'clouds', unit: '', read: true, write: false },
                    native: { id: id1 + 'Clouds' }
                });
                adapter.setObjectNotExists(id1 + 'Windchill', {
                    type: 'state',
                    common: {
                        name: 'Windchill',
                        type: 'number',
                        role: 'windchill',
                        unit: '°C',
                        read: true,
                        write: false
                    },
                    native: { id: id1 + 'Windchill' }
                });
            }
        }
    }
}