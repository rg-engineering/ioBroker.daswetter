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
    // force terminate after 4 min
    // don't know why it does not terminate by itself...
    setTimeout(() => {
        adapter.log.warn('force terminate, objects still in list: ' + Object.keys(tasks).length);
        process.exit(0);
    }, 300000);
    
    allDone = false;

    if (adapter.config.UseNewDataset) {
        adapter.log.debug('using new datastaructure');
        getForecastData7Days();
    } else {
        adapter.log.debug('using old datastaructure');
        checkWeatherVariablesOld();
        getForecastData7DaysOld();
    }
}

function getIconUrl(num) {
    const iconSet = adapter.config.iconSet || 6;
    num = parseInt(num, 10) || 0;
    if (num && iconSet > 4) {
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
    for (const prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            const dataValue = obj[prop];
            if (prop !== 'data_sequence') {
                const keyNameLong = keyName + '_' + prop.replace(/\s/g, '_');
                insertIntoList(keyNameLong, dataValue);
            }
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

                            const numOfPeriods = result.report.location[l].var[0].data[0].forecast.length;

                            tasks.push({
                                name: 'add',
                                key: 'NextDays.Location_' + (l + 1),
                                obj: {
                                    type: 'device',
                                    common: {
                                        name: result.report.location[l].$.city,
                                        role: 'weather'
                                    }
                                }
                            });
                            const ll = l + 1;

                            for (let p = 0; p < numOfPeriods; p++) {
                                tasks.push({
                                    name: 'add',
                                    key: 'NextDays.Location_' + (l + 1) + '.Day_' + (p + 1),
                                    obj: {
                                        type: 'channel',
                                        common: {
                                            name: 'Day ' + (p + 1),
                                            role: 'weather'
                                        }
                                    }
                                });
                                const numOfDatapoints = result.report.location[l].var.length;
                                const pp = p + 1;
                                let location = result.report.location[l].$.city;
                                const pos = location.indexOf('[');
                                if (pos !== -1) {
                                    location = location.substring(0, pos).trim();
                                }

                                insertIntoList('NextDays.Location_' + ll + '.Day_' + pp + '.Location', location);

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

                        adapter.log.debug('7 days forecast done, objects in list' + Object.keys(tasks).length);

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
                adapter.log.error('DasWetter.com reported an error: ' + error);
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

                            const numOfDays = result.report.location[l].day.length;

                            for (let d = 0; d < numOfDays; d++) {

                                let keyName = '';
                                const ll = l + 1;
                                const dd = d + 1;

                                let value = result.report.location[l].day[d].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd;

                                getProps(value, keyName);

                                value = result.report.location[l].day[d].symbol[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.symbol';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].tempmin[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.tempmin';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].tempmax[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.tempmax';
                                getProps(value, keyName);

                                value = result.report.location[l].day[d].wind[0].$;
                                keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.wind';
                                getProps(value, keyName);

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

                                    value = result.report.location[l].day[d].hour[h].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh;
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].temp[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.temp';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].symbol[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol';
                                    getProps(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].wind[0].$;
                                    keyName = 'NextDaysDetailed.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind';
                                    getProps(value, keyName);

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
                adapter.log.error('DasWetter.com reported an error: ' + error);
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

                            const numOfDays = result.report.location[l].day.length;

                            for (let d = 0; d < numOfDays; d++) {

                                let keyName = '';
                                const ll = l + 1;
                                const dd = d + 1;

                                //adapter.log.debug('loc: ' + l + ' day: ' + d + ' = ' + JSON.stringify(result.report.location[l].day[d]));

                                let value = result.report.location[l].day[d].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd;
                                //adapter.log.debug(JSON.stringify(result.report.location[l].day[d].$));
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].symbol[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.symbol';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].tempmin[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.tempmin';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].tempmax[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.tempmax';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].wind[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.wind';
                                getProps(value, keyName);


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


                                value = result.report.location[l].day[d].moon[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.moon';
                                getProps(value, keyName);


                                value = result.report.location[l].day[d].local_info[0].$;
                                keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.local_info';
                                getProps(value, keyName);


                                const numOfHours = result.report.location[l].day[d].hour.length;

                                for (let h = 0; h < numOfHours; h++) {

                                    //adapter.log.debug('location: ' + l + ' day: ' + d + ' hour ' + h);
                                    const hh = h + 1;

                                    value = result.report.location[l].day[d].hour[h].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh;
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].temp[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.temp';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].symbol[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.symbol';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].wind[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.wind';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].windgusts[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windgusts';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].rain[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.rain';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].humidity[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.humidity';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].pressure[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.pressure';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].clouds[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.clouds';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].snowline[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.snowline';
                                    getProps(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].windchill[0].$;
                                    keyName = 'NextHours.Location_' + ll + '.Day_' + dd + '.Hour_' + hh + '.windchill';
                                    getProps(value, keyName);

                                }
                            }
                        }

                        adapter.log.debug('hourly forecast done, objects in list ' + Object.keys(tasks).length);
                        allDone = true;
                        if (!dbRunning) {
                            startDbUpdate();
                        } else {
                            adapter.log.debug('update already running');
                        }
                    });
                } catch (e) {
                    adapter.log.error('exception in HourlyForecast [' + e + ']');
                }
            } else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error);
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

function insertIntoList(key, value) {
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
        } if (key.match(/\.Maximale_Temperatur_value$/)) {
            obj = {
                type: 'state',
                common: {
                    name: 'Minimal day temperature',
                    type: 'number',
                    role: 'value.temperature.min.forecast.' + d,
                    unit: '°C',
                    read: true,
                    write: false
                }
            };
        } else if (key.match(/\.Minimale_Temperatur_value$/)) {
            obj = {
                type: 'state',
                common: {
                    name: 'Maximal day temperature',
                    type: 'number',
                    role: 'value.temperature.max.forecast.' + d,
                    unit: '°C',
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
        } else if (key.match(/\.Wetter_Symbol_id2/)) {
            obj = {
                type: 'state',
                common: {
                    name: 'Weather icon name',
                    type: 'string',
                    role: 'weather.icon.name.forecast.' + d,
                    unit: '',
                    read: true,
                    write: false
                }
            };
        } else if (key.match(/\.Wetter_Symbol_value2/)) {
            obj = {
                type: 'state',
                common: {
                    name: 'Weather state URL',
                    type: 'string',
                    role: 'weather.title.forecast.' + d,
                    unit: '',
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
                    unit: '',
                    read: true,
                    write: false
                }
            };
        }  else if (key.match(/\.windIconURL/)) {
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
        } else {
            throw 'Unknown task';
        } 
    }
}


function createExtendObject(key, objData, value, callback) {
    adapter.getObject(key, (err, obj) => {
        if (!obj) {
            if (value !== undefined) {
                adapter.log.debug('back to list: ' + key + ' ' + value);
                insertIntoList(key, value);
            }
            adapter.setObjectNotExists(key, objData, callback);
        } else if (value !== undefined) {
            adapter.setState(key, {ack: true, val: value}, callback);
        } else if (cb) {
            cb();
        }
    });
}

function updateExtendObject(key, value, callback) {
    adapter.setState(key, {ack: true, val: value}, callback);
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
                adapter.log.error('DasWetter.com reported an error: ' + error);
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
                adapter.log.error('DasWetter.com reported an error: ' + error);
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
                adapter.log.error('DasWetter.com reported an error: ' + error);
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

function checkWeatherVariablesOld() {

    //7 days forecast
    if (adapter.config.Days7Forecast) {
        adapter.setObjectNotExists('NextDays', {
            type: 'channel',
            role: 'weather',
            common: {name: '7 days forecast'},
            native: {location: adapter.config.location}
        });
        // all states for all 7 days...
        for (let d = 0; d < 7; d++) {
            const id = 'NextDays.' + d + 'd.';
            adapter.setObjectNotExists('NextDays.' + d + 'd', {
                type: 'channel',
                role: 'forecast',
                common: {name: 'in ' + d + ' days'},
                native: {location: adapter.config.location}
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
                native: {id: id + 'Temperature_Min'}
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
                native: {id: id + 'Temperature_Max'}
            });
            adapter.setObjectNotExists(id + 'WindID', {
                type: 'state',
                common: {name: 'WindID', type: 'number', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'Wind_ID'}
            });
            adapter.setObjectNotExists(id + 'WindIDB', {
                type: 'state',
                common: {name: 'WindIDB', type: 'number', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'Wind_IDB'}
            });

            adapter.setObjectNotExists(id + 'Wind', {
                type: 'state',
                common: {name: 'Wind', type: 'string', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'Wind'}
            });
            adapter.setObjectNotExists(id + 'WindB', {
                type: 'state',
                common: {name: 'WindB', type: 'string', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'WindB'}
            });
            adapter.setObjectNotExists(id + 'ConditionID', {
                type: 'state',
                common: {name: 'ConditionID', type: 'number', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'ConditionID'}
            });
            adapter.setObjectNotExists(id + 'Condition', {
                type: 'state',
                common: {name: 'Condition', type: 'string', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'Condition'}
            });

            adapter.setObjectNotExists(id + 'ConditionID2', {
                type: 'state',
                common: {name: 'ConditionID2', type: 'number', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'ConditionID2'}
            });
            adapter.setObjectNotExists(id + 'Condition2', {
                type: 'state',
                common: {name: 'Condition2', type: 'string', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'Condition2'}
            });

            adapter.setObjectNotExists(id + 'day', {
                type: 'state',
                common: {name: 'day', type: 'string', role: 'day', unit: '', read: true, write: false},
                native: {id: id + 'day'}
            });
            adapter.setObjectNotExists(id + 'atmosphere', {
                type: 'state',
                common: {name: 'atmosphere', type: 'string', role: 'atmosphere', unit: '', read: true, write: false},
                native: {id: id + 'atmosphere'}
            });
        }
    }
    //5 days forecast
    if (adapter.config.Days5Forecast) {
        adapter.setObjectNotExists('NextDaysDetailed', {
            type: 'channel',
            role: 'weather',
            common: {name: '5 days detailed forecast'},
            native: {location: adapter.config.location}
        });
        // all states for all 5 days...
        for (let d = 0; d < 5; d++) {
            const id = 'NextDaysDetailed.' + d + 'd.';
            adapter.setObjectNotExists('NextDaysDetailed.' + d + 'd', {
                type: 'channel',
                role: 'forecast',
                common: {name: 'in ' + d + ' days'},
                native: {location: adapter.config.location}
            });

            adapter.setObjectNotExists(id + 'Weekday', {
                type: 'state',
                common: {name: 'Weekday', type: 'string', role: 'day', unit: '', read: true, write: false},
                native: {id: id + 'Weekday'}
            });
            adapter.setObjectNotExists(id + 'date', {
                type: 'state',
                common: {name: 'date', type: 'string', role: 'day', unit: '', read: true, write: false},
                native: {id: id + 'date'}
            });
            adapter.setObjectNotExists(id + 'SymbolID', {
                type: 'state',
                common: {name: 'SymbolID', type: 'number', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'SymbolID'}
            });
            adapter.setObjectNotExists(id + 'Symbol', {
                type: 'state',
                common: {name: 'Symbol', type: 'string', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'Symbol'}
            });

            adapter.setObjectNotExists(id + 'SymbolID2', {
                type: 'state',
                common: {name: 'SymbolID2', type: 'number', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'SymbolID2'}
            });
            adapter.setObjectNotExists(id + 'Symbol2', {
                type: 'state',
                common: {name: 'Symbol2', type: 'string', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'Symbol2'}
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
                native: {id: id + 'Temperature_Min'}
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
                native: {id: id + 'Temperature_Max'}
            });

            adapter.setObjectNotExists(id + 'Wind_Max', {
                type: 'state',
                common: {name: 'Wind_Max', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                native: {id: id + 'Wind_Max'}
            });
            adapter.setObjectNotExists(id + 'WindSymbol', {
                type: 'state',
                common: {name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'WindSymbol'}
            });
            adapter.setObjectNotExists(id + 'WindSymbolB', {
                type: 'state',
                common: {name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'WindSymbolB'}
            });
            adapter.setObjectNotExists(id + 'WindGusts', {
                type: 'state',
                common: {name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                native: {id: id + 'WindGusts'}
            });
            adapter.setObjectNotExists(id + 'Rain', {
                type: 'state',
                common: {name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false},
                native: {id: id + 'Rain'}
            });
            adapter.setObjectNotExists(id + 'Humidity', {
                type: 'state',
                common: {name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false},
                native: {id: id + 'Humidity'}
            });

            adapter.setObjectNotExists(id + 'Pressure', {
                type: 'state',
                common: {name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false},
                native: {id: id + 'Pressure'}
            });
            adapter.setObjectNotExists(id + 'Snowline', {
                type: 'state',
                common: {name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false},
                native: {id: id + 'Snowline'}
            });

            for (let h = 0; h < 8; h++) {
                const id1 = 'NextDaysDetailed.' + d + 'd.' + h + 'h.';
                adapter.setObjectNotExists('NextDaysDetailed.' + d + 'd.' + h + 'h', {
                    type: 'channel',
                    role: 'forecast',
                    common: {name: h + ' period'},
                    native: {location: adapter.config.location}
                });

                adapter.setObjectNotExists(id1 + 'hour', {
                    type: 'state',
                    common: {name: 'hour', type: 'number', role: 'hour', unit: '', read: true, write: false},
                    native: {id: id1 + 'hour'}
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
                    native: {id: id1 + 'Temperature'}
                });
                adapter.setObjectNotExists(id1 + 'SymbolID', {
                    type: 'state',
                    common: {name: 'SymbolID', type: 'number', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'SymbolID'}
                });
                adapter.setObjectNotExists(id1 + 'Symbol', {
                    type: 'state',
                    common: {name: 'Symbol', type: 'string', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'Symbol'}
                });

                adapter.setObjectNotExists(id1 + 'SymbolID2', {
                    type: 'state',
                    common: {name: 'SymbolID2', type: 'number', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'SymbolID2'}
                });
                adapter.setObjectNotExists(id1 + 'Symbol2', {
                    type: 'state',
                    common: {name: 'Symbol2', type: 'string', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'Symbol2'}
                });


                adapter.setObjectNotExists(id1 + 'Wind', {
                    type: 'state',
                    common: {name: 'Wind', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                    native: {id: id1 + 'Wind'}
                });
                adapter.setObjectNotExists(id1 + 'WindDir', {
                    type: 'state',
                    common: {name: 'WindDir', type: 'string', role: 'wind', unit: '', read: true, write: false},
                    native: {id: id1 + 'WindDir'}
                });
                adapter.setObjectNotExists(id1 + 'WindSymbol', {
                    type: 'state',
                    common: {name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false},
                    native: {id: id1 + 'WindSymbol'}
                });
                adapter.setObjectNotExists(id1 + 'WindSymbolB', {
                    type: 'state',
                    common: {name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false},
                    native: {id: id1 + 'WindSymbolB'}
                });
                adapter.setObjectNotExists(id1 + 'WindGusts', {
                    type: 'state',
                    common: {name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                    native: {id: id1 + 'WindGusts'}
                });
                adapter.setObjectNotExists(id1 + 'Rain', {
                    type: 'state',
                    common: {name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false},
                    native: {id: id1 + 'Rain'}
                });
                adapter.setObjectNotExists(id1 + 'Humidity', {
                    type: 'state',
                    common: {name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false},
                    native: {id: id1 + 'Humidity'}
                });

                adapter.setObjectNotExists(id1 + 'Pressure', {
                    type: 'state',
                    common: {name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false},
                    native: {id: id1 + 'Pressure'}
                });
                adapter.setObjectNotExists(id1 + 'Snowline', {
                    type: 'state',
                    common: {name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false},
                    native: {id: id1 + 'Snowline'}
                });
                adapter.setObjectNotExists(id1 + 'Clouds', {
                    type: 'state',
                    common: {name: 'Clouds', type: 'number', role: 'clouds', unit: '', read: true, write: false},
                    native: {id: id1 + 'Clouds'}
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
                    native: {id: id1 + 'Windchill'}
                });
            }

        }
    }

    //hourly forecast
    if (adapter.config.HourlyForecast) {
        adapter.setObjectNotExists('hourly', {
            type: 'channel',
            role: 'weather',
            common: {name: 'hourly detailed forecast'},
            native: {location: adapter.config.location}
        });
        // all states for all hours... (2 days only...)
        for (let d = 0; d < 2; d++) {
            const id = 'hourly.' + d + 'd.';
            adapter.setObjectNotExists('hourly.' + d + 'd', {
                type: 'channel',
                role: 'forecast',
                common: {name: 'in ' + d + ' days'},
                native: {location: adapter.config.location}
            });

            adapter.setObjectNotExists(id + 'Weekday', {
                type: 'state',
                common: {name: 'Weekday', type: 'string', role: 'day', unit: '', read: true, write: false},
                native: {id: id + 'Weekday'}
            });
            adapter.setObjectNotExists(id + 'date', {
                type: 'state',
                common: {name: 'date', type: 'string', role: 'day', unit: '', read: true, write: false},
                native: {id: id + 'date'}
            });
            adapter.setObjectNotExists(id + 'SymbolID', {
                type: 'state',
                common: {name: 'SymbolID', type: 'number', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'SymbolID'}
            });
            adapter.setObjectNotExists(id + 'Symbol', {
                type: 'state',
                common: {name: 'Symbol', type: 'string', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'Symbol'}
            });

            adapter.setObjectNotExists(id + 'SymbolID2', {
                type: 'state',
                common: {name: 'SymbolID2', type: 'number', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'SymbolID2'}
            });
            adapter.setObjectNotExists(id + 'Symbol2', {
                type: 'state',
                common: {name: 'Symbol2', type: 'string', role: 'condition', unit: '', read: true, write: false},
                native: {id: id + 'Symbol2'}
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
                native: {id: id + 'Temperature_Min'}
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
                native: {id: id + 'Temperature_Max'}
            });

            adapter.setObjectNotExists(id + 'Wind_Max', {
                type: 'state',
                common: {name: 'Wind_Max', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                native: {id: id + 'Wind_Max'}
            });
            adapter.setObjectNotExists(id + 'WindSymbol', {
                type: 'state',
                common: {name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'WindSymbol'}
            });
            adapter.setObjectNotExists(id + 'WindSymbolB', {
                type: 'state',
                common: {name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false},
                native: {id: id + 'WindSymbolB'}
            });
            adapter.setObjectNotExists(id + 'WindGusts', {
                type: 'state',
                common: {name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                native: {id: id + 'WindGusts'}
            });
            adapter.setObjectNotExists(id + 'Rain', {
                type: 'state',
                common: {name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false},
                native: {id: id + 'Rain'}
            });
            adapter.setObjectNotExists(id + 'Humidity', {
                type: 'state',
                common: {name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false},
                native: {id: id + 'Humidity'}
            });

            adapter.setObjectNotExists(id + 'Pressure', {
                type: 'state',
                common: {name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false},
                native: {id: id + 'Pressure'}
            });
            adapter.setObjectNotExists(id + 'Snowline', {
                type: 'state',
                common: {name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false},
                native: {id: id + 'Snowline'}
            });

            for (let h = 0; h < 24; h++) {
                const id1 = 'hourly.' + d + 'd.' + h + 'h.';
                adapter.setObjectNotExists('hourly.' + d + 'd.' + h + 'h', {
                    type: 'channel',
                    role: 'forecast',
                    common: {name: h + ' period'},
                    native: {location: adapter.config.location}
                });

                adapter.setObjectNotExists(id1 + 'hour', {
                    type: 'state',
                    common: {name: 'hour', type: 'number', role: 'hour', unit: '', read: true, write: false},
                    native: {id: id1 + 'hour'}
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
                    native: {id: id1 + 'Temperature'}
                });
                adapter.setObjectNotExists(id1 + 'SymbolID', {
                    type: 'state',
                    common: {name: 'SymbolID', type: 'number', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'SymbolID'}
                });
                adapter.setObjectNotExists(id1 + 'Symbol', {
                    type: 'state',
                    common: {name: 'Symbol', type: 'string', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'Symbol'}
                });

                adapter.setObjectNotExists(id1 + 'SymbolID2', {
                    type: 'state',
                    common: {name: 'SymbolID2', type: 'number', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'SymbolID2'}
                });
                adapter.setObjectNotExists(id1 + 'Symbol2', {
                    type: 'state',
                    common: {name: 'Symbol2', type: 'string', role: 'symbol', unit: '', read: true, write: false},
                    native: {id: id1 + 'Symbol2'}
                });


                adapter.setObjectNotExists(id1 + 'Wind', {
                    type: 'state',
                    common: {name: 'Wind', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                    native: {id: id1 + 'Wind'}
                });
                adapter.setObjectNotExists(id1 + 'WindDir', {
                    type: 'state',
                    common: {name: 'WindDir', type: 'string', role: 'wind', unit: '', read: true, write: false},
                    native: {id: id1 + 'WindDir'}
                });
                adapter.setObjectNotExists(id1 + 'WindSymbol', {
                    type: 'state',
                    common: {name: 'WindSymbol', type: 'number', role: 'wind', unit: '', read: true, write: false},
                    native: {id: id1 + 'WindSymbol'}
                });
                adapter.setObjectNotExists(id1 + 'WindSymbolB', {
                    type: 'state',
                    common: {name: 'WindSymbolB', type: 'number', role: 'wind', unit: '', read: true, write: false},
                    native: {id: id1 + 'WindSymbolB'}
                });
                adapter.setObjectNotExists(id1 + 'WindGusts', {
                    type: 'state',
                    common: {name: 'WindGusts', type: 'number', role: 'wind', unit: 'kph', read: true, write: false},
                    native: {id: id1 + 'WindGusts'}
                });
                adapter.setObjectNotExists(id1 + 'Rain', {
                    type: 'state',
                    common: {name: 'Rain', type: 'number', role: 'rain', unit: 'mm', read: true, write: false},
                    native: {id: id1 + 'Rain'}
                });
                adapter.setObjectNotExists(id1 + 'Humidity', {
                    type: 'state',
                    common: {name: 'Humidity', type: 'number', role: 'humidity', unit: '%', read: true, write: false},
                    native: {id: id1 + 'Humidity'}
                });

                adapter.setObjectNotExists(id1 + 'Pressure', {
                    type: 'state',
                    common: {name: 'Pressure', type: 'number', role: 'pressure', unit: 'mb', read: true, write: false},
                    native: {id: id1 + 'Pressure'}
                });
                adapter.setObjectNotExists(id1 + 'Snowline', {
                    type: 'state',
                    common: {name: 'Snowline', type: 'number', role: 'snowline', unit: 'm', read: true, write: false},
                    native: {id: id1 + 'Snowline'}
                });
                adapter.setObjectNotExists(id1 + 'Clouds', {
                    type: 'state',
                    common: {name: 'Clouds', type: 'number', role: 'clouds', unit: '', read: true, write: false},
                    native: {id: id1 + 'Clouds'}
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
                    native: {id: id1 + 'Windchill'}
                });
            }
        }
    }
}