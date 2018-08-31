/**
 * Copyright 2018 Gooee, LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at 
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Import the appropriate service
const {smarthome} = require('actions-on-google')
const rp = require('request-promise')
var raven = require('raven')

//Globals
var API_URL = process.env.API_URL
var queriedDevices = []
var successfulDevices = []
var failedDevices = []
var payloadCommands = []

//Sentry Setup
let SENTRY_ENVIRONMENT = 'TMPL_SENTRY_ENV'
let SENTRY_RELEASE = 'TMPL_SENTRY_REL'
let SENTRY_KEY = 'TMPL_SENTRY_KEY'
let SENTRY_PARAMS = [SENTRY_ENVIRONMENT, SENTRY_RELEASE, SENTRY_KEY]
if (!SENTRY_PARAMS.some(x => {
    return x.startsWith('TMPL_')
})) {
    var SENTRY_CLI = raven.config(SENTRY_KEY, {
        release: SENTRY_RELEASE,
        environment: SENTRY_ENVIRONMENT,
        transport: raven.transports.HTTPTransport
    }).install()
}

// Allow Devices and Spaces(Switches) to be powered on/off, dim/brighten, and set to x%
const SPACE_TEMPLATE = {
	"id": "__REPLACE__",
	"type": "action.devices.types.SWITCH",
	"traits": [
		"action.devices.traits.OnOff",
		"action.devices.traits.Brightness"
	],
	"name": {
		"name": "__REPLACE__"
    },
    "willReportState": false,
	"customData": {
		"type": "space" 
	}
}
const DEVICE_TEMPLATE = {
	"id": "__REPLACE__",
	"type": "action.devices.types.LIGHT",
	"traits": [
		"action.devices.traits.OnOff",
        "action.devices.traits.Brightness"
	],
	"name": {
		"name": "__REPLACE__"
    },
    "willReportState": false,
	"deviceInfo": {
		"manufacturer": "Gooee",
	},
	"customData": {
        "type": "device",
        "online": "__REPLACE__"
	}
}


//Helper Functions

/**
 * Create default GET and POST requests to Gooee Cloud API
 * @param {string} token : Bearer token
 */
function get_request(endpoint, token) {
    let options = {
        uri: 'https://' + API_URL + endpoint,
        json: true,
        auth: { bearer: token }
    }
    return rp.get(options)
}
function post_request(endpoint, req, token) {
    let options = {
        uri: 'https://' + API_URL + endpoint,
        json: true,
        auth: { bearer: token },
        body: req
    }
    return rp.post(options)
}

/** Concatenate device objects into single object */
function combine_devices(device) {
    queriedDevices.push(device)
}

/** Combine device objects based on success or fail */
function combine_command_data(success, fail) {
    if(success){
        successfulDevices.push(success)
    } else {
        failedDevices.push(fail)
    }
}

/**
 * Create command payload for each action received.
 * @param {string} action: "on", "brightness" corresponding to device traits values.
 * @param {Boolean||number} value: on -> Boolean, brightness -> number.
 * @param {Array} successfulDevices: list of devices with successful action.
 * @param {Array} failedDevices: list of devices with failed action.
 */
function combine_commands(action, value, successfulDevices, failedDevices) {
    payloadCommands = []
    switch(action){
        case 'on':
            if (successfulDevices) {
                var cmd = {
                    'ids': successfulDevices,
                    'status': 'SUCCESS',
                    'states': {
                        'on': value,
                        'online': true
                    }
                }
                payloadCommands.push(cmd)
            }
            if (!Array.isArray(failedDevices) || failedDevices.length) {
                var cmd = {
                    'ids': failedDevices,
                    'status': 'ERROR'
                }
                payloadCommands.push(cmd)
            }
            break
        case 'brightness':
            if (successfulDevices) {
                var cmd = {
                    'ids': successfulDevices,
                    'status': 'SUCCESS',
                    'states': {
                        'brightness': value
                    }
                }
                payloadCommands.push(cmd)
            }
            if (failedDevices) {
                var cmd = {
                    'ids': failedDevices,
                    'status': 'ERROR',
                }
                payloadCommands.push(cmd)
            }
            break
    }
    successfulDevices = []
    failedDevices = []
}

//Handlers for Fulfillment

/** Execution handler parses action from commands and POSTs action(s) to Gooee API
 * @returns {object} resp:
 *{
 * "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
 * "payload": {
 *   "commands": [{
 *     "ids": ["123"],
 *     "status": "SUCCESS",
 *     "states": {
 *       "on": true,
 *       "online": true
 *     }
 *   },{
 *     "ids": ["456"],
 *     "status": "ERROR",
 *     "errorCode": "deviceTurnedOff"
 *   }]
 * }
 *}
 */
async function handle_execute(body, token) {
    let commands = body.inputs[0].payload.commands
    for (let command of commands) {
        let devices = command.devices
        let action = Object.keys(command.execution[0].params)[0]
        let value = command.execution[0].params[action]
        let req = {
            'type': '__REPLACE__',
            'value': '__REPLACE__'
        }
        switch(action) {
            case 'on':
                req.type = value ? 'on':'off'
                req.value = {'transition_time': 1}
                break
            case 'brightness':
                req.type = 'dim'
                req.value = {
                    'transition_time': 2,
                    'level': value
                }
                break
        }
        for (let device of devices) {
            if (device.customData.type === 'device') {
                req['device'] = device.id
                await post_request('/actions', req, token)
                .then(async function() {
                    await combine_command_data(req.device, null)
                }).catch(async function(error) {
                    await combine_command_data(null, req.device)
                })
                delete req['device']
            } else {
                req['space'] = device.id
                await post_request('/actions', req, token)
                .then(async function() {
                    await combine_command_data(req.space, null)
                }).catch(async function(error) {
                    await combine_command_data(null, req.space)
                })
                delete req['space']
            }    
        } //End of For Loop
        await combine_commands(action, value, successfulDevices, failedDevices)
        var resp = {
            'requestId': body.requestId,
            'payload': {
                'commands': payloadCommands
            }
        }
        return resp
    }
}

