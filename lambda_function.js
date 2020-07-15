/**
 * Copyright 2020 Gooee, LLC
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

// Dependencies
const aws = require("aws-sdk");
const lambda = new aws.Lambda();
const parse = require("parse-link-header");
const rp = require("request-promise");
const { smarthome } = require("actions-on-google");
const app = smarthome({
        jwt: require("./smart-home-key.json"),
    });
const winston = require("winston"),
    WinstonCloudWatch = require("winston-cloudwatch");

// Globals
const API_URL = process.env.API_URL;
const SPACE_TEMPLATE = require("./space_template.json");
const DEVICE_TEMPLATE = require("./device_template.json");
const logger = new winston.createLogger();
let agentUserId;
let successfulDevices = [];
let failedDevices = [];
let payloadCommands = [];

/*
 * Configure Winston Cloudwatch logger
 */
function configureCloudwatchLogger(context) {
    logger.add(
        new WinstonCloudWatch({
            logGroupName: context.logGroupName,
            logStreamName: context.logStreamName,
            level: process.env.LOG_LEVEL,
        }),
    );
}

/**
 * Updates agentUserId with customer ID from Gooee Cloud API /me endpoint
 * @param {string} token : Bearer token
 */
async function getUserAgent(token) {
    agentUserId = await helpers
        .getRequest("/me", token)
        .then(function(resp) {
            return resp.customer;
        })
        .catch(function(error) {
            logger.error(error);
        });
}

/**
 * Get device and space states (i.e. on/off, brightness, etc.) for ReportState payload
 * @param {string} token : Bearer token
 */
async function getStates(token) {
    return await helpers
        .getRequest("/devices?type__in=wim,bulb&limit=100", token)
        .then(async function(resp) {
            let deviceStates = {};
            let on, brightness;
            for (let i = 0; i < resp.length; i++) {
                let deviceId = resp[i].id;
                for (let meta of resp[i].meta) {
                    switch (meta.name) {
                        case "onoff":
                            on = meta.value;
                            break;
                        case "dim":
                            brightness = meta.value;
                            break;
                    }
                }
                deviceStates[deviceId] = {
                    on: on,
                    brightness: brightness,
                };
            }
            return deviceStates;
        })
        .then(async function(deviceStates) {
            let spaceStates = await helpers
                .getRequest("/spaces/?_include=id,name&limit=100", token)
                .then(async function(resp) {
                    let states = {};
                    for (let i = 0; i < resp.length; i++) {
                        let onoff = await helpers
                            .getRequest("/spaces/" + resp[i].id + "/device_states", token)
                            .then(async function(resp) {
                                // Space is on if at least one device is on
                               let  one_on = false;
                                for (let device in resp["states"]) {
                                    if (device.onoff === true) {
                                        one_on = true;
                                    }
                                }
                                return one_on;
                            });
                        states[resp[i].id] = {
                            on: onoff,
                        };
                    }
                    return states;
                })
                .catch(res => {
                    logger.warn("Failed getting states for spaces: " + res);
                });
            return Object.assign(deviceStates, spaceStates);
        })
        .catch(res => {
            logger.warn("Failed getting states for devices: " + res);
        });
}



/**
 * Create default GET requests to Gooee Cloud API
 * @param {string} endpoint : Cloud API path endpoint
 * @param {string} token : Bearer token
 * @param {Boolean} is_next : true if link header has a next value
 */
async function getRequest(endpoint, token, is_next = false) {
    let options = {
        method: "GET",
        uri: is_next ? endpoint : "https://" + API_URL + endpoint,
        json: true,
        auth: { bearer: token },
        resolveWithFullResponse: true,
    };

    return await rp(options)
        .then(async function(r) {
            // Provide the response body of this page and the next.
            const links = r.headers.link ? parse(r.headers.link) : null;
            if (links && links.next) {
                return [].concat(r.body, await getRequest(links.next.url, token, true));
                // Provide the response body.
            } else {
                return r.body;
            }
        })
        .catch(error => {
            logger.error(error);
        });
}

/**
 * Create default POST requests to Gooee Cloud API
 * @param {string} endpoint : Cloud API path endpoint
 * @param {object} req : request body
 * @param {string} token : Bearer token
 */
function postRequest(endpoint, req, token) {
    let options = {
        uri: "https://" + API_URL + endpoint,
        json: true,
        auth: { bearer: token },
        body: req,
    };
    return rp.post(options);
}

