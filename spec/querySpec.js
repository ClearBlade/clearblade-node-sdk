var ClearBlade = require('../ClearBlade').ClearBlade;

describe('A ClearBlade Query object', function() {
  var query = null;

  beforeEach(function() {
    query = new ClearBlade.Query({collection: 'fake'});
    query.equalTo('pants', 'green');

    spyOn(ClearBlade, 'request');
  });

  it('should correctly add ascending options', function(done) {
    query.ascending('pants');
    expect(query.query.SORT).toEqual([{'ASC': 'pants'}]);
    done();
  });

  it('should correctly add descending options', function(done) {
    query.descending('pants');
    expect(query.query.SORT).toEqual([{'DESC': 'pants'}]);
    done();
  });

  it('should correctly add equalTo options', function(done) {
    query.equalTo('shirt', 'yellow');
    expect(query.query.FILTERS[0][0].EQ).toContain({shirt: 'yellow'});
    done();
  });

  it('should correctly add greaterThan options', function(done) {
    query.greaterThan('shirt', 'yellow');
    expect(query.query.FILTERS[0][1].GT).toContain({shirt: 'yellow'});
    done();
  });

  it('should correctly add greaterThanEqualTo options', function(done) {
    query.greaterThanEqualTo('shirt', 'yellow');
    expect(query.query.FILTERS[0][1].GTE).toContain({shirt: 'yellow'});
    done();
  });

  it('should create a proper request for fetching', function(done) {
    query.fetch(function() { });

    var expectedRequest = {
      method: 'GET',
      qs: 'query=%7B%22FILTERS%22%3A%5B%5B%7B%22EQ%22%3A%5B%7B%22pants%22%3A%22green%22%7D%5D%7D%5D%5D%7D',
      endpoint: 'api/v/1/data/fake'
    };
    expect(ClearBlade.request.calls.argsFor(0)[0]).toEqual(expectedRequest);

    done();
  });

  it('should create a proper request for update', function(done) {
    query.update({pants: 'bass'}, function() { });
    var expectedRequest = {
      method: 'PUT',
      body: {query: [[{EQ: [{pants:'green'}]}]], $set: {pants: 'bass'}},
      endpoint: 'api/v/1/data/fake',
    };
    expect(ClearBlade.request.calls.argsFor(0)[0]).toEqual(expectedRequest);
    done();
  });

  it('should create a proper request for remove', function(done) {
    query.remove(function() { });
    var expectedRequest = {
      method: 'DELETE',
      qs: 'query=%5B%5B%7B%22EQ%22%3A%5B%7B%22pants%22%3A%22green%22%7D%5D%7D%5D%5D',
      endpoint: 'api/v/1/data/fake'
    };
    expect(ClearBlade.request.calls.argsFor(0)[0]).toEqual(expectedRequest);
    done();
  });
});
