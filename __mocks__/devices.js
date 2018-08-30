var mocked_wim = {
    "id": "123456789",
    "name": "mocked_wim",
    "type": "wim",
    "meta": [
        {
            "name": "onoff",
            "value": true
        },
        {
            "name": "is_online",
            "value": true
        },
        {
            "name": "dim",
            "value": 100
        }
    ]
}
var mocked_bulb = {
    "id": "987654321",
    "name": "mocked_bulb",
    "type": "bulb",
    "meta": [
        {
            "name": "onoff",
            "value": true
        },
        {
            "name": "is_online",
            "value": true
        },
        {
            "name": "dim",
            "value": 50
        }
    ]
}
let mocked_space = {
    "id": "192837465",
    "name": "mocked_space"
}
let mocked_device_states = {
    "space": "192837465",
    "states": {
        "20f8235b-0827-4200-9284-6b8ccdb0e633": {
            "onoff": true,
            "dim": 100
        },
        "20f7821b-0827-4200-9284-6b8cfda098e3": {
            "onoff": true,
            "dim": 100
        }
    }
}
var lights = []
var switches = []
lights.push(mocked_wim)
lights.push(mocked_bulb)
switches.push(mocked_space)
exports.lights = lights
exports.switches = switches
exports.mocked_wim = mocked_wim
exports.mocked_space = mocked_space
exports.mocked_device_states = mocked_device_states
