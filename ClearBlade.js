var requestLib = require('request'),
    _ = require('lodash'),
    mqtt = require('mqtt'),
    winston = require('winston'),
    util = require('util');

winston.add(winston.transports.File, { filename: 'cblog.log' });

function ClearBlade() {}

ClearBlade.prototype.logger = function (message) {
  if (this.logging) {
    console.log(message);
  }
  return;
};

ClearBlade.prototype.request = function(options, callback) {
  if (!options || typeof options !== 'object')
    throw new Error("Request: options is not an object or is empty");

  var requestOptions = {headers: {}};
  requestOptions.method = options.method || 'GET';
  if (!options.URI || typeof options.URI !== 'string') { // TODO: Check if I actually need to require this if I'm setting a URI / user / etc in the helper constructors for Collection et al
    throw new Error('Must supply a valid URI');
  }
  requestOptions.url = options.URI;
  requestOptions.body = options.body || {};
  var qs = options.qs || '';
  var useUser = options.useUser || true;
  var authToken = useUser && options.authToken;
  // if (!options.user || !options.user.authToken || typeof options.user !== 'object') {
  //   throw new Error('Must supply a valid user object');
  // }
  if (useUser && !authToken && options.user && options.user.authToken) {
    authToken = options.user.authToken;
  }

  var endpoint = options.endpoint || '';
  var params = qs;
  if (endpoint) {
    requestOptions.url +=  ('/' + endpoint);
  }
  if (params) {
    requestOptions.url += "?" + params;
  }

  if (authToken) {
    requestOptions.headers["ClearBlade-UserToken"] = authToken;
  } else {
    if (!options.systemKey || !options.systemSecret || typeof options.systemKey !== 'string' || typeof options.systemSecret !== 'string') {
      throw new Error('Must supply systemKey and systemSecret strings');
    }
    requestOptions.headers["ClearBlade-SystemKey"] = options.systemKey;
    requestOptions.headers["ClearBlade-SystemSecret"] = options.systemSecret;
  }

  if (!this.isObjectEmpty(requestOptions.body) || params) {

    if (requestOptions.method === "POST" || requestOptions.method === "PUT") {
      // Content-Type is expected for POST and PUT; bad things can happen if you don't specify this.
      requestOptions.headers["Content-Type"] = "application/json";
    }

    requestOptions.headers["Accept"] = "application/json";
  }
  requestOptions.body = JSON.stringify(requestOptions.body);

  // This used to call the callback with simply a boolean error and a *string* of the body,
  // so you may see some parts of the SDK only caring about those two things, but I am adding
  // the full response object as a third callback argument in order to access statuscodes and
  // request-specific context.
  requestLib(requestOptions, function(error, response, body) {
    if (!error && (response.statusCode === 200 || response.statusCode === 202) && body) {
      try {
        body = JSON.parse(body);
      } catch (e) {
        callback(true, {parseError: e, body: body}, response);
      }
      callback(error, body, response);
    } else if (!error && response.statusCode === 200) {
      callback(false, "", response);
    } else if (error || response.statusCode !== 200) {
      callback(true, body, response);
    } else {
      callback(true, body, response);
    }
  });

};

ClearBlade.prototype.isObjectEmpty = function (object) {
  /*jshint forin:false */
  if (typeof object !== 'object') {
    return true;
  }
  for (var keys in object) {
    if(object.hasOwnProperty(keys))
      return false;
  }
  return true;
};

ClearBlade.prototype.validateEmailPassword = function(email, password) {
  if (email == null || email == undefined || email == "" || typeof email != 'string') {
    throw new Error("Email must be given and must be a string");
  }
  if (password == null || password == undefined || password == "" || typeof password != 'string') {
    throw new Error("Password must be given and must be a string");
  }
};

ClearBlade.prototype.execute = function (error, response, callback) {
  if (typeof callback === 'function') {
    callback(error, response);
  } else {
    this.logger("Did you forget to supply a valid Callback!");
  }
};

/**
 * This method initializes the ClearBlade module with the values needed to connect to the platform
 * @method ClearBlade.init
 * @param options {Object} the `options` Object
 */