/** Concatenate device objects into single object
 * @param {Array} devices : array of device objects
 * @param {object} device : device object
 */
function combineDevices(devices, device) {
    devices.push(device);
}

/** Combine device objects based on if the action was successful or not.
 * @param {Array} success : array of devices that updated successfully
 * @param {Array} fail : array of devices that failed to update
 */
function combineCommandData(success, fail) {
    if (success) {
        successfulDevices.push(success);
    } else {
        failedDevices.push(fail);
    }
}

/**
 * Create command payload for each action received.
 * @param {string} action: "on", "brightness" corresponding to device traits values.
 * @param {Boolean||number} value: on -> Boolean, brightness -> number.
 * @param {Array} successfulDevices: list of devices with successful action.
 * @param {Array} failedDevices: list of devices with failed action.
 */
function combineCommands(action, value, successfulDevices, failedDevices) {
    payloadCommands = [];
    switch (action) {
        case "on":
            if (successfulDevices) {
                const cmd = {
                    ids: successfulDevices,
                    status: "SUCCESS",
                    states: {
                        on: value,
                        online: true,
                    },
                };
                payloadCommands.push(cmd);
            }
            if (!Array.isArray(failedDevices) || failedDevices.length) {
                const cmd = {
                    ids: failedDevices,
                    status: "ERROR",
                };
                payloadCommands.push(cmd);
            }
            break;
        case "brightness":
            if (successfulDevices) {
                const cmd = {
                    ids: successfulDevices,
                    status: "SUCCESS",
                    states: {
                        brightness: value,
                    },
                };
                payloadCommands.push(cmd);
            }
            if (failedDevices) {
                const cmd = {
                    ids: failedDevices,
                    status: "ERROR",
                };
                payloadCommands.push(cmd);
            }
            break;
    }
    successfulDevices = [];
    failedDevices = [];
}

/**
 * Helper function that invokes
 * @param {object} _body : object containing requestId
 * @param {object} ctx: context of lambda function
 * @param {string} _token : Bearer token
 */
async function _reportState(_body, ctx, _token) {
    let params = {
        FunctionName: ctx.functionName,
        InvocationType: "Event",
        LogType: "Tail",
        Payload: JSON.stringify({
            intent: "actions.devices.REPORT_STATE",
            requestId: _body.requestId,
            agentUserId: agentUserId,
            token: _token,
        }),
    };
    lambda.invoke(params, function(err, data) {
        if (err) logger.error(err, err.stack);
        // an error occurred
        else logger.debug(JSON.stringify(data)); // successful response
    });
}


/*** INTENT HANDLERS***/

/**
 * Handles ReportState by directly calling reportState via the smarthome app.
 * @param {string} agentUserId : user ID that matches the Google Home User ID that was initially sent in the Sync response.
 *                               This is the Gooee Customer ID.
 * @param {string} requestId : requestID that came from the original request
 * @param {string} token : Bearer token for oauth
 * {
 * "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
 * "agentUserId": "1234",
 * "payload": {
 *   "devices": {
 *     "states": {
 *       "1458765": {
 *         "on": true
 *       },
 *       "4578964": {
 *         "on": true,
 *         "isLocked": true
 *       }
 *     }
 *   }
 * }
 *}
 */
async function handleReportState(agentUserId, requestId, token) {
    let request = {
        requestId: requestId,
        agentUserId: agentUserId,
        payload: {
            devices: {
                states: await getStates(token),
            },
        },
    };
    logger.debug(JSON.stringify(request));
    // Call reportState via smarthome app
    app.reportState(request)
        .then(() => {
            logger.debug("Report State Successful.");
        })
        .catch(error => {
            logger.error(error.stack);
        });
    return request;
}

