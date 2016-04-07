var ClearBlade = require('../ClearBlade');

describe('A ClearBlade User request', function() {
  beforeEach(function () {
    spyOn(ClearBlade, 'request').andCallFake(function(options, callback) {
      callback(null, {user_token: 'fake'});
    });
    var initOptions =  {
      systemKey: "fakeSystemKey",
      systemSecret: "fakeSystemSecret"
    };
    ClearBlade.init(initOptions);
  });
  it('should make a valid request with a valid query using allUsers', function(done) {
    // TODO: This should be a ClearBlade.parseQuery test more than an allUsers test but
    // the bug was reported here so I'm doing it here for now.
    var userQuery = ClearBlade.Query();
    var user = ClearBlade.User();
    var expectedRequest = {
      method: 'GET',
      endpoint: 'api/v/1/user',
      URI: 'https://platform.clearblade.com',
      qs: 'query=%7B%22FILTERS%22%3A%5B%5B%7B%22EQ%22%3A%5B%7B%22pants%22%3A%22green%22%7D%5D%7D%5D%5D%7D',
      user: {
  email : null,
  authToken : 'fake'
      }
    };
    userQuery.equalTo('pants', 'green');
    user.allUsers(userQuery, function() {
      // check the request, don't care about the results because this is a unit test
      expect(ClearBlade.request.mostRecentCall.args[0]).toEqual(expectedRequest);
      done();
    });
  });

  it('should make a valid request with no query using allUsers', function(done) {
    ClearBlade.request.andCallFake(function(options, callback) {
      callback(null, [{user: 'fake'}]);
    });
    var user = ClearBlade.User();
    var expectedRequest = {
      method: 'GET',
      endpoint: 'api/v/1/user',
      URI: 'https://platform.clearblade.com',
      qs: '',
      user: {
  email : null,
  authToken : 'fake'
      }
    };
    user.allUsers(function() {
      expect(ClearBlade.request.mostRecentCall.args[0]).toEqual(expectedRequest);
      done();
    });
  });
});
