# Older changes
## 4.4.0 (2026-01-18)
* (René, chatGPT, copilot) admin-UI overworked with react
* (René, copilot) preview of symbols for weather, wind and moon in admin
* (René) sunshine duration for day 1 based on daylight hours and clouds calculation added
* (René) see issue #462: sun and moon times as Unix timestamp formated as complete date+time added
* (René) new datapoints "Wind_Speed_Beauforts" and "Wind_symbol_URL" added
* (René) calculation of wind speed Beauforts based on wind speed in km/h added
* (René) WindIconURL calculation added based on wind direction and wind speed
* (René, chatGPT) wind icons added (svg and png)
* (René) translations updated
* (René) URL for weather symbols, wind and moon updated to new icon folder structure
* (René) see issue #473: copy datapoints of current hour into "current"-folder; update every hour with internal timer added; must be enabled in admin

## 4.3.0 (2026-01-03)
* (H5N1v2) 41 icons for DasWetter@4.x (galeria7)

## 4.2.0 (2026-01-01)
* (René) translations of symbol descriptions
* (René) some new datapoints (time and date) to identify forecast periods
* (René) see issue #462: sun and moon times now without date part (time-only)
* (TA2k) Add bundesland / state as search option and move some debug to info logs

## 4.1.0 (2025-12-28)
* (René) see issue #457: forecast download for daily and hourly can now be disabled to reduce number of DP's
* (René) see issue #456: combination of postcode and free text search for location API added, if location not found by postcode a free text search is executed
* (René) see issue #458: unit for pressure changed to millibar / hPa
* (René) see issue #459: bug fix to be able to edit custom path for moon symbols
* (René) if API provides night specific symbol description, it will be shown now
* (René) datapoint descriptions changed

## 4.0.0 (2025-12-27)
**Breaking Changes**
instances of older versions **must be deleted** and a new instance must be created
* (René, copilot) rework with typescript
* (René, copilot) support of new api from DasWetter.com
* (René) adapter type changed from "scheduled" to "deamon"

## 3.2.8 (2025-11-02)
* (René) see issue #444: avoid crash if no data received, show response status in debug log

## 3.2.7 (2025-11-02)
* (René) enable / disable each path separately in admin

## 3.2.6 (2025-10-22)
* (René) #417: bug fix: allow 14 minutes between two data requests to avoid unnecessary warnings

## 3.2.5 (2025-10-21)
* (René) #442: bug fix for state of wind direction
* (René) #417: info, if data query is too often (max. 4 times per hour)
* (René) update dependencies + changes based on adapter checker

## 3.2.4 (2025-10-04)
* (René) new testing
* (René) update dependencies + changes based on adapter checker

## 3.2.3 (2025-02-26)
* (René) changes requested by adapter checker
* (René) dependencies updated

## 3.2.2 (2024-12-15)
* (René) translations
* (René) see issue #408: hint regarding user registration limitation added

## 3.2.1 (2024-12-06)
* (René) see issue #411: jsonConfig fixed

## 3.2.0 (2024-12-04)
* (René) see issue #406: test with nodejs@22
* (René) update dependencies
* (René) migration to admin 5 UI (jsonConfig)

## 3.1.16 (2024-08-18)
* (René) update dependencies
* (René) bug fixes based on adapter checker recommendation

## 3.1.15 (2024-05-28)
* (René) see issue #354: change of dependencies

## 3.1.13 (2024-01-12)
* (René) update dependencies

## 3.1.12 (2023-12-24)
* (René) see issue #217: additional log added to understand root cause, please copy&past log output into github issue

## 3.1.11 (2023-11-18)
* (René) update dependencies

## 3.1.10 (2023-07-30)
* (René) update dependencies

## 3.1.8 (2023-04-07)
* (René) update dependencies

## 3.1.7 (2023-01-31)
* (René) update dependencies