ClearBlade.prototype.init = function(options) {
  var _this = this;
  //check for undefined/null then check if they are the correct types for required params
  if (!options || typeof options !== 'object')
    throw new Error('Options must be an object or it is undefined');

  if (!options.systemKey || typeof options.systemKey !== 'string')
    throw new Error('systemKey must be defined/a string');

  if (!options.systemSecret || typeof options.systemSecret !== 'string')
    throw new Error('systemSecret must be defined/a string');

  //check for optional params.
  if (options.logging && typeof options.logging !== 'boolean')
    throw new Error('logging must be a true boolean if present');

  if (options.callback && typeof options.callback !== 'function')
    throw new Error('callback must be a function');

  if (options.email && typeof options.email !== 'string')
    throw new Error('email must be a string');

  if (options.password && typeof options.password !== 'string')
    throw new Error('password must be a string');

  if (options.registerUser && typeof options.registerUser !== 'boolean')
    throw new Error('registerUser must be a true boolean if present');

  if (options.useUser && (!options.useUser.email || !options.useUser.authToken)) {
    throw new Error('useUser must contain both an email and an authToken ' +
                    '{"email":email,"authToken":authToken}');
  }

  if (options.email && !options.password)
    throw new Error('Must provide a password for email');

  if (options.password && !options.email)
    throw new Error('Must provide a email for password');

  if (options.registerUser && !options.email)
    throw new Error('Cannot register anonymous user. Must provide an email');

  if (options.useUser && (options.email || options.password || options.registerUser))
    throw new Error('Cannot authenticate or register a new user when useUser is set');

  this.systemKey = options.systemKey;
  this.systemSecret = options.systemSecret;
  this.URI = options.URI || "https://platform.clearblade.com";
  this.messagingURI = options.messagingURI || "messaging.clearblade.com";
  this.messagingPort = options.messagingPort || 1883;
  this.logging = options.logging || false;

  this.defaultQoS = options.defaultQoS || 0;
  this._callTimeout =  options.callTimeout || 30000; //default to 30 seconds

  this.user = null;

  if (options.useUser) {
    this.user = options.useUser;
  } else if (options.registerUser) {
    this.registerUser(options.email, options.password, function(err, response) {
      if (err) {
        _this.execute(err, response, options.callback);
      } else {
        _this.loginUser(options.email, options.password, function(err, user) {
          _this.execute(err, user, options.callback);
        });
      }
    });
  } else if (options.email) {
    this.loginUser(options.email, options.password, function(err, user) {
      _this.execute(err, user, options.callback);
    });
  } else {
    _this.loginAnon(function(err, user) {
      _this.execute(err, user, options.callback);
    });
  }
};

ClearBlade.prototype.loginAnon = function(callback) {
  var _this = this;
  this.request({
    method: 'POST',
    useUser: false,
    endpoint: 'api/v/1/user/anon',
    systemKey: this.systemKey,
    systemSecret: this.systemSecret,
    URI: this.URI
  }, function(err, response) {
    if (err) {
      _this.execute(true, response, callback);
    } else {
      _this.setUser(null, response.user_token);
      _this.execute(false, _this.user, callback);
    }
  });
};

ClearBlade.prototype.registerUser = function(email, password, callback) {
  var _this = this;
  this.validateEmailPassword(email, password);
  this.request({
    method: 'POST',
    endpoint: 'api/v/1/user/reg',
    useUser: false,
    body: { "email": email, "password": password },
    systemKey: this.systemKey,
    systemSecret: this.systemSecret,
    URI: this.URI
  }, function (err, response) {
    if (err) {
      _this.execute(true, response, callback);
    } else {
      _this.execute(false, "User successfully registered", callback);
    }
  });
};

ClearBlade.isCurrentUserAuthenticated = function(callback) {
  var _this = this;
  this.request({
    method: 'POST',
    endpoint: 'api/v/1/user/checkauth',
    systemKey: this.systemKey,
    systemSecret: this.systemSecret,
    URI: this.URI
  }, function (err, response) {
    if (err) {
      _this.execute(true, response, callback);
    } else {
      _this.execute(false, response.is_authenticated, callback);
    }
  });
};

ClearBlade.prototype.loginUser = function(email, password, callback) {
  var _this = this;
  this.validateEmailPassword(email, password);
  this.request({
    method: 'POST',
    useUser: false,
    endpoint: 'api/v/1/user/auth',
    body: { "email": email, "password": password },
    systemKey: this.systemKey,
    systemSecret: this.systemSecret,
    URI: this.URI
  }, function (err, response) {
    if (err) {
      _this.execute(true, response, callback);
    } else {
      try {
        _this.setUser(email, response.user_token);
        _this.execute(false, _this.user, callback);
      } catch(e) {
        _this.execute(true, e, callback);
      }
    }
  });
};

ClearBlade.prototype.logoutUser = function(callback) {
  var _this = this;
  this.request({
    method: 'POST',
    endpoint: 'api/v/1/user/logout',
    systemKey: this.systemKey,
    systemSecret: this.systemSecret,
    URI: this.URI
  }, function(err, response) {
    if (err) {
      _this.execute(true, response, callback);
    } else {
      _this.execute(false, "User Logged out", callback);
    }
  });
};

ClearBlade.prototype.setUser = function(email, authToken) {
  this.user = {
    email: email,
    authToken: authToken
  };
};

