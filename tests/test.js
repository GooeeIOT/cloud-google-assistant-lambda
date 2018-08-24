var expect = require('jest')
const handler = require('../index').fulfillment

//mock data
var sync_request = {
    params: {
        header: {
            Authorization: 'Bearer <token>'
        }
    },
    'body-json': {
        requestId: '947648466986',
        inputs: [{
            intent: 'action.devices.SYNC'
        }]
    }
}
var query_request = {
    
}
var execute_request = {
    
}

test('onSync returns valid response', () => {
    handler(sync_request)
})