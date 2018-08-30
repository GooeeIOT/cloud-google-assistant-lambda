const lambda = require('../lambda_function')
const request =  require('../__mocks__/request')
const response = require('../__mocks__/response')
const devices = require('../__mocks__/devices')
const expect = require('chai').expect
const rp = require('request-promise')
const sinon = require('sinon')

describe('Handler tests should pass successfully', () => {
    var rpStub = sinon.stub(rp, 'get')

    describe('Return onSync data', () => {
        before(() => {
            rpStub.onCall(0).resolves(devices.lights)
            rpStub.onCall(1).resolves(devices.switches)
        })
        it('should return devices', async () => {
            var resp = await lambda.handle_sync(request.onSync, null)
            expect(resp).to.deep.equal(response.onSync)
        })
    })
    describe('Return onQuery data', () => {
        before(() => {
            rpStub.onCall(2).resolves(devices.mocked_wim)
            rpStub.onCall(3).resolves(devices.mocked_device_states)
        })
        it('should return queried devices', async () => {
            var resp = await lambda.handle_query(request.onQuery, null)
            expect(resp).to.deep.equal(response.onQuery)
        })
    })

    describe('Return onExecute data', () => {
        let rpStub = sinon.stub(rp, 'post')
        before(() => {
            rpStub.resolves()
        })
        it('should return successful executions', async () => {
            var resp = await lambda.handle_execute(request.onExecute, null)
            expect(resp).to.deep.equal(response.onExecute)
        })
    })
})