/**
 * Creates a new Collection that represents the server-side collection with the specified collection ID
 * @class ClearBlade.Collection
 * @classdesc This class represents a server-side collection. It does not actully make a connection upon instantiation, but has all the methods necessary to do so. It also has all the methods necessary to do operations on the server-side collections.
 * @param {Object} options is an object containing a key 'collectionName' that is the name of the collection that you wish to represent
 */
ClearBlade.prototype.Collection = function(options) {
  var _this = this;
  var collection = {};
  if(typeof options === "string") {
    collection.endpoint = "api/v/1/data/" + options;
    options = {collectionID: options};
  } else if (options.collectionName && options.collectionName !== "") {
    collection.endpoint = "api/v/1/collection/" + this.systemKey + "/" + options.collectionName;
  } else if(options.collectionID && options.collectionID !== "") {
    collection.endpoint = "api/v/1/data/" + options.collectionID;
  } else {
    throw new Error("Must supply a collectionID or collectionName key in options object");
  }
  collection.user = this.user;
  collection.URI = this.URI;
  collection.systemKey = this.systemKey;
  collection.systemSecret = this.systemSecret;
  
  /**
   * Reqests an item or a set of items from the collection.
   * @method ClearBlade.Collection.fetch
   * @param {Query} _query Used to request a specific item or subset of items from the collection on the server. Optional.
   * @param {function} callback Supplies processing for what to do with the data that is returned from the collection
   * @example <caption>Fetching data from a collection</caption>
   * var returnedData = [];
   * var callback = function (err, data) {
   *     if (err) {
   *         throw new Error (data);
   *     } else {
   *         returnedData = data;
   *     }
   * };
   *
   * col.fetch(query, callback);
   * //this will give returnedData the value of what ever was returned from the server.
   */
  collection.fetch = function (_query, callback) {
    var query;
    /*
     * The following logic may look funny, but it is intentional.
     * I do this because it is typeical for the callback to be the last parameter.
     * However, '_query' is an optional parameter, so I have to check if 'callback' is undefined
     * in order to see weather or not _query is defined.
     */
    if (callback === undefined) {
      callback = _query;
      query = {
  FILTERS: []
      };
      query = 'query='+ _this.parseQuery(query);
    } else {
      query = 'query='+ _this.parseQuery(_query.query);
    }

    var reqOptions = {
      method: 'GET',
      endpoint: this.endpoint,
      qs: query,
      URI: _this.URI,
      user: _this.user
    };
    var colID = _this.ID;
    var callCallback = function (err, data) {
      callback(err, data);
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callCallback);
    } else {
      _this.logger("No callback was defined!");
    }
  };



  /**
   * Creates a new item in the collection and returns the created item to the callback
   * @method ClearBlade.Collection.create
   * @param {Object} newItem An object that represents an item that you want to add to the collection
   * @param {function} callback Supplies processing for what to do with the data that is returned from the collection
   * @example <caption>Creating a new item in the collection</caption>
   * //This example assumes a collection of items that have the columns: name, height, and age.
   * var newPerson = {
   *     name: 'Jim',
   *     height: 70,
   *     age: 32
   * };
   * var callback = function (err, data) {
   *     if (err) {
   *         throw new Error (data);
   *     } else {
   *         console.log(data);
   *     }
   * };
   * col.create(newPerson, callback);
   * //this inserts the the newPerson item into the collection that col represents
   *
   */
  collection.create = function (newItem, callback) {
    var reqOptions = {
      method: 'POST',
      endpoint: this.endpoint,
      body: newItem,
      URI: _this.URI,
      systemSecret: _this.systemSecret,
      systemKey: _this.systemKey,
      user: _this.user
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callback);
    } else {
      throw new Error("No callback defined for ClearBlade.Collection.create");
    }
  };
  
  /**
   * Updates an existing item or set of items
   * @method ClearBlade.Collection.update
   * @param {Query} _query Query object to denote which items or set of Items will be changed
   * @param {Object} changes Object representing the attributes that you want changed
   * @param {function} callback Function that handles the response of the server
   * @example <caption>Updating a set of items</caption>
   * //This example assumes a collection of items that have the columns name and age.
   * var query = new ClearBlade.Query();
   * query.equalTo('name', 'John');
   * var changes = {
   *     age: 23
   * };
   * var callback = function (err, data) {
   *     if (err) {
   *         throw new Error (data);
   *     } else {
   *         console.log(data);
   *     }
   * };
   *
   * col.update(query, changes, callback);
   * //sets John's age to 23
   */
  collection.update = function (_query, changes, callback) {
    var reqOptions = {
      method: 'PUT',
      endpoint: this.endpoint,
      body: {query: _query.query.FILTERS, $set: changes},
      URI: _this.URI,
      systemSecret: _this.systemSecret,
      systemKey: _this.systemKey,
      user: _this.user
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callback);
    } else {
      throw new Error("No callback defined for ClearBlade.Collection.update");
    }
  };
  
  /**
   * Removes an item or set of items from the specified collection
   * @method ClearBlade.Collection.remove
   * @param {Query} _query Query object that used to define what item or set of items to remove
   * @param {function} callback Function that handles the response from the server
   * @example <caption>Removing an item in a collection</caption>
   * //This example assumes that you have a collection with the item whose 'name' attribute is 'John'
   * var query = new ClearBlade.Query();
   * query.equalTo('name', 'John');
   * var callback = function (err, data) {
   *     if (err) {
   *         throw new Error (data);
   *     } else {
   *         console.log(data);
   *     }
   * };
   *
   * col.remove(query, callback);
   * //removes every item whose 'name' attribute is equal to 'John'
   */
  collection.remove = function (_query, callback) {
    var query;
    if (_query === undefined) {
      throw new Error("no query defined!");
    } else {
      query = 'query=' + _this.parseOperationQuery(_query.query);
    }

    var reqOptions = {
      method: 'DELETE',
      endpoint: this.endpoint,
      qs: query,
      URI: _this.URI,
      systemSecret: _this.systemSecret,
      systemKey: _this.systemKey,
      user: _this.user
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callback);
    } else {
      _this.logger("No callback was defined!");
    }
  };

  return collection;
};