## 3.1.6 (2022-12-23)
* (René) see issue #153: package Axios downgraded

## 3.1.5 (2022-12-04)
* (René) update dependencies

## 3.1.4 (2022-08-19)
* (René) update dependencies
* (dipts) Added missing / corrected inappropriate icons for galeria 1

## 3.1.3 (2022-05-05)
* (René) see issue #139: bug fix moon icon

## 3.1.2 (2022-03-20)
* (René) see issue #130: bug fix json data

## 3.1.1 (2022-03-19)
* (René) bug fix UV index

## 3.1.0 (2022-03-19)
* (René) replace bent by axios
* (René) dependencies updated
* (René) see issue #128: add UV index

## 3.0.9 (2021-11-09)
* (René) dependencies updated
* (René) see issue #114: "connectionType" and "dataSource" fixed

## 3.0.8 (2021-09-22)
* (DutchmanNL) Warn messages for channels solved
* (DutchmanNL) Optimize log message at adapter termination
* (DutchmanNL) Ensure adapter will always handle data at start

## 3.0.7 (2021-05-03)
* (René) issue #91: remove warnings with js-controller 3.3.

## 3.0.5 (2021-03-21)
* (René) dependencies updated

## 3.0.4 (2020-10-16)
* (René) see issue #76: parse rain values as float instead integer

## 3.0.3 (2020-09-19)
* (René) see issue #66: parse numbers added

## 3.0.1 (2020-05-01)
* (René) breaking change: old data structure is not supported anymore
* (René) "request" replaced by "bent"
* (René) "xml2js" replaced by "xml2json"
* (René) manual from DasWetter updated in folder \docs
* (René) see issue #39: create copy of data in hourly data path for next 1, 2, 3 or 6 hours (as an option)
* (René) copy for current can be disabled now

## 2.8.2 (2020-03-20)
* (René) some more logs to find parser errors

## 2.8.1 (2019-09-08)
* (René) bug fix: some datapoints were created as number instead of string

## 2.8.0 (2019-03-19)
* (René) moon and wind icon set added in admin !!path to wind icons changed!!
* (René) path to customized icon set added 
* (René) exit code changed

## 2.7.3 (2019-02-24)
* (René) bug fix: some values are number instead of string

## 2.7.2 (2019-02-14)
* (bluefox) Serialization of the objects deletion

## 2.6.1 (2019-02-10)
* (René) update dependencies

## 2.6.0 (2019-01-20)
* (René) support of compact mode
* (René) new icons for galeria5 (color or white; svg or png) selectable in admin
* (René) auto-repair for path4

## 2.5.0 (2018-11-30)
* (René) since app has problems with svg we can use png instead. svg's are converted to png. In admin a new option is available to use original svg's or converted png's 
* (René) max. 500 datapoints are deleted per call to reduce work load, so it might take a few calls until all old data points are removed

## 2.4.0 (2018-11-26)
* (René) sunshine duration added
* (René) current in NextHours_Day1 and NextHours2_Day1 added

## 2.3.1 (2018-11-04)
* (René) clean up code

## 2.3.0 (2018-08-23)
* (René) support of 4. path (json)

## 2.2.0 (2018-08-20)
* (René) delete unused data structure

## 2.1.3 (2018-08-17)
* (René) typo fixed
* (René) missing Icon-URL's added

## 2.1.2 (2018-08-14)
* (bluefox) Configuration dialog was fixed

## 2.1.1 (2018-08-04)
* (René) parse timeout added
* (René) missing roles and states added
* (René) using of units from data structure

## 2.1.0 (2018-07-30)
* (bluefox) Added URLs to icons
* (bluefox) Added the roles and the names to states
* (bluefox) Icons moved to admin directory

## 2.0.0
* (René) new datastructure !not compatible to version 1.x!
now parsing all data from xml and store them in datapoints
for compatibility: in configuration old data structure can be enabled 
needs also 2.x of vis-weather-widget
