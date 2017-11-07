/*
 * DasWetter.com adapter für iobroker
 *
 * Created: 21.03.2017 21:31:28
 *  Author: Rene

Copyright(C)[2016, 2017][René Glaß]

Dieses Programm ist freie Software.Sie können es unter den Bedingungen der GNU General Public License, wie von der Free Software 
Foundation veröffentlicht, weitergeben und/ oder modifizieren, entweder gemäß Version 3 der Lizenz oder (nach Ihrer Option) jeder 
späteren Version.

Die Veröffentlichung dieses Programms erfolgt in der Hoffnung, daß es Ihnen von Nutzen sein wird, aber OHNE IRGENDEINE GARANTIE,
    sogar ohne die implizite Garantie der MARKTREIFE oder der VERWENDBARKEIT FÜR EINEN BESTIMMTEN ZWECK.Details finden Sie in der
GNU General Public License.

Sie sollten ein Exemplar der GNU General Public License zusammen mit diesem Programm erhalten haben.Falls nicht,
    siehe < http://www.gnu.org/licenses/>.

*/

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils


// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('daswetter');
var request = require('request');
var parseString = require('xml2js').parseString;


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

    checkWeatherVariables();

    getForecastData7Days(function () {
        setTimeout(function () {
            adapter.stop();
        }, 6000);
    });

    // force terminate after 1min
    // don't know why it does not terminate by itself...
    setTimeout(function () {
        adapter.log.warn('force terminate');
        process.exit(0);
    }, 60000);

}



function getForecastData7Days(cb) {

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
                        }
                        adapter.log.debug('7 days forecast done');
                        getForecastData5Days(cb);
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
        getForecastData5Days(cb);
    }
    if (cb) cb();
}

function getForecastData5Days(cb) {

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

                            for (var h = 0; h < 8; h++) {
                                var id1 = "NextDaysDetailed." + d + "d." + h + 'h.';

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
                            }
                        }
                        adapter.log.debug('5 days forecast done');
                        getForecastDataHourly(cb);
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
        getForecastDataHourly(cb);
    }
    if (cb) cb();
}

function getForecastDataHourly(cb) {

    if (adapter.config.HourlyForecast) {
        var url = adapter.config.HourlyForecast;
        adapter.log.debug('calling forecast: ' + url);

        request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {

                try {
                    //adapter.log.debug('got body: ' + body);

                    var body1=body.replace(/wind-gusts/g, "windgusts");
                    //adapter.log.debug('got body: ' + body);

                    parseString(body1, function (err, result) {
                        //adapter.log.debug('parsedhourly: ' + JSON.stringify(result));

                        


                        for (var d = 0; d < 2; d++) {

                            var id = "hourly." + d + "d.";

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

                            for (var h = 0; h < 24; h++) {
                                var id1 = "hourly." + d + "d." + h + 'h.';

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
                            }
                        }
                        adapter.log.debug('hourly forecast done');
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
    if (cb) cb();
}


function checkWeatherVariables() {

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

            for (var h=0;h<8;h++) {
                var id1 = "NextDaysDetailed." + d + "d."+h+'h.';
                adapter.setObjectNotExists('NextDaysDetailed.' + d + 'd.'+h+'h', {
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