ClearBlade.prototype.makeKVPair = function (key, value) {
  var KVPair = {};
  KVPair[key] = value;
  return KVPair;
};

ClearBlade.prototype.addToQuery = function(queryObj, key, value) {
  queryObj.query[key] = value;
};

ClearBlade.prototype.addFilterToQuery = function (queryObj, condition, key, value) {
  var newObj = {};
  newObj[key] = value;
  var newFilter = {};
  newFilter[condition] = [newObj];
  if (typeof queryObj.query.FILTERS === 'undefined') {
    queryObj.query.FILTERS = [];
    queryObj.query.FILTERS.push([newFilter]);
    return;
  } else {
    for (var i = 0; i < queryObj.query.FILTERS[0].length; i++) {
      for (var k in queryObj.query.FILTERS[0][i]) {
        if (queryObj.query.FILTERS[0][i].hasOwnProperty(k)) {
          if (k === condition) {
            queryObj.query.FILTERS[0][i][k].push(newObj);
            return;
          }
        }
      }
    }
    queryObj.query.FILTERS[0].push(newFilter);
  }
};

ClearBlade.prototype.addSortToQuery = function(queryObj, direction, column) {
  if (typeof queryObj.query.SORT === 'undefined') {
    queryObj.query.SORT = [];
  }
  queryObj.query.SORT.push(this.makeKVPair(direction, column));
};

ClearBlade.prototype.parseOperationQuery = function(_query) {
  return encodeURIComponent(JSON.stringify(_query.FILTERS));
};

ClearBlade.prototype.parseQuery = function(_query) {
  var parsed = encodeURIComponent(JSON.stringify(_query));
  return parsed;
};

/**
 * creates a Query object that can be used in Collection methods or on its own to operate on items on the server
 * @class ClearBlade.Query
 * @param {Object} options Object that has configuration values used when instantiating a Query object
 */
