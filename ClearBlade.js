var requestLib = require('request'),
    _ = require('lodash'),
    mqtt = require('mqtt'),
    winston = require('winston');

winston.add(winston.transports.File, { filename: 'cblog.log' });

(function(root) {
  root.ClearBlade = root.ClearBlade || {};
}(this));

(function(root) {
  root.ClearBlade = root.ClearBlade || {};
  var ClearBlade = root.ClearBlade;

  ClearBlade.logger = function (message) {
    if (ClearBlade.logging) {
      console.log(message);
    }
    return;
  };

  ClearBlade.request = function(options, callback) {
    if (!options || typeof options !== 'object')
      throw new Error("Request: options is not an object or is empty");

    var requestOptions = {headers: {}};
    var self = this;
    requestOptions.method = options.method || 'GET';
    requestOptions.url = options.URI || ClearBlade.URI;
    requestOptions.body = options.body || {};
    var qs = options.qs || '';
    var useUser = options.useUser || true;
    var authToken = useUser && options.authToken;
    if (useUser && !authToken && this.user && this.user.authToken) {
      authToken = this.user.authToken;
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
      requestOptions.headers["ClearBlade-SystemKey"] = ClearBlade.systemKey;
      requestOptions.headers["ClearBlade-SystemSecret"] = ClearBlade.systemSecret;
    }

    if (!ClearBlade.isObjectEmpty(requestOptions.body) || params) {

      if (requestOptions.method === "POST" || requestOptions.method === "PUT") {
        // Content-Type is expected for POST and PUT; bad things can happen if you don't specify this.
        requestOptions.headers["Content-Type"] = "application/json";
      }

      requestOptions.headers["Accept"] = "application/json";
    }
    requestOptions.body = JSON.stringify(requestOptions.body);

    requestLib(requestOptions, function(error, response, body) {
      if (!error && response.statusCode == 200 && body) {
        try {
          body = JSON.parse(body);
        } catch (e) {
          callback(e, body);
          return;
        }
        callback(error, body);
      } else if (error || response.statusCode != 200) {
        callback(true, body);
      } else {
        callback(true, body);
      }
    });

  };

  ClearBlade.isObjectEmpty = function (object) {
    /*jshint forin:false */
    if (typeof object !== 'object') {
      return true;
    }
    for (var keys in object) {
      return false;
    }
    return true;
  };

  ClearBlade.validateEmailPassword = function(email, password) {
    if (email == null || email == undefined || typeof email != 'string') {
      throw new Error("Email must be given and must be a string");
    }
    if (password == null || password == undefined || typeof password != 'string') {
      throw new Error("Password must be given and must be a string");
    }
  };

  ClearBlade.execute = function (error, response, callback) {
    if (typeof callback === 'function') {
      callback(error, response);
    } else {
      ClearBlade.logger("Did you forget to supply a valid Callback!");
    }
  };

  /**
    * This method initializes the ClearBlade module with the values needed to connect to the platform
    * @method ClearBlade.init
    * @param options {Object} the `options` Object
    */
  ClearBlade.init = function(options) {
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

    ClearBlade.systemKey = options.systemKey;
    ClearBlade.systemSecret = options.systemSecret;
    ClearBlade.URI = options.URI || "https://platform.clearblade.com";
    ClearBlade.messagingURI = options.messagingURI || "messaging.clearblade.com";
    ClearBlade.messagingPort = options.messagingPort || 1883;
    ClearBlade.logging = options.logging || false;

    ClearBlade.defaultQoS = options.defaultQoS || 0;
    ClearBlade._callTimeout =  options.callTimeout || 30000; //default to 30 seconds

    ClearBlade.user = null;

    if (options.useUser) {
      ClearBlade.user = options.useUser;
    } else if (options.registerUser) {
      ClearBlade.registerUser(options.email, options.password, function(err, response) {
        if (err) {
          ClearBlade.execute(err, response, options.callback);
        } else {
          ClearBlade.loginUser(options.email, options.password, function(err, user) {
            ClearBlade.execute(err, user, options.callback);
          });
        }
      });
    } else if (options.email) {
      ClearBlade.loginUser(options.email, options.password, function(err, user) {
        ClearBlade.execute(err, user, options.callback);
      });
    } else {
      ClearBlade.loginAnon(function(err, user) {
        ClearBlade.execute(err, user, options.callback);
      });
    }
  };

  ClearBlade.loginAnon = function(callback) {
    ClearBlade.request({
      method: 'POST',
      useUser: false,
      endpoint: 'api/v/1/user/anon'
    }, function(err, response) {
      if (err) {
        ClearBlade.execute(true, response, callback);
      } else {
        ClearBlade.setUser(null, response.user_token);
        ClearBlade.execute(false, ClearBlade.user, callback);
      }
    });
  };

  ClearBlade.registerUser = function(email, password, callback) {
    ClearBlade.validateEmailPassword(email, password);
    ClearBlade.request({
      method: 'POST',
      endpoint: 'api/v/1/user/reg',
      useUser: false,
      body: { "email": email, "password": password }
    }, function (err, response) {
      if (err) {
        ClearBlade.execute(true, response, callback);
      } else {
        ClearBlade.execute(false, "User successfully registered", callback);
      }
    });
  };

  ClearBlade.isCurrentUserAuthenticated = function(callback) {
    ClearBlade.request({
      method: 'POST',
      endpoint: 'api/v/1/user/checkauth'
    }, function (err, response) {
      if (err) {
        ClearBlade.execute(true, response, callback);
      } else {
        ClearBlade.execute(false, response.is_authenticated, callback);
      }
    });
  };

  ClearBlade.loginUser = function(email, password, callback) {
    ClearBlade.validateEmailPassword(email, password);
    ClearBlade.request({
      method: 'POST',
      useUser: false,
      endpoint: 'api/v/1/user/auth',
      body: { "email": email, "password": password }
    }, function (err, response) {
      if (err) {
        ClearBlade.execute(true, response, callback);
      } else {
        try {
          ClearBlade.setUser(email, response.user_token);
          ClearBlade.execute(false, ClearBlade.user, callback);
        } catch(e) {
          ClearBlade.execute(true, e, callback);
        }
      }
    });
  };

  ClearBlade.logoutUser = function(callback) {
    ClearBlade.request({
      method: 'POST',
      endpoint: 'api/v/1/user/logout'
    }, function(err, response) {
      if (err) {
        ClearBlade.execute(true, response, callback);
      } else {
        ClearBlade.execute(false, "User Logged out", callback);
      }
    });
  };

  ClearBlade.setUser = function(email, authToken) {
    ClearBlade.user = {
      email: email,
      authToken: authToken
    };
  };

  /**
    * Creates a new Collection that represents the server-side collection with the specified collection ID
    * @class ClearBlade.Collection
    * @classdesc This class represents a server-side collection. It does not actully make a connection upon instantiation, but has all the methods necessary to do so. It also has all the methods necessary to do operations on the server-side collections.
    * @param {String} collectionID The string ID for the collection you want to represent.
    */
  ClearBlade.Collection = function(collectionID) {
    this.ID = collectionID;
  };

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
  ClearBlade.Collection.prototype.fetch = function (_query, callback) {
    var query;
    var self = this;
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
      query = 'query='+ ClearBlade.parseQuery(query);
    } else {
      query = 'query='+ ClearBlade.parseQuery(_query.query);
    }

    var reqOptions = {
      method: 'GET',
      endpoint: 'api/v/1/data/' + this.ID,
      qs: query
    };
    var colID = this.ID;
    var callCallback = function (err, data) {
      callback(err, data);
    };
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callCallback);
    } else {
      ClearBlade.logger("No callback was defined!");
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
  ClearBlade.Collection.prototype.create = function (newItem, callback) {
    var reqOptions = {
      method: 'POST',
      endpoint: 'api/v/1/data/' + this.ID,
      body: newItem
    };
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callback);
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
  ClearBlade.Collection.prototype.update = function (_query, changes, callback) {
    var reqOptions = {
      method: 'PUT',
      endpoint: 'api/v/1/data/' + this.ID,
      body: {query: _query.query.FILTERS, $set: changes}
    };
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callback);
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
  ClearBlade.Collection.prototype.remove = function (_query, callback) {
    var query;
    if (_query === undefined) {
      throw new Error("no query defined!");
    } else {
      query = 'query=' + ClearBlade.parseOperationQuery(_query);
    }

    var reqOptions = {
      method: 'DELETE',
      endpoint: 'api/v/1/data/' + this.ID,
      qs: query
    };
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callback);
    } else {
      ClearBlade.logger("No callback was defined!");
    }
  };

  ClearBlade.makeKVPair = function (key, value) {
    var KVPair = {};
    KVPair[key] = value;
    return KVPair;
  };

  ClearBlade.addToQuery = function(queryObj, key, value) {
    queryObj.query[key] = value;
  };

  ClearBlade.addFilterToQuery = function (queryObj, condition, key, value) {
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

  ClearBlade.addSortToQuery = function(queryObj, direction, column) {
    if (typeof queryObj.query.SORT === 'undefined') {
      queryObj.query.SORT = [];
    }
    queryObj.query.SORT.push(ClearBlade.makeKVPair(direction, column));
  };

  ClearBlade.parseOperationQuery = function(_query) {
    return encodeURIComponent(JSON.stringify(_query.FILTERS));
  };

  ClearBlade.parseQuery = function(_query) {
    var parsed = encodeURIComponent(JSON.stringify(_query));
    return parsed;
  };

  /**
   * creates a Query object that can be used in Collection methods or on its own to operate on items on the server
   * @class ClearBlade.Query
   * @param {Object} options Object that has configuration values used when instantiating a Query object
   */
  ClearBlade.Query = function (options) {
    if (!options) {
      options = {};
    }
    if (options.collection !== undefined || options.collection !== "") {
      this.collection = options.collection;
    }
    this.query = {};
    this.OR = [];
    this.OR.push([this.query]);
    this.offset = options.offset || 0;
    this.limit = options.limit || 10;
  };

  ClearBlade.Query.prototype.ascending = function (field) {
    ClearBlade.addSortToQuery(this, "ASC", field);
    return this;
  };

  ClearBlade.Query.prototype.descending = function (field) {
    ClearBlade.addSortToQuery(this, "DESC", field);
    return this;
  };

  /**
   * Creates an equality clause in the query object
   * @method ClearBlade.Query.prototype.equalTo
   * @param {String} field String defining what attribute to compare
   * @param {String} value String or Number that is used to compare against
   * @example <caption>Adding an equality clause to a query</caption>
   * var query = new ClearBlade.Query();
   * query.equalTo('name', 'John');
   * //will only match if an item has an attribute 'name' that is equal to 'John'
   */
  ClearBlade.Query.prototype.equalTo = function (field, value) {
    ClearBlade.addFilterToQuery(this, "EQ", field, value);
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
  ClearBlade.Query.prototype.greaterThan = function (field, value) {
    ClearBlade.addFilterToQuery(this, "GT", field, value);
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
  ClearBlade.Query.prototype.greaterThanEqualTo = function (field, value) {
    ClearBlade.addFilterToQuery(this, "GTE", field, value);
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
  ClearBlade.Query.prototype.lessThan = function (field, value) {
    ClearBlade.addFilterToQuery(this, "LT", field, value);
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
  ClearBlade.Query.prototype.lessThanEqualTo = function (field, value) {
    ClearBlade.addFilterToQuery(this, "LTE", field, value);
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
  ClearBlade.Query.prototype.notEqualTo = function (field, value) {
    ClearBlade.addFilterToQuery(this, "NEQ", field, value);
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
  ClearBlade.Query.prototype.or = function (that) {
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
    * Set the pagination options for a Query.
    * @method ClearBlade.Query.setPage
    * @param {int} pageSize Number of items per response page. The default is
    * 100.
    * @param {int} pageNum  Page number, taking into account the page size. The
    * default is 1.
    */
  ClearBlade.Query.prototype.setPage = function (pageSize, pageNum) {
    ClearBlade.addToQuery(this, "PAGESIZE", pageSize);
    ClearBlade.addToQuery(this, "PAGENUM", pageNum);
    return this;
  };

  ClearBlade.Query.prototype.execute = function (method, callback) {
    var reqOptions = {
      method: method
    };
    switch(method) {
      case "GET":
        reqOptions.qs = 'query=' + ClearBlade.parseQuery(this.query);
        break;
      case "PUT":
        reqOptions.body = this.query; // TODO: confirm
        break;
      case "DELETE":
        reqOptions.qs = 'query=' + ClearBlade.parseOperationQuery(this.query);
        break;
      default:
        throw new Error("The method " + method + " does not exist");
    }
    if (this.collection === undefined || this.collection === "") {
      throw new Error("No collection was defined");
    } else {
      reqOptions.endpoint = "api/v/1/data/" + this.collection;
    }
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callback);
    } else {
      ClearBlade.logger("No callback was defined!");
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
  ClearBlade.Query.prototype.fetch = function (callback) {
    var reqOptions = {
      method: 'GET',
      qs: 'query=' + ClearBlade.parseQuery(this.query)
    };

    if (this.collection === undefined || this.collection === "") {
      throw new Error("No collection was defined");
    } else {
      reqOptions.endpoint = "api/v/1/data/" + this.collection;
    }
    var colID = this.collection;
    var callCallback = function (err, data) {
      callback(err, data);
    };

    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callCallback);
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
  ClearBlade.Query.prototype.update = function (changes, callback) {
    var reqOptions = {
      method: 'PUT',
      body: {query: this.query.FILTERS, $set: changes}
    };

    var colID = this.collection;
    var callCallback = function (err, data) {
      if (err) {
        callback(err, data);
      } else {
        var itemArray = [];
        for (var i = 0; i < data.length; i++) {
          var newItem = new ClearBlade.Item(data[i], colID);
          itemArray.push(newItem);
        }
        callback(err, itemArray);
      }
    };

    if (this.collection === undefined || this.collection === "") {
      throw new Error("No collection was defined");
    } else {
      reqOptions.endpoint = "api/v/1/data/" + this.collection;
    }
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callCallback);
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
  ClearBlade.Query.prototype.remove = function (callback) {
    var reqOptions = {
      method: 'DELETE',
      qs: 'query=' + ClearBlade.parseOperationQuery(this.query)
    };

    var colID = this.collection;
    var callCallback = function (err, data) {
      if (err) {
        callback(err, data);
      } else {
        var itemArray = [];
        for (var i in data) {
          var newItem = new ClearBlade.Item(data[i], colID);
          itemArray.push(newItem);
        }
        callback(err, itemArray);
      }
    };

    if (this.collection == undefined || this.collection == "") {
      throw new Error("No collection was defined");
    } else {
      reqOptions.endpoint = "api/v/1/data/" + this.collection;
    }
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callCallback);
    } else {
      logger("No callback was defined!");
    }

  };

  ClearBlade.Item = function (data, collection) {
    if (!(data instanceof Object)) {
      throw new Error("data must be of type Object");
    }
    if ((typeof collection !== 'string') || (collection === "")) {
      throw new Error("You have to give a collection ID");
    }
    this.collection = collection;
    this.data = data;
  };

  // WARNING: DOES NOT WORK WITH CONNECTION-BASED COLLECTIONS
  ClearBlade.Item.prototype.save = function () {
    //do a put or a post to the database to save the item in the db
    var self = this;
    var query = new ClearBlade.Query({collection: this.collection});
    query.equalTo('item_id', this.data.item_id);
    var callback = function (err, data) {
      if (err) {
        throw new Error (data);
      } else {
        self.data = data[0].data;
      }
    };
    query.update(this.data, callback);
  };

  // WARNING: DOES NOT WORK WITH CONNECTION-BASED COLLECTIONS
  ClearBlade.Item.prototype.refresh = function () {
    //do a get to make the local item reflect the database
    var self = this;
    var query = new ClearBlade.Query({collection: this.collection});
    query.equalTo('item_id', this.data.item_id);
    var callback = function (err, data) {
      if (err) {
        throw new Error (data);
      } else {
        self.data = data[0].data;
      }
    };
    query.fetch(callback);
  };

  // WARNING: DOES NOT WORK WITH CONNECTION-BASED COLLECTIONS
  ClearBlade.Item.prototype.destroy = function () {
    //deletes the relative record in the DB then deletes the item locally
    var self = this;
    var query = new ClearBlade.Query({collection: this.collection});
    query.equalTo('item_id', this.data.item_id);
    var callback = function (err, data) {
      if (err) {
        throw new Error (data);
      } else {
        self.data = null;
        self.collection = null;
        delete self.data;
        delete self.collection;
      }
    };
    query.remove(callback);
    delete this;
  };

  ClearBlade.User = function(){};
  ClearBlade.User.getUser = function(callback){
    var reqOptions = {
      method: 'GET',
      endpoint: 'api/v/1/user/info'
    };
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callCallback);
    } else {
      logger("No callback was defined!");
    }
  };
  
  ClearBlade.User.setUser = function(data, callback){
    var reqOptions = {
      method: 'PUT',
      endpoint: 'api/v/1/user/info',
      body: data
    };
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callCallback);
    } else {
      logger("No callback was defined!");
    }
  };

  ClearBlade.User.allUsers = function(_query, callback) {
    var query;
    if (callback === undefined) {
      callback = _query;
      query = '';
    } else {
      query = 'query=' + ClearBlade.parseQuery(_query.query);
    }

    var reqOptions = {
      method: 'GET',
      endpoint: 'api/v/1/user',
      qs: query
    };
    var callCallback = function(err, data) {
      callback(err, data);
    };
    if (typeof callback === 'function') {
      ClearBlade.request(reqOptions, callCallback);
    } else {
      logger('No callback was defined!');
    }
  };

}(this));

