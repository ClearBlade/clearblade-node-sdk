var ClearBlade = require('../ClearBlade');
var util = require('util');

describe('A ClearBlade Code object', function () {
    var code;
    var systemKey = 'fakeSystemKey';
    var systemSecret = 'fakeSystemSecret';
    var codeUriPrefix = 'api/v/1/code/';
    var serviceName = 'fakeServiceName';
    var defaultPlatformUrl = 'https://platform.clearblade.com';
    var fakeAuthToken = 'fake';
    var requestSpy;

    beforeEach(function () {
        requestSpy = spyOn(ClearBlade, 'request').andCallFake(function (options, callback) {
            callback(null, {user_token: fakeAuthToken});
        });

        var initOptions = {
            systemKey: systemKey,
            systemSecret: systemSecret
        };
        ClearBlade.init(initOptions);

        code = ClearBlade.Code();

    });

    it('should call execute with the correct options', function (done) {

        code.execute(serviceName, {}, function (err, data) {});

        var expectedRequest = {
            method: 'POST',
            endpoint: codeUriPrefix + systemKey + '/' + serviceName,
            URI: defaultPlatformUrl,
            user: {
                email: null,
                authToken: fakeAuthToken
            },
            body: {}
        };

        expect(ClearBlade.request.mostRecentCall.args[0]).toEqual(expectedRequest);
        done();
    });

    it('should send an error back if body.success is equal to false', function (done) {
        var syntaxError = 'SyntaxError: learn how to code';
        spyOn(code, 'execute').andCallThrough(function() {});

        requestSpy.andCallFake(function(options, callback) {
            callback(null, {success: false, results: syntaxError});
        });

        code.execute('test', {}, function(err, data) {
            if(err) {
                expect(data.results).toEqual(syntaxError);
            } else {
                this.fail(new Error('Returning body.success did not cause callback to fail into error block'));
            }
            done();
        }.bind(this));

    });
});