ClearBlade.prototype.Query = function (options) {
  var _this = this;
  var query = {};
  if (!options) {
    options = {};
  }
  if(typeof options === "string") {
    query.endpoint = "api/v/1/data/" + options;
    options = {collectionID: options};
  } else if (options.collectionName && options.collectionName !== "") {
    query.endpoint = "api/v/1/collection/" + this.systemKey + "/" + options.collectionName;
  } else if(options.collectionID && options.collectionID !== "") {
    query.endpoint = "api/v/1/data/" + options.collectionID;
  } else if (options.collection && options.collection !== "") {
    query.endpoint = "api/v/1/data/" + options.collection;
  }
  query.query = {};
  query.OR = [];
  query.OR.push([this.query]);  // TODO: check this
  query.offset = options.offset || 0;
  query.limit = options.limit || 10;

  query.user = this.user;
  query.URI = this.URI;
  query.systemKey = this.systemKey;
  query.systemSecret = this.systemSecret;

  query.ascending = function(field) {
    _this.addSortToQuery(this, "ASC", field);
    return this;
  };

  query.descending = function (field) {
    _this.addSortToQuery(this, "DESC", field);
    return this;
  };

  /**
   * Creates an equality clause in the query object
   * @method ClearBlade.Query.equalTo
   * @param {String} field String defining what attribute to compare
   * @param {String} value String or Number that is used to compare against
   * @example <caption>Adding an equality clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.equalTo('name', 'John');
   * //will only match if an item has an attribute 'name' that is equal to 'John'
   */
  query.equalTo = function (field, value) {
    _this.addFilterToQuery(this, "EQ", field, value);
    return this;
  };

  /**
   * Creates a greater than clause in the query object
   * @method ClearBlade.Query.greaterThan
   * @param {String} field String defining what attribute to compare
   * @param {String} value String or Number that is used to compare against
   * @example <caption>Adding a greater than clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.greaterThan('age', 21);
   * //will only match if an item has an attribute 'age' that is greater than 21
   */
  query.greaterThan = function (field, value) {
    _this.addFilterToQuery(this, "GT", field, value);
    return this;
  };

  /**
   * Creates a greater than or equality clause in the query object
   * @method ClearBlade.Query.greaterThanEqualTo
   * @param {String} field String defining what attribute to compare
   * @param {String} value String or Number that is used to compare against
   * @example <caption>Adding a greater than or equality clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.greaterThanEqualTo('age', 21);
   * //will only match if an item has an attribute 'age' that is greater than or equal to 21
   */
  query.greaterThanEqualTo = function (field, value) {
    _this.addFilterToQuery(this, "GTE", field, value);
    return this;
  };

  /**
   * Creates a less than clause in the query object
   * @method ClearBlade.Query.lessThan
   * @param {String} field String defining what attribute to compare
   * @param {String} value String or Number that is used to compare against
   * @example <caption>Adding a less than clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.lessThan('age', 50);
   * //will only match if an item has an attribute 'age' that is less than 50
   */
  query.lessThan = function (field, value) {
    _this.addFilterToQuery(this, "LT", field, value);
    return this;
  };

  /**
   * Creates a less than or equality clause in the query object
   * @method ClearBlade.Query.lessThanEqualTo
   * @param {String} field String defining what attribute to compare
   * @param {String} value String or Number that is used to compare against
   * @example <caption>Adding a less than or equality clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.lessThanEqualTo('age', 50);
   * //will only match if an item has an attribute 'age' that is less than or equal to 50
   */
  query.lessThanEqualTo = function (field, value) {
    _this.addFilterToQuery(this, "LTE", field, value);
    return this;
  };

  /**
   * Creates a not equal clause in the query object
   * @method ClearBlade.Query.notEqualTo
   * @param {String} field String defining what attribute to compare
   * @param {String} value String or Number that is used to compare against
   * @example <caption>Adding a not equal clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.notEqualTo('name', 'Jim');
   * //will only match if an item has an attribute 'name' that is not equal to 'Jim'
   */
  query.notEqualTo = function (field, value) {
    _this.addFilterToQuery(this, "NEQ", field, value);
    return this;
  };


  /**
   * Creates an regular expression clause in the query object
   * @method ClearBlade.Query.matches
   * @param {String} field String defining what attribute to compare
   * @param {String} pattern String that is used to compare against
   * @example <caption>Adding an regular expression clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.matches('name', 'Smith$');
   * //will only match if an item has an attribute 'name' that ends in 'Smith'
   */
  query.matches = function (field, pattern) {
    _this.addFilterToQuery(this, "RE", field, pattern);
    return this;
  };
  
  /**
   * Set the pagination options for a Query.
   * @method ClearBlade.Query.setPage
   * @param {int} pageSize Number of items per response page. The default is
   * 100.
   * @param {int} pageNum  Page number, taking into account the page size. The
   * default is 1.
   */
  query.setPage = function (pageSize, pageNum) {
    _this.addToQuery(this, "PAGESIZE", pageSize);
    _this.addToQuery(this, "PAGENUM", pageNum);
    return this;
  };
  
  /**
   * chains an existing query object to the Query object in an or
   * @method ClearBlade.Query.or
   * @param {Query} that Query object that will be added in disjunction to this query object
   * @example <caption>Chaining two queries together in an or</caption>
   * var query1 = new ClearBlade.Query();
   * var query2 = new ClearBlade.Query();
   * query1.equalTo('name', 'John');
   * query2.equalTo('name', 'Jim');
   * query1.or(query2);
   * //will match if an item has an attribute 'name' that is equal to 'John' or 'Jim'
   */
  query.or = function (that) {
    if (this.query.hasOwnProperty('FILTERS') && that.query.hasOwnProperty('FILTERS')) {
      for (var i = 0; i < that.query.FILTERS.length; i++) {
        this.query.FILTERS.push(that.query.FILTERS[i]);
      }
      return this;
    } else if (!this.query.hasOwnProperty('FILTERS') && that.query.hasOwnProperty('FILTERS')) {
      for (var j = 0; j < that.query.FILTERS.length; j++) {
        this.query.FILTERS = [];
        this.query.FILTERS.push(that.query.FILTERS[j]);
      }
      return this;
    }
  };

  
  /**
   * Reqests an item or a set of items from the query. Requires that
   * the Query object was initialized with a collection.
   * @method ClearBlade.Query.prototype.fetch
   * @param {function} callback Supplies processing for what to do with the data that is returned from the collection
   * @example <caption>The typical callback</caption>
   * var callback = function (err, data) {
   *     if (err) {
   *         //error handling
   *     } else {
   *         console.log(data);
   *     }
   * };
   * query.fetch(callback);
   * //this will give returnedData the value of what ever was returned from the server.
   */
  query.fetch = function (callback) {
    var reqOptions = {
      method: 'GET',
      qs: 'query=' + _this.parseQuery(this.query),
      URI: _this.URI,
      endpoint: this.endpoint,
      user: _this.user
    };

    var callCallback = function (err, data) {
      callback(err, data);
    };

    if (typeof callback === 'function') {
      _this.request(reqOptions, callCallback);
    } else {
      logger("No callback was defined!");
    }
  };

  /**
   * Updates an existing item or set of items. Requires that a collection was
   * set when the Query was initialized.
   * @method ClearBlade.Query.prototype.update
   * @param {Object} changes Object representing the attributes that you want changed
   * @param {function} callback Function that handles the response of the server
   * @example <caption>Updating a set of items</caption>
   * //This example assumes a collection of items that have the columns name and age.
   * var query = new ClearBlade.Query({'collection': 'COLLECTIONID'});
   * query.equalTo('name', 'John');
   * var changes = {
   *     age: 23
   * };
   * var callback = function (err, data) {
   *     if (err) {
   *         throw new Error (data);
   *     } else {
   *         console.log(data);
   *     }
   * };
   *
   * query.update(changes, callback);
   * //sets John's age to 23
   */
  query.update = function (changes, callback) {
    var reqOptions = {
      method: 'PUT',
      body: {query: this.query.FILTERS, $set: changes},
      URI: _this.URI,
      endpoint: this.endpoint,
      user: _this.user
    };

    var callCallback = function (err, data) {
      callback(err, data);
    };

    if (typeof callback === 'function') {
      _this.request(reqOptions, callCallback);
    } else {
      logger("No callback was defined!");
    }
  };

  /**
   * Removes an item or set of items from the Query
   * @method ClearBlade.Query.prototype.remove
   * @param {function} callback Function that handles the response from the server
   * @example <caption>Removing an item in a collection</caption>
   * //This example assumes that you have a collection with the item whose 'name' attribute is 'John'
   * var query = new ClearBlade.Query({'collection': 'COLLECTIONID'});
   * query.equalTo('name', 'John');
   * var callback = function (err, data) {
   *     if (err) {
   *         throw new Error (data);
   *     } else {
   *         console.log(data);
   *     }
   * };
   *
   * query.remove(callback);
   * //removes every item whose 'name' attribute is equal to 'John'
   */
  query.remove = function (callback) {
    var reqOptions = {
      method: 'DELETE',
      qs: 'query=' + _this.parseOperationQuery(this.query),
      URI: _this.URI,
      endpoint: this.endpoint,
      user: _this.user
    };

    var callCallback = function (err, data) {
      callback(err, data);
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callCallback);
    } else {
      logger("No callback was defined!");
    }
  };
 
  return query;
};

