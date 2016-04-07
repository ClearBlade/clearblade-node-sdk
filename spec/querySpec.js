var ClearBlade = require('../ClearBlade');

describe('A ClearBlade Query object', function() {
  beforeEach(function (done) {
    spyOn(ClearBlade, 'request').andCallFake(function(options, callback) {
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

  it('should correctly add ascending options', function(done) {
    var query = ClearBlade.Query({collectionID: 'fake'});
    query.equalTo('pants', 'green');
    query.ascending('pants');
    expect(query.query.SORT).toEqual([{'ASC': 'pants'}]);
    done();
  });

  it('should correctly add descending options', function(done) {
    var query = ClearBlade.Query({collectionID: 'fake'});
    query.equalTo('pants', 'green');
    query.descending('pants');
    expect(query.query.SORT).toEqual([{'DESC': 'pants'}]);
    done();
  });

  it('should correctly add equalTo options', function(done) {
    var query = ClearBlade.Query({collectionID: 'fake'});
    query.equalTo('pants', 'green');
    query.equalTo('shirt', 'yellow');
    expect(query.query.FILTERS[0][0].EQ).toContain({shirt: 'yellow'});
    done();
  });

  it('should correctly add greaterThan options', function(done) {
    var query = ClearBlade.Query({collectionID: 'fake'});
    query.equalTo('pants', 'green');
    query.greaterThan('shirt', 'yellow');
    expect(query.query.FILTERS[0][1].GT).toContain({shirt: 'yellow'});
    done();
  });

  it('should correctly add greaterThanEqualTo options', function(done) {
    var query = ClearBlade.Query({collectionID: 'fake'});
    query.equalTo('pants', 'green');
    query.greaterThanEqualTo('shirt', 'yellow');
    expect(query.query.FILTERS[0][1].GTE).toContain({shirt: 'yellow'});
    done();
  });

  it('should create a proper request for fetching', function(done) {
    var query = ClearBlade.Query({collection: 'fake'});
    query.equalTo('pants', 'green');
    query.fetch(function() { });

    var expectedRequest = {
      method: 'GET',
      qs: 'query=%7B%22FILTERS%22%3A%5B%5B%7B%22EQ%22%3A%5B%7B%22pants%22%3A%22green%22%7D%5D%7D%5D%5D%7D',
      URI: 'https://platform.clearblade.com',
      endpoint: 'api/v/1/data/fake',
      user: {
  email: null,
  authToken : 'fake'
      }
    };
    expect(ClearBlade.request.mostRecentCall.args[0]).toEqual(expectedRequest);

    done();
  });

  it('should create a proper request for update', function(done) {
    var query = ClearBlade.Query({collectionID: 'fake'});
    query.equalTo('pants', 'green');
    query.update({pants: 'bass'}, function() { });
    var expectedRequest = {
      method: 'PUT',
      body: {query: [[{EQ: [{pants:'green'}]}]], $set: {pants: 'bass'}},
      URI: 'https://platform.clearblade.com',
      endpoint: 'api/v/1/data/fake',
      user: {
  email: null,
  authToken : 'fake'
      }
    };
    expect(ClearBlade.request.mostRecentCall.args[0]).toEqual(expectedRequest);
    done();
  });

  it('should create a proper request for remove', function(done) {
    var query = ClearBlade.Query({collectionID: 'fake'});
    query.equalTo('pants', 'green');
    query.remove(function() { });
    var expectedRequest = {
      method: 'DELETE',
      qs: 'query=%5B%5B%7B%22EQ%22%3A%5B%7B%22pants%22%3A%22green%22%7D%5D%7D%5D%5D',
      URI: 'https://platform.clearblade.com',
      endpoint: 'api/v/1/data/fake',
      user: {
  email: null,
  authToken : 'fake'
      }
    };
    expect(ClearBlade.request.mostRecentCall.args[0]).toEqual(expectedRequest);
    done();
  });
});