/** Execution handler parses action from commands and POSTs action(s) to Gooee API
 * @param body : execution response body
 * {
 *   "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
 *   "inputs": [{
 *     "intent": "action.devices.EXECUTE",
 *     "payload": {
 *       "commands": [{
 *         "devices": [{
 *           "id": "123",
 *           "customData": {
 *             "fooValue": 74,
 *             "barValue": true,
 *             "bazValue": "sheepdip"
 *           }
 *         }],
 *         "execution": [{
 *           "command": "action.devices.commands.OnOff",
 *           "params": {
 *             "on": true
 *           }
 *         }]
 *       }]
 *     }
 *   }]
 * }
 * @returns {object} resp :
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
async function handleExecute(body, token) {
    let commands = body.inputs[0].payload.commands;
    for (let command of commands) {
        // For each command get devices and action, and perform associated
        // Gooee action on the devices
        let devices = command.devices;
        let action = Object.keys(command.execution[0].params)[0];
        let value = command.execution[0].params[action];
        let payload = {
            name: "Google Action Request",
            type: "__REPLACE__",
            target_type: "__REPLACE__",
            target_id: "__REPLACE__",
            value: "__REPLACE__",
        };

        switch (action) {
            case "on":
                payload.type = value ? "on" : "off";
                payload.value = { transition_time: 1 };
                break;
            case "brightness":
                payload.type = "dim";
                payload.value = {
                    transition_time: 1,
                    level: value,
                };
                break;
        }

        for (let device of devices) {
            if (device.customData.type === "device") {
                payload["target_type"] = "device";
            } else {
                payload["target_type"] = "space";
            }
            payload["target_id"] = device.id;
            payload["origin"] = "google";

            await helpers
                .postRequest("/actions", payload, token)
                .then(async function() {
                    await combineCommandData(payload.target_id, null);
                })
                .catch(async function(error) {
                    await combineCommandData(null, payload.target_id);
                });
        }
        // Record successful and failed actions
        await combineCommands(action, value, successfulDevices, failedDevices);
        return {
            requestId: body.requestId,
            payload: {
                agentUserId: agentUserId,
                commands: payloadCommands,
            },
        };
    }
}

/**
 * Query handler parses body for devices and returns state of devices from call to
 * Gooee Cloud API,
 * @param {object} body: payload of request containing spaces/devices to query
 * {
    "requestId": "ff36a3cc-ec34-11e6-b1a0-64510650abcf",
    "inputs": [{
      "intent": "action.devices.QUERY",
      "payload": {
        "devices": [{
          "id": "123",
          "customData": {
            "fooValue": 74,
          }
        }]
      }
    }]
}
 * @param {string} token: Bearer token for auth in cloud api
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
 *       "brightness": 80
 *     }
 *   }
 * }
 *}
 */
async function handleQuery(body, token) {
    let devices = body.inputs[0].payload.devices;
    let queryDevices = []; // array of device ids to query
    for (let i = 0; i < devices.length; i++) {
        queryDevices.push(devices[i]);
    }

    let queriedDevices = [];
    for (let query of queryDevices) {
        if (query.customData.type === "device") {
            await helpers
                .getRequest("/devices/" + query.id, token)
                .then(async function(resp) {
                    let device = {};
                    for (let meta of resp.meta) {
                        switch (meta.name) {
                            case "onoff":
                                var on = meta.value;
                                break;
                            case "is_online":
                                var online = meta.value;
                                break;
                            case "dim":
                                var brightness = meta.value;
                                break;
                        }
                    }
                    // Device object holds relevant data needed for query response
                    device[resp.id] = {
                        on: on,
                        online: online,
                        brightness: brightness ? brightness : null,
                    };
                    await combineDevices(queriedDevices, device);
                })
                .catch(error => {
                    logger.error(error);
                    throw new Error(error);
                });
        } else {
            await helpers
                .getRequest("/spaces/" + query.id + "/device_states", token)
                .then(async function(resp) {
                    let device = {};
                    let onoff = 0;
                    for (x of Object.values(resp.states)) {
                        onoff = onoff + x.onoff; // Remains 0 if all lights are off
                    }
                    device[query.id] = {
                        on: Boolean(onoff),
                        online: true,
                    };
                    await combineDevices(queriedDevices, device);
                })
                .catch(error => {
                    throw new Error(error);
                });
        }
    }
    return {
        requestId: body.requestId,
        payload: {
            devices: Object.assign({}, ...queriedDevices),
        },
    };
}