ClearBlade.prototype.Item = function (data, options) {
  var _this = this;
  var item = {};
  if (!(data instanceof Object)) {
    throw new Error("data must be of type Object");
  }

  if(options === undefined || options === null || options === "") {
    throw new Error("Must supply an options parameter");
  }
  if(typeof options === "string") {
    options = {collectionID: options};
  }
  item.data = data;

  item.save = function () {
    //do a put or a post to the database to save the item in the db
    var query = _this.Query(options);
    query.equalTo('item_id', this.data.item_id);
    var callback = function (err, data) {
      if (err) {
        throw new Error (data);
      } else {
        this.data = data[0].data;
      }
    };
    query.update(this.data, callback);
  };

  item.refresh = function () {
    //do a get to make the local item reflect the database
    var query = _this.Query(options);
    query.equalTo('item_id', this.data.item_id);
    var callback = function (err, data) {
      if (err) {
        throw new Error (data);
      } else {
        this.data = data[0].data;
      }
    };
    query.fetch(callback);
  };

  item.destroy = function () {
    //deletes the relative record in the DB then deletes the item locally
    var query = _this.Query(options);
    query.equalTo('item_id', this.data.item_id);
    var callback = function (err, data) {
      if (err) {
        throw new Error (data);
      } else {
        this.data = null;
        delete this.data;
      }
    };
    query.remove(callback);
    delete this;
  };
  
  return item;
};

