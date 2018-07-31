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
    // force terminate after 4 min
    // don't know why it does not terminate by itself...
    setTimeout(function () {
        adapter.log.warn('force terminate, objects still in list: ' + Object.keys(tasks).length);
        process.exit(15);
    }, 300000); //300000
    AllDone = false;
    
    
    DeleteOldData(adapter.config.UseNewDataset);

    if (adapter.config.UseNewDataset) {
        adapter.log.debug('using new datastaructure');

        getForecastData7Days();

    }
    else {
        adapter.log.debug('using old datastaructure');

        checkWeatherVariables_old();

        getForecastData7Days_old();
    }
    
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

                    InsertIntoList(keyNameLong,  datavalue);
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

                        CheckObject('NextDays', "7 days forecast", 'device');

                        //adapter.log.debug(JSON.stringify(result));

                        //result.report.location[0].var[0].data[0].forecast[d].$.value
                        var NoOfLocations = result.report.location.length;
                        
                        //adapter.log.debug("locations: " + NoOfLocations + " periods: " + NoOfPeriods + " datapoints: " + NoOfDatapoints);

                        for (var l = 0; l < NoOfLocations; l++) {

                            var ll = l + 1;
                            CheckObject("NextDays.Location_" + ll, "Location " + ll, 'channel');

                            
                            var NoOfPeriods = result.report.location[l].var[0].data[0].forecast.length;

                            for (var p = 0; p < NoOfPeriods; p++) {

                                var pp = p + 1;
                                CheckObject("NextDays.Location_" + ll + ".Day_" + pp, "Day " + pp, 'channel');
                                
                                var NoOfDatapoints = result.report.location[l].var.length;

                                for (var d = 0; d < NoOfDatapoints; d++) {

                                    var DatapointName = result.report.location[l].var[d].name;
                                    
                                    
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
                        CheckObject('NextDaysDetailed', "5 days detailed forecast", 'device');
                        

                        var NoOfLocations = result.report.location.length;
                       
                        for (var l = 0; l < NoOfLocations; l++) {

                            
                            var ll = l + 1;
                            CheckObject("NextDaysDetailed.Location_" + ll, "Location " + ll, 'channel');
                            

                            var NoOfDays = result.report.location[l].day.length;

                            for (var d = 0; d < NoOfDays; d++) {

                                var keyName = "";
                                
                                var dd = d + 1;
                                CheckObject("NextDaysDetailed.Location_" + ll + ".Day_" + dd, "Day " + dd, 'channel');
                                
                                
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
                                    CheckObject("NextDaysDetailed.Location_" + ll + ".Day_" + dd + ".Hour_" + hh, "Hour " + hh, 'channel');
                                    
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
                        CheckObject('NextHours', "hourly forecast", 'device');
                        

                        var NoOfLocations = result.report.location.length;

                        for (var l = 0; l < NoOfLocations; l++) {
                            var ll = l + 1;
                            CheckObject("NextHours.Location_" + ll, "Location " + ll, 'channel');



                            var NoOfDays = result.report.location[l].day.length;

                            for (var d = 0; d < NoOfDays; d++) {

                                var keyName = "";
                               
                                var dd = d + 1;
                                CheckObject("NextHours.Location_" + ll + ".Day_" + dd, "Day " + dd, 'channel');
                                


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
                                    CheckObject("NextHours.Location_" + ll + ".Day_" + dd + ".Hour_" + hh, "Hour " + hh, 'channel');
                                    
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

function InsertIntoList(key, value) {

    var obj = {
        type: 'state',
        common: { name: key, type: 'string', role: 'history', unit: '', read: true, write: false },
        native: { location: key }
    };
    tasks.push({
        name: "update",
        key: key,
        obj: obj,
        value: value
    });
    
}

function CheckObject(key, name, type) {
    adapter.getObject(key, function (err, obj) {
        if (!obj) {
            adapter.log.debug('add object: ' + key);
            var newObj = {
                type: type,
                common: { name: name, type: 'string', role: 'history', unit: '', read: true, write: false },
                native: { location: key }
            };

            tasks.push({
                name: "add",
                key: key,
                obj: newObj,
            });

        }
        else {
            //adapter.log.debug('object already there: ' + key);
        }
    });


}


function DeleteIntoList(key) {
    tasks.push({
        name: "delete",
        key: key
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
        createExtendObject(task.key, task.obj, task.value, function () {
            setTimeout(processTasks, 0, tasks);
        });
    } else if (task.name === 'update') {
        updateExtendObject(task.key, task.obj, task.value, function () {
            setTimeout(processTasks, 0, tasks);
        });
    } else if (task.name === 'delete') {
       DeleteState(task.key, function () {
            setTimeout(processTasks, 0, tasks);
        });
    } else {
        throw 'Unknown task';
    }
}


function createExtendObject(key, objData, value, callback) {

    adapter.getObject(key, function (err, obj) {
        try {
            if (!obj) {
                adapter.log.debug('create: ' + key );
                adapter.setObjectNotExists(key, objData, callback);
            }
            else {
                //already exist
                adapter.log.debug('create: already exist ' + key );
                callback();
            }
        }
        catch (e) {
            adapter.log.error('exception in createExtendObject [' + e + ']');
        }
    });
}

function updateExtendObject(key, objData, value, callback) {

    //check if exist
    adapter.getObject(key, function (err, obj) {
        try {
            if (!obj) {
                //if not exist: creat
                adapter.log.debug('back to list: ' + key + " " + value);
                adapter.setObjectNotExists(key, objData, callback);
                
                InsertIntoList(key, value);

            }
            else {
                //adapter.log.debug('update: ' + key + " " + value);
                adapter.setState(key, { ack: true, val: value }, callback);
                
            }
        }
        catch (e) {
            adapter.log.error('exception in updateExtendObject [' + e + ']');
        }
    });
}

// Delete all states from array (one after each other)
/*
function deleteStates(states, callback) {
    // If array is empty => finished
    if (!states || !states.length) {
        if (callback) callback();
        return;
    }

    // Get one ID
    var id = states.pop();

    // Delete Object
    adapter.delObject(id, function (err) {
        // Delete state
        adapter.delState(id, function (err) {
            // Go to next ID
            setTimeout(deleteStates, 0, states, callback);
        });
    });
}
*/

function DeleteState(state, callback) {

    adapter.delObject(state, function (err) {
        // Delete state
        adapter.delState(state, callback);
    });

}
/*
https://github.com/ioBroker/ioBroker/wiki/Adapter-Development-Documentation
*/
function DeleteObject(key, callback) {

    // Get all IDs of this adapter

    var sKeyArr = key.split(".");
    adapter.log.debug("*********" + JSON.stringify(sKeyArr));

    adapter.getChannelsOf(sKeyArr[0], function (err, channels) {
        if (err) {
            adapter.log.error("error in  DeleteObject " + sKeyArr[0] + " " + err);
        }
        else {

            adapter.log.debug("got " + channels.length + " channels, objects in list " + Object.keys(tasks).length);
            for (var i = 0; i < channels.length; i++) {
                //adapter.log.debug("got channel: " + JSON.stringify(channels[i]));

                var channel = channels[i].common.name;

                adapter.getStatesOf(sKeyArr[0], channel, function (err, states) {
                    if (err) {
                        adapter.log.error("error in  DeleteObject " + channel + " " + err);
                    }
                    else {
                        adapter.log.debug("got " + states.length + " states in " + channel);
                        for (var j = 0; j < states.length; j++) {
                            //adapter.log.debug("got state " + states[j].native.location + " in " + channel + " " + JSON.stringify(states[j]));

                            //adapter.log.debug("got state " + states[j]._id );
                            DeleteIntoList(states[j]._id);
                        }
                    }
                });


            }
        }
    });

    /*
    got 8 channels
    got channel: {"type":"channel","common":{"name":"Location 1","type":"string","role":"history","unit":"","read":true,"write":false},"native":{"location":"NextDays.Location_1"},"from":"system.adapter.daswetter.0","ts":1530122433923,"_id":"daswetter.0.NextDays.Location_1","acl":{"object":1636,"owner":"system.user.admin","ownerGroup":"system.group.administrator"}}
    got channel: {"type":"channel","common":{"name":"Day 1","type":"string","role":"history","unit":"","read":true,"write":false},"native":{"location":"NextDays.Location_1.Day_1"},"from":"system.adapter.daswetter.0","ts":1530122434020,"_id":"daswetter.0.NextDays.Location_1.Day_1","acl":{"object":1636,"owner":"system.user.admin","ownerGroup":"system.group.administrator"}}
    */

    /*
    adapter.getStatesOf(sKeyArr[0], sKeyArr[1], function (err, states) {
        //var toDelete = [];
        adapter.log.debug("got " + states.length + " states " );

        for (var i = 0; i < states.length; i++) {
            adapter.log.debug("got state: " + JSON.stringify(states[i]));

        }



        
        //for (var id in states) {
        //    // test value and store ID if value is empty
        //    if (states[id].native.location.includes(key)) {
        //        //toDelete.push(id);
        //        adapter.log.debug("got state: " + JSON.stringify(states[id]));
        //    }
        //}
        
        // gently delete all empty states
        deleteStates(toDelete, function () {
            adapter.log.info('delete finished');
            process.exit(12);
        });
    });
*/
    /*
    got 84 states
    got state: {"type":"state","common":{"name":"data","type":"string","role":"history","unit":"","read":true,"write":false},"native":{"location":"NextDays.Location_1.Day_1.Minimale Temperatur.value"},"from":"system.adapter.daswetter.0","ts":1530122423708,"_id":"daswetter.0.NextDays.Location_1.Day_1.Minimale Temperatur.value","acl":{"object":1636,"state":1636,"owner":"system.user.admin","ownerGroup":"system.group.administrator"}}
    */

/*
    adapter.getObjects(function (err, obj) {
        if (err) {
            adapter.log.error("error in  getObjects " + key + " " + err);
        }
        else {
            adapter.log.debug("got objects " + obj.length);
        }
    });
    */
/*
    adapter.getObject(key, function (err, obj) {

        if (err) {
            adapter.log.debug("error in deleting " + key + " " + err);
        }
        else {
            if (obj) {

                adapter.log.debug("deleting " + key + " " + obj.type);

                if (obj.type === "channel") {
                    adapter.log.debug(key + " " + obj._id + " is channel");
                    adapter.deleteChannel('', obj._id, function (err, obj) {
                        if (err) {
                            adapter.log.debug("error 222 in deleting " + key + " " + err);
                        }
                        else {
                            adapter.log.debug("deleted");
                        }
                    });
                }
                else if (obj.type === "device") {
                    adapter.log.debug(key + " is device");
                }
                else if (obj.type === "state") {
                    adapter.log.debug(key + " is state");
                    adapter.delObject ( obj._id, function (err, obj) {
                        if (err) {
                            adapter.log.debug("error 222 in deleting " + key + " " + err);
                        }
                        else {
                            adapter.log.debug("deleted");
                        }
                    });

                }
                else {
                    adapter.log.debug(key + " is unknown");
                }
            }
            else {
                adapter.log.debug("is null " + key);
            }

            //process.exit(12);
        }
    });
*/

/*
    adapter.delObject(key, function (err, obj) {
        try {
            if (err) {
                adapter.log.error("delete  " + key + " : " + err + " type "  );
            }
            else {
                adapter.log.info("object deleted");
            }
            callback();
        }
        catch (e) {
            adapter.log.error('exception in DeleteObject [' + e + ']');
        }
    });
*/
}






//============================================================================================
// old functions for compatibility



function getForecastData7Days_old(cb) {

    if (adapter.config.Days7Forecast) {
        var url = adapter.config.Days7Forecast;
        adapter.log.debug('calling forecast: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);
                    parseString(body, function (err, result) {
                        //adapter.log.debug('parsed7: ' + JSON.stringify(result));
                        for (var d = 0; d < 7; d++) {
                            var id = "NextDays." + d + "d.";

                            InsertIntoList(id + 'Temperature_Min',  result.report.location[0].var[0].data[0].forecast[d].$.value );
                            InsertIntoList(id + 'Temperature_Max',  result.report.location[0].var[1].data[0].forecast[d].$.value );
                            InsertIntoList(id + 'WindID',  result.report.location[0].var[2].data[0].forecast[d].$.id );
                            InsertIntoList(id + 'WindIDB',  result.report.location[0].var[2].data[0].forecast[d].$.idB );
                            InsertIntoList(id + 'Wind',  result.report.location[0].var[2].data[0].forecast[d].$.value );
                            InsertIntoList(id + 'WindB',  result.report.location[0].var[2].data[0].forecast[d].$.valueB );
                            InsertIntoList(id + 'ConditionID',  result.report.location[0].var[3].data[0].forecast[d].$.id );
                            InsertIntoList(id + 'Condition',  result.report.location[0].var[3].data[0].forecast[d].$.value );
                            InsertIntoList(id + 'ConditionID2',  result.report.location[0].var[3].data[0].forecast[d].$.id2 );
                            InsertIntoList(id + 'Condition2',  result.report.location[0].var[3].data[0].forecast[d].$.value2 );
                            InsertIntoList(id + 'day',  result.report.location[0].var[4].data[0].forecast[d].$.value );
                            InsertIntoList(id + 'atmosphere',  result.report.location[0].var[5].data[0].forecast[d].$.value );
                            /*
                            adapter.setState(id + 'Temperature_Min', { ack: true, val: result.report.location[0].var[0].data[0].forecast[d].$.value });
                            adapter.setState(id + 'Temperature_Max', { ack: true, val: result.report.location[0].var[1].data[0].forecast[d].$.value });
                            adapter.setState(id + 'WindID', { ack: true, val: result.report.location[0].var[2].data[0].forecast[d].$.id });
                            adapter.setState(id + 'WindIDB', { ack: true, val: result.report.location[0].var[2].data[0].forecast[d].$.idB });
                            adapter.setState(id + 'Wind', { ack: true, val: result.report.location[0].var[2].data[0].forecast[d].$.value });
                            adapter.setState(id + 'WindB', { ack: true, val: result.report.location[0].var[2].data[0].forecast[d].$.valueB });
                            adapter.setState(id + 'ConditionID', { ack: true, val: result.report.location[0].var[3].data[0].forecast[d].$.id });
                            adapter.setState(id + 'Condition', { ack: true, val: result.report.location[0].var[3].data[0].forecast[d].$.value });
                            adapter.setState(id + 'ConditionID2', { ack: true, val: result.report.location[0].var[3].data[0].forecast[d].$.id2 });
                            adapter.setState(id + 'Condition2', { ack: true, val: result.report.location[0].var[3].data[0].forecast[d].$.value2 });
                            adapter.setState(id + 'day', { ack: true, val: result.report.location[0].var[4].data[0].forecast[d].$.value });
                            adapter.setState(id + 'atmosphere', { ack: true, val: result.report.location[0].var[5].data[0].forecast[d].$.value });
                            */
                        }
                        adapter.log.debug('7 days forecast done, objects in list ' + Object.keys(tasks).length);
                        getForecastData5Days_old(cb);

                        
                        if (!DBRunning) {
                            StartDBUpdate();
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
        getForecastData5Days_old(cb);
    }
    if (cb) cb();
}

function getForecastData5Days_old(cb) {

    if (adapter.config.Days5Forecast) {
        var url = adapter.config.Days5Forecast;
        adapter.log.debug('calling forecast: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);
                    var body1 = body.replace(/wind-gusts/g, "windgusts");

                    parseString(body1, function (err, result) {
                        //adapter.log.debug('parsed5: ' + JSON.stringify(result));


                        for (var d = 0; d < 5; d++) {
                            var id = "NextDaysDetailed." + d + "d.";

                            InsertIntoList(id + 'Weekday',  result.report.location[0].day[d].$.name );
                            InsertIntoList(id + 'date',  result.report.location[0].day[d].$.value );
                            InsertIntoList(id + 'SymbolID',  result.report.location[0].day[d].symbol[0].$.value );
                            InsertIntoList(id + 'Symbol',  result.report.location[0].day[d].symbol[0].$.desc );
                            InsertIntoList(id + 'SymbolID2',  result.report.location[0].day[d].symbol[0].$.value2 );
                            InsertIntoList(id + 'Symbol2',  result.report.location[0].day[d].symbol[0].$.desc2 );
                            InsertIntoList(id + 'Temperature_Min',  result.report.location[0].day[d].tempmin[0].$.value );
                            InsertIntoList(id + 'Temperature_Max',  result.report.location[0].day[d].tempmax[0].$.value );
                            InsertIntoList(id + 'Wind_Max',  result.report.location[0].day[d].wind[0].$.value );
                            InsertIntoList(id + 'WindSymbol',  result.report.location[0].day[d].wind[0].$.symbol );
                            InsertIntoList(id + 'WindSymbolB', result.report.location[0].day[d].wind[0].$.symbolB );
                            InsertIntoList(id + 'WindGusts',  result.report.location[0].day[d].windgusts[0].$.value );
                            InsertIntoList(id + 'Rain', result.report.location[0].day[d].rain[0].$.value);
                            InsertIntoList(id + 'Humidity', result.report.location[0].day[d].humidity[0].$.value );
                            InsertIntoList(id + 'Pressure',  result.report.location[0].day[d].pressure[0].$.value );
                            InsertIntoList(id + 'Snowline',  result.report.location[0].day[d].snowline[0].$.value );


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

                            for (var h = 0; h < 8; h++) {
                                var id1 = "NextDaysDetailed." + d + "d." + h + 'h.';

                                InsertIntoList(id1 + 'hour', result.report.location[0].day[d].hour[h].$.value );
                                InsertIntoList(id1 + 'Temperature',  result.report.location[0].day[d].hour[h].temp[0].$.value );
                                InsertIntoList(id1 + 'SymbolID',  result.report.location[0].day[d].hour[h].symbol[0].$.value );
                                InsertIntoList(id1 + 'Symbol',  result.report.location[0].day[d].hour[h].symbol[0].$.desc );
                                InsertIntoList(id1 + 'SymbolID2',  result.report.location[0].day[d].hour[h].symbol[0].$.value2 );
                                InsertIntoList(id1 + 'Symbol2',  result.report.location[0].day[d].hour[h].symbol[0].$.desc2 );
                                InsertIntoList(id1 + 'Wind',  result.report.location[0].day[d].hour[h].wind[0].$.value );
                                InsertIntoList(id1 + 'WindDir',  result.report.location[0].day[d].hour[h].wind[0].$.dir );
                                InsertIntoList(id1 + 'WindSymbol',  result.report.location[0].day[d].hour[h].wind[0].$.symbol );
                                InsertIntoList(id1 + 'WindSymbolB',  result.report.location[0].day[d].hour[h].wind[0].$.symbolB );
                                InsertIntoList(id1 + 'WindGusts',  result.report.location[0].day[d].hour[h].windgusts[0].$.value );
                                InsertIntoList(id1 + 'Rain',  result.report.location[0].day[d].hour[h].rain[0].$.value );
                                InsertIntoList(id1 + 'Humidity',  result.report.location[0].day[d].hour[h].humidity[0].$.value );
                                InsertIntoList(id1 + 'Pressure',  result.report.location[0].day[d].hour[h].pressure[0].$.value );
                                InsertIntoList(id1 + 'Snowline',  result.report.location[0].day[d].hour[h].snowline[0].$.value );
                                InsertIntoList(id1 + 'Clouds',  result.report.location[0].day[d].hour[h].clouds[0].$.value );
                                InsertIntoList(id1 + 'Windchill',  result.report.location[0].day[d].hour[h].windchill[0].$.value );
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
                        getForecastDataHourly_old(cb);

                        
                        if (!DBRunning) {
                            StartDBUpdate();
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
        getForecastDataHourly_old(cb);
    }
    if (cb) cb();
}

function getForecastDataHourly_old(cb) {

    if (adapter.config.HourlyForecast) {
        var url = adapter.config.HourlyForecast;
        adapter.log.debug('calling forecast: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);

                    var body1 = body.replace(/wind-gusts/g, "windgusts");
                    //adapter.log.debug('got body: ' + body);

                    parseString(body1, function (err, result) {
                        //adapter.log.debug('parsedhourly: ' + JSON.stringify(result));




                        for (var d = 0; d < 2; d++) {

                            var id = "hourly." + d + "d.";

                            InsertIntoList(id + 'Weekday', result.report.location[0].day[d].$.name);
                            InsertIntoList(id + 'date', result.report.location[0].day[d].$.value);
                            InsertIntoList(id + 'SymbolID', result.report.location[0].day[d].symbol[0].$.value);
                            InsertIntoList(id + 'Symbol', result.report.location[0].day[d].symbol[0].$.desc);
                            InsertIntoList(id + 'SymbolID2', result.report.location[0].day[d].symbol[0].$.value2);
                            InsertIntoList(id + 'Symbol2', result.report.location[0].day[d].symbol[0].$.desc2);
                            InsertIntoList(id + 'Temperature_Min', result.report.location[0].day[d].tempmin[0].$.value);
                            InsertIntoList(id + 'Temperature_Max', result.report.location[0].day[d].tempmax[0].$.value);
                            InsertIntoList(id + 'Wind_Max', result.report.location[0].day[d].wind[0].$.value);
                            InsertIntoList(id + 'WindSymbol', result.report.location[0].day[d].wind[0].$.symbol);
                            InsertIntoList(id + 'WindSymbolB', result.report.location[0].day[d].wind[0].$.symbolB);
                            InsertIntoList(id + 'WindGusts', result.report.location[0].day[d].windgusts[0].$.value);
                            InsertIntoList(id + 'Rain', result.report.location[0].day[d].rain[0].$.value);
                            InsertIntoList(id + 'Humidity', result.report.location[0].day[d].humidity[0].$.value);
                            InsertIntoList(id + 'Pressure', result.report.location[0].day[d].pressure[0].$.value);
                            InsertIntoList(id + 'Snowline', result.report.location[0].day[d].snowline[0].$.value);

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

                            for (var h = 0; h < 24; h++) {
                                var id1 = "hourly." + d + "d." + h + 'h.';

                                InsertIntoList(id1 + 'hour', result.report.location[0].day[d].hour[h].$.value);
                                InsertIntoList(id1 + 'Temperature', result.report.location[0].day[d].hour[h].temp[0].$.value);
                                InsertIntoList(id1 + 'SymbolID', result.report.location[0].day[d].hour[h].symbol[0].$.value);
                                InsertIntoList(id1 + 'Symbol', result.report.location[0].day[d].hour[h].symbol[0].$.desc);

                                InsertIntoList(id1 + 'SymbolID2', result.report.location[0].day[d].hour[h].symbol[0].$.value2);
                                InsertIntoList(id1 + 'Symbol2', result.report.location[0].day[d].hour[h].symbol[0].$.desc2);

                                InsertIntoList(id1 + 'Wind', result.report.location[0].day[d].hour[h].wind[0].$.value);
                                InsertIntoList(id1 + 'WindDir', result.report.location[0].day[d].hour[h].wind[0].$.dir);
                                InsertIntoList(id1 + 'WindSymbol', result.report.location[0].day[d].hour[h].wind[0].$.symbol);
                                InsertIntoList(id1 + 'WindSymbolB', result.report.location[0].day[d].hour[h].wind[0].$.symbolB);
                                InsertIntoList(id1 + 'WindGusts', result.report.location[0].day[d].hour[h].windgusts[0].$.value);
                                InsertIntoList(id1 + 'Rain', result.report.location[0].day[d].hour[h].rain[0].$.value);
                                InsertIntoList(id1 + 'Humidity',  result.report.location[0].day[d].hour[h].humidity[0].$.value);
                                InsertIntoList(id1 + 'Pressure', result.report.location[0].day[d].hour[h].pressure[0].$.value);
                                InsertIntoList(id1 + 'Snowline', result.report.location[0].day[d].hour[h].snowline[0].$.value);
                                InsertIntoList(id1 + 'Clouds', result.report.location[0].day[d].hour[h].clouds[0].$.value);
                                InsertIntoList(id1 + 'Windchill', result.report.location[0].day[d].hour[h].windchill[0].$.value);

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
    if (cb) cb();
}


function DeleteOldData(bUseNewDataset) {

    adapter.log.debug('checking data structures');

    //daswetter.0.NextHours.Location_1
    //daswetter.0.NextHours.Location_1.Day_1.Hour_1
    //daswetter.0.NextHours.Location_1.Day_1.Hour_1.clouds.value
    //DeleteObject("NextHours.Location_1.Day_1.Hour_1", null);
    //DeleteObject("NextDays.Location_1.Day_1.Hour_1", null);

    if (bUseNewDataset) {
       
        adapter.getObject('NextDays.0d', function (err, obj) {
            if (err) {
                // do nothing
            } else {
                if (obj) {
                    adapter.log.debug('deleting NextDays.xd');
                    DeleteObject("NextDays.0d", null);
                    //DeleteObject("NextDays.1d", null);
                    //DeleteObject("NextDays.2d", null);
                    //DeleteObject("NextDays.3d", null);
                    //DeleteObject("NextDays.4d", null);
                    //DeleteObject("NextDays.5d", null);
                    //DeleteObject("NextDays.6d", null);
                    
                }
            }
        });

        adapter.getObject('NextDaysDetailed.0d', function (err, obj) {
            if (err) {
                // do nothing
            } else {
                if (obj) {
                    adapter.log.debug('deleting NextDaysDetailed.xd');
                    //DeleteObject("NextDaysDetailed.0d", null);
                    //DeleteObject("NextDaysDetailed.1d", null);
                    //DeleteObject("NextDaysDetailed.2d", null);
                    //DeleteObject("NextDaysDetailed.3d", null);
                    //DeleteObject("NextDaysDetailed.4d", null);
                    
                }
            }
        });
        adapter.getObject('hourly.0d', function (err, obj) {
            if (err) {
                // do nothing
            } else {
                if (obj) {
                    adapter.log.debug('deleting hourly.xd');
                    //DeleteObject("hourly.0d", null);
                    //DeleteObject("hourly.1d", null);
                }
            }
        });
    }
    else {
        adapter.getObject('NextDays.Location_1', function (err, obj) {
            if (err) {
                // do nothing
            } else {
                if (obj) {
                    adapter.log.debug('deleting NextDays.Location_1');
                    DeleteObject("NextDays.Location_1", null);
                }
            }
        });
        adapter.getObject('NextDaysDetailed.Location_1', function (err, obj) {
            if (err) {
                // do nothing
            } else {
                if (obj) {
                    adapter.log.debug('deleting NextDaysDetailed.Location_1');
                    DeleteObject("NextDaysDetailed.Location_1", null);
                }
            }
        });
        adapter.getObject('NextDaysDetailed.Location_1', function (err, obj) {
            if (err) {
                // do nothing
            } else {
                if (obj) {
                    adapter.log.debug('deleting NextHours.Location_1');
                    DeleteObject("NextHours.Location_1", null);
                }
            }
        });
    }
}


function checkWeatherVariables_old() {

    //7 days forecast
    if (adapter.config.Days7Forecast) {
        adapter.setObjectNotExists('NextDays', {
            type: 'channel',
            role: 'weather',
            common: { name: '7 days forecast' },
            native: { location: adapter.config.location }
        });
        // all states for all 7 days...
        for (var d = 0; d < 7; d++) {
            var id = "NextDays." + d + "d.";
            adapter.setObjectNotExists('NextDays.' + d + 'd', {
                type: 'channel',
                role: 'forecast',
                common: { name: 'in ' + d + ' days' },
                native: { location: adapter.config.location }
            });
            adapter.setObjectNotExists(id + 'Temperature_Min', {
                type: 'state',
                common: { name: 'Temperature_Min', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
                native: { id: id + 'Temperature_Min' }
            });
            adapter.setObjectNotExists(id + 'Temperature_Max', {
                type: 'state',
                common: { name: 'Temperature_Max', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
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
        for (var d = 0; d < 5; d++) {
            var id = "NextDaysDetailed." + d + "d.";
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
                common: { name: 'Temperature_Min', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
                native: { id: id + 'Temperature_Min' }
            });
            adapter.setObjectNotExists(id + 'Temperature_Max', {
                type: 'state',
                common: { name: 'Temperature_Max', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
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

            for (var h = 0; h < 8; h++) {
                var id1 = "NextDaysDetailed." + d + "d." + h + 'h.';
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
                    common: { name: 'Temperature', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
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
                    common: { name: 'Windchill', type: 'number', role: 'windchill', unit: '°C', read: true, write: false },
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
        for (var d = 0; d < 2; d++) {
            var id = "hourly." + d + "d.";
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
                common: { name: 'Temperature_Min', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
                native: { id: id + 'Temperature_Min' }
            });
            adapter.setObjectNotExists(id + 'Temperature_Max', {
                type: 'state',
                common: { name: 'Temperature_Max', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
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

            for (var h = 0; h < 24; h++) {
                var id1 = "hourly." + d + "d." + h + 'h.';
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
                    common: { name: 'Temperature', type: 'number', role: 'temperature', unit: '°C', read: true, write: false },
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
                    common: { name: 'Windchill', type: 'number', role: 'windchill', unit: '°C', read: true, write: false },
                    native: { id: id1 + 'Windchill' }
                });
            }
        }
    }
}