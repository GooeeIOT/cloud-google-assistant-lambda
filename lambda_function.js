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

// Create an app instance
const app = smarthome({
    debug:true
})

//Globals
var API_URL = process.env.API_URL
var getRequest = postRequest = rp
var queried_devices = {}
var successful_devices = []
var failed_devices = []
var payload_commands = []

// Allow Devices and Spaces(Switches) to be powered on/off, dim/brighten, and set to x%
var SPACE_TEMPLATE = {
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
var DEVICE_TEMPLATE = {
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
function handle_auth(token) {
    getRequest = rp.defaults({
        baseUrl: 'https://' + API_URL,
        method: 'GET',
        json: true,
        auth: {
            bearer: token
        }
    })
    postRequest = rp.defaults({
        baseUrl: 'https://' + API_URL + '/actions',
        method: 'POST',
        json: true,
        auth: {
            bearer: token
        }
    })
}

/** Concatenate device objects into single object */
function combine_devices(device){
    queried_devices.concat(device)
}

/** Combine device objects based on success or fail */
function combine_command_data(success, fail){
    if(success){
        successful_devices.push(success)
    } else {
        failed_devices.push(fail)
    }
}

/**
 * Create command payload for each action received.
 * @param {string} action: "on", "brightness" corresponding to device traits values.
 * @param {Boolean||number} value: on -> Boolean, brightness -> number.
 * @param {Array} successful_devices: list of devices with successful action.
 * @param {Array} failed_devices: list of devices with failed action.
 */
function combine_commands(action, value, successful_devices, failed_devices){
    payload_commands = []
    switch(action){
        case 'on':
            if(successful_devices){
                var cmd = {
                    'ids': successful_devices,
                    'status': 'SUCCESS',
                    'states': {
                        'on': value,
                        'online': true
                    }
                }
                payload_commands.push(cmd)
            }
            if(failed_devices){
                var cmd = {
                    'ids': failed_devices,
                    'status': 'ERROR'
                }
                payload_commands.push(cmd)
            }
            break
        case 'brightness':
            if(successful_devices){
                var cmd = {
                    'ids': [new Set(successful_devices)],
                    'status': 'SUCCESS',
                    'states': {
                        'brightness': value
                    }
                }
                payload_commands.push(cmd)
            }
            if(failed_devices){
                var cmd = {
                    'ids': [new Set(failed_devices)],
                    'status': 'ERROR',
                }
                payload_commands.push(cmd)
            }
            break
    }
    successful_devices = []
    failed_devices = []
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
async function handle_execute(body) {
    var commands = body.inputs[0].payload.commands
    for(var command of commands){
        var devices = command.devices
        var action = Object.keys(command.execution[0].params)[0]
        var value = command.execution[0].params[action]
        var req = {
            'type': '__REPLACE__',
            'device': '__REPLACE__',
            'value': '__REPLACE__'
        }
        switch(action){
            case 'on':
                req.type = value ? 'on':'off'
                req.value = {'transition_time': 1}
                break
            case 'brightness':
                req.type = 'dim'
                req.value = {
                    'transition_time': 1,
                    'level': value
                }
                break
        }
        for (var device of devices){
            req.device = device.id
            if (device.customData.type === 'device'){
                await postRequest('/', {body:req})
                .then(async function(response){
                    await combine_command_data(req.device, null)
                }).catch(async function(error){
                    console.log(error)
                    await combine_command_data(null, req.device)
                })
            } else {
                await getRequest('/spaces/' + device.id)
                .then(async function(resp){
                    await combine_command_data(req.device, null)
                }).catch(async function(error){
                    await console.log(error)
                    await combine_command_data(null, req.device)
                })
            }    
        } //End of For Loop
        await combine_commands(action, value, successful_devices, failed_devices)
        var resp = {
            'requestId': body.requestId,
            'payload': {
                'commands': payload_commands
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
async function handle_query(body) {
    var devices = body.inputs[0].payload.devices
    var query_devices = []
    for(var i=0; i < devices.length; i++){
        query_devices.push(devices[i])
    }
    
    for(var query of query_devices){
        if (query.customData.type === 'device'){
            await getRequest('/devices/'+query.id)
            .then( async function(resp){
                var device = {}
                for (var meta of resp.meta){
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
        } else {
            await getRequest('/spaces/'+query.id+'/device_states')
            .then( async function(resp){
                var device = {}
                var onoff = 0
                for(x of Object.values(resp.states)) {
                    onoff = onoff + x.onoff
                }
                device[query.id] = {
                    on: Boolean(onoff),
                    online: true
                }
                await combine_devices(_device)
            })
        }
    } //End For Loop
    var resp = {
        'requestId': body.requestId,
        'payload': {
            'devices': queried_devices
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
async function handle_sync(body){
    return await getRequest('/devices/?_include=name,id,meta&type__in=wim,bulb')
    .then( async function (resp){
        var synced_devices = []
        for (var i=0; i < resp.length; i++) {
            var device_tmpl = await JSON.parse(JSON.stringify(DEVICE_TEMPLATE))
            device_tmpl.id = resp[i].id
            device_tmpl.name.name = resp[i].name
            online = await resp[i].meta.find(x => {return x.name === 'is_online'})
            device_tmpl.customData.online = online.value
            synced_devices.push(device_tmpl)
        }
        return synced_devices
    })
    .then( async function (synced_devices){
        return await getRequest('/spaces/?_include=id,name')
        .then( async function (resp){
            var synced_spaces = []
            for (var i=0; i < resp.length; i++) {
                var space_tmpl = await JSON.parse(JSON.stringify(SPACE_TEMPLATE))
                space_tmpl.id = resp[i].id
                space_tmpl.name.name = resp[i].name
                synced_spaces.push(space_tmpl)
            }
            var devices = synced_devices.concat(synced_spaces)
            var resp = {
                'requestId': body.requestId,
                'payload': {
                    'devices': devices
                }
            }
            return resp
        })
    })
}

// Fulfillment
/**
 * Lambda Function Handler that is invoked by calls to Smart Home App
 * @param {object} event : Contains invocation data.
 * @param {object} context : Contains AWS lambda runtime information.
 * @param {object} callback : Contains AWS lambda runtime information.
 */
exports.fulfillment = async function(event, context) {
    body = event['body-json']
    headers = event.params.header
    token = headers.Authorization.split(' ')[1]

    await handle_auth(token)
    try{
        var intent = body.inputs[0].intent
        var response = {}
        switch(intent){
            case 'action.devices.SYNC':
                console.log('SYNCING...')
                response = await handle_sync(body)
                break
            case 'action.devices.QUERY':
                console.log('QUERYING...')
                response = await handle_query(body)
                break
            case 'action.devices.EXECUTE':
                console.log('EXECUTING...')
                response = await handle_execute(body)
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
        return error
    }
}