/**
 * Sync handler retrieves User-scoped Devices and Spaces from Gooee Cloud API.
 * @param {object} body : payload containing requestId and sync intent
 * @returns {object}  resp :
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
 *                   "name": "Wim Device"
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
async function handleSync(body, token) {
    return await helpers
        .getRequest("/devices?type__in=wim,bulb&limit=100", token)
        .then(async function(resp) {
            let syncedDevices = [];
            for (let i = 0; i < resp.length; i++) {
                // For each device in response create device object from DEVICE_TEMPLATE
                let device_tmpl = await JSON.parse(JSON.stringify(DEVICE_TEMPLATE));
                device_tmpl.id = resp[i].id;
                device_tmpl.name.name = resp[i].name;
                const online = await resp[i].meta.find(x => {
                    return x.name === "is_online";
                });
                if (online) {
                    device_tmpl.customData.online = online.value;
                    syncedDevices.push(device_tmpl); // syncedDevices stores the device objects
                }
            }
            return syncedDevices;
        })
        .then(async function(syncedDevices) {
            return await helpers
                .getRequest("/spaces?_include=id,name&limit=100", token)
                .then(async function(resp) {
                    let syncedSpaces = [];
                    for (let i = 0; i < resp.length; i++) {
                        // For each space in response create space object from SPACE_TEMPLATE
                        let space_tmpl = await JSON.parse(JSON.stringify(SPACE_TEMPLATE));
                        space_tmpl.id = resp[i].id;
                        space_tmpl.name.name = resp[i].name;
                        syncedSpaces.push(space_tmpl); // syncedSpaces stores the space objects
                    }
                    // Combine the space and device objects to be sent as one payload
                    let devices = syncedDevices.concat(syncedSpaces);
                    return {
                        requestId: body.requestId,
                        payload: {
                            agentUserId: agentUserId,
                            devices: devices,
                        },
                    };
                });
        });
}

/*** Fulfillment (Lambda Handler) ***/

/**
 * Lambda Function Handler that is invoked by calls to Smart Home App
 * @param {object} event : Contains invocation data.
 * @param {object} context : Contains AWS lambda runtime information.
 *
 * Google Assistant sends Smart Home intents (SYNC, QUERY, EXECUTE, DISCONNECT)
 * which are simple messaging objects that describe what smart home Action to
 * perform such as turning on a light. All of the smart home intents are contained
 * in the `action.devices` namespace in the event body.
 * The fulfillment function processes the event and handles each intent. After
 * each intent (excluding actions.devices.REPORT_STATE) is handled, _reportState
 * is called.
 *
 * @returns {object} res:
 * {
      isBase64Encoded: false,
      statusCode: 200,
      body: JSON.stringify(response)
    };
    response of body depends on intent.
 */
async function fulfillment(event, context) {
    // Configure Winston logger for CloudWatch logging
    configureCloudwatchLogger(context);
    try {
        let body;
        let token;
        let intent;
        if ("body" in event) {
            // Process JSON for events coming from API Gateway
            body = JSON.parse(event.body);
            token = event.headers.Authorization.split(" ")[1]; // Bearer token for oauth
            intent = body["inputs"][0]["intent"];
            await getUserAgent(token);
            if (agentUserId == null) {
                logger.error("Error getting User Agent");
            }
        } else {
            // Event triggered by Lambda (specifically for ReportState)
            token = event.token;
            agentUserId = event.agentUserId;
            intent = event.intent;
        }

        let response = {};
        switch (intent) {
            case "action.devices.SYNC":
                logger.debug("SYNCING...");
                response = await handleSync(body, token);
                await _reportState(body, context, token);
                break;
            case "action.devices.QUERY":
                logger.debug("QUERYING...");
                response = await handleQuery(body, token);
                await _reportState(body, context, token);
                break;
            case "action.devices.EXECUTE":
                logger.debug("EXECUTING...");
                response = await handleExecute(body, token);
                await _reportState(body, context, token);
                break;
            case "action.devices.DISCONNECT":
                logger.debug("DISCONNECTING...");
                response = {};
                break;
            case "actions.devices.REPORT_STATE":
                logger.debug("REPORTING STATE...");
                response = await handleReportState(agentUserId, event.requestId, token);
                break;
            default:
                logger.error("Intent in event not found");
        }

        logger.debug('Response: ' + JSON.stringify(response));
        return {
            isBase64Encoded: false,
            statusCode: 200,
            body: JSON.stringify(response),
        };

    } catch (error) {
        logger.error(error.stack);
    }
}

// helpers needed for testing and stubbing
const helpers = {
    fulfillment,
    getRequest,
    handleSync,
    handleQuery,
    handleExecute,
    postRequest,
};
module.exports = helpers;