(function(root) {
  root.ClearBlade = root.ClearBlade || {};
  var ClearBlade = root.ClearBlade;

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
  ClearBlade.Messaging = function(options, callback){
    var that = this;
    //roll through the config
    var conf = {};
    conf.userName = ClearBlade.user.authToken;
    conf.password = ClearBlade.systemKey;
    conf.hosts = options.hosts || [ClearBlade.messagingURI];
    conf.ports = options.ports || [ClearBlade.messagingPort];
    if (options.qos !== undefined && options.qos !== null) {
      this._qos = options.qos;
    } else {
      this._qos = ClearBlade.defaultQoS;
    }

    var onMessageArrived = function(message){
      // messageCallback from Subscribe()
      that.messageCallback(message.payloadString);
    };

    var clientID = Math.floor(Math.random() * 10e12).toString();
    var url = "tcp://"+conf.userName+":"+conf.password+"@"+conf.hosts[0]+":"+conf.ports[0]+"?clientId="+clientID;
    this.client = mqtt.connect(url);

    var onSuccess = function(data) {
      callback(data);
    };

    this.client.on('connect', onSuccess);

    var onFailure = function(err) {
      console.log("ClearBlade Messaging failed to connect");
      callback(err);
    };
    this.client.on('error', onFailure);
  };

  /**
   * Gets the message history from a ClearBlade Messaging topic.
   * @method ClearBlade.Messaging.getMessageHistory
   * @param {string} topic The topic from which to retrieve history
   * @param {number} startTime The time from which the history retrieval begins
   * @param {number} count The number of messages to retrieve
   * @param {function} callback The function to be called upon execution of query -- called with a boolean error and the response
   */
  ClearBlade.Messaging.getMessageHistory = function(topic, startTime, count, callback) {
    var reqOptions = {
      method: 'GET',
      endpoint: 'api/v/1/message/' + ClearBlade.systemKey,
      qs: 'topic=' + topic + '&count=' + count + '&last=' + startTime
    };
    ClearBlade.request(reqOptions, function(err, response) {
      if (err) {
        ClearBlade.execute(true, response, callback);
      } else {
        ClearBlade.execute(false, response, callback);
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

  ClearBlade.Messaging.prototype.publish = function(topic, payload){
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
  ClearBlade.Messaging.prototype.subscribe = function (topic, options, messageCallback) {
    _.defaults(options, {qos: 0});
    this.client.subscribe(topic, options);
    this.client.on('message', function(topic, message) {
      console.log('Topic: ' + topic + ' Message: ' + message);
      if (message !== 'null') {
        messageCallback(message);
      }
    });
  };

}(this));
