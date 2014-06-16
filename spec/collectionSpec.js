var ClearBlade = require('../ClearBlade').ClearBlade;

beforeEach(function(done) {
  var doneCallback = function() { done(); };
  var initOptions =  {
    URI: 'http://127.0.0.1',
    callback: doneCallback,
    systemKey: "fakeSystemKey",
    systemSecret: "fakeSystemSecret"
  };
  ClearBlade.init(initOptions);
});


describe('A ClearBlade Collection object', function() {
  var collection = null;

  beforeEach(function() {
    collection = new ClearBlade.Collection("fakecollectionID");

    spyOn(ClearBlade, 'request').and.callThrough();
  });

  it('should call fetch with the correct options', function(done) {
    collection.fetch(function(err, data) {});

    var expectedRequest = {
      method: 'GET',
      endpoint: 'api/v/1/data/fakecollectionID',
      qs: 'query=%7B%22FILTERS%22%3A%5B%5D%7D'
    };
    expect(ClearBlade.request.calls.argsFor(0)[0]).toEqual(expectedRequest);
    done();
  });
});
