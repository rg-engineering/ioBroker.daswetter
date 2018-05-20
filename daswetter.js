/*
 * DasWetter.com adapter für iobroker
 *
 * Created: 21.03.2017 21:31:28
 *  Author: Rene

Copyright(C)[2016, 2017, 2018][René Glaß]

*/

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.Adapter('daswetter');
var request = require('request');
var parseString = require('xml2js').parseString;

var DBRunning = false;
var AllDone = false;

//Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
	if (obj) {
        switch (obj.command) {
        	case 'send':
        		// e.g. send email or pushover or whatever
        		console.log('send command');

        		// Send response in callback if required
        		if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
        		break;

    	}
    }
});

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.debug('cleaned everything up...');
        callback();
    }
    catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.debug('objectChange ' + id + ' ' + JSON.stringify(obj));

    //feuert auch, wenn adapter im admin anghalten oder gestartet wird...

    if (obj == null && myPort != null) {
        myPort.close();
    }

});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});



// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    try {
        main();
    }
    catch (e) {
        adapter.log.error('exception catch after ready [' + e + ']');
    }
});

function main() {

    // force terminate after 1min
    // don't know why it does not terminate by itself...
    setTimeout(function () {
        
        adapter.log.warn('force terminate, objects still in list: ' + Object.keys(tasks).length);

        process.exit(0);
    }, 240000);

    AllDone = false;
    getForecastData7Days();

    /*
    getForecastData7Days(function () {
        setTimeout(function () {
            adapter.log.warn('force terminate 1');
            //adapter.stop();
            process.exit(0);
        }, 500000);
    });
    */
    

}

function getprops(obj, keyName) {
    //adapter.log.debug(JSON.stringify(obj));
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            //adapter.log.debug(prop);

                var datavalue = obj[prop];

                //adapter.log.debug(keyName + " key " + prop + " = " + datavalue);

                if(prop != "data_sequence") {
                    var keyNameLong = keyName + "." + prop;

                    InsertIntoList(keyNameLong, obj, datavalue);
                }
            }
    }
}

function getForecastData7Days(cb) {

    if (adapter.config.Days7Forecast) {
        var url = adapter.config.Days7Forecast;
        adapter.log.debug('calling forecast 7 days: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {

                    //adapter.log.debug(body);

                    //convert xml to json first
                    parseString(body, function (err, result) {
                        //var oData = JSON.parse(result);

                        //adapter.log.debug(JSON.stringify(result));

                        //result.report.location[0].var[0].data[0].forecast[d].$.value
                        var NoOfLocations = result.report.location.length;
                        
                        //adapter.log.debug("locations: " + NoOfLocations + " periods: " + NoOfPeriods + " datapoints: " + NoOfDatapoints);

                        for (var l = 0; l < NoOfLocations; l++) {

                            var NoOfPeriods = result.report.location[l].var[0].data[0].forecast.length;

                            for (var p = 0; p < NoOfPeriods; p++) {

                                var NoOfDatapoints = result.report.location[l].var.length;

                                for (var d = 0; d < NoOfDatapoints; d++) {

                                    var DatapointName = result.report.location[l].var[d].name;
                                    var pp = p + 1;
                                    var ll = l + 1;
                                    var keyName = "NextDays.Location_" + ll + ".Day_" + pp + "." + DatapointName;

                                    var value = result.report.location[l].var[d].data[0].forecast[p].$;

                                    //var size = Object.keys(value).length;
                                    var size = 0;

                                    getprops(value, keyName);

                                }
                            }
                        }
                        adapter.log.debug('7 days forecast done, ojects in list' + Object.keys(tasks).length);
                        if (!DBRunning) {
                            StartDBUpdate();
                        }
                        else {
                            adapter.log.debug('update already running');
                        }
                        getForecastData5Days(cb);
                    });
              
                }
                catch (e) {
                    adapter.log.error('exception in 7DaysForecast [' + e + ']');
                    getForecastData5Days(cb);
                }
            }
            else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error);
                getForecastData5Days(cb);
            }
        });
    }
    else {
        getForecastData5Days(cb);
    }
    if (cb) cb();
}




function getForecastData5Days(cb) {

    if (adapter.config.Days5Forecast) {
        var url = adapter.config.Days5Forecast;
        adapter.log.debug('calling forecast 5 days: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);
                    var body1 = body.replace(/wind-gusts/g, "windgusts");

                    parseString(body1, function (err, result) {
                        //var oData = JSON.parse(result);

                        //adapter.log.debug(JSON.stringify(result));

                        var NoOfLocations = result.report.location.length;
                       
                        for (var l = 0; l < NoOfLocations; l++) {

                            var NoOfDays = result.report.location[l].day.length;

                            for (var d = 0; d < NoOfDays; d++) {

                                var keyName = "";
                                var ll = l + 1;
                                var dd = d + 1;
                                
                                var value = result.report.location[l].day[d].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd;
                                
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].symbol[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".symbol";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].tempmin[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".tempmin";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].tempmax[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".tempmax";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].wind[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".wind";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].windgusts[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".windgusts";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].rain[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".rain";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].humidity[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".humidity";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].pressure[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".pressure";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].snowline[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".snowline";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].sun[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".sun";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].moon[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".moon";
                                getprops(value, keyName);

                                value = result.report.location[l].day[d].local_info[0].$;
                                keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".local_info";
                                getprops(value, keyName);

                                var NoOfHours = result.report.location[l].day[d].hour.length;

                                for (var h = 0; h < NoOfHours; h++) {

                                    //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                                    var hh = h + 1;

                                    value = result.report.location[l].day[d].hour[h].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh;
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].temp[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].symbol[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].wind[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].windgusts[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windgusts";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].rain[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].humidity[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].pressure[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].clouds[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].snowline[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".snowline";
                                    getprops(value, keyName);

                                    value = result.report.location[l].day[d].hour[h].windchill[0].$;
                                    keyName = "NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                                    getprops(value, keyName);
                                }
                            }
                        }

                        adapter.log.debug('5 days forecast done, objects in list ' + Object.keys(tasks).length);
                        if (!DBRunning) {
                            StartDBUpdate();
                        }
                        else {
                            adapter.log.debug('update already running');
                        }
                        getForecastDataHourly(cb);
                    });
                }
                catch (e) {
                    adapter.log.error('exception in 5DaysForecast [' + e + ']');
                    getForecastDataHourly(cb);
                }
            }
            else {
                // ERROR
                adapter.log.error('DasWetter.com reported an error: ' + error);
                getForecastDataHourly(cb);
            }
        });
    }
    else {
        getForecastDataHourly(cb);
    }
    //if (cb) cb();
}




