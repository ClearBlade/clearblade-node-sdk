var ClearBlade = require('../ClearBlade');
var util = require('util');

beforeEach(function(done) {
  spyOn(ClearBlade, 'request').and.callFake(function(options, callback) {
    callback(null, {user_token: 'fake'});
  });
  var doneCallback = function() { done(); };
  var initOptions =  {
    callback: doneCallback,
    systemKey: "fakeSystemKey",
    systemSecret: "fakeSystemSecret"
  };
  ClearBlade.init(initOptions);
});


describe('A ClearBlade Collection object', function() {
  var collection = null;

  beforeEach(function() {
    collection = ClearBlade.Collection("fakecollectionID");

    // Just stub the request that will do the fetch
    ClearBlade.request.and.stub();
  });

  it('should call fetch with the correct options', function(done) {
    collection.fetch(function(err, data) {});

    var expectedRequest = {
      method: 'GET',
      endpoint: 'api/v/1/data/fakecollectionID',
      qs: 'query=%7B%22FILTERS%22%3A%5B%5D%7D',
      URI: 'https://platform.clearblade.com',
      user: {
	email: null,
	authToken: 'fake'
      }
    };
    expect(ClearBlade.request.calls.argsFor(1)[0]).toEqual(expectedRequest);
    done();
  });
});