/**
 * Query handler parses body for devices and returns state of devices from call to
 * Gooee Cloud API, 
 * @param {object} body
 * @returns {object} resp:
 * {
 * "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
 * "payload": {
 *   "devices": {
 *     "123": {
 *       "on": true,
 *       "online": true
 *     },
 *     "456": {
 *       "on": true,
 *       "online": true,
 *       "brightness": 80,
 *       "color": {
 *         "name": "cerulean",
 *         "spectrumRGB": 31655
 *       }
 *     }
 *   }
 * }
 *}
 */
async function handle_query(body, token) {
    let devices = body.inputs[0].payload.devices
    let queryDevices = []
    for (var i=0; i < devices.length; i++) {
        queryDevices.push(devices[i])
    }
    
    for (let query of queryDevices) {
        if (query.customData.type === 'device') {
            await get_request('/devices/'+query.id, token)
            .then( async function(resp){
                let device = {}
                for (let meta of resp.meta) {
                    switch(meta.name) {
                        case 'onoff':
                            var on = meta.value
                            break
                        case 'is_online':
                            var online = meta.value
                            break
                        case 'dim':
                            var brightness = meta.value
                            break
                    }
                }
                device[resp.id] = {
                    on: on,
                    online: online,
                    brightness: brightness ? brightness: null
                }
                await combine_devices(device)
            })
            .catch( (error) => {
                SENTRY_CLI.captureException(error)
            })
        } else {
            await get_request('/spaces/'+query.id+'/device_states', token)
            .then( async function(resp) {
                let device = {}
                let onoff = 0
                for (x of Object.values(resp.states)) {
                    onoff = onoff + x.onoff
                }
                device[query.id] = {
                    on: Boolean(onoff),
                    online: true
                }
                await combine_devices(device)
            })
            .catch( (error) => {
                SENTRY_CLI.captureException(error)
            })
        }
    } //End For Loop
    var resp = {
        'requestId': body.requestId,
        'payload': {
            'devices': Object.assign({}, ...queriedDevices)
        }
    }
    return resp
}

/**
 * Sync handler retrives User Scoped devices and spaces from Gooee Cloud API
 * @param {object} body 
 * @returns {object} resp:
 * {
 *   "requestId": "1775275380024508951",
 *   "payload": {
 *       "devices": [
 *           {
 *               "id": "028a2487-e040-4604-9d87-3ad481fe516b",
 *               "type": "action.devices.types.LIGHT",
 *               "traits": [
 *                   "action.devices.traits.OnOff",
 *                   "action.devices.traits.Brightness"
 *               ],
 *               "name": {
 *                   "name": "Wimmer Device"
 *               },
 *               "willReportState": true,
 *               "deviceInfo": {
 *                   "manufacturer": "Gooee"
 *               },
 *               "customData": {
 *                   "type": "device",
 *                   "online": true
 *               }
 *           }
 *       ]
 *   }
 * }
 */
async function handle_sync(body, token) {
    return await get_request('/devices/?_include=name,id,meta&type__in=wim,bulb', token)
    .then( async function (resp) {
        let syncedDevices = []
        for (let i=0; i < resp.length; i++) {
            let device_tmpl = await JSON.parse(JSON.stringify(DEVICE_TEMPLATE))
            device_tmpl.id = resp[i].id
            device_tmpl.name.name = resp[i].name
            online = await resp[i].meta.find(x => {return x.name === 'is_online'})
            device_tmpl.customData.online = online.value
            syncedDevices.push(device_tmpl)
        }
        return syncedDevices
    })
    .then( async function (syncedDevices) {
        return await get_request('/spaces/?_include=id,name', token)
        .then( async function (resp) {
            var syncedSpaces = []
            for (var i=0; i < resp.length; i++) {
                var space_tmpl = await JSON.parse(JSON.stringify(SPACE_TEMPLATE))
                space_tmpl.id = resp[i].id
                space_tmpl.name.name = resp[i].name
                syncedSpaces.push(space_tmpl)
            }
            let devices = syncedDevices.concat(syncedSpaces)
            var resp = {
                'requestId': body.requestId,
                'payload': {
                    'devices': devices
                }
            }
            return resp
        })
    })
    .catch( (error) => {
        SENTRY_CLI.captureException(error)
    })
}

// Fulfillment
/**
 * Lambda Function Handler that is invoked by calls to Smart Home App
 * @param {object} event : Contains invocation data.
 * @param {object} context : Contains AWS lambda runtime information.
 */
async function fulfillment(event, context) {
    try {
        let body = event['body-json']
        let headers = event.params.header
        let token = headers.Authorization.split(' ')[1]
        let intent = body.inputs[0].intent
        var response = {}
        switch(intent){
            case 'action.devices.SYNC':
                console.log('SYNCING...')
                response = await handle_sync(body, token)
                break
            case 'action.devices.QUERY':
                console.log('QUERYING...')
                response = await handle_query(body, token)
                break
            case 'action.devices.EXECUTE':
                console.log('EXECUTING...')
                response = await handle_execute(body, token)
                break
            case 'action.devices.DISCONNECT':
                response = {}
                break
            default:
                throw(event)
        }
        await console.log('Response: '+JSON.stringify(response))
        return response
    }
    catch(error){
        SENTRY_CLI.captureException(error)
        return error
    }
}

module.exports = {
    fulfillment,
    get_request,
    post_request,
    handle_execute,
    handle_query,
    handle_sync
}
