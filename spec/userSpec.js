var ClearBlade = require('../ClearBlade');

// beforeEach(function(done) {
//   // Make a spy that returns some fake shit when it gets the anon request here
//   spyOn(ClearBlade, 'request').and.callFake(function(options, callback) {
//     callback(null, {user_token: 'fake'});
//   });
//   var doneCallback = function() { done(); };
//   var initOptions = {
//     callback: doneCallback,
//     systemKey: 'fakeSystemKey',
//     systemSecret: 'fakeSystemSecret'
//   };
//   ClearBlade.init(initOptions);
// });

describe('A ClearBlade User request', function() {
  it('should make a valid request with a valid query using allUsers', function(done) {
    // TODO: This should be a ClearBlade.parseQuery test more than an allUsers test but
    // the bug was reported here so I'm doing it here for now.
    var userQuery = ClearBlade.Query({collection: 'fake'});
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
      expect(ClearBlade.request.calls.argsFor(1)[0]).toEqual(expectedRequest);
      done();
    });
  });

  it('should make a valid request with no query using allUsers', function(done) {
    ClearBlade.request.and.callFake(function(options, callback) {
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
      expect(ClearBlade.request.calls.argsFor(1)[0]).toEqual(expectedRequest);
      done();
    });
  });
});
