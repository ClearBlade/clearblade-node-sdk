/*
 * This tests the push functionality of the Node sdk
 */

var ClearBlade = require('../ClearBlade');

describe("ClearBlade send push", function () {
  beforeEach(function () {
    spyOn(ClearBlade, 'request').andCallFake(function(options, callback) {
      callback(null, [], {statusCode: 202});
    });
    var initOptions =  {
      systemKey: "fakeSystemKey",
      systemSecret: "fakeSystemSecret"
    };
    ClearBlade.init(initOptions);
    ClearBlade.setUser('test@fake.com', 'testUserToken');
  });
  
  it("sends proper push", function () {
    var users = ['user1', 'user2', 'user3'],
	payload = { // I have no idea what's supposed to go here
	  alert: 'hello'
	},
	appId = 'someIDSuppliedByApple',
	expectedData = {
	  method: 'POST',
	  endpoint: 'api/v/1/push/fakeSystemKey',
	  body: {
	    cbids: ['user1', 'user2', 'user3'],
	    "apple-message": {
	      aps: {
		alert: 'hello'
	      }
	    },
	    appid: 'someIDSuppliedByApple'
	  },
	  user: {
	    email: 'test@fake.com',
	    authToken: 'testUserToken'
	  }
	};
    ClearBlade.sendPush(users, payload, appId, function () {});
    expect(ClearBlade.request.mostRecentCall.args[0]).toEqual(expectedData);
  });
});