ClearBlade.prototype.Code = function() {
  var _this = this;
  var code = {};

  code.user = this.user;
  code.URI = this.URI;
  code.systemKey = this.systemKey;
  code.systemSecret = this.systemSecret;
  code.callTimeout = this._callTimeout;
  code.URIPrefix = 'api/v/1/code/';

  code.execute = function(name, params, callback){
    var reqOptions = {
      method: 'POST',
      endpoint: this.URIPrefix + _this.systemKey + '/' + name,
      body: params,
      user: _this.user,
      URI: _this.URI
    };
    var codeCallback = function(err, body) {
      if(err) {
        callback(true, body);
      } else {
        //if the server told us that the service failed - i.e., syntax error
        if(body.success === false) {
          callback(true, body);
        } else {
          callback(false, body);
        }
      }
    }
    if (typeof callback === 'function') {
      _this.request(reqOptions, codeCallback);
    } else {
      throw new Error('Callback for execute is undefined or is not a function');
    }
  };

  return code;
}

ClearBlade.prototype.User = function() {
  var _this = this;
  var user = {};
  
  user.user = this.user;
  user.URI = this.URI;
  user.systemKey = this.systemKey;
  user.systemSecret = this.systemSecret;
  
  user.getUser = function(callback){
    var reqOptions = {
      method: 'GET',
      endpoint: 'api/v/1/user/info',
      URI: this.URI,
      systemSecret: this.systemSecret,
      systemKey: this.systemKey,
      user: this.user
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callback);
    } else {
      logger("No callback was defined!");
    }
  };

  user.setUser = function(data, callback){
    var reqOptions = {
      method: 'PUT',
      endpoint: 'api/v/1/user/info',
      body: data,
      URI: this.URI,
      systemSecret: this.systemSecret,
      systemKey: this.systemKey,
      user: this.user
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callback);
    } else {
      logger("No callback was defined!");
    }
  };


  user.allUsers = function(_query, callback) {
    var query;
    if (callback === undefined) {
      callback = _query;
      query = '';
    } else {
      query = 'query=' + _this.parseQuery(_query.query);
    }

    var reqOptions = {
      method: 'GET',
      endpoint: 'api/v/1/user',
      qs: query,
      URI: this.URI,
      user: this.user
    };
    if (typeof callback === 'function') {
      _this.request(reqOptions, callback);
    } else {
      logger('No callback was defined!');
    }
  };

  return user;
};

/**
 * Initializes the ClearBlade messaging object and connects to a server.
 * @class ClearBlade.Messaging
 * @param {Object} options  This value contains the config object for connecting. A number of reasonable defaults are set for the option if none are set.
 *<p>
 *The connect options and their defaults are:
 * <p>{number} [timeout] sets the timeout for the websocket connection in case of failure. The default is 60</p>
 * <p>{Messaging Message} [willMessage] A message sent on a specified topic when the client disconnects without sending a disconnect packet. The default is none.</p>
 * <p>{Number} [keepAliveInterval] The server disconnects if there is no activity for this pierod of time. The default is 60.</p>
 * <p>{object} [invocationContext] An object to wrap all the important variables needed for the onFalure and onSuccess functions. The default is empty.</p>
 * <p>{function} [onSuccess] A callback to operate on the result of a sucessful connect. In beta the default is just the invoking of the `callback` parameter with the data from the connection.</p>
 * <p>{function} [onFailure] A callback to operate on the result of an unsuccessful connect. In beta the default is just the invoking of the `callback` parameter with the data from the connection.</p>
 * <p>{Object} [hosts] An array of hosts to attempt to connect too. Sticks to the first one that works. The default is [ClearBlade.messagingURI].</p>
 * <p>{Object} [ports] An array of ports to try, it also sticks to thef first one that works. The default is [1337].</p>
 *</p>
 * @param {function} callback Callback to be run upon either succeessful or
 * failed connection
 * @example <caption> A standard connect</caption>
 * var callback = function (data) {
 *   console.log(data);
 * };
 * //A connect with a nonstandard timeout
 * var cb = new ClearBlade.Messaging({"timeout":15}, callback);
 */
