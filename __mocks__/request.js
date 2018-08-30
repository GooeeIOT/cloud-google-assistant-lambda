
exports.onSync = {
  requestId: '000000000',
  inputs: [{
      'intent': 'actions.devices.SYNC'
  }]
}
exports.onQuery = {
  "requestId": "999999999",
  "inputs": [{
    "intent": "action.devices.QUERY",
    "payload": {
      "devices": [{
        "id": "123456789",
        "customData": {
          "online": true,
          "type": "device"
        }
      },
      {
        "id": "192837465",
        "customData": {
              "type": "space"
        }
      }]
    }
  }]
}
exports.onExecute = {
  "requestId": "555555555",
  "inputs": [{
    "intent": "action.devices.EXECUTE",
    "payload": {
      "commands": [{
        "devices": [{
          "id": "987654321",
          "customData": {
            "online": true,
          "type": "device"
          }
        },{
          "id": "192837465",
          "customData": {
            "type": "space"
          }
        }],
        "execution": [{
          "command": "action.devices.commands.OnOff",
          "params": {
            "on": false
          }
        }]
      }]
    }
  }]
}
