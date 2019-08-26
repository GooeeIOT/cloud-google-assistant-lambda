exports.onSync = {
    requestId: "000000000",
    payload: {
        agentUserId: "agent123",
        devices: [
            {
                id: "123456789",
                name: {
                    name: "mocked_wim",
                },
                traits: ["action.devices.traits.OnOff", "action.devices.traits.Brightness"],
                type: "action.devices.types.LIGHT",
                willReportState: true,
                deviceInfo: {
                    manufacturer: "Gooee",
                },
                customData: {
                    online: true,
                    type: "device",
                },
            },
            {
                id: "987654321",
                name: {
                    name: "mocked_bulb",
                },
                traits: ["action.devices.traits.OnOff", "action.devices.traits.Brightness"],
                type: "action.devices.types.LIGHT",
                willReportState: true,
                deviceInfo: {
                    manufacturer: "Gooee",
                },
                customData: {
                    online: true,
                    type: "device",
                },
            },
            {
                id: "192837465",
                name: {
                    name: "mocked_space",
                },
                traits: ["action.devices.traits.OnOff"],
                type: "action.devices.types.SWITCH",
                willReportState: true,
                deviceInfo: {
                    manufacturer: "Gooee",
                },
                customData: {
                    online: true,
                    type: "space",
                },
            },
        ],
    },
};
exports.onQuery = {
    requestId: "999999999",
    payload: {
        agentUserId: "agent123",
        devices: {
            "123456789": {
                on: true,
                online: true,
                brightness: 100,
            },
            "192837465": {
                on: true,
                online: true,
            },
        },
    },
};
exports.onExecute = {
    requestId: "555555555",
    payload: {
        agentUserId: "agent123",
        commands: [
            {
                ids: ["987654321", "192837465"],
                status: "SUCCESS",
                states: {
                    on: false,
                    online: true,
                },
            },
        ],
    },
};