ClearBlade.prototype.Messaging = function(options, callback){
  var _this = this;
  var messaging = {};

  messaging.user = this.user;
  messaging.URI = this.URI;
  messaging.systemKey = this.systemKey;
  messaging.systemSecret = this.systemSecret;
  
  //roll through the config
  var conf = {};
  conf.userName = this.user.authToken;
  conf.password = this.systemKey;
  conf.hosts = options.hosts || [this.messagingURI];
  conf.ports = options.ports || [this.messagingPort];
  if (options.qos !== undefined && options.qos !== null) {
    messaging._qos = options.qos;
  } else {
    messaging._qos = this.defaultQoS;
  }

  var onMessageArrived = function(message){
    // messageCallback from Subscribe()
    _this.messageCallback(message.payloadString);
  };

  var clientID = Math.floor(Math.random() * 10e12).toString();
  var url = "tcp://"+conf.userName+":"+conf.password+"@"+conf.hosts[0]+":"+conf.ports[0]+"?clientId="+clientID;
  messaging.client = mqtt.connect(url);

  var onSuccess = function(data) {
    callback(data);
  };

  messaging.client.on('connect', onSuccess);

  var onFailure = function(err) {
    console.log("ClearBlade Messaging failed to connect");
    callback(err);
  };
  messaging.client.on('error', onFailure);

  
  /**
   * Gets the message history from a ClearBlade Messaging topic.
   * @method ClearBlade.Messaging.getMessageHistory
   * @param {string} topic The topic from which to retrieve history
   * @param {number} startTime The time from which the history retrieval begins
   * @param {number} count The number of messages to retrieve
   * @param {function} callback The function to be called upon execution of query -- called with a boolean error and the response
   */
  messaging.getMessageHistory = function(topic, startTime, count, callback) {
    var reqOptions = {
      method: 'GET',
      endpoint: 'api/v/1/message/' + this.systemKey,
      qs: 'topic=' + topic + '&count=' + count + '&last=' + startTime,
      URI: this.URI,
      systemSecret: this.systemSecret,
      systemKey: this.systemKey,
      user: this.user
    };
    _this.request(reqOptions, function(err, response) {
      if (err) {
        _this.execute(true, response, callback);
      } else {
        _this.execute(false, response, callback);
      }
    });
  };

  
  /**
   * Publishes to a topic.
   * @method ClearBlade.Messaging.prototype.publish
   * @param {string} topic Is the topic path of the message to be published. This will be sent to all listeners on the topic. No default.
   * @param {string | ArrayBuffer} payload The payload to be sent. Also no default.
   * @example <caption> How to publish </caption>
   * var callback = function (data) {
   *   console.log(data);
   * };
   * var cb = ClearBlade.Messaging({}, callback);
   * cb.Publish("ClearBlade/is awesome!","Totally rules");
   * //Topics can include spaces and punctuation  except "/"
   */
  messaging.publish = function(topic, payload){
    this.client.publish(topic, payload);
  };

  /**
   * Subscribes to a topic
   * @method ClearBlade.Messaging.prototype.subscribe
   * @param {string} topic The topic to subscribe to. No default.
   * @param {Object} [options] The configuration object. Options:
   <p>{Number} [qos] The quality of service specified within MQTT. The default is 0, or fire and forget.</p>
   <p>{Number} [timeout] The time to wait for a response from the server acknowleging the subscription.</p>
   * @param {function} messageCallback Callback to invoke upon message arrival
   * @example <caption> How to publish </caption>
   * var callback = function (data) {
   *   console.log(data);
   * };
   * var cb = ClearBlade.Messaging({}, callback);
   * cb.Subscribe("ClearBlade/is awesome!",{});
   */
  messaging.subscribe = function (topic, options, messageCallback) {
    _.defaults(options, {qos: 0});
    this.client.subscribe(topic, options);
    this.client.on('message', function(topic, message) {
      if (message !== 'null') {
        messageCallback(message);
      }
    });
  };

  return messaging;
};



  /**
   * Sends a push notification
   * @method ClearBlade.sendPush
   * @param {Array} users The list of users to which the message will be sent
   * @param {Object} payload An object with the keys 'alert', 'badge', 'sound'
   * @param {string} appId A string with appId that identifies the app to send to
   * @param {function} callback A function like `function (err, data) {}` to handle the response
   */

ClearBlade.prototype.sendPush = function (users, payload, appId, callback) {
  if (!callback || typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  if (!Array.isArray(users)) {
    throw new Error('User list must be an array of user IDs');
  }
  var _this = this;
  var formattedObject = {};
  Object.getOwnPropertyNames(payload).forEach(function(key, element) {
    if (key === "alert" || key === "badge" || key === "sound") {
      if (!formattedObject.hasOwnProperty('aps')) {
  formattedObject.aps = {};
      }
      formattedObject.aps[key] = payload[key];
    }
  });
  var body = {
    cbids: users,
    "apple-message": formattedObject,
    appid: appId
  };
  var reqOptions = {
    method: 'POST',
    endpoint: 'api/v/1/push/' + this.systemKey,
    body: body,
    user: this.user
  };
  this.request(reqOptions, function(err, body, response) {
    if (err) {
      _this.execute(true, body, callback);
    } else {
      if (response.statusCode === 202 && Array.isArray(body) && body.length === 0) {
        _this.execute(false, body, callback);
      } else {
        _this.execute(true, body, callback);
      }
    }
  });
};

module.exports = new ClearBlade();