function getForecastDataHourly(cb) {

    if (adapter.config.HourlyForecast) {
        var url = adapter.config.HourlyForecast;
        adapter.log.debug('calling forecast hourly: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {


                try {
                    //adapter.log.debug('got body: ' + body);

                    var body1 = body.replace(/wind-gusts/g, "windgusts");
                    //adapter.log.debug('got body: ' + body);

                    parseString(body1, function (err, result) {
                        //var oData = JSON.parse(result);

                        //adapter.log.debug(JSON.stringify(result));

                        var NoOfLocations = result.report.location.length;

                        for (var l = 0; l < NoOfLocations; l++) {

                            var NoOfDays = result.report.location[l].day.length;

                            for (var d = 0; d < NoOfDays; d++) {

                                var keyName = "";
                                var ll = l + 1;
                                var dd = d + 1;

                                //adapter.log.debug("loc: " + l + " day: " + d + " = " + JSON.stringify(result.report.location[l].day[d]));

                                var value = result.report.location[l].day[d].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd;
                                //adapter.log.debug(JSON.stringify(result.report.location[l].day[d].$));
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].symbol[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".symbol";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].tempmin[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".tempmin";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].tempmax[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".tempmax";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].wind[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".wind";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].windgusts[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".windgusts";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].rain[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".rain";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].humidity[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".humidity";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].pressure[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".pressure";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].snowline[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".snowline";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].sun[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".sun";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].moon[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".moon";
                                getprops(value, keyName);


                                value = result.report.location[l].day[d].local_info[0].$;
                                keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".local_info";
                                getprops(value, keyName);


                                var NoOfHours = result.report.location[l].day[d].hour.length;

                                for (var h = 0; h < NoOfHours; h++) {

                                    //adapter.log.debug("location: " + l + " day: " + d + " hour " + h);
                                    var hh = h + 1;

                                    value = result.report.location[l].day[d].hour[h].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh;
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].temp[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".temp";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].symbol[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".symbol";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].wind[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".wind";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].windgusts[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windgusts";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].rain[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".rain";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].humidity[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".humidity";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].pressure[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".pressure";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].clouds[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".clouds";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].snowline[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".snowline";
                                    getprops(value, keyName);


                                    value = result.report.location[l].day[d].hour[h].windchill[0].$;
                                    keyName = "NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh + ".windchill";
                                    getprops(value, keyName);

                                }
                            }
                        }


                        adapter.log.debug('hourly forecast done, objects in list ' + Object.keys(tasks).length);
                        AllDone = true;
                        if (!DBRunning) {
                            StartDBUpdate();
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
        AllDone = true;
        if (!DBRunning) {
            StartDBUpdate();
        }
        else {
            adapter.log.debug('update already running');
        }
    }
}

var tasks = [];

function InsertIntoList(key, obj, value) {

    var obj = {
        type: 'state',
        common: { name: 'data', type: 'string', role: 'history', unit: '', read: true, write: false },
        native: { location: key }
    };
    tasks.push({
        name: "add",
        key: key,
        obj: obj,
        value: value
    });
    tasks.push({
        name: "update",
        key: key,
        obj: obj,
        value: value
    });
}

function StartDBUpdate() {
    adapter.log.debug('objects in list: ' + Object.keys(tasks).length);

    
    processTasks(tasks);
}

function processTasks(tasks) {
    if (!tasks || !tasks.length) {
        adapter.log.debug('nothing to do');
        DBRunning = false;

        if (AllDone) {
            adapter.log.debug('exit, all done');

            process.exit(0);
        }

        return;
    }

    DBRunning = true;
    var task = tasks.shift();
    if (task.name === 'add') {
        createExtendObject(task.key, task.obj, function () {
            setTimeout(processTasks, 0, tasks);
        });
    } else if (task.name === 'update') {
        updateExtendObject(task.key, task.value, function () {
            setTimeout(processTasks, 0, tasks);
        });
    }  else {
        throw 'Unknown task';
    }
}


function createExtendObject(key, objData, callback) {

    adapter.getObject(key, function (err, obj) {
        if (!obj) {
            adapter.setObjectNotExists(key, objData, callback);
            //adapter.log.debug('create: ' + key);
        }
        else {
            adapter.extendObject(key, objData, callback);
        }
    });
}

function updateExtendObject(key, value, callback) {

    adapter.setState(key, { ack: true, val: value },callback);
    //adapter.log.debug('update: ' + key + " " + value);

}


//============================================================================================
// old functions for compatibility



