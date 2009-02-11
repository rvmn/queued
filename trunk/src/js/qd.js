/*
	Copyright (c) 2004-2009, The Dojo Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/

/*
	This is a compiled version of Dojo, built for deployment and not for
	development. To get an editable version, please visit:

		http://dojotoolkit.org

	for documentation and information on getting the source.
*/

/*
	Copyright (c) 2004-2009, The Dojo Foundation All Rights Reserved.
	Available via Academic Free License >= 2.1 OR the modified BSD license.
	see: http://dojotoolkit.org/license for details
*/

/*
	This is a compiled version of Dojo, built for deployment and not for
	development. To get an editable version, please visit:

		http://dojotoolkit.org

	for documentation and information on getting the source.
*/

if(!dojo._hasResource["qd.services.util"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.util"] = true;
dojo.provide("qd.services.util");

(function(){
	var reHexEntity=/&#x([^;]+);/g,
		reDecEntity=/&#([^;]+);/g;

	dojo.mixin(qd.services.util, {
		prepare: function(args, d){
			var dfd = d || new dojo.Deferred();
			if(args.result){
				dfd.addCallback(function(data, ioArgs){
					args.result.call(args, data, ioArgs);
				});
			}
			if(args.error){
				dfd.addErrback(function(evt, ioArgs){
					args.error.call(args, evt, ioArgs);
				});
			}
			return dfd;
		},
		mixin: function(dest, override){
			// Custom mixin function to stamp the properties from override
			// onto dest without clobbering member objects as you would in
			// a shallow copy like dojo.mixin does; this isn't particularly
			// robust or fast, but it works for our movie objects.
			//
			// The basic property handling rules are:
			// 	- null doesn't overwrite anything, ever
			// 	- scalars get overwritten by anything, including new scalars
			// 	- arrays get overwritten by longer arrays or by objects
			// 	- objects get merged by recursively calling mixin()
			for(k in override){
				if(override[k] === null || override[k] === undefined){ continue; }
				if(dojo.isArray(override[k])){
					if(dojo.isArray(dest[k])){ // the longest array wins!
						if(override[k].length > dest[k].length){
							dest[k] = override[k].slice(0);	//	make a copy of the override.
						}
					} else {
						if(!dojo.isObject(dest[k])){
							dest[k] = override[k].slice(0);
						}
					}
				}
				else if(dojo.isObject(override[k])){
					if(dest[k] !== null && dojo.isObject(dest[k])){
						dest[k] = qd.services.util.mixin(dest[k], override[k]);
					}else{
						dest[k] = qd.services.util.mixin({}, override[k]);
					}
				}
				else{
					if(dest[k] === null || (!dojo.isArray(dest[k]) && !dojo.isObject(dest[k]))){
						dest[k] = override[k];
					}
				}
			}
			return dest;
		},
		clean: function(str){
			return str.replace(reHexEntity, function(){
					return String.fromCharCode(parseInt(arguments[1],16));
				})
				.replace(reDecEntity, function(){
					return String.fromCharCode(parseInt(arguments[1],10));
				})
				.replace(/\&quot\;/g, '"')
				.replace(/\&apos\;/g, "'")
				.replace(/\&amp\;/g, "&")
				.replace(/<[^>]*>/g, "");
		},
		image: {
			url: function(url){
				//	summary:
				//		Return the best url for the image.
				//	url: String
				//		The Netflix URL to check against the local cache.
				var file = air.File.applicationStorageDirectory.resolvePath(url.replace("http://", ""));
				if(file.exists){
					return file.url;
				}
				return url;
			},
			store: function(/* String */url){
				//	summary:
				//		Return the best url for the image.
				//	url: String
				//		The Netflix URL to store to the local cache.
				var l = new air.URLLoader(), u = new air.URLRequest(url);
				var dfd = new dojo.Deferred();
				l.dataFormat = air.URLLoaderDataFormat.BINARY;

				//	save the data once it has completed loading.
				l.addEventListener(air.Event.COMPLETE, function(evt){
					//	make sure the cache directory is created
					var tmpUrl = url.replace("http://", "");
					var file = air.File.applicationStorageDirectory.resolvePath(tmpUrl);

					//	this branch shouldn't happen but just in case...
					if(file.exists){
						file.deleteFile();
					}

					//	open up the file object for writing.
					var fs = new air.FileStream();
					fs.open(file, air.FileMode.WRITE);
					fs.writeBytes(l.data, 0, l.data.length);
					fs.close();

					//	fire the callback
					dfd.callback(file.url, url);
				});

				//	do something about an error
				l.addEventListener(air.IOErrorEvent.IO_ERROR, function(evt){
					dfd.errback(url, evt);
				});

				//	just in case a security error is thrown.
				l.addEventListener(air.SecurityErrorEvent.SECURITY_ERROR, function(evt){
					dfd.errback(url, evt);
				});

				//	load the URL.
				l.load(u);
				return dfd;
			}
		}
	});
})();

}

if(!dojo._hasResource["qd.services.storage"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.storage"] = true;
dojo.provide("qd.services.storage");

/*	qd.services.storage
 *
 *	A wrapper utility around AIR's EncryptedLocalStorage,
 *	designed specifically for Queued's needs.
 */

(function(){
	var els = air.EncryptedLocalStore,
		ba = air.ByteArray;

	qd.services.storage = new (function(useCompression){
		var compress = useCompression || false;

		//	basic common functionality
		this.item = function(/* String */key, /* Object? */value){
			//	summary:
			//		Provide a dojo-like interface for getting and
			//		setting items in the Store.
			if(key === null || key === undefined || !key.length){
				throw new Error("qd.services.storage.item: you cannot pass an undefined or empty string as a key.");
			}

			if(value !== undefined){
				//	setter branch
				var stream = new ba();
				stream.writeUTFBytes(dojo.toJson(value));
				if(compress){
					stream.compress();
				}

				els.setItem(key, stream);
				return value;
			}

			//	getter branch
			var stream = els.getItem(key);
			if(!stream){
				return null;
			}

			if(compress){
				try {
					stream.uncompress();
				} catch(ex){
					//	odds are we have an uncompressed thing here, so simply kill it and return null.
					els.removeItem(key);
					return null;
				}
			}

			//	just in case, we make sure there's no "undefined" in the pulled JSON.
			var s = stream.readUTFBytes(stream.length).replace("undefined", "null");
			return dojo.fromJson(s);
		};

		this.remove = function(key){
			if(key === null || key === undefined || !key.length){
				throw new Error("qd.services.storage.remove: you cannot pass an undefined or empty string as a key.");
			}
			els.removeItem(key);
		};

		this.clear = function(){
			els.reset();
			this.onClear();
		};

		this.onClear = function(){
			//	summary:
			//		Stub function to run anything when the storage is cleared.
		};
	})();
 })();

}

if(!dojo._hasResource["qd.services.data"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.data"] = true;
dojo.provide("qd.services.data");

qd.services.data = new (function(){
	this._testKey = "h1dd3n!!11one1";
	this._testDb = "queued-test.db";	//	revert to queued.db
	var _key = this._testKey;
	this.database = this._testDb;

	var initFile = "js/updates/resources/initialize.sql",
		initialized = false;

	var syncConn = new air.SQLConnection(),
		asyncConn = new air.SQLConnection(),
		inCreation = false,
		self = this;

	//	Properties
	this.__defineGetter__("initialized", function(){
		return initialized;
	});

	//	these can't be getters, unfortunately.
	this.connection = function(/* Boolean? */async){
		return (async ? asyncConn : syncConn);
	};
	this.connected = function(/* Boolean? */async){
		return (async ? asyncConn.connected : syncConn.connected );
	};
	this.transacting = function(/* Boolean? */async){
		return (async ? asyncConn.inTransaction : syncConn.inTransaction );
	};
	this.lastId = function(/* Boolean? */async){
		return (async ? asyncConn.lastInsertRowID : syncConn.lastInsertRowID );
	};

	function eventSetup(/* air.SQLConnection */conn){
		//	set up all of our event handlers on the passed connection
		//	open the db, set up the connection handlers
		conn.addEventListener(air.SQLEvent.OPEN, self.onOpen);
		conn.addEventListener(air.SQLErrorEvent.ERROR, self.onError);
		conn.addEventListener(air.SQLEvent.CLOSE, self.onClose);
		conn.addEventListener(air.SQLEvent.ANALYZE, self.onAnalyze);
		conn.addEventListener(air.SQLEvent.DEANALYZE, self.onDeanalyze);
		conn.addEventListener(air.SQLEvent.COMPACT, self.onCompact);
		conn.addEventListener(air.SQLEvent.BEGIN, self.onBegin);
		conn.addEventListener(air.SQLEvent.COMMIT, self.onCommit);
		conn.addEventListener(air.SQLEvent.ROLLBACK, self.onRollback);
		conn.addEventListener(air.SQLEvent.CANCEL, self.onCancel);
		conn.addEventListener(air.SQLUpdateEvent.INSERT, self.onInsert);
		conn.addEventListener(air.SQLUpdateEvent.UPDATE, self.onUpdate);
		conn.addEventListener("delete", self.onDelete);
		return conn;
	}
	
	this.init = function(key, db, forceCreate){
		//	set up the key
		var k = key||this._testKey;
		if(typeof(k) == "string"){
			_key = new air.ByteArray();
			_key.writeUTFBytes(k);
			k = _key;
		}

		if(key){ this._testKey = key; }
		this.database = db || this.database;

		//	open the sync connection and test to see if it needs to run the create statements
		var sync = eventSetup(syncConn);
		sync.open(air.File.applicationStorageDirectory.resolvePath(this.database), "create", false, 1024, k);

		//	open the async connection
		var async = eventSetup(asyncConn);
		async.openAsync(air.File.applicationStorageDirectory.resolvePath(this.database), "create", null, false, 1024, k);

		if(!forceCreate){
			var s = new air.SQLStatement();
			s.sqlConnection = sync;
			//	latest change: remove integer ID from Title table.  If it exists, recreate.
			s.text = "SELECT json FROM Title LIMIT 1";
			try{
				s.execute();
			} catch(e){
				this.create({ connection: sync, file: this.initFile });
			}
		} else {
			this.create({ connection: sync, file: this.initFile });
		}
		this.onInitialize();

		//	attach to app.onExit
		var h = dojo.connect(qd.app, "onExit", function(evt){
			if(evt.isDefaultPrevented()){
				return;
			}
			dojo.disconnect(h);
			async.close();
			sync.close();
			air.trace("Database connections closed.");
		});
	};

	this.create = function(/* Object */kwArgs){
		//	summary:
		//		Create the database.
		console.warn("Creating the database...");
		inCreation = true;
		var file = kwArgs && kwArgs.file || initFile,
			conn = kwArgs && kwArgs.connection || syncConn;

		var f = air.File.applicationDirectory.resolvePath(file);
		if(f.exists){
			//	kill off the async connection first.
			asyncConn.close();
			asyncConn = null;

			var fs = new air.FileStream();
			fs.open(f, air.FileMode.READ);
			var txt = fs.readUTFBytes(fs.bytesAvailable);
			fs.close();

			var st = new Date();

			//	break it apart.
			txt = txt.replace(/\t/g, "");
			var c="", inMerge = false, test = txt.split(/\r\n|\r|\n/), a=[];
			for(var i=0; i<test.length; i++){
				if(inMerge){
					c += test[i];
					if(test[i].indexOf(")")>-1){
						a.push(c);
						c = "";
						inMerge = false;
					}
				} else {
					if(test[i].indexOf("(")>-1 && test[i].indexOf(")")==-1){
						inMerge = true;
						c += test[i];
					} else {
						a.push(test[i]);
					}
				}
			}
			
			//	use raw SQL statements here because of the need to preempt any
			//	statements that might have been called while creating.
			for(var i=0, l=a.length; i<l; i++){
				var item = dojo.trim(a[i]);
				if(!item.length || item.indexOf("--")>-1){ continue; }
				var s = new air.SQLStatement();
				s.text = item;
				s.sqlConnection = conn;
				s.execute();
			}

			//	profiling
			console.warn("db creation took " + (new Date().valueOf() - st.valueOf()) + "ms.");

			//	re-open the async connection.
			asyncConn = new air.SQLConnection();
			var async = eventSetup(asyncConn);
			async.openAsync(air.File.applicationStorageDirectory.resolvePath(this.database), "create", null, false, 1024, _key);

			//	fire off the onCreate event.
			this.onCreate();

			//	run an analysis on it
			//conn.analyze();
		}
	};

	/*=====
	 qd.services.data.fetch.__Args = function(sql, params, result, error){
		//	sql: String
		//		The SQL statement to be executed.
		//	params: Object|Array?
		//		Any parameters to be pushed into the SQL statement.  If an
		//		Array, expects the SQL statement to be using ?, if an object
		//		it expects the SQL statement to be using keywords, prepended
		//		with ":".
		//	result: Function?
		//		The callback to be executed when results are returned.
		//	error: Function?
		//		The callback to be executed when an error occurs.
		this.sql = sql;
		this.params = params;
		this.result = result;
		this.error = error;
	 }
	=====*/

	function prep(/* qd.services.data.fetch.__Args */kwArgs, /* air.SQLStatement */s, /* Boolean */async){
		//	summary:
		//		Prepare the SQL statement and return it.
		s.sqlConnection = kwArgs.connection || (async ? asyncConn : syncConn);
		s.text = kwArgs.sql;
		if(kwArgs.params && dojo.isArray(kwArgs.params)){
			//	allow the ordered list version
			for(var i=0, l=kwArgs.params.length; i<l; i++){
				s.parameters[i] = kwArgs.params[i];
			}
		} else {
			var params = kwArgs.params || {};
			for(var p in params){
				s.parameters[":" + p] = params[p];
			}
		}
		return s;	//	air.SQLStatement
	}

	var queue = [], createHandler;
	function exec(){
		var o = queue.shift();
		if(o){
			o.deferred.addCallback(exec);
			o.deferred.addErrback(exec);
			o.statement.execute();
		}
	}

	function query(/* qd.services.data.fetch.__Args */kwArgs, /* air.SQLStatement */s){
		//	summary:
		//		Inner function to communicate with the database.
		//	set up the deferred.
		var dfd = new dojo.Deferred();

		//	set up the event handlers.
		var onResult = function(evt){
			var result = s.getResult();
			dfd.callback(result);
		};
		var onError = function(evt){
			console.warn(evt);
			dfd.errback(evt); 
		}

		if(kwArgs.result){ 
			dfd.addCallback(function(result){
				kwArgs.result.call(kwArgs, result.data, result);
			});
		}
		if(kwArgs.error){
			dfd.addErrback(function(evt){
				kwArgs.error.call(kwArgs, evt);
			});
		}

		s.addEventListener(air.SQLEvent.RESULT, onResult);
		s.addEventListener(air.SQLErrorEvent.ERROR, onError);

		queue.push({
			statement: s,
			deferred: dfd
		});

		if(!inCreation){
			exec();
		} 
		else if(!createHandler){
			//	we only want this to start once, don't go adding a bunch more connections
			createHandler = dojo.connect(self, "onCreate", function(){
				dojo.disconnect(createHandler);
				createHandler = null;
				exec();
			});
		}
		return dfd;	//	dojo.Deferred
	}

	this.fetch = function(/* qd.services.data.fetch.__Args */kwArgs){
		//	summary:
		//		Fetch (i.e. read) data out of the database.  Can be used for write operations
		//		but is not recommended; use execute for write ops.
		if(!kwArgs.sql){
			console.log("qd.services.data.fetch: no SQL passed. " + dojo.toJson(kwArgs));
			return null;
		}

		//	fetch should use the sync connection unless an SQLConnection is passed with the kwArgs.
		var s = prep(kwArgs, new air.SQLStatement(), false),
			d = query(kwArgs, s);
		this.onFetch(kwArgs);
		return d;	//	dojo.Deferred
	};

	this.execute = function(/* qd.services.data.fetch.__Args */kwArgs){
		//	summary:
		//		Execute the passed SQL against the database.  Should be used
		//		for write operations (INSERT, REPLACE, DELETE, UPDATE).
		if(!kwArgs.sql){
			console.log("qd.services.data.execute: no SQL passed. " + dojo.toJson(kwArgs));
			return null;
		}

		//	execute should use the async connection unless an SQLConnection is passed with the kwArgs.
		var s = prep(kwArgs, new air.SQLStatement(), true),
			d = query(kwArgs, s);
		this.onExecute(kwArgs);
		return d;	//	dojo.Deferred
	};

	this.sql = function(/* String */sql){
		//	summary:
		//		Dev functionality to allow for arbitrary sql to be executed.
		//		FIXME: remove this before release!
		this.execute({
			sql: sql,
			result: function(data){
				console.log(data);
			},
			error: function(err){
				console.warn(err);
			}
		});
	};

	//	event stubs
	this.onError = function(evt){ };
	this.onOpen = function(evt){ };
	this.onClose = function(evt){ };

	//	analysis & maintenance
	this.onAnalyze = function(evt){ };
	this.onDeanalyze = function(evt){ };
	this.onCompact = function(evt){ };
	this.onInitialize = function(){ };
	this.onCreate = function(){ 
		inCreation = false;
	};

	//	adding other database files
	this.onAttach = function(evt){ };
	this.onDetach = function(evt){ };

	//	transactions
	this.onBegin = function(evt){ };
	this.onCommit = function(evt){ };
	this.onRollback = function(evt){ };

	//	SQL execution
	this.onFetch = function(kwArgs){ };
	this.onExecute = function(kwArgs){ };
	this.onCancel = function(evt){ };
	this.onInsert = function(evt){ };
	this.onUpdate = function(evt){ };
	this.onDelete = function(evt){ };
})();

}

if(!dojo._hasResource["qd.services.network"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.network"] = true;
dojo.provide("qd.services.network");

(function(){
	var monitor, monitorUrl="http://www.netflix.com";

	qd.services.network = new (function(){
		var self = this,
			pollInterval = 2500;
		var statusChange = function(e){
			self.onChange((monitor && monitor.available));
		};

		//	Properties
		this.__defineGetter__("isRunning", function(){
			//	summary:
			//		Return whether or not the monitor is running.
			return (monitor && monitor.running);	//	Boolean
		});

		this.__defineGetter__("lastPoll", function(){
			//	summary:
			//		Return the last time the monitor checked the network status.
			return (monitor && monitor.lastStatusUpdate);	//	Date
		});

		this.__defineGetter__("available", function(){
			//	summary:
			//		Return whether or not the network is available.
			return monitor && monitor.available;	//	Boolean
		});

		this.__defineSetter__("available", function(/* Boolean */b){
			//	summary:
			//		Explicitly set the network availability
			if(monitor){
				monitor.available = b;
			}
			return (monitor && monitor.available);	//	Boolean
		});

		//	FIXME: This is for DEV purposes only!
		this.offline = function(){
			monitor.stop();
			monitor.available = false;
		};
		this.online = function(){
			monitor.start();
		};

		this.initialized = false;

		//	Methods
		this.init = function(/* String? */url){
			//	summary:
			//		Initialize the network services by creating and starting the monitor.
			//	set up the offline monitor
			monitor = new air.URLMonitor(new air.URLRequest((url||monitorUrl))); 
			monitor.pollInterval = pollInterval;
			monitor.addEventListener(air.StatusEvent.STATUS, statusChange);
			self.initialized = true;
			self.onInitialize(monitor.urlRequest.url);
		};

		this.start = function(){
			//	summary:
			//		Start the monitor services.
			if(!monitor){
				self.init();
			}
			console.log("qd.services.network.start: monitor is running.");
			self.onStart();
			return monitor.start();
		};

		this.stop = function(){
			//	summary:
			//		Stop the monitor services.
			console.log("qd.services.network.stop: monitor is stopped.");
			self.onStop();
			return (monitor && monitor.stop());
		};

		//	Event stubs
		this.onInitialize = function(/* String */url){
			//	summary:
			//		Fires when the network services is initialized.
		};
		this.onStart = function(){
			//	summary:
			//		Fires when the network services is started.
		};
		this.onStop = function(){
			//	summary:
			//		Fires when the network services is stopped.
		};
		this.onChange = function(/* Boolean */isAvailable){
			//	summary:
			//		Stub event to connect to when the network status changes
			console.log("qd.services.network.onChange: current status is " + isAvailable);
		};
	})();
})();

}

if(!dojo._hasResource["qd.services.parser"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.parser"] = true;
dojo.provide("qd.services.parser");


(function(){
	//	generic XML parsing services for Queued.
	//	Can take most of the XML available from Netflix
	//	and return JSON objects from them.
	
	var util = qd.services.util;
	
	//	TITLES
	var baseTitle = {
		guid: null,
		rentalHistoryGuid: null,
		atHomeGuid: null,
		recommendationGuid: null,
		ratingGuid: null,
		type: null,
		title: null,
		art:{
			small: null,
			medium: null,
			large: null
		},
		releaseYear: null,
		runTime: null,
		rating: null,
		synopsis: null,
		ratings:{ average:null, predicted:null, user:null },
		categories: [],
		bonusMaterials: [],
		awards: {
			nominee:[],
			winner:[]
		},
		formats:{ },
		screenFormats: [],
		cast: [],
		directors: [],
		series: {},
		season: {},
		similars: [],
		audio: {},
		dates: {
			updated: null,
			availability: null
		},
		discs: [],
		episodes: [],
		fullDetail: false
	};
	
	//	Parse helpers.
	function parseAwards(nl){
		var ret = [];
		for(var i=0,l=nl.length; i<l; i++){
			var n = nl[i];
			var tmp = {
				year: n.getAttribute("year")
			};
			var c = n.childNodes;
			for(var j=0, jl=c.length; j<jl; j++){
				var cn = c[j];
				if(cn.nodeType==1){
					if(cn.tagName=="category"){
						tmp.scheme = cn.getAttribute("scheme");
						tmp.term = cn.getAttribute("term");
					}
					else if(cn.tagName=="link"){
						var guid = cn.getAttribute("href");
						tmp.person = {
							guid: guid,
							id: guid.substr(guid.lastIndexOf("/")+1),
							title: cn.getAttribute("title")
						};
					}
				}
			}
			ret.push(tmp);
		}
		return ret;
	}

	function parseFormats(nl){
		var ret = {};
		for(var i=0, l=nl.length; i<l; i++){
			var available = nl[i].getAttribute("available_from");
			var d = parseInt(available+"000", 10);
			var n = nl[i].getElementsByTagName("category")[0];
			if(n){
				ret[n.getAttribute("term")] = (available)?new Date(d):null;
			}
		}
		return ret;
	}

	function parseDate(/* String */tenDijitStr){
		// summary:
		//		XML helper.
		//	description:
		//		Converts netflix date string into a date object
		return dojo.date.locale.format(new Date(Number(tenDijitStr+"000")), {selector:"date", datePattern:"MM/dd/yy"}); // Date
	}

	function parseScreenFormats(nl){
		var ret = [];
		for(var i=0, l=nl.length; i<l; i++){
			var categories = nl[i].getElementsByTagName("category"),
				info = { title:"", screen:"" };
			for(var j=0, jl=categories.length; j<jl; j++){
				var c = categories[j];
				if(c.getAttribute("scheme").indexOf("title")>-1){
					info.title = c.getAttribute("term");
				} else {
					info.screen = c.getAttribute("term");
				}
			}
			ret.push(info);
		}
		return ret;
	}

	function parseLinks(nl){
		var ret = [];
		for(var i=0, l=nl.length; i<l; i++){
			var guid = nl[i].getAttribute("href");
			ret.push({
				guid: guid,
				title: nl[i].getAttribute("title")
			});
		}
		return ret;
	}

	function parseAudio(nl){
		//	this is ugly.
		var ret = {};
		for(var i=0, l=nl.length; i<l; i++){
			var node = nl[i], tfnode;
			for(var j=0; j<node.childNodes.length; j++){
				if(node.childNodes[j].nodeType != 1){ continue; }
				tfnode = node.childNodes[j];
				break;
			}

			var tf = tfnode.getAttribute("term");
			ret[tf]={ };
			for(var j=0; j<tfnode.childNodes.length; j++){
				if(tfnode.childNodes[j].nodeType != 1){ continue; }
				var lnode = tfnode.childNodes[j], 
					tmp = [], 
					lang = tfnode.childNodes[j].getAttribute("term");

				for(var k=0; k<lnode.childNodes.length; k++){
					if(lnode.childNodes[k].nodeType != 1){ continue; }
					tmp.push(lnode.childNodes[k].getAttribute("term"));
				}
				ret[tf][lang] = tmp;
			}
		}
		return ret;
	}
	
	// public functions
	var p = qd.services.parser;
	p.titles = {
		fromRss: function(/* XmlNode */node, /* Object? */obj){
			//	summary:
			//		Parse basic movie information from the passed RSS element.
			var o = dojo.clone(baseTitle);
			for(var i=0, l=node.childNodes.length; i<l; i++){
				var n=node.childNodes[i];
				if(n.nodeType != 1){ continue; }	//	ignore non-elements
				switch(n.tagName){
					case "title":
						var pieces = dojo.trim(n.textContent).match(/^\d+-\s(.*)$/);
						o.title = pieces ? pieces[1]: dojo.trim(n.textContent);
						break;
					case "guid":
						/*
						//	TODO: TV series/seasons detection.
						var guid = dojo.trim(n.textContent);
						//	swap out their ID for the real one.
						o.id = guid.substr(guid.lastIndexOf("/")+1);
						o.guid = "http://api.netflix.com/catalog/titles/movies/" + o.id;
						*/
						break;
					case "description":
						var pieces = dojo.trim(n.textContent).match(/<img src="([^"]+)".*<br>([^$]*)/);
						if(pieces){
							o.art.small = pieces[1].replace("/small/", "/tiny/");
							o.art.medium = pieces[1];
							o.art.large = pieces[1].replace("/small/", "/large/");
							o.synopsis = util.clean(pieces[2]);
						}
						break;
				}
			}
			if(obj){
				o = util.mixin(obj, o);
			}
			return o;	//	Object
		},
		fromXml: function(/* XmlNode */node, /* Object?*/obj){
			//	summary:
			//		Parse the returned title information from the passed XmlNode.
			var o = dojo.clone(baseTitle);

			var links = node.ownerDocument.evaluate("./link", node),
				info = node.ownerDocument.evaluate("./*[name()!='link']", node),
				currentNode;
			
			//	TODO: pull the queue info out of the resulting object!
			//	fill out the info first.
			while(currentNode = info.iterateNext()){
				switch(currentNode.tagName){
					case "id":
						//	need to fork this a little because of "other" ids that are
						//	possibly passed by Netflix.
						var test = currentNode.parentNode.tagName,
							value = dojo.trim(currentNode.textContent);
						if(test == "ratings_item"){
							o.ratingGuid = value;
						}
					   	else if(test == "rental_history_item"){
							o.rentalHistoryGuid = value;
						}
						else if(test == "at_home_item"){
							o.atHomeGuid = value;
						}
						else if(test == "recommendation"){
							o.recommendationGuid = value;
						}
						else {
							o.guid = value;
						}
						break;
					case "title":
						o.title = currentNode.getAttribute("regular");
						break;
					case "box_art":
						o.art = {
							small: currentNode.getAttribute("small"),
							medium: currentNode.getAttribute("medium"),
							large: currentNode.getAttribute("large")
						};
						break;
					case "release_year":
						o.releaseYear = dojo.trim(currentNode.textContent);
						break;
					case "runtime":
						o.runTime = parseInt(dojo.trim(currentNode.textContent), 10)/60;
						break;
					case "category":
						var scheme = currentNode.getAttribute("scheme");
						scheme = scheme.substr(scheme.lastIndexOf("/")+1);
						if(scheme == "mpaa_ratings" || scheme == "tv_ratings"){
							o.rating = currentNode.getAttribute("term");
						}
						else if (scheme == "genres"){
							o.categories.push(currentNode.getAttribute("term"));
						}
						/*
						else if (scheme == "queue_availability"){
							o.queue_availability = currentNode.getAttribute("term");
						}
						*/
						break;
					case "user_rating":
						var val = currentNode.getAttribute("value");
						if(val == "not_interested"){
							o.ratings.user = val;
						}else{
							o.ratings.user = parseFloat(dojo.trim(currentNode.textContent), 10);
						}
						break;
					case "predicted_rating":
						o.ratings.predicted = parseFloat(dojo.trim(currentNode.textContent), 10);
						break;
					case "average_rating":
						o.ratings.average = parseFloat(dojo.trim(currentNode.textContent), 10);
						break;
					case "availability_date":
						o.dates.availability = parseDate(currentNode.textContent);
						break;
					case "updated":
						o.dates.updated = parseDate(currentNode.textContent);
						break;
				}
			}

			//	do the links now.
			while(currentNode = links.iterateNext()){
				var type = currentNode.getAttribute("title"),
					rel = currentNode.getAttribute("rel");
				switch(rel){
					case "http://schemas.netflix.com/catalog/titles/synopsis":
						o.synopsis = util.clean(dojo.trim(currentNode.textContent));
						break;
					case "http://schemas.netflix.com/catalog/titles/awards":
						o.awards.nominee=parseAwards(currentNode.getElementsByTagName("award_nominee"));
						o.awards.winner=parseAwards(currentNode.getElementsByTagName("award_winner"));
						break;
					case "http://schemas.netflix.com/catalog/titles/format_availability":
						var nodes = currentNode.getElementsByTagName("availability");
						if(nodes && nodes.length){
							o.formats = parseFormats(nodes);
						} 
						break;
					case "http://schemas.netflix.com/catalog/titles/screen_formats":
						o.screenFormats = parseScreenFormats(currentNode.getElementsByTagName("screen_format"));
						break;
					case "http://schemas.netflix.com/catalog/people.cast":
						o.cast = parseLinks(currentNode.getElementsByTagName("link"));
						break;
					case "http://schemas.netflix.com/catalog/people.directors":
						o.directors = parseLinks(currentNode.getElementsByTagName("link"));
						break;
					case "http://schemas.netflix.com/catalog/titles/languages_and_audio":
						o.audio = parseAudio(currentNode.getElementsByTagName("language_audio_format"));
						break;
					case "http://schemas.netflix.com/catalog/titles.similars":
						o.similars = parseLinks(currentNode.getElementsByTagName("link"));
						break;
					case "http://schemas.netflix.com/catalog/titles/bonus_materials":
						o.bonusMaterials = parseLinks(currentNode.getElementsByTagName("link"));
						break;
					case "http://schemas.netflix.com/catalog/titles/official_url":
						break;
					case "http://schemas.netflix.com/catalog/title":
						o.guid = currentNode.getAttribute("href");
						o.title = type;
						break;
					case "http://schemas.netflix.com/catalog/titles.series":
						o.series = {
							guid: currentNode.getAttribute("href"),
							title: type
						};
						break;
					case "http://schemas.netflix.com/catalog/titles.season":
						o.season = {
							guid: currentNode.getAttribute("href"),
							title: type
						};
						break;
					case "http://schemas.netflix.com/catalog/titles.discs":
						dojo.query("link", currentNode).forEach(function(disc){
							o.discs.push({
								guid: disc.getAttribute("href"),
								title: disc.getAttribute("title")
							});
						});
						break;
					case "http://schemas.netflix.com/catalog/titles.programs":
						dojo.query("link", currentNode).forEach(function(episode){
							o.episodes.push({
								guid: episode.getAttribute("href"),
								title: episode.getAttribute("title")
							});
						});
						break;
				}
			}

			if(obj){
				o = util.mixin(obj, o);
			}
			this.setType(o);
			o.fullDetail = true;	//	we have the full details now, so mark it as such.
			return o;	//	Object
		},
		
		setType: function(/* Object */o){
			//	post-process to find a "type"
			if(o.guid.indexOf("discs")>-1){
				o.type = "disc";
			}
			else if (o.guid.indexOf("programs")>-1){
				o.type = "episode";
			}
			else if (o.guid.indexOf("series")>-1){
				if(o.guid.indexOf("seasons")>-1){
					o.type = "season";
				} else {
					o.type = "series";
				}
			}
			else {
				o.type = "movie";	//	generic
			}
		}
	};

	p.queues = {
		fromXml: function(/* XmlNode */node, /* Object? */obj){
			//	object representing a queue item.  Note that the title info is
			//	deliberately limited.
			var item = {
				queue: "/queues/disc",
				guid: null,
				id: null,
				position: null,
				availability: null,
				updated: null,
				shipped: null,
				watched: null,
				estimatedArrival: null,
				returned: null,
				viewed: null,
				format: null,
				title: {
					guid: null,
					title: null
				}
			};

			var info = node.ownerDocument.evaluate("./*", node), currentNode;
			while(currentNode = info.iterateNext()){
				switch(currentNode.tagName){
					case "id":
						item.guid = dojo.trim(currentNode.textContent);
						item.id = item.guid;
						var l = item.guid.split("/");
						l.pop();	//	pull the id off
						item.queue = l.slice(5).join("/");
						break;
					case "position":
						item.position = parseInt(currentNode.textContent, 10);
						break;
					case "category":
						var scheme = currentNode.getAttribute("scheme");
						if(scheme == "http://api.netflix.com/categories/queue_availability"){
							item.availability = dojo.trim(currentNode.textContent);
						}
						else if(scheme == "http://api.netflix.com/categories/title_formats"){
							item.format = currentNode.getAttribute("term");
						}
						break;
					case "updated":
						item.updated = parseDate(currentNode.textContent);
						break;
					case "shipped_date":
						item.shipped = parseDate(currentNode.textContent);
						break;
					case "watched_date":
						item.watched = parseDate(currentNode.textContent);
						break;
					case "estimated_arrival_date":
						item.estimatedArrival = parseDate(currentNode.textContent);
						break;
					case "returned_date":
						item.returned = parseDate(currentNode.textContent);
					case "viewed_time":
						item.viewed = currentNode.textContent;
						break;
					case "link":
						//	we only care about the title this represents.
						var rel = currentNode.getAttribute("rel");
						if(rel == "http://schemas.netflix.com/catalog/title"){
							//	use the title parser on the main node here for basic info.
							//	Note that it is up to the calling code to merge this title's
							//	info with any existing info.
							item.title = p.titles.fromXml(node);
						}
						else if(rel == "http://schemas.netflix.com/queues.available"){
							//	we do this here because for the available queues, Netflix embeds
							//	the position in the guid.
							var l = currentNode.getAttribute("href");
							//	redo the id
							item.id = l + "/" + item.guid.substr(item.guid.lastIndexOf("/")+1);
						}
						break;
				}
			}

			if(obj){
				item = util.mixin(obj, item);
			}
			return item;
		}
	};

	p.users = {
		fromXml: function(/* XmlNode */node, /* Object? */obj){
			//	summary:
			//		Return a user object from the passed xml node.
			var user = {
				name: { first: null, last: null },
				userId: null,
				canInstantWatch: false,
				preferredFormats: []
			};

			//	ignore the links included for now.
			var info = node.ownerDocument.evaluate("./*[name()!='link']", node), currentNode;
			while(currentNode = info.iterateNext()){
				switch(currentNode.tagName){
					case "user_id":
						user.userId = dojo.trim(currentNode.textContent);
						break;
					case "first_name":
						user.name.first = dojo.trim(currentNode.textContent);
						break;
					case "last_name":
						user.name.last = dojo.trim(currentNode.textContent);
						break;
					case "can_instant_watch":
						user.canInstantWatch = dojo.trim(currentNode.textContent)=="true";
						break;
					case "preferred_formats":
						dojo.query("category", currentNode).forEach(function(item){
							user.preferredFormats.push(item.getAttribute("term"));
						});
						break;
				}
			}

			if(obj){
				obj = util.mixin(obj, user);
			}
			return user;	//	Object
		}
	};

	p.people = {
		fromXml: function(/* XmlNode */node, /* Object? */obj){
			//	summary:
			//		Parse the information out of the passed XmlNode for people.
			var person = {
				id: null,
				name: null,
				bio: null,
				filmography: null
			};

			var info = node.ownerDocument.evaluate("./name()", node), currentNode;
			while(currentNode = info.iterateNext()){
				switch(currentNode.tagName){
					case "id":
					case "name":
					case "bio":
						person[currentNode.tagName] = util.clean(dojo.trim(currentNode.textContent));
						break;
					case "link":
						//	ignore the alternate link
						if(currentNode.getAttribute("rel") == "http://schemas.netflix.com/catalog/titles.filmography"){
							person.filmography = currentNode.getAttribute("href");
						}
						break;
				}
			}

			if(obj){
				person = util.mixin(obj, person);
			}
			return person;	//	Object
		}
	};

	p.status = {
		fromXml: function(/* XmlNode */node){
			//	summary:
			//		Parse the status info out of the passed node.
			var obj = {};
			for(var i=0, l=node.childNodes.length; i<l; i++){
				var item = node.childNodes[i];
				if(item.nodeType == 1){
					switch(item.tagName){
						case "status_code":
							obj.code = dojo.trim(item.textContent);
							break;
						case "sub_code":
							obj.subcode = dojo.trim(item.textContent);
							break;
						case "message":
						case "etag":
							obj[item.tagName] = dojo.trim(item.textContent);
							break;
						case "resources_created":
							obj.created = dojo.query("queue_item", item).map(function(n){
								return p.queues.fromXml(n);
							});
							break;
						case "failed_title_refs":
							obj.failed = dojo.query("link", item).map(function(n){
								return {
									guid: n.getAttribute("href"),
									title: n.getAttribute("title")
								};
							});
							break;
						case "already_in_queue":
							obj.inQueue = dojo.query("link", item).map(function(n){
								return {
									guid: n.getAttribute("href"),
									title: n.getAttribute("title")
								};
							});
							break;
					}
				}
			}
			return obj;
		}
	};
})();

}

if(!dojo._hasResource["qd.services.online.feeds"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.online.feeds"] = true;
dojo.provide("qd.services.online.feeds");

(function(){
	var util = qd.services.util,
		ps = qd.services.parser,
		db = qd.services.data;

	var rssFeeds = {
		top25: [],
		top100: null,
		newReleases: null
	};
	var top25Feeds = [], top100Feed, newReleasesFeed;
	var feedlistInit = function(){
		db.fetch({
			sql: "SELECT id, term, lastUpdated, isInstant, feed, xml FROM GenreFeed ORDER BY term",
			result: function(data, result){
				dojo.forEach(data, function(item){
					if(item.feed.indexOf("Top100RSS")>-1){
						rssFeeds.top100 = item;
					} else if(item.feed.indexOf("NewReleasesRSS")>-1){
						rssFeeds.newReleases = item;
					} else {
						rssFeeds.top25.push(item);
					}
				});
			}
		});
	};
	if(db.initialized){
		feedlistInit();
	} else {
		var h = dojo.connect(db, "onInitialize", function(){
			dojo.disconnect(h);
			feedlistInit();
		});
	}

	function getFeedObject(url){
		if(url == rssFeeds.top100.feed){ return rssFeeds.top100; }
		if(url == rssFeeds.newReleases.feed){ return rssFeeds.newReleases; }
		for(var i=0; i<rssFeeds.top25.length; i++){
			if(url == rssFeeds.top25[i].feed){
				return rssFeeds.top25[i];
			}
		}
		return null;
	}

	dojo.mixin(qd.services.online.feeds, {
		//	this object is used to get and cache any of the public RSS feeds
		//	available from Netflix.
		list: function(){
			return rssFeeds.top25;
		},
		top100: function(){
			return rssFeeds.top100;
		},
		newReleases: function(){
			return rssFeeds.newReleases;
		},
		fetch: function(/* Object */kwArgs){
			//	summary:
			//		Fetch the feed at the url in the feed object, and
			//		store/cache the feed when returned.
			var dfd = util.prepare(kwArgs), feed=getFeedObject(kwArgs.url);
			dojo.xhrGet({
				url: kwArgs.url,
				handleAs: "xml",
				load: function(xml, ioArgs){
					var node, parsed = [], items = xml.evaluate("//channel/item", xml);
					while(node = items.iterateNext()){
						parsed.push(ps.titles.fromRss(node));
					}

					//	pre and post-process the results (image caching)
					qd.services.online.process(parsed, dfd);

					//	push the xml doc into the database
					var sql = "UPDATE GenreFeed SET LastUpdated = DATETIME(), xml=:xml WHERE id=:id ";
					db.execute({
						sql: sql,
						params:{
							id: feed.id,
							xml: new XMLSerializer().serializeToString(xml).replace(/'/g, "''")
						},
						result: function(data){
							//	console.log("Stored the feed ("+feed.term+")");
						}
					});
				},
				error: function(err, ioArgs){
					dfd.errback(new Error("qd.service.feeds.fetch: an error occurred when trying to get " + kwArgs.url));
				}
			});
			return dfd;
		}
	});
})();

}

if(!dojo._hasResource["qd.services.online.titles"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.online.titles"] = true;
dojo.provide("qd.services.online.titles");

(function(){
	var ps = qd.services.parser,
		db = qd.services.data,
		util = qd.services.util;

	var some = encodeURIComponent("discs,episodes,seasons,synopsis,formats, screen formats"),
		expand = encodeURIComponent("awards,cast,directors,discs,episodes,formats,languages and audio,screen formats,seasons,synopsis");	//	similars

	function saveTitle(item){
		var param = {
			guid: item.guid,
			link: item.guid,
			title: item.title,
			synopsis: item.synopsis,
			rating: item.rating,
			item: dojo.toJson(item)
		};

		db.execute({
			sql: "SELECT json FROM Title WHERE guid=:guid",
			params: {
				guid: item.guid
			},
			result: function(data){
				if(data && data.length){
					//	mix-in the passed json with the stored one.
					item = util.mixin(dojo.fromJson(data[0].json), item);
					param.item = dojo.toJson(item);
				}
				db.execute({
					sql:  "REPLACE INTO Title (guid, link, title, lastUpdated, synopsis, rating, json)"
						+ " VALUES(:guid, :link, :title, DATETIME(), :synopsis, :rating, :item)",
					params: param,
					result: function(data){
						//	don't need this, keeping it for logging purposes.
					},
					error: function(err){
						console.warn("titles.save: ERROR!", error);
					}
				});
			}
		});
	}

	function fetchItem(url, dfd, term){
		var signer = qd.app.authorization;
		dojo.xhrGet(dojox.io.OAuth.sign("GET", {
			url: url,
			handleAs: "xml",
			load: function(xml, ioArgs){
				//	get the right node, parse it, cache it, and callback it.
				var node, items = xml.evaluate((term!==undefined?"//catalog_title":"//ratings/ratings_item"), xml), ob;

				while(node = items.iterateNext()){
					if(term !== undefined){
						var test = node.getElementsByTagName("title");
						if(test.length && test[0].getAttribute("regular") == util.clean(term)){
							ob = ps.titles.fromXml(node);
							break;
						}
					} else {
						ob = ps.titles.fromXml(node);
						break;
					}
				}

				if(ob){
					if(term !== undefined){
						//	hit it again, this time with a guid (so we can get some ratings)
						url = "http://api.netflix.com/users/" + signer.userId + "/ratings/title"
							+ "?title_refs=" + ob.guid
							+ "&expand=" + expand;
						fetchItem(url, dfd);
					} else {
						//	fire off the callback, passing it the returned object.
						qd.services.item(ob);
						qd.services.online.process(ob, dfd);
						saveTitle(ob);
					}
				} else {
					//	in case we don't get an exact term match back from Netflix.
					var e = new Error("No term match from Netflix for " + term);
					e.xml = xml;
					dfd.errback(e, ioArgs);
				}
			},
			error: function(err, ioArgs){
				//	TODO: modify for an invalid signature check.
				var e = new Error(err);
				e.xml = ioArgs.xhr.responseXML;
				dfd.errback(e, ioArgs);
			}
		}, signer), false);
	}

	function batchRatingsFetch(titles, args, ratings){
		//	summary:
		//		Private function to do actual ratings calls.
		var signer = qd.app.authorization,
			refs= [];
		for(var p in titles){
			refs.push(p);
		}

		var url = "http://api.netflix.com/users/" + signer.userId + "/ratings/title"
			+ "?title_refs=" + refs.join(",");
		
		var signedArgs = dojox.io.OAuth.sign("GET", {
			url: url,
			handleAs: "xml",
			load: function(xml, ioArgs){
				//	parse the info, merge and save
				var node, items = xml.evaluate("//ratings/ratings_item", xml), a = [], toSave = [];
				while(node = items.iterateNext()){
					var tmp = ps.titles.fromXml(node),
						r = tmp.ratings,
						title = titles[tmp.guid];
					if(!title || dojo.isString(title)){
						//	for some reason we only have a string.
						title = tmp;
					} else {
						if(r.predicted !== null){ title.ratings.predicted = r.predicted; }
						if(r.user !== null){ title.ratings.user = r.user; }
					}
					a.push(title);
					qd.services.item(title);
					toSave.push(title);
					ratings.push(title);
				}

				args.result.call(args, a, ioArgs);

				dojo.forEach(toSave, function(item){
					saveTitle(item);
				});
			},
			error: function(err, ioArgs){
				console.warn("Bath ratings fetch: ", err);
			}
		}, signer);
		return dojo.xhrGet(signedArgs);
	}

	function encode(s){
		if(!s){ return ""; }
		return encodeURIComponent(s)
			.replace(/\!/g, "%2521")
			.replace(/\*/g, "%252A")
			.replace(/\'/g, "%2527")
			.replace(/\(/g, "%2528")
			.replace(/\)/g, "%2529");
	}

	dojo.mixin(qd.services.online.titles, {
		//	TODO: see if this really needs to be exposed.
		save: function(/* Object */item){
			saveTitle(item);
		},
		clear: function(){
			db.execute({
				sql: "DELETE FROM Title",
				result: function(data){
					//	don't do anything for now.
				}
			});
		},
		/*=====
		qd.services.online.titles.find.__FindArgs = function(term, start, max, result, error){
			//	summary:
			//		Arguments object for doing a title search
			//	term: String
			//		The partial title to be looking for.
			//	start: Number?
			//		The page index to start on.  Default is 0.
			//	max: Number?
			//		The maximum number of results to find.  Default is 25 (supplied by Netflix).
			//	result: Function?
			//		The callback function that will be executed when a result is
			//		fetched.
			//	error: Function?
			//		The callback function to be executed if there is an error in fetching.
		}
		=====*/
		find: function(/* qd.services.online.titles.find.__FindArgs */kwArgs){
			//	summary:
			//		Use the Netflix API directly, and try to cache any results as they come.
			var dfd = util.prepare(kwArgs),
				signer = qd.app.authorization;

			var t = encodeURIComponent(util.clean(kwArgs.term));
			if(t.match(/!|\*|\'|\(|\)/g)){
				t = encode(t);
			}
			dojo.xhrGet(dojox.io.OAuth.sign("GET", {
				url: "http://api.netflix.com/catalog/titles?"
					+ "term=" + t
					+ (kwArgs.start ? "&start_index=" + kwArgs.start : "")
					+ (kwArgs.max ? "&max_results=" + kwArgs.max : "")
					+ "&expand=" + some,
				handleAs: "xml",
				load: function(response, ioArgs){
					//	assemble the results and return as an object.
					var n = response.evaluate("/catalog_titles/number_of_results", response).iterateNext(),
						o = {
							number_found: n ? parseInt(dojo.trim(n.textContent), 10) : 0,
							search_term: kwArgs.term,
							results: [],
							sort_by: "Relevance"
						};

					//	parse the movie results.
					var items = response.evaluate("/catalog_titles/catalog_title", response), node, sqls=[];
					while(node = items.iterateNext()){
						var item = ps.titles.fromXml(node);
						o.results.push(item);
						qd.services.item(item);
						sqls.push(item);
					}

					//	fire the callback before these titles are pushed into the database.
					dfd.callback(o, ioArgs);

					//	go and execute the saved SQL in the background
					dojo.forEach(sqls, function(item){
						saveTitle(item);
					});
				},
				error: function(err, ioArgs){
					//	TODO: modify for an invalid signature check.
					var e = new Error(err);
					e.xml = ioArgs.xhr.responseXML;
					dfd.errback(e, ioArgs);
				}
			}, signer));
			return dfd;		//	dojo.Deferred
		},

		/*=====
		qd.services.online.titles.fetch.__FetchArgs = function(term, title, result, error){
			//	summary:
			//		Arguments object for fetching movie details
			//	term: String?
			//		The full title of the Netflix title in question, as provided by the 
			//		Netflix RSS feeds.
			//	guid: String?
			//		The guid of the title in question as passed back by the Netflix servers.
			//	result: Function?
			//		The callback function that will be executed when a result is
			//		fetched.
			//	error: Function?
			//		The callback function to be executed if there is an error in fetching.
		}
		=====*/
		fetch: function(/* qd.services.online.titles.fetch.__FetchArgs */kwArgs){
			//	summary:
			//		Retrieve title details from the Netflix API.
			if(!kwArgs.guid && !kwArgs.term){
				throw new Error("qd.services.online.titles.fetch: you must pass either a guid or a term.");
			}

			var dfd = util.prepare(kwArgs);

			//	look to see if the object is in memory first.
			var test;
			if(kwArgs.term){
				test = qd.services.itemByTerm(kwArgs.term);
			} else {
				test = qd.services.item(kwArgs.guid);
			}
			if(test && test.ratings.predicted !== null && test.synopsis){
				setTimeout(function(){
					dfd.callback(test);
				}, 10);
				return dfd;
			}

			//	Check the cache second.
			var sql = "SELECT * FROM Title WHERE guid=:guid AND json IS NOT NULL";
			var params = { guid: kwArgs.guid };
			if(kwArgs.term){
				sql = "SELECT * FROM Title WHERE title=:term AND json IS NOT NULL";
				params = { term: kwArgs.term };
			}

			var url;
			if(kwArgs.term){
				var t = encodeURIComponent(util.clean(kwArgs.term));
				if(t.match(/!|\*|\'|\(|\)/g)){
					t = encode(t);
				}
				url = "http://api.netflix.com/catalog/titles?"
					+ "term=" + t
					+ "&expand=" + some
					+ "&max_results=24";	//	hardcoded, we want this to be as fast as possible
			} else {
				url = "http://api.netflix.com/users/" + qd.app.authorization.userId + "/ratings/title"
					+ "?title_refs=" + kwArgs.guid
					+ "&expand=" + expand;
			}
			
			db.execute({
				sql: sql,
				params: params,
				result: function(data, result){
					if(data && data.length){
						var title = dojo.fromJson(data[0].json);
						if(title.ratings.predicted !== null && title.synopsis){
							qd.services.item(title);
							setTimeout(function(){
								dfd.callback(title, result);
							}, 10);
						} else {
							//	get it from Netflix
							fetchItem(url, dfd, kwArgs.term);
						}
					} else {
						//	get it from Netflix
						fetchItem(url, dfd, kwArgs.term);
					}
				}
			});
			return dfd;	//	dojo.Deferred
		},
		/*=====
		on.titles.autosuggest.__AutosuggestArgs = function(term, result, error){
			//	summary:
			//		Arguments object for fetching movie details
			//	term: String?
			//		The partial string that an autocomplete should match.
			//	result: Function?
			//		The callback function that will be executed when a result is
			//		fetched.
			//	error: Function?
			//		The callback function to be executed if there is an error in fetching.
		}
		=====*/
		autosuggest: function(/* on.titles.autosuggest.__AutosuggestArgs */kwArgs){
			//	summary:
			//		Get the autocomplete terms from Netflix, given the right term.
			var dfd = util.prepare(kwArgs),
				signer = qd.app.authorization;

			dojo.xhrGet(dojox.io.OAuth.sign("GET", {
				url: "http://api.netflix.com/catalog/titles/autocomplete"
					+ "?term=" + encode(kwArgs.term),
				handleAs: "xml",
				load: function(xml, ioArgs){
					var a = [], node, items = xml.evaluate("//@short", xml);
					while(node = items.iterateNext()){
						a.push(node.nodeValue);
					}
					dfd.callback(a, ioArgs);
				},
				error: function(err, ioArgs){
					dfd.errback(err, ioArgs);
				}
			}, signer));

			return dfd;
		},

		/*=====
		 qd.services.online.titles.rated.__RatedArgs = function(guids, result, error){
			//	summary:
			//		Named arguments used for fetching the contents of a queue.
			//	guids: Array
			//		The list of guids to get ratings for.
			//	result: Function?
			//		The callback function on successful retrieval.
			//	error: Function?
			//		The errback function on failure.
		 }
		 =====*/
		rated: function(/* qd.services.online.titles.rated.__RatedArgs */kwArgs){
			//	summary:
			//		Fetch ratings info for all of the guids passed in the kwArgs.
			//		Try to do most of this as local as possible, by doing the following:
			//			1. get all the titles from the database.
			//			2. check which ones already have the predicted and actual ratings.
			//			3. assemble a list of titles without that information.
			//			4. fetch those titles from Netflix, and merge with the existing ones.
			//			5. save the titles with new ratings info.
			var dfd = new dojo.Deferred();
			var ratings = [];

			//	TODO: grab any titles from memory, check to see if they have ratings, and
			//	pull them out of the guid list.
			db.fetch({
				sql: "SELECT json FROM Title WHERE guid IN ('" + (kwArgs.guids || []).join("','") + "') ORDER BY title",
				result: function(data){
					var good = [], missing = [], item, tested = {};
					if(data){
						//	run through the data results and see what we really need to go get from Netflix.
						for(var i=0; i<data.length; i++){
							item = dojo.fromJson(data[i].json);
							if(item && item.ratings && item.ratings.predicted !== null){
								good.push(item);
							} else {
								missing.push(item);
							}
							if(item){
								tested[item.guid] = true;
							}
						}
					} else {
						missing = kwArgs.guids.slice(0);
					}

					//	now double check and make sure that any *not* tested guids are pushed into missing.
					dojo.forEach(kwArgs.guids, function(guid){
						if(!tested[guid]){
							missing.push(guid);
						}
					});

					if(good.length){
						dojo.forEach(good, function(item){
							qd.services.item(item);
						});
						kwArgs.result.call(kwArgs, good);
						ratings = ratings.concat(good);
					}

					if(missing.length){
						//	we have at least one missing title, so let's go get that info from Netflix.
						var chunks = [], limit = 24, position = 0;
						while(position < missing.length){
							var n = Math.min(limit, missing.length - position);
							chunks.push(missing.slice(position, position + n));
							position += n;
						}

						//	start the missing fetches.
						var pos = 0, timer;
						timer = setInterval(function(){
							var chunk = chunks[pos++];
							if(chunk){
								//	pre-process and call the internal function.
								var o = {};
								dojo.forEach(chunk, function(item){
									if(dojo.isString(item)){
										o[item] = item;
									} else {
										o[item.guid] = item;
									}
								});
								batchRatingsFetch(o, kwArgs, ratings);
							} else {
								clearInterval(timer);
								dfd.callback(ratings);
							}
						}, 250);
					} else {
						dfd.callback(ratings);
					}
				}
			});
			return dfd;
		},
		/*=====
		qd.services.online.titles.rate.__RateArgs = function(guid, rating, result, error){
			//	summary:
			//		Named arguments object for handling rating a movie.
			//	guid: String
			//		The id of the title to be updated.
			//	rating: String
			//		The new rating for the movie
			//	result: Function?
			//		The callback fired when the rating is completed.
			//	error: Function?
			//		The errback fired in case of an error.
		}
		=====*/
		rate: function(/* qd.services.online.titles.rate.__RateArgs */kwArgs){
			//	summary:
			//		Rate the title as referenced by kwArgs.guid.
			var dfd = util.prepare(kwArgs),
				signer = qd.app.authorization;

			var item = qd.services.item(kwArgs.guid);
			if(!item){
				setTimeout(function(){
					dfd.errback(new Error("qd.service.rate: cannot rate an item with a guid of " + kwArgs.guid));
				}, 10);
				return dfd;
			}
			
			//	check to see if this is an update
			var url = "http://api.netflix.com/users/" + signer.userId + "/ratings/title/actual";
			if(item.ratings.user){
				//	this is an update, make sure there's a rating id.
				var args = {
					url: url + "/" + item.guid.substr(item.guid.lastIndexOf("/")+1),
					content: {
						rating: kwArgs.rating,
						method: "PUT"
					},
					handleAs: "xml",
					load: function(xml, ioArgs){
						var s = ps.status.fromXml(xml.documentElement);
						if(s.code == "200"){
							if(kwArgs.rating == "not_interested" || kwArgs.rating == "no_opinion"){
								item.ratings.user = null;
							}
							qd.services.item(item);
							saveTitle(item);
							dfd.callback(kwArgs.rating, ioArgs);
						} else {
							dfd.errback(s);
						}
					},
					error: function(err, ioArgs){
						dfd.errback(err, ioArgs);
					}
				};
				args = dojox.io.OAuth.sign("GET", args, signer);
				dojo.xhrGet(args);
			} else {
				//	this is a new rating.
				var args = {
					url: url
						+ "?title_ref=" + encodeURIComponent(kwArgs.guid)
						+ "&rating=" + kwArgs.rating,
					handleAs: "xml",
					load: function(xml, ioArgs){
						var s = ps.status.fromXml(xml.documentElement);
						if(s.code == "201"){
							if(kwArgs.rating == "not_interested" || kwArgs.rating == "no_opinion"){
								item.ratings.user = null;
							}
							qd.services.item(item);
							saveTitle(item);
							dfd.callback(kwArgs.rating, ioArgs);
						} else {
							dfd.errback(s);
						}
					},
					error: function(err, ioArgs){
						dfd.errback(err, ioArgs);
					}
				};
				args = dojox.io.OAuth.sign("POST", args, signer);
				dojo.xhrPost(args);
			}
			return dfd;
		},
		/*=====
		qd.services.titles.online.recommendations.__RecArgs = function(start, max, result, error){
			//	summary:
			//		Keyword arguments to be fed to the recommendations method.
			//	start: Integer?
			//		The starting index to fetch.  Defaults to the Netflix default (0).
			//	max: Integer?
			//		The max number of results to fetch.  Defaults to the Netflix default (25).
			//	result: Function?
			//		The callback to be run when results are returned.
			//	error: Function?
			//		The callback to be run if an error occurs.
		}
		=====*/
		recommendations: function(/* qd.services.titles.online.recommendations.__RecArgs */kwArgs){
			//	summary:
			//		Fetch user recommendations from Netflix.
			var dfd = util.prepare(kwArgs),
				signer = qd.app.authorization;
			
			//	when online, always get this from the servers.
			var qs = [];
			if(kwArgs.start){ qs.push("start_index=" + kwArgs.start); }
			if(kwArgs.max){ qs.push("max_results=" + kwArgs.max); }
			var url = "http://api.netflix.com/users/" + signer.userId + "/recommendations" 
				+ "?expand=" + some
				+ (qs.length ? "&" + qs.join("&") : "");

			dojo.xhrGet(dojox.io.OAuth.sign("GET", {
				url: url,
				handleAs: "xml",
				load: function(xml, ioArgs){
					var node, 
						items = xml.evaluate("recommendations/recommendation", xml), 
						results = [], sqls = []; 
					while(node = items.iterateNext()){
						var item = ps.titles.fromXml(node);
						results.push(item);
						sqls.push(item);
						saveTitle(item);
						qd.services.item(item);
					}

					//	do the callback
					qd.services.online.process(results, dfd);

					//	push it into the database.
					setTimeout(function(){
						var sql = "REPLACE INTO Recommendation(guid, title, lastUpdated) "
							+ " VALUES (:guid, :title, DATETIME())";
						dojo.forEach(sqls, function(item){
							db.execute({
								sql: sql,
								params: {
									guid: item.guid,
									title: item.title
								},
								result: function(data){
									//console.warn("Recommended title '" + item.title + "' saved.");
								}
							});
						});
					}, 500);
				},
				error: function(err, ioArgs){
					dfd.errback(err, ioArgs);
				}
			}, signer));
			return dfd;
		}
	});
})();

}

if(!dojo._hasResource["qd.services.online.queues"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.online.queues"] = true;
dojo.provide("qd.services.online.queues");


(function(){
 	var ps = qd.services.parser,
		db = qd.services.data,
		util = qd.services.util,
		storage = qd.services.storage;

	var tags = {
		disc: null,
		instant: null
	};
	function etag(queue, tag){
		if(tag){
			tags[queue] = tag;
		}
		return tags[queue];
	}

	dojo.mixin(qd.services.online.queues, {
		paths: {
			GET: {
				"queues/disc"				:"//queue/queue_item",
				"queues/disc/saved"			:"//queue/queue_item",
				"at_home"					:"//at_home/at_home_item",
				"queues/instant"			:"//queue/queue_item",
				"rental_history/shipped"	:"//rental_history/rental_history_item",
				"rental_history/returned"	:"//rental_history/rental_history_item",
				"rental_history/watched"	:"//rental_history/rental_history_item",
				"queues/disc/available"		:""
			}
		},
		etag: function(/* String */queue, /* String? */tag){
			return etag(queue, tag);
		},
		clear: function(){
			db.execute({
				sql: "DELETE FROM QueueCache",
				result: function(data){
					//	don't do anything for now.
				}
			});
			db.execute({
				sql: "DELETE FROM TransactionQueue",
				result: function(data){
					//	don't do anything for now.
				}
			});
		},
		/*=====
		 qd.services.online.queues.fetch.__FetchArgs = function(url, lastUpdated, start, max, result, error){
			//	summary:
			//		Named arguments used for fetching the contents of a queue.
			//	url: String
			//		The partial URL to be used (ex. queues/disc, at_home)
			//	lastUpdated: String?
			//		A UNIX timestamp, in seconds, with when you want to check it from.  Useful for at home notifications.
			//	start: Number?
			//		The index at which to start the fetch.  Defaults to 0.
			//	max: Number?
			//		The maximum number of items to fetch.  Defaults to 500.
			//	result: Function?
			//		The callback function on successful retrieval.
			//	error: Function?
			//		The errback function on failure.
		 }
		 =====*/
		fetch: function(/* qd.services.online.queues.fetch.__FetchArgs */kwArgs){
			var dfd = util.prepare(kwArgs),
				signer = qd.app.authorization;
			
			if(kwArgs.lastUpdated){
				//	convert from date to number.
				kwArgs.lastUpdated = Math.floor(kwArgs.lastUpdated.valueOf()/1000);
			}

			//	always get it from the server, but make sure you cache the queue on the user object
			dojo.xhrGet(dojox.io.OAuth.sign("GET", {
				url: "http://api.netflix.com/users/" + signer.userId + "/" + (kwArgs.url || "queues/disc")
					+ "?sort=queue_sequence"
					+ "&start_index=" + (kwArgs.start || 0)
					+ "&max_results=" + (kwArgs.max || 500)
					+ (kwArgs.lastUpdated ? "&updated_min=" + kwArgs.lastUpdated : "")
					+ "&expand=" + encodeURIComponent("discs,episodes,seasons,synopsis,formats"),
				handleAs: "xml",
				load: function(xml, ioArgs){
					var results = [], node, items = xml.evaluate(qd.services.online.queues.paths.GET[(kwArgs.url || "queues/disc")], xml);
					var test = xml.getElementsByTagName("etag"), tagq;
					if(test && test.length){
						if(kwArgs.url && kwArgs.url.indexOf("queues/disc")>-1){
							tagq = "disc";
						}
						else if(kwArgs.url && kwArgs.url.indexOf("queues/instant")>-1){
							tagq = "instant";
						}
						if(tagq){
							etag(tagq, test[0].textContent);
						}
					}

					while(node = items.iterateNext()){
						var q = ps.queues.fromXml(node);
						results.push(q);
						qd.services.item(q);
						qd.services.item(q.title);
					}

					//	fire the callback before these titles are pushed into the database.
					dfd.callback(results, ioArgs);
				},
				error: function(err, ioArgs){
					dfd.errback(err, ioArgs);
				}
			}, signer), false);
			return dfd;
		},
		//	specific things
		atHome: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "at_home";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
				//	cache the big and small images for this.
				dojo.forEach(arr, function(item){
					var art = item.title.art;
					art.large = util.image.url(art.large);
					if(art.large.indexOf("http://")>-1){
						util.image.store(art.large).addCallback(function(){
							art.large = util.image.url(art.large);
						});
					}

					art.small = util.image.url(art.small);
					if(art.small.indexOf("http://")>-1){
						util.image.store(art.small).addCallback(function(){
							art.small = util.image.url(art.small);
						});
					}
				});
			});
			return dfd;
		},
		discs: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "queues/disc";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("discs: ", arr);
			});
			return dfd;
		},
		saved: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "queues/disc/saved";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("saved discs: ", arr);
			});
			return dfd;
		},
		instant: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "queues/instant";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("instant: ", arr);
			});
			return dfd;
		},
		watched: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "rental_history/watched";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("watched: ", arr);
			});
			return dfd;
		},
		shipped: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "rental_history/shipped";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
				console.log("shipped: ", arr);
			});
			return dfd;
		},
		returned: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "rental_history/returned";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
				console.log("returned: ", arr);
			});
			return dfd;
		},

		/*=====
		 qd.services.online.queues.modify.__ModifyArgs = function(url, guid, title, format, position, result, error){
			//	summary:
			//		Named arguments used for fetching the contents of a queue.
			//	url: String
			//		The partial url (see fetch) of the queue to be adding the item to.
			//	guid: String
			//		The full id of the queue item to be added or moved.
			//	title: String
			//		The title/name of the item being altered.
			//	format: String?
			//		The desired format of the item to be added.  Defaults to user's preferences.
			//	position: Number?
			//		The desired position of the item in the queue.  Do not pass if adding an item.
			//	result: Function?
			//		The callback function on successful retrieval.
			//	error: Function?
			//		The errback function on failure.
		 }
		 =====*/
		modify: function(/* qd.services.online.queues.add.__AddArgs */kwArgs){
			//	summary:
			//		Add or move an item in a queue.  Note that for the online
			//		version, we can ignore the passed title.
			var dfd = util.prepare(kwArgs),
				signer = qd.app.authorization;

			var tagq = kwArgs.url.indexOf("instant")>-1 ? "instant" : "disc";
			var content = {
				title_ref: kwArgs.guid,
				etag: etag(tagq)
			};
			if(kwArgs.format){ content.format = kwArgs.format; }
			if(kwArgs.position){ content.position = kwArgs.position; }

			//	build the query string and append it.
			var qs = [];
			for(var p in content){
				qs.push(p + "=" + encodeURIComponent(content[p]));
			}

			var args = dojox.io.OAuth.sign("POST", {
				url: "http://api.netflix.com/users/" + signer.userId + "/" + (kwArgs.url || "queues/disc")
					+ "?" + qs.join("&"),
				handleAs: "xml",
				load: function(xml, ioArgs){
					var o = ps.status.fromXml(xml.documentElement);
					if(o.etag){ etag(tagq, o.etag); }
					dfd.callback(o, ioArgs);
				},
				error: function(err, ioArgs){
					console.warn("qd.service.queues.modify: an error occurred.", err.status.results.message);
					dfd.errback(err, ioArgs);
				}
			}, signer);
			dojo.xhrPost(args);
			return dfd;
		},
		/*=====
		 qd.services.online.queues.remove.__RemoveArgs = function(url, guid, title, result, error){
			//	summary:
			//		Named arguments used for fetching the contents of a queue.
			//	url: String
			//		The partial URL of the queue to be modified, i.e. queues/disc/available.
			//	guid: String
			//		The partial id (after the userId) of the queue item to be removed.
			//	title: String
			//		The title/name of the item being removed.
			//	result: Function?
			//		The callback function on successful retrieval.
			//	error: Function?
			//		The errback function on failure.
		 }
		 =====*/
		remove: function(/* qd.services.online.queues.remove.__RemoveArgs */kwArgs){
			//	summary:
			//		Remove an item from the queue.  We can ignore the title here,
			//		since we are online.
			// API NOTE:
			//		Remove by ID not GUID. EX: 404309
			var dfd = util.prepare(kwArgs),
				signer = qd.app.authorization;

			var tagq = kwArgs.url.indexOf("instant")>-1 ? "instant":"disc";
			dojo.xhrDelete(dojox.io.OAuth.sign("DELETE", {
				url: "http://api.netflix.com/users/" + signer.userId + "/" + kwArgs.url + "/" + kwArgs.guid + "?etag=" + etag(tagq),
				handleAs: "xml",
				load: function(xml, ioArgs){
					var o = ps.status.fromXml(xml.documentElement);
					if(o.etag){ etag(tagq, o.etag); }
					dfd.callback(o, ioArgs);

					//	go fetch a new etag
					qd.service.queues[tagq=="instant"?"instant":"discs"]({ max: 1 });
				},
				error: function(err, ioArgs){
					dfd.errback(err, ioArgs);
				}
			}, signer));
			return dfd;
		},
		cache: function(/* String */queue, /* Array */list){
			//	summary:
			//		Cache the current state of the queue.
	//		if(queue == "history") { return; }
			var map = dojo.map(list, function(listItem){
				//	strip out the useless stuff.
				var item = dojo.clone(listItem.item);
				if("detailsStr" in item){ delete item.detailsStr; }
				if("genreStr" in item){ delete item.genreStr; }
				if("instantStr" in item){ delete item.instantStr; }
				if("returnedStr" in item){ delete item.returnedStr; }
				if("starRatingEnabledStr" in item){ delete item.starRatingEnabledStr; }
				return item;
			});
			setTimeout(function(){
				db.execute({
					sql: "REPLACE INTO QueueCache (queue, json, lastUpdated) VALUES (:queue, :json, DATETIME())",
					params: {
						queue: queue,
						json: dojo.toJson(map)
					}
				});
			}, 500);
		},
		//	stubs to prevent any kind of Function Not Defined errors.
		addMovieById: function(){ return; },
		addMovieByTerm: function(){ return; }
	});
})();

}

if(!dojo._hasResource["qd.services.online.user"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.online.user"] = true;
dojo.provide("qd.services.online.user");

(function(){
	var ps = qd.services.parser;
	dojo.mixin(qd.services.online.user, {
		fetch: function(kwArgs){
			//	summary:
			//		Fetch the current user's information from the Netflix servers.
			var dfd = new dojo.Deferred(),
				signer = qd.app.authorization;

			dojo.xhrGet(dojox.io.OAuth.sign("GET", {
				url: "http://api.netflix.com/users/" + signer.userId,
				handleAs: "xml",
				load: function(xml, ioArgs){
					var o = ps.users.fromXml(xml.documentElement);
					dfd.callback(o, ioArgs);
				},
				error: function(err, ioArgs){
					console.error("qd.services.online.user.fetch: ", err);
					dfd.errback(err);
				}
			}, signer), false);
			return dfd;
		}
	});
})();

}

if(!dojo._hasResource["qd.services.online"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.online"] = true;
dojo.provide("qd.services.online");








(function(){
 	var db = qd.services.data,
		network = qd.services.network;

	//////////////////////////////////////////////////////////////////////////////////////////////
	//	Synchronization functions
	//////////////////////////////////////////////////////////////////////////////////////////////
	var actions = [];

	//	wrapper functions around sync functionality...this is due to the application sandbox.
	var methods = {
		rate: function(args){
			return qd.service.titles.rate(args);
		},
		add: function(args){
			var dfd = new dojo.Deferred();
			qd.app.queue.addMovieById(args.movieId, null, args.queue);
			setTimeout(function(){
				dfd.callback();
			}, 250);
			return dfd;
		},
		termAdd: function(args){
			var dfd = new dojo.Deferred();
			var queue = args.queue;
			args.result = function(item){
				qd.app.queue.addMovieById(item.guid, null, queue);
				dfd.callback();
			};
			delete args.queue;
			qd.service.titles.fetch(args);
			return dfd;
		},
		modify: function(args){
			return qd.service.queues.modify(args);
		},
		remove: function(args){
			return qd.service.queues.remove(args);
		},
		discs: function(){
			return qd.service.queues.discs({ max: 1 });
		},
		instant: function(){
			return qd.service.queues.instant({ max: 1 });
		}
	};
	function getActions(){
		actions = [];
		db.execute({
			sql: "SELECT * FROM TransactionQueue ORDER BY dateAdded, id",
			result: function(data){
				//	pre-process what we have here into a queue of functions to execute.
				if(data && data.length){
					actions.push(function(){
						qd.services.online.onSyncItemStart("Fetching disc queue");
						methods.discs().addCallback(function(){
							qd.services.online.onSyncItemComplete();
						}).addErrback(function(err){
							console.warn(err);
							qd.services.online.onSyncItemComplete();
						});
					});
					actions.push(function(){
						qd.services.online.onSyncItemStart("Fetching instant queue");
						methods.instant().addCallback(function(){
							qd.services.online.onSyncItemComplete();
						}).addErrback(function(err){
							console.warn(err);
							qd.services.online.onSyncItemComplete();
						});
					});
					dojo.forEach(data, function(item){
						var method = item.method;
						actions.push(function(){
							if(methods[method]){
								try {
									qd.services.online.onSyncItemStart(item.prompt);
									methods[method](dojo.fromJson(item.args||"{}")).addCallback(function(){
										qd.services.online.onSyncItemComplete();
									}).addErrback(function(err){
										console.warn(err);
										qd.services.online.onSyncItemComplete();
									});
								} catch(ex){
									console.warn("sync: ", ex);
								}
							}
						});
					});
					qd.services.online.onSyncNeeded(actions.length);
				}
			}
		});
	}

	function execute(){
		//	note that the setTimeout is there to limit the number of
		//	things posted to Netflix to 4 a second.
		var fn = actions.shift();
		if(fn){
			setTimeout(function(){
				fn();
			}, 400);
		} else {
			//	we are done, so wipe the transaction queue.
			db.execute({
				sql: "DELETE FROM TransactionQueue"
			});
			qd.services.online.onSyncComplete();
		}
	}

	//	connect to the onChange event of the network.
	dojo.connect(network, "onChange", function(){
		if(network.available){
			//	check to see if there's anything stored in the transaction queue.
			getActions();
		}
	});

	//////////////////////////////////////////////////////////////////////////////////////////////

	dojo.mixin(qd.services.online, {
		process: function(titles, dfd){
			//	summary:
			//		Process a list of titles by both saving images, and
			//		saving the title itself into the database.
			//	titles: Array | Object
			//		The title(s) to be processed
			//	dfd: dojo.Deferred?
			//		An optional deferred to be fired during the processing.
			//	returns: void
			var util = qd.services.util,
				proc = titles;
			if(!(titles instanceof Array)){ proc = [ titles ]; }

			//	pre-process image urls.
			dojo.forEach(proc, function(item){
				item.art.large = util.image.url(item.art.large);
			});

			//	do the callback
			if(dfd){ dfd.callback(titles); }

			//	post-process with a timeout, let the UI finish rendering and try
			//	to let it finish pulling images, since it looks like when we do
			//	this, AIR saves it off the cache anyways.
			setTimeout(function(){
				dojo.forEach(proc, function(item){
					if(item.art.large && item.art.large.indexOf("http://")==0){
						var imageDfd = util.image.store(item.art.large);
						imageDfd.addCallback(function(u){
							item.art.large = u;
						});
					}
				});
			}, 2000);
		},
		onSyncNeeded: function(/* Integer */n){
			//	stub for connecting to for the sync process.
		},
		synchronize: function(){
			//	summary:
			//		Start the synchronization process.
			execute();
		},
		onSyncComplete: function(){
			//	summary:
			//		Stub for when the synchronization process is complete.
		},
		onSyncItemStart: function(/* String */prompt){
		},
		onSyncItemComplete: function(){
			//	summary:
			//		Stub for each item completion.
			execute();
		},
		discardSynchronizations: function(){
			//	summary:
			//		Throw out any stored sync.
			db.execute({
				sql: "DELETE FROM TransactionQueue",
				result: function(data){
					qd.services.online.onDiscardSync();
				}
			});
		},
		onDiscardSync: function(){
			//	summary:
			//		Stub for when sync actions are discarded.
		}
	});
})();

}

if(!dojo._hasResource["qd.services.offline.feeds"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.offline.feeds"] = true;
dojo.provide("qd.services.offline.feeds");

(function(){
	var ps = qd.services.parser,
		db = qd.services.data,
		util = qd.services.util;

	//	private function to handle all feeds
	var rssFeeds = {
		top25: [],
		top100: null,
		newReleases: null
	};
	var top25Feeds = [], top100Feed, newReleasesFeed;
	var feedlistInit = function(){
		db.fetch({
			sql: "SELECT id, term, lastUpdated, feed, xml FROM GenreFeed ORDER BY term",
			result: function(data, result){
				dojo.forEach(data, function(item){
					if(item.feed.indexOf("Top100RSS")>-1){
						rssFeeds.top100 = item;
					} else if(item.feed.indexOf("NewReleasesRSS")>-1){
						rssFeeds.newReleases = item;
					} else {
						rssFeeds.top25.push(item);
					}
				});
			}
		});
	};
	if(db.initialized){
		feedlistInit();
	} else {
		var h = dojo.connect(db, "onInitialize", function(){
			dojo.disconnect(h);
			feedlistInit();
		});
	}

	function getFeedObject(url){
		if(url == rssFeeds.top100.feed){ return rssFeeds.top100; }
		if(url == rssFeeds.newReleases.feed){ return rssFeeds.newReleases; }
		for(var i=0; i<rssFeeds.top25.length; i++){
			if(url == rssFeeds.top25[i].feed){
				return rssFeeds.top25[i];
			}
		}
		return null;
	}

	dojo.mixin(qd.services.offline.feeds, {
		list: function(){
		  return rssFeeds.top25;
		},
		top100: function(){
			return rssFeeds.top100;
		},
		newReleases: function(){
			return rssFeeds.newReleases;
		},
		fetch: function(/* Object */kwArgs){
			var dfd = util.prepare(kwArgs), feed = getFeedObject(kwArgs.url);
			if(feed && feed.xml){
				var xml = new DOMParser().parseFromString(feed.xml, "text/xml");
				var node, parsed = [], items = xml.evaluate("//channel/item", xml);
				while(node = items.iterateNext()){
					var item = ps.titles.fromRss(node);
					item.art.large = util.image.url(item.art.large);
					parsed.push(item);
				}
				dfd.callback(parsed);
			} else {
				dfd.errback(new Error("qd.service.feeds.fetch: there is no XML cache for this feed."), feed.term);
			}
			return dfd;
		}
	});
})();

}

if(!dojo._hasResource["qd.services.offline.titles"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.offline.titles"] = true;
dojo.provide("qd.services.offline.titles");

(function(){
	var ps = qd.services.parser,
		db = qd.services.data,
		util = qd.services.util;
	
	dojo.mixin(qd.services.offline.titles, {
		save: function(/* Object */item){
			qd.services.online.titles.save(item);
		},
		clear: function(){
			qd.services.online.titles.clear();
		},
		find: function(/* qd.services.online.titles.find.__FindArgs */kwArgs){
			//	summary:
			//		Try to pull as many titles from the database as possible,
			//		based on the terms.
			var dfd = util.prepare(kwArgs);
			var sql = "SELECT t.title, t.json "
				+ "FROM Title t "
				+ "INNER JOIN (SELECT DISTINCT title FROM Title WHERE SUBSTR(title, 0, :length) = :term AND json IS NOT NULL) t1 "
				+ "ON t1.title = t.title "
				+ "INNER JOIN (SELECT DISTINCT title FROM Title WHERE title LIKE :like AND json IS NOT NULL) t2 "
				+ "ON t2.title = t.title "
				+ "ORDER BY t.title";
			//	+ " LIMIT " + Math.min((kwArgs.max || 25), 100) + "," + (kwArgs.start || 0);

			db.execute({
				sql: sql,
				params: {
					length: kwArgs.term.length,
					term: kwArgs.term,
					like: "%" + kwArgs.term + "%"
				},
				result: function(data, result){
					var o = {
						number_found: data && data.length || 0,
						search_term: kwArgs.term,
						results: [],
						sort_by: "Relevance"
					};
					if(data && data.length){
						for(var i=0; i<data.length; i++){
							var item = dojo.fromJson(data[i].json);
							item.art.large = util.image.url(item.art.large);
							o.results.push(item);
							qd.services.item(item);
						}
						dfd.callback(o);
					} else {
						console.warn("titles.find ERROR:", o);
						dfd.errback(o);
					}
				},
				error: function(result){
					console.warn("titles.find ERROR:", result);
					dfd.errback(result);
				}
			});
			return dfd;
		},
		fetch: function(/* qd.services.online.titles.fetch.__FetchArgs */kwArgs){
			var dfd = util.prepare(kwArgs);
			//	Check the cache first.

			var sql = "SELECT * FROM Title WHERE guid=:guid AND json IS NOT NULL",
				params = { guid: kwArgs.guid };
			if(kwArgs.term){
				sql = "SELECT * FROM Title WHERE title=:term AND json IS NOT NULL",
				params = { term: kwArgs.term };
			}

			db.fetch({
				sql: sql,
				params: params,
				result: function(data, result){
					var title;
					if(data && data.length){
						title = dojo.fromJson(data[0].json);
						title.art.large = util.image.url(title.art.large);
						qd.services.item(item);
					}
					setTimeout(function(){
						if(title){
							dfd.callback(title, result);
						} else {
							dfd.errback(new Error("qd.offline.service.fetch: the title '" + kwArgs.term + "' is unavailable."));
						}
					}, 10);
				}
			});
			return dfd;
		},
		autosuggest: function(/* on.titles.autosuggest.__AutosuggestArgs */kwArgs){
			var dfd = util.prepare(kwArgs);
			var sql = "SELECT 1 AS main, title FROM Title WHERE SUBSTR(title, 0, :length) = :term "
				+ "UNION SELECT 2 AS main, title FROM Title WHERE title LIKE :like "
				+ "ORDER BY main, title LIMIT 0,10";
			db.fetch({
				sql: sql,
				params: {
					length: kwArgs.term.length,
					term: kwArgs.term,
					like: "%" + kwArgs.term + "%"
				},
				result: function(data){
					var a = [];
					dojo.forEach(data, function(item){
						a.push(item.title);
					});
					setTimeout(function(){
						dfd.callback(a, null);
					}, 10);
				}
			});
			return dfd;
		},
		rated: function(/* qd.services.online.titles.rated.__RatedArgs */kwArgs){
			//	should have an array of guids.
			var dfd = new dojo.Deferred();

			db.execute({
				sql: "SELECT json FROM Title WHERE guid IN ('" + (kwArgs.guids || []).join("','") + "') ORDER BY title",
				result: function(data){
					if(data && data.length){
						var a = [];
						dojo.forEach(data, function(item){
							var tmp = dojo.fromJson(item.json);
							if(tmp.ratings && tmp.ratings.predicted){
								tmp.art.large = util.image.url(tmp.art.large);
								qd.services.item(tmp);
								a.push(tmp);
							}
						});
						if(a.length){
							kwArgs.result.call(kwArgs, a);
						}
					}
					//	no matter what happens, run the callback.
					dfd.callback(a);
				}
			});
			return dfd;
		},
		rate: function(/* qd.services.online.titles.rate.__RateArgs */kwArgs){
			//	summary:
			//		Store the passed rating command in the transaction queue
			//		for synchronization purposes.
			var dfd = util.prepare(kwArgs),
				item = qd.services.item(kwArgs.guid);

			if(!item){
				setTimeout(function(){
					dfd.errback(new Error("qd.service.rate: cannot rate an item with a guid of " + kwArgs.guid));
				}, 10);
				return dfd;
			}
			
			var sql = "INSERT INTO TransactionQueue (method, args, prompt, dateAdded) "
				+ " VALUES (:method, :args, :prompt, DATETIME())";

			var params = {
				method: "rate",
				args: "{guid:'" + kwArgs.guid + "',rating:'" + kwArgs.rating + "'}",
				prompt: 'Setting the rating on "' + item.title + '" to ' + kwArgs.rating
			};

			db.execute({
				sql: sql,
				params: params,
				result: function(data){
					//	just do the callback.
					dfd.callback(kwArgs.rating);
				}
			});

			return dfd;
		},
		recommendations: function(kwArgs){
			var dfd = util.prepare(kwArgs),
				sql = "SELECT DISTINCT r.guid AS guid, r.title AS title, t.json AS json "
					+ "FROM Recommendation r "
					+ "INNER JOIN Title t "
					+ "ON t.guid = r.guid "
					+ "WHERE t.json IS NOT NULL "
					+ "ORDER BY r.title",
				max = kwArgs.max || 25,
				start = kwArgs.start || 0;
			sql += " LIMIT " + start + "," + max;

			db.execute({
				sql: sql,
				result: function(data){
					//	A note: we are not going to throw any errors if there's nothing
					//	in the database that's cached.
					var a = [];
					if(data && data.length){
						dojo.forEach(data, function(item){
							var title = dojo.fromJson(item.json);
							title.art.large = util.image.url(title.art.large);
							a.push(title);
							qd.services.item(title);
						});
					}
					dfd.callback(a);
				},
				error: function(data){
					dfd.errback(data);
				}
			});
			return dfd;
		}		
	});
})();

}

if(!dojo._hasResource["qd.services.offline.queues"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.offline.queues"] = true;
dojo.provide("qd.services.offline.queues");

(function(){
 	var ps = qd.services.parser,
		db = qd.services.data,
		util = qd.services.util;

	dojo.mixin(qd.services.offline.queues, {
		etag: function(/* String */queue, /* String? */tag){
			return qd.services.online.queues.etag(queue, tag);
		},
		clear: function(){
			qd.services.online.queues.clear();
		},
		fetch: function(/* qd.services.online.queues.fetch.__FetchArgs */kwArgs){
			var dfd = util.prepare(kwArgs);
			var sql = "SELECT * FROM QueueCache WHERE queue=:queue",
				queue = "disc";

			if(kwArgs.url == "queues/disc/saved"){ queue = "saved"; }
			else if(kwArgs.url == "at_home"){ queue = "at_home"; }
			else if(kwArgs.url == "queues/instant"){ queue = "instant"; }
			else if(kwArgs.url == "rental_history/watched"){ queue = "watched"; }
			else if(kwArgs.url.indexOf("rental_history")>-1){ queue = "history"; }
			
			db.execute({
				sql: sql,
				params: {
					queue: queue
				},
				result: function(data){
					//	pre-process and send back.
					var a = [];
					if(data && data.length){
						a = dojo.fromJson(data[0].json);
						dojo.forEach(a, function(item){
							item.title.art.large = util.image.url(item.title.art.large);
							item.title.art.small = util.image.url(item.title.art.small);
							qd.services.item(item);
							qd.services.item(item.title);
						});
					}
					dfd.callback(a);
				},
				error: function(data){
					dfd.errback(data);
				}
			});
			return dfd;
		},
		atHome: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "at_home";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
				console.log("offline at home: ", arr);
			});
			return dfd;
		},
		discs: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "queues/disc";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("discs: ", arr);
			});
			return dfd;
		},
		saved: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "queues/disc/saved";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("saved discs: ", arr);
			});
			return dfd;
		},
		instant: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "queues/instant";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("instant: ", arr);
			});
			return dfd;
		},
		watched: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "rental_history/watched";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
			//	console.log("watched: ", arr);
			});
			return dfd;
		},
		shipped: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "rental_history/shipped";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
				console.log("shipped: ", arr);
			});
			return dfd;
		},
		returned: function(kwArgs){
			kwArgs = kwArgs || {};
			kwArgs.url = "rental_history/returned";
			var dfd = this.fetch(kwArgs);
			dfd.addCallback(function(arr){
				console.log("returned: ", arr);
			});
			return dfd;
		},
		modify: function(/* qd.services.online.queues.add.__AddArgs */kwArgs){
			var dfd = util.prepare(kwArgs),
				item = qd.services.item(kwArgs.guid),
				title = kwArgs.title || "";

			if(kwArgs.position === undefined){
				//	this is an add.  In theory we should never get here.
				setTimeout(function(){
					dfd.callback({});
				}, 10);
				return dfd;
			}

			var sql = "INSERT INTO TransactionQueue (method, args, prompt, dateAdded) "
				+ " VALUES (:method, :args, :prompt, DATETIME())";

			var args = {
				url: kwArgs.url || "queues/disc",
				guid: kwArgs.guid,
				title: kwArgs.title,
				position: kwArgs.position
			};
			if(kwArgs.format !== undefined){
				args.format = kwArgs.format;
			}

			var params = {
				method: "modify",
				args: dojo.toJson(args),
				prompt: 'Modifying queue item "' + title + '"'
			};

			db.execute({
				sql: sql,
				params: params,
				result: function(data){
					//	need to set up a fake status object, depends on how this
					//	method was called.
					var obj = {};
					obj.code = "201";
					var i = dojo.clone(item);
					i.guid = i.id.substr(0, lastIndexOf("/")) + kwArgs.position + i.id.substr(lastIndexOf("/")+1);
					i.position = kwArgs.position;
					obj.created = [ i ];
					dfd.callback(obj);
				}
			});

			return dfd;
		},
		remove: function(/* qd.services.online.queues.remove.__RemoveArgs */kwArgs){
			var dfd = util.prepare(kwArgs);
			var sql = "INSERT INTO TransactionQueue (method, args, prompt, dateAdded) "
				+ " VALUES (:method, :args, :prompt, DATETIME())";
			db.execute({
				sql: sql,
				params: {
					method: "remove",
					args: dojo.toJson({
						url: kwArgs.url,
						guid: kwArgs.guid,
						title: kwArgs.title
					}),
					prompt: 'Removing "' + (kwArgs.title||"") + '" from the ' + (kwArgs.url.indexOf("instant")>-1?"instant":"disc") + " queue"
				},
				result: function(data){
					dfd.callback({ code: 200 });
				}
			});		
			return dfd;
		},
		cache: function(){ return; },
		addMovieById: function(/* String */movieId, target, /* String */queue){
			//	summary:
			//		Interceptor function to store the transaction to be executed
			//		upon returning online.
			queue = queue || "queue";
			var item = qd.services.item(movieId);
			if(!item){
				console.warn("Can't add movie: it doesn't have full information here yet.", movieId);
				return;
			}

			var sql = "INSERT INTO TransactionQueue (method, args, prompt, dateAdded) "
				+ " VALUES (:method, :args, :prompt, DATETIME())";
			db.execute({
				sql: sql,
				params: {
					method: "add",
					args: dojo.toJson({
						movieId: movieId,
						queue: queue
					}),
					prompt: 'Adding "' + item.title + '" to the ' + (queue=="queue"?"disc":"instant") + " queue"
				},
				result: function(data){
					console.log("addMovieById storage complete.");
				}
			});		
		},
		addMovieByTerm: function(/* String */term, target, /* String */queue){
			//	summary:
			//		Interceptor function to store the transaction to be executed
			//		upon returning online.
			queue = queue || "queue";
			var sql = "INSERT INTO TransactionQueue (method, args, prompt, dateAdded) "
				+ " VALUES (:method, :args, :prompt, DATETIME())";
			db.execute({
				sql: sql,
				params: {
					method: "termAdd",
					args: dojo.toJson({
						term: term,
						queue: queue
					}),
					prompt: 'Adding "' + term + '" to the ' + (queue=="queue"?"disc":"instant") + " queue"
				},
				result: function(data){
					console.log("addMovieByTerm storage complete.");
				}
			});		
		}
	});
})();

}

if(!dojo._hasResource["qd.services.offline.user"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.offline.user"] = true;
dojo.provide("qd.services.offline.user");

(function(){
 	dojo.mixin(qd.services.offline.user, {
		fetch: function(){
			//	summary:
			//		Return the cached user object if we are authorized.
			var dfd = new dojo.Deferred();
			var fn = function(){
				dfd.errback(new Error("qd.service.user.fetch: you must authorize the application to fetch user details."));
			};

			setTimeout(function(){
				dfd.callback(qd.app.user());
			}, 10);
			return dfd;
		}
	});
})();

}

if(!dojo._hasResource["qd.services.offline"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.offline"] = true;
dojo.provide("qd.services.offline");






}

if(!dojo._hasResource["qd.services.authorization"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services.authorization"] = true;
dojo.provide("qd.services.authorization");



//	takes the place of qd.oauth's handshake process.
(function(){
	var auth = qd.services.authorization;
	
	auth.request = function(){
		//	summary:
		//		In the event of a new user, we need to
		//		request a user's access token.  This is
		//		done through a non-standard handshake 
		//		process.
		//
		//		Based on Mike Wilcox's original oauth
		//		handshake.

		var dfd = new dojo.Deferred(),
			token = qd.app.authorization;

		var kwArgs = {
			url: "http://api.netflix.com/oauth/request_token",
			handleAs: "text",
			error: function(err, ioArgs){
				console.warn("qd.services.authorization.request: error getting initial request token.");
				console.error(ioArgs.xhr.responseText);
				dfd.errback("auth", ioArgs.xhr.responseText);
			},
			load: function(response, ioArgs){
				//	this should force us to open the window for the Netflix auth handshake.
				console.log("qd.services.authorization.request: initial handshake complete.");
				var a = response.split("&"),
					o = {};
				dojo.forEach(a, function(item){
					var pair = item.split("=");
					o[pair[0]] = unescape(pair[1]);
				});
				console.log("Initial handshake items: ", o);

				var url = "http://api-user.netflix.com/oauth/login?"
					+ "application_name=" + o.application_name
					+ "&oauth_consumer_key=" + token.consumer.key
					+ "&oauth_token=" + o.oauth_token;

				//	temporarily set the token for the second part of the handshake.
				token.token = {
					key: o.oauth_token,
					secret: o.oauth_token_secret
				};

				//	open up the new window for authorization
				var win1 = new dair.Window({
					size: { h: 525, w: 350, t: 100, l: 100 },
					href: url,
					resizable: false,
					alwaysInFront: true,
					maximizable: true,
					minimixeable: false
				});

				//	add event listeners on the window.
				var seenOnce = false;
				var v = setInterval(function(){
					var wurl = win1._window.location;
					if(wurl != url){
						console.log("Handshake window URL change: ", wurl);
						if(!seenOnce && wurl=="https://api-user.netflix.com/oauth/login"){
							seenOnce = true;
							return;
						} 
						else if(wurl=="http://www.netflix.com/TermsOfUse"){
							//looking at the terms of use. Don't know how to get them back.
							return;
						}
						else if(wurl.indexOf("Failed")>0){
							console.warn("Bad username or password in the handshake window.");
							//	TODO: fire off the errback and kill the timer?
							return;
						}
						console.warn("Handshake succeeded.");
						clearInterval(v);
						v = null;
						win1.close();
					}
				}, 1000);
				var c2 = dojo.connect(win1, "onClose", function(){
					if(v){
						console.warn("User did not try to authorize!");
						dfd.errback("user");
						clearInterval(v);
						dojo.disconnect(c2);
						return;
					}

					//	we're good to go, so go get the access token
					dojo.xhrGet(dojox.io.OAuth.sign("GET", {
						url: "http://api.netflix.com/oauth/access_token",
						handleAs: "text",
						error: function(err, ioArgs){
							console.error(ioArgs.xhr.responseText);
							dfd.errback("auth");
						},
						load: function(response, ioArgs){
							console.warn("ACCESS GRANTED: ", response);
							var a = response.split("&"), o = {};
							dojo.forEach(a, function(item){
								var p = item.split("=");
								o[p[0]] = unescape(p[1]);
							});
							qd.app.authorize(o.oauth_token, o.oauth_token_secret, o.user_id);
							dfd.callback(o.user_id);	//	original used the username, should see if we can grab that.
						}
					}, token), false);
				});
			}
		};

		dojo.xhrGet(dojox.io.OAuth.sign("GET", kwArgs, token), false);
		return dfd;
	};
})();

}

if(!dojo._hasResource["qd.services"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.services"] = true;
dojo.provide("qd.services");

//	This file is primarily a package loader, and initializer.









(function(){
	var storage = qd.services.storage,
		network = qd.services.network,
		db = "queued.db",
		dbProp = "OUhxbVZ1Mtmu4zx9LzS5cA==",
		pwd = storage.item(dbProp);

	dojo.connect(storage, "onClear", function(){
		//	push the database access info back into storage.  Basically if we don't have
		//	the password, probably we're at re-initializing everything.
		if(pwd){
			storage.item(dbProp, pwd);
		}
	});

	qd.services._forceCreate = false;
	qd.services.init = function(){
		if(!pwd){
			//	generate a new password for the database service and store it.
			var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&*~?0123456789-_abcdefghijklmnopqrstuvwxyz",
				key = "";
			for(var i=0; i<16; i++){
				key += tab.charAt(Math.round(Math.random()*tab.length));
			}
			pwd = storage.item(dbProp, key);
		}

		qd.services.network.start();
		qd.services.data.init(pwd, db, qd.services._forceCreate);
	};

	var registry = {}, titleRegistry = {};
	qd.services.item = function(/* String | Object */item){
		//	summary:
		//		Registry operations.  If item is a string,
		//		this acts as a getter.  If it is an object,
		//		it acts as a setter.  Note that this should
		//		work for *any* object in the system, not just
		//		titles.
		if(dojo.isString(item)){
			return registry[item] || null;
		}

		//	assume it's an object.
		if(item && !item.guid){
			console.warn("qd.services.item: the passed item has no guid!", item);
			return null;
		}

		var tmp = registry[item.guid];
		if(tmp){
			item = qd.services.util.mixin(tmp, item);
		}

		registry[item.guid] = item;
		if(item.title){
			titleRegistry[item.title] = item;
		}
		return item;
	};

	qd.services.itemByTerm = function(/* String */term){
		//	summary:
		//		Find any objects in the registry based on a title.
		//		If found, return it.
		return titleRegistry[term];
	};

	qd.services.clearItems = function(){
		registry = {};
		titleRegistry = {};
	};
})();

}

if(!dojo._hasResource["qd.app"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app"] = true;
dojo.provide("qd.app");




qd.app = new (function(){
	//	native application references
	var _app = air.NativeApplication.nativeApplication,
		self = this;

	//	BEGIN APPLICATION-SPECIFIC EVENTS
	_app.idleThreshold = 300;

	//	Application-specific information
	this.__defineGetter__("info", function(){
		//	summary:
		//		Get the application information and return
		//		it as a JSON object.
		var xml = new DOMParser().parseFromString(_app.applicationDescriptor, "text/xml"),
			root = xml.getElementsByTagName("application")[0],
			copy = root.getElementsByTagName("copyright")[0],
			ver = root.getElementsByTagName("version")[0];

		var o = {
			applicationId: _app.applicationID,
			publisherId: _app.publisherID,
			autoExit: _app.autoExit,
			idleThreshold: _app.idleThreshold,
			copyright: (copy && copy.firstChild && copy.firstChild.data) || null,
			version: (ver && ver.firstChild && ver.firstChild.data) || null
		};
		return o;	//	Object
	});
	this.__defineGetter__("version", function(){
		//	summary:
		//		Return a float version of the version of Queued.
		var info = this.info;
		if(info.version){
			return parseFloat(info.version, 10);
		}
		return null;
	});

	//	
	//	cleanup functions
	function onExit(evt){
		//	close all the windows and check to make sure they don't stop
		//	the event; if they don't, then go ahead and fire our own exiting
		//	event.
		air.trace("CLOSURE EXIT")
		if(evt.isDefaultPrevented()){
			return;	//	don't do anything
		}
		self.onExit(evt);
		if(evt.isDefaultPrevented()){
			return;	//	don't do anything
		}
	}

//	since we are init, there should only be one open window.
	window.nativeWindow.addEventListener(air.Event.CLOSING, onExit);

	this.onExit = function(/* air.Event */evt){
		//	summary:
		//		Stub for handling any exiting events.
		console.log("qd.app.onExit: FIRING");
	};
	this.exit = function(){
		//	summary:
		//		Manually exit the application and call any finalizers.
		//		This *should* call our onExit handlers, above.
		console.warn("APP EXIT")
		var evt = new air.Event(air.Event.EXITING, false, true); 
		_app.dispatchEvent(evt); 
		if(!evt.isDefaultPrevented()){
			_app.exit(); 
		} 
	};

	//	user idle functions
	this.__defineGetter__("lastInput", function(){
		//	summary:
		//		The time, in seconds, since the last user input on the app.
		return _app.timeSinceLastUserInput;	 //	int
	});
	this.__defineGetter__("idleThreshold", function(){
		return _app.idleThreshold;
	});
	this.__defineSetter__("idleThreshold", function(/* int */n){
		_app.idleThreshold = n;
	});

	function onIdle(evt){
		self.onIdle(evt);
	}
	function onPresent(evt){
		self.onPresent(evt);
	}
	_app.addEventListener(air.Event.USER_IDLE, onIdle);
	_app.addEventListener(air.Event.USER_PRESENT, onPresent);

	this.onIdle = function(/* air.Event */evt){
		//	summary:
		//		Stub for handling when the user is idle.
		console.log("qd.app.onIdle: FIRING");
	};
	this.onPresent = function(/* air.Event */evt){
		//	summary:
		//		Stub for handling when the user returns from being idle.
		console.log("qd.app.onPresent: FIRING");
	};

	//	checking to see if this is the first time running the app.
	this.onUpgrade = function(oldVersion, newVersion){
		//	summary:
		//		Stub for when the application is upgraded
		console.warn("Update detected!  Upgrading to version " + newVersion);
		var file = air.File.applicationDirectory.resolvePath("js/updates/commands.js");
		if(file.exists){
			var fs = new air.FileStream();
			fs.open(file, air.FileMode.READ);
			var js = fs.readUTFBytes(fs.bytesAvailable);
			fs.close();
			eval(js);
			if(Updater){
				Updater.invoke(oldVersion, newVersion);
			}
		}
	};
	this.onFirstRun = function(info){
		//	summary:
		//		Stub for when the application is run for the first time
		console.log("qd.app.onFirstRun!");
		console.log(info);
	};

//	dojo.addOnLoad(function(){
	(function(){
		//	look for the existance of a file.
		var info = self.info,
			version = parseFloat(info.version, 10),
			file = air.File.applicationStorageDirectory.resolvePath("preferences/version.txt"),
			doWrite = false;
		if(file.exists){
			//	check to see the version matches.
			var stream = new air.FileStream(); 
			stream.open(file, air.FileMode.READ); 
			var content = parseFloat(stream.readUTFBytes(stream.bytesAvailable), 10); 
			stream.close(); 
			if(content < version){
				//	we have an updated version.
				self.onUpgrade(content, version);
				doWrite = true;
			}
		} else {
			//	fire the onFirstRun event.
			self.onFirstRun(info);
			doWrite = true;
		}

		//	finally, write the new file if needed.
		if(doWrite){
			var stream = new air.FileStream(); 
			stream.open(file, air.FileMode.WRITE); 
			var content = stream.writeUTFBytes(version); 
			stream.close(); 
		}
	})();
//	});

	//	END APP EVENTS
	
	//	Authorization setup.
	var acl;
	this.__defineGetter__("authorization", function(){
		//	summary:
		//		Return the private authorization object for OAuth-based requests.
		if(!acl){
			acl = {
				consumer: {
					key:"6tuk26jpceh3z8d362suu2kd",
					secret:"pRM4YDTtqD"
				},
				sig_method: "HMAC-SHA1",
				token: null,
				userId: null
			};
			qd.services.storage.item("token", acl);
		}
		return acl;	//	Object
	});

	this.__defineGetter__("authorized", function(){
		//	summary:
		//		Return whether or not the current user is actually authorized.
		//		Replaces isLoggedIn().
		var signer = this.authorization;
		return (signer.token !== null && signer.userId !== null);
	});

	this.authorize = function(/* String */token, /* String */secret, /* String */userId){
		//	summary
		//		Set the user's tokens on the ACO.
		if(!token || !secret){
			throw new Error("qd.app.authorize: you must pass the authorization information.");
		}

		var o = this.authorization;

		//	set the token properties
		o.token = {
			key: token,
			secret: secret
		};

		//	set the userId
		o.userId = userId;

		//	drop it into storage.
		qd.services.storage.item("token", o);
		return o;
	};

	this.deauthorize = function(){
		//	summary:
		//		Remove the Netflix authorization tokens from the application's acl object.
		var o = this.authorization;
		o.token = null;
		o.userId = null;
		qd.services.storage.item("token", o);

		//	remove the user object from storage.
		qd.app.user(null);
		qd.service.titles.clear();
		qd.service.queues.clear();
		qd.services.clearItems();

		return o;
	};

	//	authorization initialization
	dojo.addOnLoad(function(){
		//	try to get the current token out of storage.
		try {
			acl = qd.services.storage.item("token");
		} catch(ex){
			//	swallow it.
		}
	});

	//	User information
	var user;
	this.user = function(/* Object? */obj){
		if(obj!==undefined){
			user = obj;
			this.save();
			return user;
		}
		if(user){
			return user;
		}
		return user = qd.services.storage.item("user");
	};
	this.save = function(){
		var _s = new Date();
		qd.services.storage.item("user", user);
		console.warn("Time to save user info into storage: " + (new Date()-_s) + "ms.");
	};

	dojo.addOnLoad(function(){
		var user = qd.app.user();
		if(user){
			dojo.byId("topNavUser").innerHTML = "Welcome " + user.name.first + " " + user.name.last;
			dojo.byId("prefsUserName").innerHTML = user.name.first + " " + user.name.last;
		}
		else if(!user && qd.app.authorized){
			//	fetching the user information, since it seems to be missing.
			var h = dojo.connect(qd.services.network, "onChange", function(){
				dojo.disconnect(h);
				var dfd = qd.service.user.fetch();
				dfd.addCallback(function(obj){
					qd.app.user(obj);
					dojo.byId("topNavUser").innerHTML = "Welcome " + obj.name.first + " " + obj.name.last;
					dojo.byId("prefsUserName").innerHTML = obj.name.first + " " + obj.name.last;
				});
			});
		}

		if(qd.app.authorized){
			dojo.style("searchBar", "display", "block");
			dojo.removeClass(dojo.body(), "notLoggedIn");
		}
	});

	//	view the source code.
	this.source = function(){
		try {
			var vs = air.SourceViewer.getDefault();
			//	Note that the following exclusions are aimed at a release, and not a debug session.
			vs.setup({ 
				exclude: [ '/lib', '/META-INF', 'mimetype', 'Queued.exe', 'Icon.icns' ],
				colorScheme: 'nightScape'	
			});
			vs.viewSource();
		} catch(ex){
			console.warn("You cannot run the source code viewer in debug mode.");
			console.dir(ex);
		}
	};

	/*=====
	 qd.app.underlay.__Args = function(params){
		//	params: Object
		//		Parameters governing the underlay behavior:
		//		* loader (Boolean, default true) specifies whether or not
		//		to show the spinner/loading box.
		//		* bodyOnly (Boolean, default true) specifies whether or
		//		not to cover the page header with the underlay, as opposed
		//		to covering only the page content/body area.
		this.params = params;
	 }
	=====*/ 

	// Here's a simple underlay object; call the show() and hide() methods
	// to toggle it on and off. The object tracks the calls with a simple
	// counter and only hides the underlay when the number of calls to
	// hide() matches the number of calls to show().
	this.underlay = new (function(){
		var inc=0;
		this.show = function(/* qd.app.underlay.show.__Args */kwArgs){
			if(++inc){
				var u1 = dojo.byId("topMoviesUnderlay"),
					u2 = dojo.byId("queueUnderlay"),
					args = dojo.mixin({loader:true, bodyOnly:true}, kwArgs||{});
				if(u1){
					dojo.style(u1, {display:"block", height:u1.parentNode.scrollHeight});
				}
				if(u2){
					dojo.style(u2, {display:"block", height:u2.parentNode.scrollHeight});
				}
				if(!args.bodyOnly){
					dojo.style("headerUnderlay", "display", "block");
				}
				if(args.loader){
					var n = dojo.byId("loaderNode");
					dojo.style(n, {display:"block", opacity:0});
					dojo.fadeIn({node:n}).play();
				}
			}
		};
		this.hide = function(){
			if(!--inc){
				var n = dojo.byId("loaderNode");
				if(dojo.style(n, "display") == "block"){
					var anim = dojo.fadeOut({node:n});
					var __ac = dojo.connect(anim, "onEnd", function(){
						dojo.disconnect(__ac);
						dojo.style(n, "display", "none");
					});
					anim.play();
				}
				dojo.style("headerUnderlay", "display", "none");
				dojo.style("topMoviesUnderlay", "display", "none");
				dojo.style("queueUnderlay", "display", "none");
			}
			if(inc < 0){ inc=0; } // handle excessive calls to hide()
		};
	})();

	this.loadingIcon = new (function(){
		var showing = false, timer;
		this.__defineGetter__("showing", function(){
			return showing;
		});
		this.show = function(){
			//	error icon always takes precedence.
			if(qd.app.errorIcon.showing){ return; }
			if(showing){ return; }

			dojo.query(".loadingIndicator, .bgLoadingSpinner").forEach(function(item){
				dojo.style(item, {
					opacity: 1,
					display: "block"
				});
			});
			showing = true;

			//	force it to go away eventually.
			timer = setTimeout(dojo.hitch(this, function(){
				this.hide();
			}), 10000);
		};
		this.hide = function(){
			dojo.query(".loadingIndicator, .bgLoadingSpinner").forEach(function(item){
				item.style.display = "none";
			});
			showing = false;
			if(timer){ 
				clearTimeout(timer);
				timer = null;
			}
		};
	})();

	this.errorIcon = new (function(){
		var showing = false;
		this.__defineGetter__("showing", function(){
			return showing;
		});
		this.show = function(){
			if(showing){ return; }

			if(qd.app.loadingIcon.showing){
				qd.app.loadingIcon.hide();
			}

			dojo.query(".loadingIndicator, .offlineIndicator").forEach(function(item){
				dojo.style(item, {
					opacity: 1,
					display: "block"
				});
			});
			showing = true;
		};
		this.hide = function(){
			dojo.query(".loadingIndicator, .offlineIndicator").forEach(function(item){
				item.style.display = "none";
			});
			showing = false;
		};
	})();

	this.errorTooltip = new (function(){
		var fader, timeout, delay = 5000, duration = 1600, endHandle;
		this.show = function(/* String */title, /* String */msg, /* Boolean? */persistIcon){
			//	summary:
			//		Show the indicator toolip with the given message parts.
			//	title: String
			//		The main message to show the user.
			//	msg: String
			//		The explanation for the user as to what happened.
			//	persistIcon: Boolean?
			//		Leave the icon showing if this is true.  Defaults to false.
			title = title || "An unknown error occured.";
			msg = msg || "A unknown error occured with your last action.";
			persistIcon = (persistIcon !== undefined) ? persistIcon : false;
			var n = dojo.byId("indicatorTooltip");

			if(timeout){
				clearTimeout(timeout);
			}

			//	stop the fader.
			if(fader){
				fader.stop();
				fader = null;
			}

			//	set the messages.
			dojo.query("h1,p", n).forEach(function(node){
				if(node.tagName.toLowerCase() == "h1"){
					node.innerHTML = title;
				} else {
					node.innerHTML = msg;
				}
			});

			//	show the error icon.
			qd.app.errorIcon.show();

			//	show the node.
			dojo.style(n, {
				opacity: 1,
				display: "block"
			});

			//	set up the fader
			setTimeout(function(){
				fader = dojo.fadeOut({ node: n, duration: duration });
				endHandle = dojo.connect(fader, "onEnd", function(){
					n.style.display = "none";
					dojo.disconnect(endHandle);
					endHandle = null;

					if(!persistIcon){
						setTimeout(function(){
							qd.app.errorIcon.hide();
						}, 1000);
					}
				});
				fader.play();
			}, delay);
		};

		this.hide = function(){
			//	summary:
			//		Force the tooltip to be hidden.
			qd.app.errorIcon.hide();

			var n = dojo.byId("indicatorTooltip");
			if(timeout){
				clearTimeout(timeout);
				timeout = null;
			}

			if(fader){
				fader.stop();
				fader = null;
			}

			if(endHandle){
				dojo.disconnect(endHandle);
				endHandle = null;
			}
			n.style.display = "none";
		};
	})();

	//	deal with the online / offline indicators.
	dojo.addOnLoad(function(){
		dojo.connect(qd.services.network, "onChange", function(state){
			if(state){
				//	we're online, hide the error stuff if needed.
				qd.app.errorTooltip.hide();
			} else {
				qd.app.errorTooltip.show(
					"Cannot reach the Netflix servers.",
					"Ratings and Queue changes will by synced to Netflix when a connection can be re-established.",
					true
				);
			}
		});
	});

	this.switchPage = function(/* String */page){
		//	summary:
		//		Change to another top-level application page.
		//	page:
		//		"yourQueue", "topMovies", "auth", "preferences
		var divId, menuId, bkClass;
		switch(page){
			case "yourQueue":
				divId = "queueContentNode";
				menuId = "bigNavYourQueue";
				bkClass = false;
				break;
			case "topMovies":
				divId = "topMoviesContainerNode";
				menuId = "bigNavTopMovies";
				bkClass = false;
				break;
			case "auth":
				divId = "authContentNode";
				menuId = "";
				bkClass = true;
				break;
			case "preferences":
				divId = "prefsContainerNode";
				menuId = "";
				bkClass = true;
				break;
		}

		console.log("app switch page: " + page, dijit.byId("contentNode"));

		dijit.byId("contentNode").selectChild(divId);	
		qd.app.selectNav(menuId, "bigNav");
		if(page == "topMovies"){
			qd.app.topMovies.checkForRefresh();	
		}
		
		// changes the background color of the app to
		// more closely match the current page. Helps hide
		// blemishes on window resize. 
		if(bkClass){
			dojo.addClass(dojo.body(), "blueBk");
		}else{
			dojo.removeClass(dojo.body(), "blueBk");
		}
	};
	
	this.selectNav = function(/* String */navItemId, /* String */navId){
		//	summary:
		//		Toggle selection styles for navigation items (just does
		//		the styling part; it doesn't actually set container node
		//		visibility or anything)
		//	navItemId:
		//		ID of the nav item to mark as selected
		//	navId:
		//		ID of the list in which the toggling is occurring
		dojo.query("#"+navId+" li").removeClass("selected");
		if (navItemId) {
			dojo.addClass(dojo.byId(navItemId), "selected");
		}
	};

	this.setTopRightNav = function(/* String */username){
		//	summary:
		//		Set up the navigation (username, prefs) on the top right of the screen.
		if(username){
			dojo.byId("topNavUser").innerHTML = "Welcome " + username;
			dojo.byId("prefsUserName").innerHTML = username;
		}
	};

	// single point of contact to determine when and/or whether some DnD is happening;
	var _isDragging = false;
	this.isDragging = function(){
		//	summary:
		//		Return whether or not something is being dragged.
		return _isDragging;	//	Boolean
	};
	this.startDragging = function(){
		//	summary:
		//		Set the isDragging flag
		_isDragging = true;
	}
	this.stopDragging = function(){
		//	summary:
		//		Unset the isDragging flag.
		_isDragging = false;
	}
	//	setup the dragging topics
	dojo.subscribe("/dnd/start", this, "startDragging");
	dojo.subscribe("/dnd/cancel", this, "stopDragging");
	dojo.subscribe("/dnd/drop", this, "stopDragging");

	//	set up the application-level behaviors
	dojo.behavior.add({
		// Top-level navigation
		"#bigNavTopMovies a": {
			onclick:dojo.hitch(this, function(){
				this.switchPage("topMovies");
				return false;
			})
		},
		
		// Top-level navigation
		"#bigNavYourQueue a": {
			onclick:dojo.hitch(this, function(){
				this.switchPage("yourQueue");
				return false;
			})
		}
	});
})();

}

if(!dojo._hasResource["qd.app.queueList"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.queueList"] = true;
dojo.provide("qd.app.queueList");





(function(){

	var REMOVAL_CONFIRMATION_TIMER_DURATION = 5000; // milliseconds to show the keep/remove button

	var create = function(tagName, text, _class, parent){

		var node = dojo.doc.createElement(tagName);

		if (text) 			{ node.innerHTML = text		};
		if (_class) 		{ node.className = _class	};
		if (tagName =="a")	{ node.href = "#"			};
		if (parent)			{ parent.appendChild(node) 	};

		return node;
	}

	var _reg = new RegExp(/\$\{.*?\}/gi);

	var makeTemplate = function(str, item, dbg){
		var tpl = "";
		var props = [];
		dojo.forEach(str.match(_reg), function(p){
			props.push(dojo.trim(p.substring(2,p.length-1)));
		});
		var frags = str.split(_reg);
		for(var i=0;i<frags.length;i++){
			tpl += frags[i];
			if(i<frags.length-1){
				tpl += item[props[i]] || dojo.getObject(props[i], false, item);
			}
		}
		return tpl;
	}


	var tpls = {
		queue: 		'<tr class="listQueuedRow" movie="${guid}">'
						+ '<td class="index dojoDndHandle"><div><input dojoAttachPoint="textbox" dojoAttachEvent="keyup:onTextKeyUp,blur:onTextBlur" type="text" value="" /></div></td>'
						+ '<td class="top dojoDndHandle" dojoAttachEvent="click:onTopClick"></td>'
						+ '<td class="title dojoDndHandle" dojoAttachEvent="click:onTitleClick">${title.title}</td>'
						+ '<td class="instant">${instantStr}</td>'
						+ '<td class="stars dojoDndHandle"><span class="starRating${starRatingEnabledStr}" style="visibility:hidden;" dojoAttachPoint="ratingNode"></span></td>'
						+ '<td class="genre dojoDndHandle">${genreStr}</td>'
						+ '<td class="format dojoDndHandle">${format}</td>'
						+ '<td class="remove"><div>'
							+ '<span dojoAttachPoint="removeButtonNode" class="button" dojoAttachEvent="click:onRemClick"></span>'
							+ '<span dojoAttachPoint="confirmButtonNode" class="confirm">'
								+ '<span class="confirmRemove" dojoAttachEvent="click:onConfirmRemoveClick"></span>'
								+ '<span class="keep" dojoAttachEvent="click:onKeepClick"></span>'
							+ '</span>'
						+ '</div></td>'
					+ '</tr>',

		at_home:	'<tr class="listQueuedRow" id="${guid}" movie="${guid}">'
						+ '<td class="title" dojoAttachEvent="click:onTitleClick, mouseover:onTitleOver, mouseout:onTitleOut">${title.title}</td>'
						+ '<td class="instant">${instantStr}</td>'
						+ '<td class="stars dojoDndHandle"><span class="starRating${starRatingEnabledStr}" style="visibility:hidden;" dojoAttachPoint="ratingNode"></span></td>'
						+ '<td class="shipped">${shipped}</td>'
						+ '<td class="arrive">${estimatedArrival}</td>'
						+ '<td class="problem"><a href="#" dojoAttachEvent="click:onProblemClick">Report a problem</a></td>'
					+ '</tr>',



		/// hmmm.. This is the same as 'queue'. May need to change how we fetch templates - with a function
		instant:	'<tr class="listQueuedRow" movie="${guid}">'
						+ '<td class="index dojoDndHandle"><div><input dojoAttachPoint="textbox" dojoAttachEvent="keyup:onTextKeyUp,blur:onTextBlur" type="text" value="" /></div></td>'
						+ '<td class="top dojoDndHandle" dojoAttachEvent="click:onTopClick"></td>'
						+ '<td class="title dojoDndHandle" dojoAttachEvent="click:onTitleClick">${title.title}</td>'
						+ '<td class="instant">${instantStr}</td>'
						+ '<td class="stars dojoDndHandle"><span class="starRating${starRatingEnabledStr}" style="visibility:hidden;" dojoAttachPoint="ratingNode"></span></td>'
						+ '<td class="genre dojoDndHandle">${genreStr}</td>'
						+ '<td class="remove"><div>'
							+ '<span dojoAttachPoint="removeButtonNode" class="button" dojoAttachEvent="click:onRemClick"></span>'
							+ '<span dojoAttachPoint="confirmButtonNode" class="confirm">'
								+ '<span class="confirmRemove" dojoAttachEvent="click:onConfirmRemoveClick"></span>'
								+ '<span class="keep" dojoAttachEvent="click:onKeepClick"></span>'
							+ '</span>'
						+ '</div></td>'
					+ '</tr>',

		watched:	'<tr class="listQueuedRow" movie="${guid}">'
						+'<td class="viewed">${watched}</td>'
						+ '<td class="title" dojoAttachEvent="click:onTitleClick">${title.title}</td>'
						+ '<td class="instant">${instantStr}</td>'
						+ '<td class="stars dojoDndHandle"><span class="starRating${starRatingEnabledStr}" style="visibility:hidden;" dojoAttachPoint="ratingNode"></span></td>'
						+ '<td class="genre">&nbsp;</td>'
						+ '<td class="details">&nbsp;</td>'
					+ '</tr>',

		history:	'<tr class="listQueuedRow" movie="${guid}">'
						+ '<td class="title" dojoAttachEvent="click:onTitleClick">${title.title}</td>'
						+ '<td class="stars dojoDndHandle"><span class="starRating${starRatingEnabledStr}" style="visibility:hidden;" dojoAttachPoint="ratingNode"></span></td>'
						+ '<td class="shipped">${shipped}</td>'
						+ '<td class="returned">${returnedStr}</td>'
						+ '<td class="details">${detailsStr}</td>'
					+ '</tr>',

		saved:	'<tr class="listQueuedRow" movie="${guid}">'
						+ '<td class="title" dojoAttachEvent="click:onTitleClick">${title.title}</td>'
						+ '<td class="stars dojoDndHandle"><span class="starRating${starRatingEnabledStr}" style="visibility:hidden;" dojoAttachPoint="ratingNode"></span></td>'
						+ '<td class="genre">${genreStr}</td>'
						+ '<td class="availability">${title.dates.availability}</td>'
						+ '<td class="remove"><div>'
							+ '<span dojoAttachPoint="removeButtonNode" class="button" dojoAttachEvent="click:onRemClick"></span>'
							+ '<span dojoAttachPoint="confirmButtonNode" class="confirm">'
								+ '<span class="confirmRemove" dojoAttachEvent="click:onConfirmRemoveClick"></span>'
								+ '<span class="keep" dojoAttachEvent="click:onKeepClick"></span>'
							+ '</span>'
						+ '</div></td>'
					+ '</tr>',
		
		noItems: '<tr class="listQueuedRow noItems">'
							+ '<td colspan="${colspan}">There are no items in this list.</td>'
						+ '</tr>'
	};

	qd.app.nonItem = function(){
		this.item = {};
		this.constructor = function(options, parentNode){
			dojo.mixin(this, options);
			this.item.colspan = (this.type=="queue"||this.type=="instant") ? "8" : "6";
			this.type = "noItems";
			var tpl = makeTemplate(tpls[this.type], this.item);
			var div = dojo.doc.createElement("div");
			div.innerHTML = tpl;
			this.domNode = div.firstChild;
			parentNode.appendChild(this.domNode);
		};
		this.destroy = function(){
			dojo._destroyElement(this.domNode);
			delete this;
		};
		this.constructor.apply(this, arguments);
	};
	
	qd.app.queueItem = function(){
		this.id = "";
		this.item = {};
		this._connects = [];
		this.type = "";
		this.parent = null;
		this.resetFormat = "";
		
		this.__defineGetter__("position", function() {
			return this.item.position;
		});

		this.__defineSetter__("position", function(pos) {
			if (this.textbox) {
				this.item.position = pos;
				this.textbox.value = pos;
			}
		});

		this.constructor = function(options, parentNode){
			dojo.mixin(this, options);
			
			//console.log(" ---- ", this.item.title.title, this.type, " item::", this.item)
			
			this.id = this.item.id;
			this.guid = this.item.guid;
			this.item.genreStr = this.item.title.categories[0];
			// play button
			this.item.instantStr = (
				this.type=="instant"
				|| this.type=="watched"
				|| ("instant"||"Instant") in this.item.title.formats
				|| this.item.format=="Instant"
				|| this.type=="watchedList") ? '<a href="#" dojoAttachEvent="click:onPlayClick">PLAY</a>' : '&nbsp';
			if(this.item.title.dates){
				this.item.estimatedArrival = this.item.estimatedArrival || "";
				this.item.shipped = this.item.shipped || "Shipping Now";
			}
			this.item.detailsStr = this.item.returned ? '&nbsp;' : '<a href="#" dojoAttachEvent="click:onProblemClick">Report a problem</a>';
			this.item.returnedStr = this.item.returned || '--';
			this.item.title.dates.availability = this.item.title.dates.availability || "--";
			if(this.item.guid) {
				this.item.starRatingEnabledStr = (!this.item.title.guid.match(/titles\/discs\//) || this.item.title.title.match(/Disc 1$/)) ? " enabled" : " nonFirst";
			}
			//this.item.starRatingEnabledStr
			var tpl = makeTemplate(tpls[this.type], this.item);
			var div = dojo.doc.createElement("div");
			div.innerHTML = tpl;
			var node = div.firstChild;
			parentNode.appendChild(node);
			this.attachEvents(node);
			this.postDom();
		};

		this.postDom = function(){
			//console.warn("POSTDOM", this.position, this.item.position)
			if (this.textbox) {
				this.textbox.value = this.position;
				this.textbox.maxLength = 3;
				this._connects.push(dojo.connect(this.textbox, "keypress", this, function(evt){
					if(evt.keyIdentifier){
						return true;
					}
					var k = evt.keyCode;
					//console.log("press:", k, evt.keyIdentifier, evt);
					if (k > 31 && (k < 48 || k > 57)) {
						dojo.stopEvent(evt);
						return false;
					}
					return true;
				}));
			}
		};

		this.setRatingData = function(user, pred, avg){
		//	console.log ("item.set rating", ((this.ratingNode)?"true":"false"));
			var node=this.ratingNode, type="average", rating=0;
			if(node) {
				if(user > 0){
					rating = user;
					type = "user";
				}else if(pred > 0){
					rating = pred;
					type = "predicted";
				}else if(avg > 0){
					rating = avg;
					type = "average";
				}
				qd.app.ratings.buildRatingWidget(node, type, rating);
				dojo.style(this.ratingNode, "visibility", "visible");
			}
		};

		this.attachEvents = function(node){
			//console.log("item attachEvents")
			this.domNode = node;
			var nodes = this.domNode.getElementsByTagName("*");
			dojo.forEach(nodes, function(n){
				var att = n.getAttribute("dojoAttachEvent");
				if (att) {
					dojo.forEach(att.split(","), function(pr){
						this._connects.push(dojo.connect(n, pr.split(":")[0], this, pr.split(":")[1]));
					}, this);
				}
				var att = n.getAttribute("dojoAttachPoint");
				if (att) {
					this[att] = n;
				}
			}, this);
		};

		this.destroy = function(){
			dojo.forEach(this._connects, dojo.disconnect, dojo);
			dojo._destroyElement(this.domNode);
			delete this;
		};

		this.update = function(newItem){
			// summary:
			//		New item returned from server
			//		Usually just new position
			this.item = newItem;
		};

		this.reset = function(){
			// summary:
			//		If the server call is unsuccessful
			//		do any resetting here
			this.textbox.value = this.position;
			console.log("reset", this.resetFormat, this.selFormat)
			if(this.resetFormat){
				setTimeout(dojo.hitch(this, function(){
					this.item.preferredFormatStr = this.resetFormat;
					this.resetFormat = "";
					this.selFormat.value =this.selFormat.selected = this.item.preferredFormatStr;
					console.warn("RESET!", this.item.preferredFormatStr, this.selFormat.value, this.selFormat.selected)
				}), 500)
			}
		};

		function toggleRemoveButtonState(outNode, inNode, duration){
			dojo.style(inNode, {display:"inline-block",opacity:0});
			var anim = dojo.fx.combine([
					dojo.fadeOut({node:outNode, duration:duration || 200}),
					dojo.fadeIn({node:inNode, duration:duration || 200})
				]),
				__h = dojo.connect(anim, "onEnd", function(){
					dojo.disconnect(__h);
					dojo.style(outNode, "display", "none");
				});
			anim.play();
		}

		this.cancelRemoveButtonTimer = function(){
			clearTimeout(this.confirmationTimer);
			this.confirmationTimer = null;
		}

		this.onFormatChange = function(evt){
			console.log("onFormatChange:", evt.target.value);
			if(evt.target.value!=this.item.preferredFormatStr){
				this.resetFormat = this.item.preferredFormatStr;
				this.item.preferredFormatStr=evt.target.value;
				this.parent.changeFormat(this);
			}	
		};
		
		this.onRemClick = function(){
			console.log("REMOVE clicked:", this.item.title);
			toggleRemoveButtonState(this.removeButtonNode, this.confirmButtonNode);
			// FIXME: this if() shouldn't be necessary, but since this method gets called
			//        twice per click, this ensures that the toggle only happens once
			if(!this.confirmationTimer){
				this.confirmationTimer = setTimeout(
					dojo.hitch(this, function(){
						toggleRemoveButtonState(this.confirmButtonNode, this.removeButtonNode, 500);
					}),
					REMOVAL_CONFIRMATION_TIMER_DURATION
				);
			}
		};

		this.onKeepClick = function(){
			//console.log("KEEP clicked:", this.item.title);
			this.cancelRemoveButtonTimer();
			toggleRemoveButtonState(this.confirmButtonNode, this.removeButtonNode);
		};

		this.onConfirmRemoveClick = function(){
			//console.log("CONFIRM REMOVE clicked:", this.item.title);
			this.cancelRemoveButtonTimer();
			this.parent.remove(this);
		};
		
		this.onProblemClick = function(){
			air.navigateToURL(new air.URLRequest("https://www.netflix.com/DiscProblems"));
		};
		this.onPlayClick = function(){
			console.log("PLAY clicked:", this.item.guid);
			//	test: try to open up a new AIR window using the url stuff from Netflix's api
			var href = "http://www.netflix.com/CommunityAPIPlay?devKey="
					+ qd.app.authorization.consumer.key
					+ "&movieid="
					+ encodeURIComponent(this.item.guid)
					+ "&nbb=y";
			console.log("PLAY: " + href);
			air.navigateToURL(new air.URLRequest(href));
		};

		this.onTitleClick = function(){
			//console.log("clicked:", this.item.title, this.item.id);
			qd.app.movies.showInfo(this.item.guid);
		};

		this.onTitleOver = function(){
			console.log("over:: " + this.item.title.title, this.item);
		};

		this.onTitleOut = function(){
			//console.log("out");
		};

		this.onTopClick = function(){
			if(this.position>1){
				this.parent.reorder(this, 1);	
			}
		};

		this.onTextKeyUp = function(evt){
			var k = evt.keyCode;
			//console.log("UP:", k, evt.keyIdentifier, evt);
			if(k == 13){
				this.parent.reorder(this, this.textbox.value);
			}
		};

		this.onTextBlur = function(evt){
			//console.log("blur", this.textbox.value, "=", this.position);
			if(this.textbox.value != this.position){
				this.textbox.value = this.position;
			}
		};

		this.constructor.apply(this, arguments);
	}


	qd.app.queueList = function(){
		this.recentWatchedAmount = 5;
		this.type = "";
		this.result = {};
		this.list = [];
		this.domNode = null;
		this.registry = {};
		this.dndSource = null;

		this.constructor = function(/* Object */options, /* Node */parentNode){
			dojo.mixin(this, options);
			if(this.type=="watched"){
				this.result.items = dojo.filter(this.result.items, function(m, i){ if(i<this.recentWatchedAmount){ return m; }}, this); 
			}
		//	console.log(" -- - - qd.app.queueList", this.type, this.result)
			this.domNode = dojo.byId(parentNode);
			this.dndSource = new dojo.dnd.Source(this.domNode, {
				accept: options.type || "movie",
				skipForm: true,
				withHandles: true,
				isSource: options.canDrag || false,
				singular: true,
				creator: dojo.hitch(this, this.createItem)
			});
			if(options.canDrag){
				dojo.connect(this.dndSource, "onDropInternal", this, "onDrop");
				dojo.connect(this.dndSource, "onDndCancel", this, "onDragCancel");
			}
			this.dndSource._legalMouseDown = function(e){
				// hack! only allow left-click dragging
				if(e.button){ return false; }
				return dojo.dnd.Source.prototype._legalMouseDown.call(this, e);
			};
			this.dndSource.insertNodes(false, dojo.filter(this.result.items, function(i){
				// in English: for "queue" and "instant", skip when position==null
				return i.position || (this.type!="queue" && this.type!="instant");
			}, this));
		
			this.noItemCheck();
			this.onLoad();
	//		console.info(this.type, "LIST ITEMS:", this.list)
		};
		
		this.onLoad = function(){
			setTimeout(dojo.hitch(qd.app.queue, "onLoad", this), 100);	
		};
		this.onChange = function(/*String*/typeOfChange){
			qd.app.queue.onChange(this, typeOfChange);	
		};
		
		this.inQueue = function(movieId){
			return dojo.some(this.list, function(listItem){
				return listItem.item.title.guid == movieId;
			}, this);	//	Boolean
		};
		
		this.inQueueByTerm = function(term){
			return dojo.some(this.list, function(listItem){
				return listItem.item.title.title == term;
			}, this);
		};

		this.noItemCheck = function(){
			if ((this.list.length == 0 && !this.noResultItem) || (this.list.length == 1 && !this.list[0])) {
				this.noResultItem = new qd.app.nonItem({
					type: this.type
				}, this.domNode);
			}else if(this.noResultItem){
				this.noResultItem.destroy();
				this.noResultItem = null;
			}
		};
		
		this.destroy = function(){
			this.dndSource.destroy();
			dojo.forEach(this.list, function(m){
				m.destroy();
			});
			if (this.noResultItem) {
				this.noResultItem.destroy();
			}
			delete this;
			// concerned that a user will logout in the middle
			//	of a server call, which may cause a temporary
			//	closure.
			this.destroyed = true;
		};
		this.createItem = function(/* Object */item, /* String? */hint){
			//	summary:
			//		Turns the movie item provided into an object the
			//		DnD system can handle, or creates an avatar for a
			//		dragged item.
			//	item:
			//		A movie object on create, and a listItem on drag.
			//	hint:
			//		When set to "avatar", indicates that we only need
			//		to create a drag avatar; otherwise, go ahead and
			//		create a full queueItem object.
			if(hint == "avatar"){
				// creating an avatar; just build a simple node
				var node = dojo.doc.createElement("div");
				node.className = "movieDragAvatar";
				node.innerHTML = item.item.title.title;
				// ref to orginial node. Having trouble getting it
				//	onCancel without this ref.
				this.draggingitem = item;
				dojo.style(this.draggingitem.domNode, "visibility", "hidden");
				dojo.style(this.draggingitem.ratingNode, "visibility", "hidden");
				return {
					node: node,
					data: item,
					type: this.type
				}
			}

			// creating a full item; instantiate a queueItem
			var listItem = new qd.app.queueItem({
					item: item,
					type: this.type,
					parent: this
				}, this.domNode);
			this.list.push(listItem);
			this.registry[item.id] = listItem;
			return {
				node: listItem.domNode,
				data: listItem,
				type: this.type
			}
		};
		
		this.onDrop = function(/* Node[] */nodes){
			//	summary:
			//		Handle drop events coming from the DnD system; typically
			//		this means reordering the queue.
			//	nodes:
			//		An array of the DOM nodes selected and being dropped; we
			//		currently only allow single-selection, so this is hard-coded
			//		to only ever look at the first node.
			var node = nodes[0];
			dojo.style(this.draggingitem.domNode, "visibility", "visible");
			dojo.style(this.draggingitem.ratingNode, "visibility", "visible");
			this.dndSource.getAllNodes().forEach(function(n, i){
				var listItem = this.dndSource.getItem(n.id).data;
				if(n.id == node.id){
					this.reorder(listItem, i+1, false);

					// save the declared style (dojo.style gets computed style)
					var col = n.style.backgroundColor;
					dojo.style(n, "background-color", "#fff");
					var anim = dojox.fx.highlight({
						node: n,
						duration: 1500,
						easing: dojo.fx.easing.cubicIn
					});
					var __h = dojo.connect(anim, "onEnd", function(){
						dojo.disconnect(__h);
						dojo.style(n, "background-color", col);
					});
					anim.play();
				}
				listItem.position = i+1;
			}, this);
			this.draggingitem = null;
		};
		
		this.onDragCancel = function(){
			if(this.draggingitem){
				dojo.style(this.draggingitem.domNode, "visibility", "visible");
				dojo.style(this.draggingitem.ratingNode, "visibility", "visible");
				this.draggingitem = null;
			}
		};
		
		this.highlight = function(movieId){
			var listItem = this.byId(movieId);
			console.log("HIGHLIGHT:", listItem);
			if(listItem){
				dijit.scrollIntoView(listItem.domNode);
				var anim = dojo.animateProperty({
					node: listItem.domNode,
					duration: 1000,
					properties: { backgroundColor: { start: "#ffff00", end: "#ffffff" } },
					onEnd: function(){
						dojo.style(listItem.domNode, "backgroundColor", "transparent");
					}
				}).play();
			}
		};
		
		this.addMovie = function(/* Object */item){
			//	summary:
			//		Adds movie to the list.
			//	description:
			//		Called from qd.app.queue
			//	note:
			//		The API allows for item to be added
			//		a certain position. Currently not
			//		supported by our UI.
			console.log("ADD MOVIE TO QUEUE:", item)

			var options = {
				guid: item.guid,
				title: item.title,
				//format:"DVD",
				url: (this.type == "instant") ? "queues/instant" : "queues/disc",
			};

			qd.app.loadingIcon.show();
			var def = qd.service.queues.modify(options);
			def.addCallback(this, function(data){
				qd.app.loadingIcon.hide();
				if(this.destroyed){ delete this; return; }
				console.log(">>>>>>>>>>>>>>>add movie result:", data);
				var item = data.created[0];
				qd.services.item(item);
				
				this.noItemCheck();
				var listItem = this.dndSource.insertNodes(false, [item]);
				dojo.forEach(this.list, function(m, i){
					m.position = i + 1;
				});
				//this.highlight(listItem.id);
				
				qd.app.queue.getRatings([item], dojo.hitch(this, function(ratings){
					this.setRatingData(ratings);
				}));
				
				this.onChange("add");
			});
			def.addErrback(this, function(err){
				qd.app.loadingIcon.hide();
				console.warn("Error on ADD MOVIE status:", err.status.results.message);
			});

		};

		this.setRatingData = function(/* Object */ratings){
			//	summary:
			//		For each passed ratings chunk, find the list item through
			//		the title it represents, and set the ratings data.
			dojo.forEach(ratings, function(m){
				var title = this.byTitle(m.guid);
				if(title){
					title.setRatingData(m.ratings.user, m.ratings.predicted, m.ratings.average);
				}
			}, this);
			qd.app.ratings.activateRatingWidgets();
		};

		this.remove = function(/* Object */listItem){
			// summary:
			//		Triggered by the delete icon in an item

			// FIXME: Seems like this code could be tighter.
			var url=(this.type == "queue")?"queues/disc/available":(this.type=="instant")?"queues/instant/available":"queues/disc/saved";
			
			var movieId = listItem.id;
			console.log("remove: ", listItem.guid);
			qd.app.loadingIcon.show();
			qd.service.queues.remove({
				url: url,
				guid: listItem.guid.substring(listItem.guid.lastIndexOf("/")+1, listItem.guid.length),
				title: listItem.item.title.title
			}).addCallback(this, function(res){
				qd.app.loadingIcon.hide();
				if(this.destroyed){
			   		delete this; 
					return; 
				}
				console.log("queueList.remove result:", res);
				this.removeDisplayItem(listItem);
				qd.app.movies.queueMovieChange(movieId, this.type);
				// needs to be done after anim -> this.noItemCheck();
			}).addErrback(this, function(err){
				qd.app.loadingIcon.hide();
				if(this.destroyed){
			   		delete this; 
					return; 
				}
				console.warn("Error on remove status:", err.status.results.message);
				//listItem.reset();
			});
		};

		this.removeDisplayItem = function(/* Object*/listItem){
			// summary:
			//		The visual, animated part of removing an item
			dojo.style(listItem.domNode, "backgroundColor", "#ff0000");
			dojo.fadeOut({node:listItem.domNode, onEnd:dojo.hitch(this, function(){
				var a = dojo.fx.wipeOut({
					node: listItem.domNode,
					duration: 500,
					onEnd: dojo.hitch(this, function(){
						this._removeListItem(listItem);
					})
				}).play();
			})}).play();
		};

		this._removeListItem = function(/* Object */listItem){
			// summary:
			//		After server call and animaton, finally
			// 		remove domNode and reorder list.
			var i = this.getIndex(listItem.id);
			this.dndSource.delItem(listItem.domNode.id);
			listItem.destroy();
			this.list.splice(i, 1);
			dojo.forEach(this.list, function(m, i){
				m.position = i+1;
			});
			this.noItemCheck();
			this.onChange("remove");
		};
		
		this.renumber = function(/* Object*/listItem){
			// note that position is one-based,
			//	while index is zero-based
			var i = this.getIndex(listItem.id);
			this.list.splice(i, 1);
			this.list.splice(listItem.position - 1, 0, listItem);
			dojo.forEach(this.list, function(m, i){
				m.position = i + 1;
			});
		};
		
		this.reorder = function(/* Object */listItem, /* Number */pos, /* Boolean? */animate){
			// re ordering by a numeric input or drag, not 'top'
			if(typeof animate == "undefined"){ animate = true; }
			
			var options = {
				guid:listItem.item.guid,
				position:pos,
				title: listItem.item.title.title,
				url:(this.type == "queue")?"queues/disc":"queues/instant"
			};
			
			qd.app.loadingIcon.show();
			var def = qd.service.queues.modify(options);
			def.addCallback(this, function(res){
				qd.app.loadingIcon.hide();
				if(this.destroyed){ delete this; return; }
				console.log(">>>>>>>>>>>>reorder result:", res);
				if(res.code=="201" || res.code=="200"){
					listItem.update(res.created[0]);
					qd.services.item(res.created[0]);
					if(animate){
						this.reorderDisplay(listItem);
					}
					this.onChange("reorder");
				}else{
					console.warn("reorder, bad status:", res)
				}
			});
			def.addErrback(this, function(err){
				qd.app.loadingIcon.hide();
				console.warn("Error on reorder status:", err.status.results.message);
				listItem.reset();
			});

		};

		this.reorderDisplay = function(/* Object*/listItem){
			this.renumber(listItem);	
			// 	animate old row to red
			//	move old row to new position
			// 	animate new row from yellow to white to transparent
			
			var self = this;
			dojo.animateProperty({
				node: listItem.domNode,
				duration: 500,
				properties: { backgroundColor: { start: "#ffffff", end: "#ff0000" }, },
				onEnd:function(){
					var refNode = listItem.domNode.parentNode;
					var node = listItem.domNode.parentNode.removeChild(listItem.domNode);
					dojo.place(node, refNode, listItem.position-1	);
					self.highlight(listItem.id);
				}
			}).play();
		
		};

		this.attachEvents = function(){
			dojo.query(".listQueuedRow", this.domNode).forEach(function(node, i){
				this.list[i].attachEvents(node);
				this.list[i].postDom();
			}, this);
		};

		this.byId = function(/* String */id){
			//	summary:
			//		Return the list item based on the queue item id.
			return this.registry[id];	// Object
		};

		this.byTitle = function(/* String */guid){
			//	summary:
			//		Return the list item based on the guid of the title it represents.
			for(var i=0, l=this.list.length, li; i<l; i++){
				li = this.list[i];
				if(li.item.title.guid == guid){
					return li;
				}
			}
			return null;
		};

		this.byTerm = function(/* String */term){
			//	summary:
			//		Return the list item based on the string title it represents.
			for(var i=0, l=this.list.length, li; i<l; i++){
				li = this.list[i];
				if(li.item.title.title == term){
					return li;
				}
			}
			return null;
		};

		this.getIndex = function(/* String */id){
			var index = -1;
			dojo.some(this.list, function(m, i){
				if(m.id==id){ index=i; return true;}
			}, this);
			return index; // Number
		};

		this.constructor.apply(this, arguments)
	};
})();

}

if(!dojo._hasResource["qd.app.queue"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.queue"] = true;
dojo.provide("qd.app.queue");




(function(){
	
	var _queueTemplate = null;
	var _atHomeTemplate = null;
	var _instantTemplate = null;
	var _historyTemplate = null;
	var _watchedTemplate = null;
	var pageCached = {};
	var lists = ["historyList", "watchedList", "instantList", "atHomeList", "queueList", "savedList"];
	
	qd.app.queue = new (function(){
		this.onLoad = function(/*Object*/queueList){
			// summary:
			//		This fires on EVERY queueList that loads
			//		check queueList.type to determine which
		};
		
		this.onAllLoaded = function(){
			// summary:
			//		Fires after all queues are loaded
			//console.log("ON ALL LOADED")
			if(qd.services.network.available){
				qd.app.queue.polling.init();
			}

			dojo.connect(qd.services.network, "onChange", function(status){
				if(status){
					qd.app.queue.polling.initialized(false);
					qd.app.queue.polling.init();
				}
			});
		};
		
		this.onChange = function(/*Object*/queueList,/*String*/typeOfChange){
			// summary:
			//		This fires on EVERY queueList that changes
			//		check queueList.type to determine which
			//	typeOfChange: String
			//		add, remove, reorder
			if(typeOfChange == "add" || typeOfChange == "remove"){
				if(queueList.type == "queue"){
					setNumInNav("numInQueueTotal", this.queueList.list.length);
				}else if(queueList.type == "instant"){
					setNumInNav("numInInstantTotal", this.instantList.list.length);
				}
			}
			qd.service.queues.cache((queueList.type=="queue"?"disc":queueList.type), queueList.list);
		};

		this.count = 1
		this.getItems = function(whichList){
			//console.log("qd.qpp.queue.getItems", whichList, this[whichList], this.atHomeList, "count:", this.count++)
			if(this[whichList]){
				return this[whichList].result.items;
			}
			return [];
		};
		
		this.isProtectedPage = function(){
			console.log("isProtectedPage:", dijit.byId("contentNode").selectedChildWidget.id);
			return dijit.byId("contentNode").selectedChildWidget.id =="queueContentNode";
		};
		
		this.inQueue = function(movieId, queue){
			return dojo.some(queue ? [queue] : lists, function(list){
				if(this[list] && list!="historyList" && list!="watchedList"){ 
					return this[list].inQueue(movieId);
				 }
			}, this);
		};
		
		this.inQueueByTerm = function(term, queue){
			var test = dojo.some(queue ? [queue]: lists, function(list){
				if(this[list] && list!="historyList" && list!="watchedList"){
					return this[list].inQueueByTerm(term);
				}
			}, this);
			return test;
		};

		this.clearCache = function(){
			// summary:
			// 		When user logs out, we need to clear the page cache
			//		or else the pages will be 'unprotected'
			pageCached = {};
			dojo.forEach(lists, function(list){
				if(this[list]){ this[list].destroy(); }
			}, this);
		};
		
		dojo.connect(qd.app, "deauthorize", dojo.hitch(this, function(){
			this.clearCache();
		}));

		this.gotoInitialPage = function(){
			//console.log("gotoInitialPage...")
			this.gotoMyQueueDvd(true);
		};

		this.switchPage = function(page){ 
			//console.log("go to queue page:", page)
			if(page == "dvd"){
				this.gotoMyQueueDvd();
			}
			else if(page == "instant"){
				this.gotoMyQueueInstant();
			}
			else if(page =="history"){
				this.gotoMyQueueHistory();
			}
			else if(page == "notLoggedIn"){
				qd.app.switchPage("notLoggedIn")
			}
			else{
				this.gotoMyQueueDvd();
			}
		};

		function changePageDisplay(page){
			if (page == "dvd") {
				qd.app.switchPage("yourQueue");
				qd.app.selectNav("myQueueDvd", "queSubNav");
				dijit.byId("queuePages").selectChild("queueContainerNode");
			}
			else if(page == "instant"){
				qd.app.switchPage("yourQueue");
				qd.app.selectNav("myQueueInstant", "queSubNav");
				dijit.byId("queuePages").selectChild("instantContainerNode");
			}
			else if(page =="history"){
				qd.app.switchPage("yourQueue");
				qd.app.selectNav("myQueueHistory", "queSubNav");
				dijit.byId("queuePages").selectChild("historyContainerNode");
			}
			else{
				//??
			}
		};

		this.addMovieById = function(/* String */movieId, target, /* String */queue){
			// summary:
			//		Adds a movie to your queue
			//	description:
			//		After cliking Add Movie in one of the areas
			//		of the app, the movieId is sent here. The actual
			//		item is retrieved (somehow) and the data is sent
			//		to NetFlix.
			console.info("CLICK ADD:", movieId);
			if(qd.app.authorized) {
				var queue = queue || "queue";
				if(target) {
					dojo.addClass(target, "inQueue")
				}
				if(this.inQueue(movieId, queue)) {
					this.switchPage("queue");
					this.queueList.highlight(movieId);
				} else {
					var movie = qd.services.item(movieId);
					if(movie){
						if(qd.services.network.available){
							if(movie.screenFormats.length){
								if(queue == "instant"){
									if("instant" in movie.formats){
										console.log("Adding to instant queue...");
										this.instantList.addMovie(movie);
									}else{
										console.warn("Attempted to add a movie to the instant queue, but it doesn't seem to be available for instant watching. Movie: " + movie.title + ", " + (movie.guid || "(no GUID)"));
									}
								}else{
									console.log("Adding to DVD queue...")
									this.queueList.addMovie(movie);
								}
							} else {
								console.log("No screen formats. Assuming this is not released and adding to saved. len:", movie.screenFormats.length, "scrFor:", movie.screenFormats)
								this.savedList.addMovie(movie);	
							}
						} else {
							qd.service.queues.addMovieById(movieId, target, queue);
							qd.app.errorTooltip.show(
								"The title has been stored.",
								'"' + movie.title + '" will be added to your queue when the Netflix servers become available.',
								true
							);
						}
					} else {
						// TODO: hit the API for movie details, or perhaps have
						//       qd.managers.movie.byId do the fetch for us
						console.warn("Can't add movie: it doesn't have full information here yet.", movieId);
					}
				}
			}
		};

		this.addMovieByTerm = function(/* String */term, target, /* String */queue){
			//	summary:
			//		This is here because we do not get guids with the RSS feeds; so
			//		what we do is fetch the title, and the run addMovieById.
			if(this.inQueueByTerm(term, queue)){
				var id = qd.services.itemByTerm(term).guid;
				this.switchPage("queue");
				this.queueList.highlight(id);
			} else {
				if(qd.services.network.available){
					qd.service.titles.fetch({
						term: term,
						result: dojo.hitch(this, function(item){
							this.addMovieById(item.guid, target, queue);
						})
					});
				} else {
					if(target) {
						dojo.addClass(target, "inQueue")
					}
					qd.service.queues.addMovieByTerm(term, target, queue);
					qd.app.errorTooltip.show(
						"The title has been stored.",
						'"' + term + '" will be added to your queue when the Netflix servers become available.',
						true
					);
				}
			}
		};

		function setNumInNav(divId, num){
			dojo.byId(divId).innerHTML = num ? "("+num+")" : "";
		}
		
		this.getRatings = function(items, callback){
			// summary:
			//		Get ratings (user, predicted, average) for a list of objects
			//
			//	items: Array
			//		An array of items. Not widgets, but objects returned from NetFlix.
			//	callback: Function
			//		The function to be called upon each return. Note this will be
			//		called multiple times if there are more than 50 items.
			var guids = dojo.map(items, function(item){
				return item.guid;
			});
			return qd.service.titles.rated({
				guids: guids,
				result: callback
			});
		};
		
		// atHome, discs, instant, watched, shipped, returned
		this.gotoMyQueueDvd = function(initialPage){
			if(!qd.app.authorized){
				qd.app.switchPage("auth");
				return;
			}
			if(pageCached["dvd"]){
				changePageDisplay("dvd");
				return;
			}

			//	TODO: figure out if this would ever be loaded in the background.
			qd.app.underlay.show();
			
			var res = [];
			qd.service.queues.atHome().addCallback(this, function(arr){
				res = res.concat(arr.slice(0));
				this.atHomeList = new qd.app.queueList({
					result: { items: arr }, 
					type: "at_home"
				}, "queueAtHomeTemplateNode");
				setNumInNav("numInQueueTotal", arr.length);
				qd.service.queues.cache(this.atHomeList.type, this.atHomeList.list);
				changePageDisplay("dvd");

				qd.service.queues.discs().addCallback(this, function(arr){
					res = res.concat(arr.slice(0));
					this.queueList = new qd.app.queueList({
						result: { items: arr }, 
						type:"queue", 
						canDrag:true
					}, "queueTemplateNode");
					setNumInNav("numInQueueTotal", res.length);
					setNumInNav("numInQueueQueued", arr.length);
					qd.service.queues.cache("disc", this.queueList.list);

					qd.service.queues.saved().addCallback(this, function(arr){
						this.savedList = new qd.app.queueList({
							result: { items: arr }, 
							type:"saved"
						}, "savedQueueTemplateNode");
						setNumInNav("numInSavedQueued", arr.length);
						qd.service.queues.cache(this.savedList.type, this.savedList.list);
						
						this.onAllLoaded();
						
						var guids = dojo.map(res, function(m){
							return m.title.guid;
						});

						qd.service.titles.rated({
							guids:guids,
							result: dojo.hitch(this, function(ratingsChunk){
								this.atHomeList.setRatingData(ratingsChunk);
								this.queueList.setRatingData(ratingsChunk);
							}),
							error: dojo.hitch(this, function(err){
								console.error("ratings chunk fetch error::", err);
							})
						}).addErrback(this, function(err){
							console.error("ratings fetch error::", err);
						}).addCallback(this, "gotoMyQueueInstant", true);
							
						pageCached["dvd"] = true;
						qd.app.underlay.hide();
					});
				}).addErrback(function(err){
					qd.app.underlay.hide();
					qd.app.errorTooltip.show(
						"Unable to retrieve your disc queue at this time.",
						"There was a communication problem getting your disc queue.  Please wait a few minutes and try again."
					);
				});
			}).addErrback(function(err){
				qd.app.underlay.hide();
				qd.app.errorTooltip.show(
					"Unable to retrieve your At Home information at this time.",
					"There was a communication problem getting your At Home information.  Please wait a few minutes and try again."
				);
			});
		};

		this.gotoMyQueueInstant = function(inBackground){
			if(!inBackground && pageCached["instant"]){
				changePageDisplay("instant");
				return;
			}

			if(!inBackground){
				qd.app.underlay.show();
			} else {
				qd.app.loadingIcon.show();
			}

			var res = [];
			qd.service.queues.watched().addCallback(this, function(arr){
				res = res.concat(arr.slice(0));
				this.watchedList = new qd.app.queueList({
					result: { items: arr }, 
					type: "watched"
				}, "instantWatchedTemplateNode");
				qd.service.queues.cache(this.watchedList.type, this.watchedList.list);

				qd.service.queues.instant().addCallback(this, function(arr){
					res = res.concat(arr.slice(0));
					this.instantList = new qd.app.queueList({
						result: { items: arr }, 
						type: "instant", 
						canDrag: true
					}, "instantQueuedTemplateNode");
					setNumInNav("numInInstantTotal", arr.length);
					setNumInNav("numInInstantQueued", arr.length);
					qd.service.queues.cache("instant", this.instantList.list);
					
					var guids = dojo.map(res, function(m){
						return m.title.guid;
					});

					qd.service.titles.rated({
						guids:guids,
						result: dojo.hitch(this, function(ratingsChunk){
							this.watchedList.setRatingData(ratingsChunk);
							this.instantList.setRatingData(ratingsChunk);
						}),
						error: dojo.hitch(this, function(err){
							console.error("ratings chunk fetch error::", err);
						})
					}).addErrback(this, function(err){
						console.error("ratings fetch error::", err);
					})//.addCallback(this, "gotoMyQueueHistory", inBackground);

					pageCached["instant"] = true;

					if(!inBackground){
						qd.app.underlay.hide();
					} else {
						qd.app.loadingIcon.hide();
					}
				}).addErrback(function(err){
					if(!inBackground){
						qd.app.underlay.hide();
					} else {
						qd.app.loadingIcon.hide();
					}
					qd.app.errorTooltip.show(
						"Unable to retrieve your instant queue at this time.",
						"There was a communication problem getting your instant queue.  Please wait a few minutes and try again."
					);
				});
			}).addErrback(function(err){
				if(!inBackground){
					qd.app.underlay.hide();
				} else {
					qd.app.loadingIcon.hide();
				}
				qd.app.errorTooltip.show(
					"Unable to retrieve your instant history at this time.",
					"There was a communication problem getting your instant history.  Please wait a few minutes and try again."
				);
			});
		};

		this.gotoMyQueueHistory = function(inBackground){
			if(!inBackground && pageCached["history"]){
				changePageDisplay("history");
				return;
			}

			if(!inBackground){
				qd.app.underlay.show();
			} else {
				qd.app.loadingIcon.show();
			}

			//	FIXME: we cache the merged list, not two separate ones...so we may have to alter this
			//	for offline.
			qd.service.queues.returned().addCallback(this, function(ret){
				qd.service.queues.shipped().addCallback(this, function(shp){
					dojo.forEach(ret, function(m){
						var found = dojo.some(shp, function(mm){	
							if(mm.title.guid == m.title.guid){
								m.shipped = mm.shipped;
								return true; 		//break loop
							}
						});
					});
				
					this.historyList = new qd.app.queueList({
						result: { items: ret }, 
						type: "history"
					}, "historyTemplateNode");
					setNumInNav("numInHistoryTotal", ret.length);
					setNumInNav("numInHistoryQueued", ret.length);
					qd.service.queues.cache(this.historyList.type, this.historyList.list);
					
					pageCached["history"] = true;
					if(!inBackground){
						changePageDisplay("history");	
						qd.app.underlay.hide();
					} else {
						qd.app.loadingIcon.hide();
					}

					//	Fetch the ratings.
					setTimeout(dojo.hitch(this, function(){
						qd.app.loadingIcon.show();
						var guids = dojo.map(ret, function(m){
							return m.title.guid;
						});

						qd.service.titles.rated({
							guids:guids,
							result: dojo.hitch(this, function(ratingsChunk){
								this.historyList.setRatingData(ratingsChunk);
							}),
							error: dojo.hitch(this, function(err){
								console.error("ratings chunk fetch error::", err);
							})
						}).addErrback(this, function(err){
							qd.app.loadingIcon.hide();
							console.error("ratings fetch error::", err);
						}).addCallback(function(){
							qd.app.loadingIcon.hide();
						});
					}), 5000);
				}).addErrback(function(err){
					if(!inBackground){
						qd.app.underlay.hide();
					} else {
						qd.app.loadingIcon.hide();
					}
					qd.app.errorTooltip.show(
						"Unable to retrieve your history at this time.",
						"There was a communication problem getting your rental history.  Please wait a few minutes and try again."
					);
				});
			}).addErrback(function(err){
				if(!inBackground){
					qd.app.underlay.hide();
				} else {
					qd.app.loadingIcon.hide();
				}
				qd.app.errorTooltip.show(
					"Unable to retrieve your history at this time.",
					"There was a communication problem getting your rental history.  Please wait a few minutes and try again."
				);
			});
		}
	})();
	
	function setupNavigation(){
		dojo.behavior.add({
			"#bigNavYourQueue a": {
				onclick:function(){
					qd.app.queue.gotoMyQueueDvd();
					return false;
				}
			},
			"#myQueueDvd a": {
				onclick:function(){
					qd.app.queue.gotoMyQueueDvd();
					return false;
				}
			},
			"#myQueueInstant a": {
				onclick:function(){
					qd.app.queue.gotoMyQueueInstant();
					return false;
				}
			},
			"#myQueueHistory a": {
				onclick:function(){
					qd.app.queue.gotoMyQueueHistory();
					return false;
				}
			}
		});
		dojo.behavior.apply();
	}

	dojo.addOnLoad(setupNavigation);
})();


qd.app.queue.polling = new (function(){
	var pollTime = 5 * 3600;
	var isPolling = false;
	var pollInterval;
	var initialized = false;
	
	this.devS = false;
	this.devR = false;
	this.devSR = false;
	
	this.initialized = function(/* Boolean? */val){
		if(val !== undefined){
			initialized = val;
		}
		return initialized;
	};

	this.init = function(){
		//console.warn("Start Polling?", dojo.attr(dojo.byId("receiveNotifications"), "checked"))
		if(initialized || dojo.attr(dojo.byId("receiveNotifications"), "checked") == false){ return; }
		console.info("Start Queue Polling")
		initialized = true;
		
		var u = qd.app.user();
		u.atHomeItems = null;
		qd.app.user(u); 

		this.checkQueues(qd.app.queue.atHomeList.result.items, null);
		this.checkUpdates();
	};
	
	this.dev = function(onOff){
		setTimeout(dojo.hitch(this, "checkUpdates"), pollTime);
	};
	
	this.checkUpdates = function(type){
		qd.service.queues.atHome().addCallback( this, function(res){
			var athome = res;
			if(this.devS || this.devR || this.devSR){
				this.doDevCode(athome, qd.app.queue.queueList.result.items);
			}
			pollInterval = setTimeout(dojo.hitch(this, "checkQueues", athome), 0);
			setTimeout(dojo.hitch(this, "checkUpdates"), pollTime);
		});
	};
	
	this.checkQueues = function(/*Array*/athome){
		//console.info("...Checking queues...")
		
		var shipped = [];
		var returned = [];
		var u = qd.app.user();
		var found = false;
		
		//console.log("user atHomeItems:", u, u.atHomeItems)
		//console.log("athome:", athome);

		if(!u.atHomeItems || !u.atHomeItems.length){
			//console.log(" - - add to user obj - -")
			u.atHomeItems = athome;
			qd.app.save(u);
			//console.info("At Home items added to user object.")
			return;
		}

		dojo.forEach(athome, function(ah){
			found = false;
			dojo.forEach(u.atHomeItems, function(m){
				if(m.guid == ah.guid){
				//	console.log("   compare::", m.shipped, ah.shipped)
					if(m.shipped != ah.shipped){
						shipped.push(ah);
					}
					if(m.returned != ah.returned){
						returned.push(ah);
					}
					found = true;
				}
			});	
			if(!found){
				// added, shipped
				shipped.push(ah);
			}
		});
		
		if(shipped.length && returned.length){
			console.log("changes to shipped and receieved", shipped, returned);
			qd.app.systray.showShippedAndReceived(shipped, returned);

		}else if(shipped.length){
			console.log("changes to shipped:", shipped)
			qd.app.systray.showShipped(shipped);
		
		}else if(returned.length){
			console.log("changes to receieved:", returned)
			qd.app.systray.showReceived(returned);
		
		}else{
			//console.log("No new notifications.");
		}
		
		if (shipped.length || returned.length) {
			//console.log("Rebuild page to see changes")
			// flush user object's 
			// atHomeItems and let it repopulate
			// after refresh
			u.atHomeItems = null;
			qd.app.save();
			qd.app.queue.clearCache();
			qd.app.queue.atHomeList.destroy();
			qd.app.queue.queueList.destroy();
			//this.historyList.destroy(); //IF!
			qd.app.queue.gotoMyQueueDvd();
		}
	};
	
	this.doDevCode = function(athome, myqueue){
		// dev change dates to force update
		console.info(" - - doing dev code - - ")
		
		var d = new Date()
		var today = dojo.date.locale.format(d, {selector:"date", datePattern:"MM/dd/yy"});
		d.setDate(d.getDate()+2);
		var tommorrow = dojo.date.locale.format(d, {selector:"date", datePattern:"MM/dd/yy"});				
		
		if (this.devR || this.devSR) {
			var received = athome[athome.length - 1];
			received.returned = today;
		}
		
		if(this.devS || this.devSR){
			var updated = myqueue.shift();
			updated.shipped = today;
			updated.estimatedArrival = tommorrow;
			athome.push(updated);
		}
		
		this.devS = this.devR = this.devSR = false;	
	};
	
})();


}

if(!dojo._hasResource["qd.app.topMovies"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.topMovies"] = true;
dojo.provide("qd.app.topMovies");


qd.app.topMovies = new (function(){
	this.switchPage = function(page){
		//	summary:
		//		Change to a Top Movies sub-page.
		//	page:
		//		"top100", "newReleases", "top25ByGenre"
		this.loggedIn = qd.app.authorized;
		var menuId, source, fetch=qd.app.feeds.fetch;
		switch(page){
			case "top100":
				menuId = "topMoviesTop100";
				source = {url: qd.service.feeds.top100().feed };
				break;
			case "newReleases":
				menuId = "topMoviesNewReleases";
				source = {url: qd.service.feeds.newReleases().feed };
				break;
			case "top25ByGenre":
				menuId = "topMoviesTop25ByGenre";
				source = {url: qd.app.feeds.currentTop25Feed};
				break;
			case "recommendations":
				menuId = "topMoviesRecommendations";
				qd.app.resultsList.setResultsType("recommendations");
				fetch = function(){ qd.app.resultsList.fetch(arguments); }
				break;
			case "search":
				menuId = "";
				qd.app.resultsList.setResultsType("search");
				fetch = null; // search does its own fetch
				break;
		}
		qd.app.selectNav(menuId, "topMoviesSubNav");
		if(fetch){ fetch(source); }

		this.currentPage = page;
		this.togglePageElements();

		qd.app.switchPage("topMovies");
		console.log("switched.");
	};
	
	this.togglePageElements = function(){
		var p = this.currentPage;
		dojo.style("genrePicker", "display", p=="top25ByGenre"?"inline":"none");
		dojo.style("top100Title", "display", p=="top100"?"block":"none");
		dojo.style("newReleasesTitle", "display", p=="newReleases"?"block":"none");

		dojo.style("artworkList", "display", (p=="search"||p=="recommendations")?"none":"block");
		dojo.style("searchResults", "display", (p=="search"||p=="recommendations")?"block":"none");
	}

	this.checkForRefresh = function(){
		this.togglePageElements();
		if(this.loggedIn === undefined){
			return;
		}
		if(qd.app.authorized && this.loggedIn != qd.app.authorized){
			this.switchPage(this.currentPage);
			this.loggedIn = qd.app.authorized;
		}
		dojo.style("topMoviesRecommendations", "display", qd.app.authorized ? "block" : "none");
	};

	dojo.behavior.add({
		// Top Movies sub nav
		"#topMoviesTop100 a": {
			onclick:dojo.hitch(this, function(){
				this.switchPage("top100");
				return false;
			})
		},
		"#topMoviesNewReleases a": {
			onclick:dojo.hitch(this, function(){
				this.switchPage("newReleases");
				return false;
			})
		},
		"#topMoviesTop25ByGenre a": {
			onclick:dojo.hitch(this, function(){
				this.switchPage("top25ByGenre");
				return false;
			})
		},
		"#topMoviesRecommendations a": {
			onclick:dojo.hitch(this, function(){
				this.switchPage("recommendations");
				return false;
			})
		}
	});

	// lazy load the Top 100 feed when we visit Top Movies for the first time
	var sectionSwitchConnect = dojo.connect(qd.app, "switchPage", dojo.hitch(this, function(page){
		if(page == "topMovies" && !this.currentPage){
			dojo.disconnect(sectionSwitchConnect);
			this.switchPage("top100");
			this.loggedIn = qd.app.authorized;
		}
	}));
})();

}

if(!dojo._hasResource["qd.app.feeds"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.feeds"] = true;
dojo.provide("qd.app.feeds");











qd.app.feeds = new (function(){
	this.currentTop25Feed = null;
	var movieListTemplate = null,
		underlay = qd.app.underlay;

	this.setupTop25Picker = function(){
		//	summary:
		//		Create DOM structure and click handlers for the Genre picker
		//		on the Top Movies > Top 25 By Genre page.
		var feeds = qd.service.feeds.list(),
			gp = dojo.byId("genrePicker"),
			gpl = dojo.query("ul", gp)[0],
			__h = null;

		dojo.connect(gp, "onclick", function(){
			if(!dojo.hasClass(gp, "open")){
				dojo.addClass(gp, "open");
				underlay.show({loader:false, bodyOnly:false});
			}else{
				underlay.hide();
			}
			__h = dojo.connect(underlay, "hide", function(){
				dojo.removeClass(gp, "open");
				dojo.disconnect(__h);
			});
		});

		dojo.forEach(feeds, function(item){
			var li = document.createElement("li");
			li.innerHTML = item.term;
			dojo.connect(li, "onclick", dojo.hitch(this, function(evt){
				this.currentTop25Feed = item.feed;
				this.fetch({url:this.currentTop25Feed});
				dojo.query("li", gpl).removeClass("selected");
				dojo.addClass(evt.target, "selected");
				dojo.byId("genrePickerSelection").innerHTML = item.term;
				underlay.hide();
				dojo.stopEvent(evt);
			}));

			// the first time through, select the first genre
			if(item.feed == feeds[0].feed){ dojo.addClass(li, "selected"); }
			gpl.appendChild(li);
		}, this);

		// select the first genre
		dojo.byId("genrePickerSelection").innerHTML = feeds[0].term;
		this.currentTop25Feed = feeds[0].feed;
	}

	this.fetch = function(/* Object */feed){
		//	summary:
		//		Fetch one of the public Netflix RSS feeds and render the
		//		results to the page.
		//	feed:
		//		Object containing at least one of the following members:
		//		* feedName ("top100"|"newReleases")
		//		* url (URL to a specific feed)
		if(!movieListTemplate){
			movieListTemplate = new dojox.dtl.HtmlTemplate("artworkList");
		}
		underlay.show();
		qd.service.feeds.fetch({
			url: feed.url,
			result: function(data){
				dojo.forEach(data, function(m){
					m.inQueue = qd.app.queue.inQueueByTerm(m.title);
				});

				dojo.query("#artworkList .addButton").removeClass("inQueue");
				
				dojo.query(".contentTop", "topMoviesContainerNode").forEach(function(node){
					node.scrollTop = 0;
				});

				movieListTemplate.render(new dojox.dtl.Context({ catalog_titles: data }));
				underlay.hide();
				dojo.behavior.apply();

				dojo.query("#artworkList .movie").forEach(function(node){
					qd.app.movies.setupMovieId(node);
				});
			},
			error: function(err, title){
				console.warn("feeds.fetch ERROR: ", err);
				underlay.hide();
				qd.app.errorTooltip.show(
					"The " + (title || "feed") + " is not available.",
					"This feed will be available when Queued is back online."
				);
			}
		});
	}

	// lazy load the genre picker
	var switchConnect = dojo.connect(qd.app.topMovies, "switchPage", dojo.hitch(this, function(){
		dojo.disconnect(switchConnect);
		this.setupTop25Picker();
	}));
})();

}

if(!dojo._hasResource["qd.app.ratings"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.ratings"] = true;
dojo.provide("qd.app.ratings");








qd.app.ratings = new (function(){
	var ratingTimeout = null;
	var ratingTimeoutNode = null;
	var ratingIsDisabled = false;

	function setRatingType(/* Node */node, /* String */type){
		//	summary:
		//		Simple method to normalize a widget's CSS classes.
		//	node:
		//		Widget's DOM node.
		//	type:
		//		"user", "predicted", "average"
		if(!dojo.hasClass(node, "starRating")){
			dojo.addClass(node, "starRating");
		}
		dojo.removeClass(node, "user");
		dojo.removeClass(node, "predicted");
		dojo.removeClass(node, "average");
		if(type=="user" || type=="predicted" || type=="average"){
			dojo.addClass(node, type);
		}
	}

	function buildRatingContext(/* Number|String */rating){
		//	summary:
		//		Build an object to pass to a DTL Context that describes
		//		a title's star rating.
		//	rating:
		//		Star rating value. 1-5, "not_interested", "no_opinion".
		if(rating == "not_interested" || rating == "no_opinion"){
			rating = 0;
		}
		for(var i=1, c={}; i<=5; i++){
			// the leading spaces are here for DTL convenience
			c[i] = (i <= rating) ? " full" : ((i-rating <= .5) ? " half" : " empty");
		}
		return c;
	}

	function setRatingStars(/* Node */node, /* Number|String */rating){
		//	summary:
		//		Show a particular star rating in a rating widget.
		//	node:
		//		Widget's DOM node (the one with the "starRating" CSS class).
		//	rating:
		//		Star rating value. 1-5, "not_interested", "no_opinion".
		var c=1, n=node.firstChild, starClasses=buildRatingContext(rating);
		while(n){
			if(dojo.hasClass(n, "star")){
				n.className = "star" + starClasses[c++];
			}
			n = n.nextSibling;
		}
	}

	function renderRatingWidget(/* Node */node, /* String */type, /* Number|String */rating){
		//	summary:
		//		Set up CSS classes to properly display a ratings widget.
		//	node:
		//		Widget's DOM node.
		//	type:
		//		"user", "predicted", "average".
		//	rating:
		//		Star rating value. 1-5, "not_interested", "no_opinion".
		var rating = rating || 0,
		    star = buildRatingContext(rating);
		node.innerHTML = '<span class="unrate"></span>'
		               + '<span class="star '+star[1]+'"></span>'
		               + '<span class="star '+star[2]+'"></span>'
		               + '<span class="star '+star[3]+'"></span>'
		               + '<span class="star '+star[4]+'"></span>'
		               + '<span class="star '+star[5]+'"></span>';
		setRatingType(node, type);
		dojo.attr(node, "rating", rating);
	}

	this.buildRatingWidget = function(/* Node */node, /* String? */type, /* Number?|String? */rating, /* Boolean? */activate){
		//	summary:
		//		Put together a star rating widget to show movie star
		//		ratings and allow users to rate movies. The node should
		//		be a descendent of a node having the "movie" attribute
		//		containing a Netflix title ID.
		//	node:
		//		DOM node to use for the widget. For the behaviors to work
		//		properly, the node should have the 'starRating' CSS class;
		//		if it doesn't, the class will be added.
		//	type:
		//		"user", "predicted", "average"; if this isn't specified,
		//		it will be looked up in the cache by traversing the DOM
		//		to find the "movie" attribute to provide a movie ID.
		//	rating:
		//		Star rating value. 1-5, "not_interested", "no_opinion"; if
		//		this isn't provided, it will be looked up in the cache
		//		similar to the "type" parameter above.
		//	activate:
		//		Determines whether to immediately activate the widget or
		//		not. Defaults to false.
		if(type && rating){
			renderRatingWidget(node, type, rating);
			if(activate){
				this.activateRatingWidgets();
			}
		}else{
			var movieId = qd.app.movies.getMovieIdByNode(node),
			    dfd = qd.app.movies.fetchTitle(movieId);
			dfd.addCallback(this, function(movie){
				var ratingType = (movie.ratings.user>0) ? "user" : ((movie.ratings.predicted>0) ? "predicted" : "average"),
				    rating = movie.ratings[ratingType];
				renderRatingWidget(node, ratingType, rating);
				if(activate){
					this.activateRatingWidgets();
				}
			});
		}
	}

	this.activateRatingWidgets = function(){
		//	summary:
		//		Apply event handlers to any rating widgets on the page.
		dojo.behavior.apply();
	};

	function disableRatings(){
		ratingIsDisabled = true;
	}
	function enableRatings(){
		// Janky timer! Give it a brief moment to try and pass
		// any click events through to nodes that might trigger
		// a rating, THEN reenable it.
		setTimeout(function(){
			ratingIsDisabled = false;
		}, 150);
	}

	var ratingWidgetHandler = {
		widget: {
			onmouseover: function(evt){
				if(ratingIsDisabled){ return; }
				var node = evt.target;
				if(dojo.hasClass(node, "starRating") && !dojo.hasClass(node, "hovering")){
					dojo.addClass(node, "hovering");
				}
				if(ratingTimeout && ratingTimeoutNode==node){ clearTimeout(ratingTimeout); }
			},
			onmouseout: function(evt){
				if(ratingIsDisabled){ return; }
				var node = dojo.hasClass(evt.target, "starRating") ? evt.target : evt.target.parentNode;
				ratingTimeoutNode = node;
				ratingTimeout = setTimeout(function(){
					dojo.removeClass(node, "hovering");
					setRatingStars(node, dojo.attr(node, "rating"));
				}, 50);
			}
		},
		stars: {
			onmousemove: function(evt){
				if(ratingIsDisabled){ return; }
				var node = evt.target, n = node;
				while(n = n.previousSibling){ if(dojo.hasClass(n, "star")){ n.className = "star full"; } }
				n = node;
				while(n = n.nextSibling){ if(dojo.hasClass(n, "star")){ n.className = "star empty"; } }
				node.className = "star full";
				dojo.addClass(node.parentNode, "hovering");
			},
			onclick: function(evt){
				if(ratingIsDisabled){ return; }
				var node = evt.target, n = node, p = node.parentNode, rating = 1;
				var movieId = qd.app.movies.getMovieIdByNode(node);

				while(n = n.previousSibling){ if(dojo.hasClass(n, "star")){ rating++; } }
				dojo.removeClass(p, "average");
				dojo.removeClass(p, "predicted");
				dojo.addClass(p, "user");
				dojo.attr(p, "rating", rating);
				qd.service.titles.rate({
					guid: movieId,
					rating: rating
				});
			}
		},
		unrate: {
			onmouseover: function(evt){
				if(ratingIsDisabled){ return; }
				var node = evt.target,
				    p = node.parentNode,
				    movieId = qd.app.movies.getMovieIdByNode(node),
				    dfd = qd.app.movies.fetchTitle(movieId);
				dfd.addCallback(function(){
					var fallbackRatingType = (movie.ratings && movie.ratings.predicted > 0) ? "predicted" : "average",
					    rating = movie.ratings[fallbackRatingType];
					dojo.removeClass(p, "hovering");
					setRatingStars(p, rating);
				});
			},
			onclick: function(evt){
				if(ratingIsDisabled){ return; }
				var node = evt.target,
					p = node.parentNode,
					isUserRating = dojo.hasClass(p, "user"),
					rating = isUserRating ? "no_opinion" : "not_interested",
					movieId = qd.app.movies.getMovieIdByNode(node),
					dfd = qd.app.movies.fetchTitle(movieId);
				dfd.addCallback(function(){
					var newRatingType = (movie.ratings.predicted > 0) ? "predicted" : "average",
					    newRating = movie.ratings[newRatingType];
					qd.service.titles.rate({
						guid: movieId,
						rating: rating
					});
					dojo.removeClass(p, "user");
					dojo.addClass(p, newRatingType);
					dojo.attr(p, "rating", newRating);
					setRatingStars(p, newRating);
					console.log("Removing rating from " + movieId + "; reverting to the " + newRatingType + " value of " + newRating);
				});
			}
		}
	};

	dojo.behavior.add({
		".starRating.enabled": ratingWidgetHandler.widget,
		".starRating.enabled .star": ratingWidgetHandler.stars
		// TODO: disabled for now
		//".starRating.enabled .unrate": ratingWidgetHandler.unrate
	});

	dojo.connect(qd.app, "startDragging", disableRatings);
	dojo.connect(qd.app, "stopDragging", enableRatings);
})();

}

if(!dojo._hasResource["qd.app.movies"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.movies"] = true;
dojo.provide("qd.app.movies");










qd.app.movies = new (function(){
	var infoTemplate = null;
	var dialogIsDisabled = false;

	function getInfoDialogTemplate(){
		//	summary:
		//		Returns the DTL template for the info dialog, creating it
		//		if necessary.
		if(!infoTemplate){
			infoTemplate = new dojox.dtl.HtmlTemplate("movieInfoTemplateNode");
		}
		return infoTemplate;
	}

	function populateDialog(/* Object */movie){
		//	summary:
		//		Render the given movie data to the info dialog template.
		//	movie:
		//		Movie to render.
		var template = getInfoDialogTemplate(),
		    context = new dojox.dtl.Context({
		    	movie: movie,
		    	isLoggedIn: qd.app.authorized
		    });
		template.render(context);

		// For some reason, attempting to set the button classes in DTL doesn't
		// seem to be reliable, like it's caching them. So let's just post-process
		// the DOM instead.
		dojo.query("#movieInfoDialogNode .addButton").forEach(function(n){
			var queue = dojo.hasClass(n, "instant") ? "instantList" : "queueList",
			    isQueued = qd.app.queue.inQueue(movie.guid, queue),
			    addOrRemoveClass = isQueued ? "addClass" : "removeClass";
			dojo[addOrRemoveClass](n, "inQueue");
		});

		dojo.behavior.apply();
		
		console.log("DIALOG MOVIE:", movie, template);
	}

	this.setupMovieId = function(/* Node */node, /* String? */movieId){
		//	summary:
		//		Sets the "movie" attribute on the given node to the	Netflix
		//		movie ID encoded within. There should be a node with the CSS
		//		class "movie_id" somewhere inside the node's DOM; this will
		//		be removed and its contents used as the value of the new
		//		attribute. If the "movie_id" node doesn't exist, nothing
		//		happens.
		//	node:
		//		The node (typically one with class="movie") to mark with
		//		the "movie" attribute.
		//	movieId:
		//		Movie ID to use as an override, skipping the DOM traversal.
		var id=0;
		if(movieId){
			id = movieId;
		}else{
			var movieIdNode = dojo.query(".movie_id", node);
			if(movieIdNode && movieIdNode.length){
				id = movieIdNode[0].innerHTML;
				movieIdNode[0].parentNode.removeChild(movieIdNode[0]);
			}else{
				id = dojo.attr(node, "movie");
			}
		}
		dojo.attr(node, "movie", id);
	};
	
	this.nodesByMovieId = function(/* String */movieId){
		// summary:
		//		Find all nodes in the topMoviesContainerNode
		//
		//	movieId: String
		//		The id of the movie
		//
		var nodes;
		nodes = dojo.query(".movie", "topMoviesContainerNode");
		if(!nodes.length){
			nodes = dojo.query(".thumb", "topMoviesContainerNode");	
		}
		return nodes; // dojo.NodeList
		
	};
	
	this.queueMovieChange = function(/* String */movieId, /* String */type, /* Boolean */addingTo){
		// summary:
		//		Changes the button of a movie node to be "In Queue" or 
		//		"not". 
		//	type: String
		//		The queue in which the item is being changed: "queue", "instant", etc...
		//		Defaults to "queue" (the regular DVD queue).
		//	addingTo: Boolean
		//		Adding to the queue. This will add the "inQueue" class
		//		to the button. false or null will remove that class.
		//		Note that the usual case will be to remove from queue,
		//		as adding to queue, it is generally known which button
		//		to change, because that button triggered the action.
		var type = type || "queue";
		this.nodesByMovieId(movieId).forEach(function(n){
			if(dojo.attr(n, "movie")==movieId){
				dojo.query(".addButton", n).forEach(function(b){
					if(type=="instant" && !dojo.hasClass(b, "instant")){ return; }
					if(addingTo){
						dojo.addClass(b, "inQueue");
					}else{
						dojo.removeClass(b, "inQueue");	
					}
				});	
			}
		});	
	};
	
	this.getMovieIdByNode = function(/* Node */node){
		//	summary:
		//		Attempt to recover the movie ID from what's encoded
		//		in the DOM around a given node.
		//	node:
		//		A node which has an attribute called "movie", or a
		//		descendant of such a node.
		//	returns:
		//		The Netflix movie ID (which might be the title if there's
		//		no GUID found, which happens in the case of items in the
		//		RSS feeds), or 0 if not found.
		while(node){
			if(dojo.hasAttr(node, "movie")){
				var guid = dojo.attr(node, "movie");
				//	test to see what this actually is.
				if(guid.indexOf("api.netflix.com")==-1){
					//	this is a title.
					return guid;
				}
				else if(
					guid.indexOf("at_home")>-1
					|| guid.indexOf("queues")>-1
					|| guid.indexOf("rental_history")>-1
				){
					//	this is one of our queue things, dive into the item.
					var item = qd.services.item(guid);
					return (item && item.title && item.title.guid) || 0;
				}
				else {
					return guid;
				}
			}
			node = node.parentNode;
		}
		return 0;
	};

	this.fetchTitle = dojo.hitch(this, function(/* String */movieId){
		//	summary:
		//		Display a movie info dialog for the given movie.
		//	movieId:
		//		Netflix API item ID or title. If it starts with "http://",
		//		then it is assumed to be a GUID; otherwise it's taken to
		//		be a movie title or search term.
		var arg = {};
		arg[(movieId && movieId.indexOf("http://") == 0) ? "guid" : "term"] = movieId;
		return qd.service.titles.fetch(arg);
	});

	this.showInfo = dojo.hitch(this, function(/* String */movieId){
		//	summary:
		//		Display a movie info dialog for the given movie.
		//	movieId:
		//		Netflix API item ID or title.
		console.log("showing the info with movieId: " + movieId);
		if(dialogIsDisabled){
			console.log("Skipping the movie info dialog because it's disabled at the moment.");
			return;
		}
		if(!movieId){
			console.error("Couldn't find a movie ID!");
			return;
		}

		if(qd.app.authorized){
			// logged in; show full details
			qd.app.underlay.show();
			if(movieId.indexOf("queues")>-1
				|| movieId.indexOf("rental_history")>-1
				|| movieId.indexOf("at_home")>-1
			){
				//	get the real movie
				movieId = qd.services.item(movieId).title.guid;
			} 
			var def = this.fetchTitle(movieId);
			def.addCallback(this, function(movie){
				qd.app.underlay.hide();
				movie.allDirectors = dojo.map(movie.directors, function(d){ return d.title; }).join(", ");
				populateDialog(movie);
				dojo.query(".movie", infoTemplate.getRootNode()).forEach(dojo.hitch(this, function(n){
					this.setupMovieId(n, movieId);
				}));
				var ratingType = (movie.ratings.user>0) ? "user"
				           : ((movie.ratings.predicted>0) ? "predicted"
				           : "average");
				dojo.query("#movieInfoTemplateNode .starRating").forEach(dojo.hitch(this, function(n){
					var first = (!movie.guid.match(/titles\/discs\//) || movie.title.match(/Disc 1$/)) ? true : false;
					dojo[first?"addClass":"removeClass"](n, "enabled");
					dojo[first?"removeClass":"addClass"](n, "nonFirst");
					qd.app.ratings.buildRatingWidget(n, ratingType, movie.ratings[ratingType], true);
				}));
				dijit.byId("movieInfoDialogNode").show();
			});
			def.addErrback(this, function(err){
				qd.app.underlay.hide();
				qd.app.errorTooltip.show(
					"No information available.", 
					"There is no extended information available for this title."
				);
			});
		}else{
			// not logged in; show abbreviated info, which we should
			// have because the very fact we're displaying a list of
			// movies for the user to click means we've at least
			// parsed one of the RSS feeds.
			var movie = qd.services.item(movieId);
			if(!movie){
				console.error("Couldn't find movie data in the registry for title " + movieId + ".");
				return;
			}
			populateDialog(movie);
			dijit.byId("movieInfoDialogNode").show();
		}
	});

	function disableInfoDialog(){
		dialogIsDisabled = true;
	}
	function enableInfoDialog(){
		// Janky timer! Give it a brief moment to try and pass
		// any click events through to nodes that might trigger
		// the dialog, THEN reenable it.
		setTimeout(function(){
			dialogIsDisabled = false;
		}, 150);
	}

	var movieInfoHandler = {
		onclick: dojo.hitch(this, function(evt){
			var movieId = this.getMovieIdByNode(evt.target);
			if(movieId){
				this.showInfo(movieId);
			}
		})
	};
	
	var movieAddHandler = {
		onclick: function(evt){
			var movieId = qd.app.movies.getMovieIdByNode(evt.target);
			if(movieId){
				if(movieId.indexOf("http")==0){
					qd.app.queue.addMovieById(movieId, evt.target);
				} else {
					qd.app.queue.addMovieByTerm(movieId, evt.target);
				}
			}
		}
	};
	
	var movieDialogAddHandler = {
		onclick: function(evt){
			var movieId = qd.app.movies.getMovieIdByNode(evt.target);
			if(movieId){
				dijit.byId("movieInfoDialogNode").hide();
				var queue = dojo.hasClass(evt.target, "instant") ? "instant" : "queue";
				if(movieId.indexOf("http")==0){
					qd.app.queue.addMovieById(movieId, evt.target, queue);
				} else {
					qd.app.queue.addMovieByTerm(movieId, evt.target, queue);
				}
			}
		}
	};
	dojo.behavior.add({
		// Public feed results interactions
		"#artworkList .movie span.title": movieInfoHandler,
		"#artworkList .movie span.boxArt": movieInfoHandler,
		"#artworkList .movie span.addButton": movieAddHandler,
		"#movieInfoTemplateNode .movie span.addButton": movieDialogAddHandler,
		// Search results
		"#searchResultsList .movie span.title": movieInfoHandler,
		"#searchResultsList .movie span.boxArt": movieInfoHandler
	});

	dojo.connect(qd.app, "startDragging", disableInfoDialog);
	dojo.connect(qd.app, "stopDragging", enableInfoDialog);

})();


}

if(!dojo._hasResource["qd.app.preferences"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.preferences"] = true;
dojo.provide("qd.app.preferences");



(function(){
	
	function handleExternalLink(evt){
		air.navigateToURL(new air.URLRequest(evt.target.href));
		return false;
	}
	
	function onClickRunBackground(/*Event*/evt){
		var checkbox = evt.target;
		console.log(dojo.attr(checkbox, "checked"));
		var u = qd.app.user();
		if(u){
			u.runInBackground = dojo.attr(checkbox, "checked");
			qd.app.save(u);
		}
	}
	
	function onClickReceiveNotifications(/*Event*/evt){
		var checkbox = evt.target;
		console.log(dojo.attr(checkbox, "checked"));
		var u = qd.app.user();
		if(u){
			u.receiveNotifications = dojo.attr(checkbox, "checked");
			qd.app.save(u);
		}
	}

	function init(){
		// first, make links in the Preferences pane open in the system default
		// browser; we can't use dojo.behavior for this because we need to
		// override the actual onclick handler (so we can make it return false)
		// and dojo.behavior just dojo.connect()s
		dojo.query("a.extern", dojo.byId("prefsContainerNode")).forEach(function(n){
			n.onclick = handleExternalLink;
		});
		// next, behavior setup(s)
		dojo.behavior.add({
			"#deauth": {
				onclick:function(){
					dojo.style(dojo.byId("deauthConfirm"), "display", "block");
					//qd.app.deauthorize();
					return false;
				}
			},
			"#deauthConfirmDelete": {
				onclick:function(){
					qd.app.deauthorize();
					return false;
				}
			},
			"#deauthConfirmKeep": {
				onclick:function(){
					dojo.style(dojo.byId("deauthConfirm"), "display", "none");
					return false;
				}
			},
			"#topNavPreferences a": {
				onclick:function(){
					qd.app.switchPage("preferences");
					return false;
				}
			},
			"#runInBackground": {
				onclick:function(evt){
					onClickRunBackground(evt);
					return false;
				}
			},
			"#receiveNotifications": {
				onclick:function(evt){
					onClickReceiveNotifications(evt);
					return false;
				}
			}
		});
		dojo.behavior.apply();
		
		// set checkboxes according to user prefs
		var u = qd.app.user(),
			receiveNotifications = u && u.receiveNotifications !== undefined && u.receiveNotifications || false,
			runInBackground = u && u.runInBackground !== undefined && u.runInBackground || false;
		dojo.attr(dojo.byId("receiveNotifications"), "checked", receiveNotifications);
		dojo.attr(dojo.byId("runInBackground"), "checked", runInBackground);
	}
	dojo.addOnLoad(init);
})();

}

if(!dojo._hasResource["qd.app.search"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.search"] = true;
dojo.provide("qd.app.search");












qd.app.search = new (function(){

	var SUGGEST_TIMEOUT_DURATION = 250,

	    autoSuggestTimer = null,
	    suggestion = null,
	    term = null,
	    totalResultsFound = 0;

	this.getClearContextData = function(){
		//	summary:
		//		Return a plain object to use with a DTL context containing data
		//		specific to this results list, for clearing the results template.
		var qar = qd.app.resultsList;
		return {
			number_found: totalResultsFound,
			headerClass: "search",
			search_term: term,
			sort_by: qar.sort
		};
	};

	this.getSortContextData = function(){
		//	summary:
		//		Return a plain object to use with a DTL context containing data
		//		specific to this results list, for sorting the results template.
		var qar = qd.app.resultsList;
		return {
			number_found: totalResultsFound,
			headerClass: "search",
			search_term: term
		};
	};

	/*=====
	qd.app.search.fetch.__FetchArgs = function(term, resultCount, result, error){
		//	summary:
		//		Arguments object for fetching recommendations.
		//	term: String
		//		The search term to send to Netflix.
		//	resultCount: Number?
		//		The number of results to find. Defaults to 20.
		//	result: Function?
		//		The callback function that will be executed when a result is
		//		fetched.
		//	error: Function?
		//		The callback function to be executed if there is an error in fetching.
	}
	=====*/

	this.fetch = function(/* qd.app.search.fetch.__FetchArgs */kwArgs){
		//	summary:
		//		Fetch search results from the Netflix API and render them
		//		to the page.
		var dfd = new dojo.Deferred(),
		    qar = qd.app.resultsList;
		hideAutoSuggestPicker();

		if(kwArgs && kwArgs.term){ term = kwArgs.term; }
		qd.service.titles.find({
			term: term,
			start: qar.results.length+1,
			max: (kwArgs && kwArgs.resultCount) || qar.ITEMS_PER_FETCH,
			result: function(response){
				totalResultsFound = response.number_found || 0;
				qar.renderResults(new dojox.dtl.Context({
					number_found: totalResultsFound,
					search_term: term,
					headerClass: "search",
					results: response.results,
					sort_by: "Relevance"
				}));
				dfd.callback(response.results);
			},
			error: function(err){
				// TODO
			}
		});

		return dfd;
	};

	this.fetchMore = function(/* qd.app.search.fetch.__FetchArgs */kwArgs){
		//	summary:
		//		Fetch additional search results from the Netflix API.
		var dfd = new dojo.Deferred(),
		    qar = qd.app.resultsList;

		qd.app.underlay.show();
		qd.service.titles.find({
			term: term,
			start: qar.results.length+1,
			max: (kwArgs && kwArgs.resultCount) || qar.ITEMS_PER_FETCH,
			result: function(response){
				qar.renderMoreResults(new dojox.dtl.Context({
					results: response.results,
					buttonClass:"addButton inQueue"
				}));
				dfd.callback(response.results);
			},
			error: function(err){
				// TODO
			}
		});

		return dfd;
	};

	function showAutoSuggestPicker(){
		//	summary:
		//		Reveal the auto-suggest picker.
		dojo.style("searchAutoSuggest", "display", "block");
		qd.app.resultsList.showPicker("searchAutoSuggestList");
	}

	function hideAutoSuggestPicker(){
		//	summary:
		//		Hide the auto-suggest picker.
		qd.app.resultsList.hidePicker("searchAutoSuggestList", function(){
			dojo.style("searchAutoSuggest", "display", "none");
		});
	}

	function highlightSuggestion(/* String|Node */node){
		//	summary:
		//		Highlight the given auto-suggest menu item node as selected.
		//	node:
		//		The node to highlight.
		if(node){
			dojo.query("#searchAutoSuggest li").removeClass("selected");
			dojo.addClass(node, "selected");
		}
	}

	function autosuggest(/* String */value){
		//	summary:
		//		Grab auto-suggest data from the Netflix API and present
		//		it in a drop-down-like menu.
		//	value:
		//		The search term to use as the basis for the suggestions
		var suggest = dojo.query("#searchAutoSuggest ul")[0];
		suggest.innerHTML = "";

		qd.service.titles.autosuggest({
			term: value,
			result: function(arr){
				dojo.forEach(arr, function(item){
					var li = document.createElement("li");
					li.innerHTML = item;
					suggest.appendChild(li);
				});

				if(arr.length){
					showAutoSuggestPicker();
				} else {
					suggest.innerHTML = "<li class='nohover'><i>No suggestions</i></li>";
				}
			},
			error: function(err){
				//	TODO
			}
		});
	}

	this.search = function(/* String */value){
		//	summary:
		//		Switch to the search page and run a search for the given term.
		//	value:
		//		Search term to use.
		qd.app.topMovies.switchPage("search");
		qd.app.resultsList.fetch({term:value});
	}


	dojo.behavior.add({
		// Search bar
		"#searchBar input": {
			onkeypress:dojo.hitch(this, function(e){
				var suggestNode = dojo.query("#searchAutoSuggest ul")[0];
				switch(e.keyCode){
				case dojo.keys.ENTER:
					if(suggestion){ e.target.value = suggestion.innerHTML; }
					qd.app.topMovies.switchPage("search");
					qd.app.resultsList.fetch({term:e.target.value});
					if(autoSuggestTimer){
						clearTimeout(autoSuggestTimer);
						autoSuggestTimer = null;
					}
					dojo.stopEvent(e);
					break;
				case dojo.keys.HOME:
				case dojo.keys.PAGE_UP:
					if(suggestion){
						suggestion = suggestNode.firstChild;
						dojo.stopEvent(e);
					}
					break;
				case dojo.keys.END:
				case dojo.keys.PAGE_DOWN:
					if(suggestion){
						suggestion = suggestNode.lastChild;
						dojo.stopEvent(e);
					}
					break;
				case dojo.keys.UP_ARROW:
					if(!suggestion){
						suggestion = suggestNode.lastChild;
					}else{
						suggestion = suggestion.previousSibling || suggestNode.lastChild;
					}
					break;
				case dojo.keys.DOWN_ARROW:
					if(!suggestion){
						suggestion = suggestNode.firstChild;
					}else{
						suggestion = suggestion.nextSibling || suggestNode.firstChild;
					}
					break;
				default:
					// on normal keypresses, wait for a brief interval before
					// checking for suggestions, to limit unnecessary API calls
					if(autoSuggestTimer){
						clearTimeout(autoSuggestTimer);
						autoSuggestTimer = null;
					}
					autoSuggestTimer = setTimeout(function(){
						suggestion = null;
						autosuggest(e.target.value);
					}, SUGGEST_TIMEOUT_DURATION);
				}
				highlightSuggestion(suggestion);
			}),
			onfocus:function(e){
				if(e.target.value == "Search movies"){
					e.target.value = "";
					dojo.style(e.target, "color", "#000");
				}
			},
			onblur:function(e){
				// janky timeout here because we don't get the onclick event
				// on #searchAutoSuggest if we hide it during this onblur; it
				// goes away too before the click is registered
				setTimeout(function(){
					suggestion = null;
					hideAutoSuggestPicker();
				}, qd.app.resultsList.HIDE_TIMER_DURATION);
				if(autoSuggestTimer){
					clearTimeout(autoSuggestTimer);
					autoSuggestTimer = null;
				}
			}
		},

		"#searchAutoSuggest ul": {
			onclick:dojo.hitch(this, function(e){
				term = e.target.innerHTML;
				dojo.query("#searchBar input")[0].value = term;
				suggestion = null;
				qd.app.topMovies.switchPage("search");
				qd.app.resultsList.fetch();
			}),
			onmouseover:function(e){
				suggestion = e.target;
				highlightSuggestion(suggestion);
			}
		}
	});

})();

}

if(!dojo._hasResource["qd.app.resultsList"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.resultsList"] = true;
dojo.provide("qd.app.resultsList");









qd.app.resultsList = new (function(){

	var resultsTemplate = null,
	    fetchMoreTemplateNode = null,
	    resultsImpl = qd.app.search; // can be qd.app.recommendations or qd.app.search

	this.ITEMS_PER_FETCH = 20;
	this.HIDE_TIMER_DURATION = 150;

	this.results = [];
	this.sort = "Relevance";
	this.suggestion = null;
	this.autoSuggestTimer = null;
	this.sortTimer = null;


	this.setResultsType = function(/* String */type){
		//	summary:
		//		Set the results list to the given type.
		//	type:
		//		One of ("recommendations", "search") depending on the operation.
		switch(type){
			case "recommendations":
				resultsImpl = qd.app.recommendations;
				break;
			case "search":
			default:
				resultsImpl = qd.app.search;
		}
	};

	this.clearResults = function(/* Boolean */deleteFromMemory){
		//	summary:
		//		Clear the current search results.
		//	deleteFromMemory:
		//		Pass true to clear the current results from memory as well as the
		//		page, false to clear only the display itself. Defaults to true.
		var context = {results:null};
		if(typeof deleteFromMemory != "undefined" && !deleteFromMemory){
			context = dojo.mixin(context, resultsImpl.getClearContextData());
		}else{
			this.results = [];
		}
		this.renderResults(new dojox.dtl.Context(context));
		// normally I'd do dojo.query(...).orphan() here, but that throws an error
		dojo.query(".movie", "searchResultsList").forEach(function(node){
			node.parentNode.removeChild(node);
		});
	};

	this.postProcessResults = function(results){
		//	summary:
		//		Common code to finish up post-search/recommendations/sort

		// cache the results, build a guid list.
		var guids = [];
		if(results){
			for(var i=0; i<results.length; i++){
				this.results.push(results[i]);
				guids.push(results[i].guid);
			}
		}

		// put movie IDs into the DOM
		var qam = qd.app.movies, inQueue;
		dojo.query("#searchResults .movie").forEach(function(node){
			qam.setupMovieId(node);
			dojo.query(".addButton", node).forEach(function(n){
				inQueue = qd.app.queue.inQueue(qam.getMovieIdByNode(n), "queueList");
				dojo[inQueue ? "addClass" : "removeClass"](n, "inQueue");
			});
		});

		qd.app.underlay.hide();

		// build & activate any pending rating widgets
		qd.service.titles.rated({
			guids: guids,
			result: function(data){
				dojo.forEach(data, function(item){
					var nl = dojo.query("div[movie='" + item.guid + "'] .starRating", dojo.byId("searchResultsList")); 
					if(nl){
						//	should be unique.
						var rating = 3, type = "average";
						if(item.ratings){
							if(item.ratings.user && item.ratings.user > 0){
								rating = item.ratings.user;
								type = "user";
							}
							else if(item.ratings.predicted && item.ratings.predicted > 0){
								rating = item.ratings.predicted;
								type = "predicted";
							}
							else if(item.ratings.average && item.ratings.average > 0){
								rating = item.ratings.average;
								type = "average";
							}
						}
						qd.app.ratings.buildRatingWidget(nl[0], type, rating);
					}
				});
			}
		}).addCallback(function(){
			qd.app.ratings.activateRatingWidgets();
		});
	};

	this.fetch = function(kwArgs){
		//	summary:
		//		Base method for running a search, fetching recommendations, etc.
		this.clearResults();
		resultsImpl.fetch(kwArgs).addCallback(this, "postProcessResults");
	};

	this.fetchMore = function(){
		//	summary:
		//		Pull in more results for the current batch and
		//		add them to the end of the existing results page.
		resultsImpl.fetchMore().addCallback(this, "postProcessResults");
	};

	this.renderResults = function(/* Object */context){
		//	summary:
		//		Render the data in the given context to the results template.
		//	context:
		//		A dojox.dtl.Context to pass to the "results" template.
		if(!resultsTemplate){
			resultsTemplate = new dojox.dtl.HtmlTemplate("searchResults");
		}
		resultsTemplate.render(context);
	};

	this.renderMoreResults = function(/* Object */context){
		//	summary:
		//		Append more results onto the current results template.
		//	context:
		//		A dojox.dtl.Context to pass to the "more results" template.
		var templateNode = dojo.clone(fetchMoreTemplateNode),
			template = new dojox.dtl.HtmlTemplate(templateNode);
		template.render(context);
		dojo.byId("searchResultsList").innerHTML += template.getRootNode().innerHTML;
	};

	this.sortResults = function(/* String */sortField){
		//	summary:
		//		Sort the current search results.
		//	sortField:
		//		The field to sort on, one of: "Title", "Year", "Genre", "Rating", "Relevance"
		//		(sorting on relevance just fetches the results all over again).
		this.clearResults(false);
		if(sortField.toLowerCase() == "relevance"){
			// just fetch them all over again, making sure to preserve the page we're on
			this.fetch({resultCount:this.results.length});
			return;
		}
		this.results.sort(function(a, b){
			var ratingsMap = ["G","TV G","TV Y","TV Y7","TV Y7 FV","PG","TV PG","PG-13","TV 14","R","TV MA","UR","NR","NC-17"];
			switch(sortField.toLowerCase()){
			case "title":
				return a.title < b.title ? -1 : 1;
			case "year":
				return a.releaseYear < b.releaseYear ? -1 : 1;
			case "genre":
				return a.categories[0] < b.categories[0] ? -1 : 1;
			case "rating":
				var ar = ratingsMap.indexOf(a.rating);
				var br = ratingsMap.indexOf(b.rating);
				if(ar == -1){ ar = 100; }
				if(br == -1){ br = 100; }
				return ar < br ? -1 : 1;
			default:
				console.log("Hmm, we're sorting by an unsupported field: " + sortField);
				return -1;
			}
		});
		var sc = resultsImpl.getSortContextData();
		this.renderResults(new dojox.dtl.Context(dojo.mixin({}, sc, {
			results: this.results,
			sort_by: sortField
		})));
		this.postProcessResults();
	};

	this.showPicker = function(/* String|Node */node, /* Function? */onEnd){
		//	summary:
		//		Show a menu/picker by animating it in.
		//	node:
		//		DOM node to reveal.
		//	onEnd:
		//		A callback to run after the reveal completes.
		var n = dojo.byId(node);
		if(dojo.style(n, "display") == "none"){
			dojo.style(n, {display:"block", height:"1px"});
			var anim = dojo.fx.wipeIn({node:n, duration:150});
			if(onEnd){
				var __ac = dojo.connect(anim, "onEnd", function(){
					dojo.disconnect(__ac);
					onEnd();
				});
			}
			anim.play();
		}
	};

	this.hidePicker = function(/* String|Node */node, /* Function? */onEnd){
		//	summary:
		//		Hide a picker/menu by animating it out.
		//	node:
		//		DOM node to hide.
		//	onEnd:
		//		A callback to run after the animation completes.
		var n = dojo.byId(node);
		if(dojo.style(n, "display") == "block"){
			var anim = dojo.fx.wipeOut({node:n, duration:75});
			var __ac = dojo.connect(anim, "onEnd", function(){
				dojo.disconnect(__ac);
				dojo.style(n, "display", "none");
				if(onEnd){ onEnd(); }
			});
			anim.play();
		}
	};

	var showSortPicker = dojo.hitch(this, function(){
		//	summary:
		//		Reveal the search result sort picker.
		if(!dojo.hasClass("searchResultsSortPickerSelection", "open")){
			this.showPicker("searchResultsSortPicker", function(){
				dojo.addClass("searchResultsSortPickerSelection", "open");
			});
		}
		if(this.sortTimer){ clearTimeout(this.sortTimer); }
	});

	var hideSortPicker = dojo.hitch(this, function(){
		//	summary:
		//		Hide the search result sort picker.
		this.sortTimer = setTimeout(dojo.hitch(this, function(){
			this.hidePicker("searchResultsSortPicker", function(){
				dojo.removeClass("searchResultsSortPickerSelection", "open");
			});
		}), this.HIDE_TIMER_DURATION);
	});

	dojo.behavior.add({
		"#searchResultsSortPickerSelection": {
			onmouseover: showSortPicker,
			onmouseout: hideSortPicker,
		},

		"#searchResultsSortPicker": {
			onmouseover: showSortPicker,
			onmouseout: hideSortPicker,
			onclick:dojo.hitch(this, function(e){
				var sortField = e.target.innerHTML;
				var sel = dojo.byId("searchResultsSortPickerSelection");
				sel.innerHTML = sortField;
				this.hidePicker("searchResultsSortPicker", function(){
					dojo.removeClass(sel, "open");
				});
				this.sortResults(sortField);
			})
		},

		"#searchResults .movie .addButton": {
			onclick:function(evt){
				var movieId = qd.app.movies.getMovieIdByNode(evt.target);
				if(movieId){
					qd.app.queue.addMovieById(movieId, evt.target);
				}
			}
		},

		".searchResultsMore": {
			onclick:dojo.hitch(this, function(){
				this.fetchMore();
			})
		},

		".recommendationsMore": {
			onclick:dojo.hitch(this, function(e){
				this.fetchMore();
			})
		}
	});

	// lazy create the results template and "more results" template node
	// when we visit Top Movies for the first time
	var sectionSwitchConnect = dojo.connect(qd.app, "switchPage", dojo.hitch(this, function(page){
		if(page == "topMovies" && fetchMoreTemplateNode == null){
			dojo.disconnect(sectionSwitchConnect);

			// set up the search and recommendations template and "more
			// results" template node
			var node = dojo.clone(dojo.byId("searchResultsList"));
			dojo.removeAttr(node, "id");
			fetchMoreTemplateNode = node;
		}
	}));


})();

}

if(!dojo._hasResource["qd.app.recommendations"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.recommendations"] = true;
dojo.provide("qd.app.recommendations");










qd.app.recommendations = new (function(){
	this.getClearContextData = function(){
		//	summary:
		//		Return a plain object to use with a DTL context containing data
		//		specific to this results list, for clearing the results template.
		return {
			skipCount: true,
			headerClass: "recommendations",
			sort_by: qd.app.resultsList.sort
		};
	};

	this.getSortContextData = function(){
		//	summary:
		//		Return a plain object to use with a DTL context containing data
		//		specific to this results list, for sorting the results template.
		return {
			skipCount: true,
			headerClass: "recommendations"
		};
	};

	/*=====
	qd.app.recommendations.fetch.__FetchArgs = function(resultCount, result, error){
		//	summary:
		//		Arguments object for fetching recommendations.
		//	resultCount: Number?
		//		The number of results to find. Defaults to 20.
		//	result: Function?
		//		The callback function that will be executed when a result is
		//		fetched.
		//	error: Function?
		//		The callback function to be executed if there is an error in fetching.
	}
	=====*/

	this.fetch = function(/* qd.app.recommendations.fetch.__FetchArgs */kwArgs){
		//	summary:
		//		Fetch recommendations from the Netflix API and render
		//		them to the page.
		var dfd = new dojo.Deferred(),
		    qar = qd.app.resultsList;

		qd.service.titles.recommendations({
			start: qar.results.length+1,
			max: (kwArgs && kwArgs.resultCount) || qar.ITEMS_PER_FETCH,
			result: function(results){
				qar.renderResults(new dojox.dtl.Context({
					skipCount: true,
					headerClass: "recommendations",
					results: results,
					sort_by: "Relevance"
				}));
				dfd.callback(results);
			},
			error: function(err){
				// TODO
			}
		});

		return dfd;
	};

	this.fetchMore = function(/* qd.app.recommendations.fetch.__FetchArgs */kwArgs){
		//	summary:
		//		Fetch additional recommendations from the Netflix API.
		var dfd = new dojo.Deferred(),
		    qar = qd.app.resultsList;

		qd.app.underlay.show();
		qd.service.titles.recommendations({
			start: qar.results.length+1,
			max: (kwArgs && kwArgs.resultCount) || qar.ITEMS_PER_FETCH,
			result: function(results){
				qar.renderMoreResults(new dojox.dtl.Context({
					results: results,
					buttonClass:"addButton inQueue"
				}));
				dfd.callback(results);
				qd.app.underlay.hide();
			},
			error: function(err){
				// TODO
			}
		});

		return dfd;
	};
})();

}

if(!dojo._hasResource["qd.app.systray"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.systray"] = true;
dojo.provide("qd.app.systray");



(function(){
	var di = dair.Icon;
	var popWidth = 410;
	var popMinHeight = 90;
	var popRowHeight = 72;
	
	var qIcon = [		
		'img/icon/AIRApp_128.png',
		'img/icon/AIRApp_48.png',
		'img/icon/AIRApp_32.png',
		'img/icon/AIRApp_16.png'
	];
	
	var getViewport = function(){
		// summary: Mixin screen resolutions into viewport sniffing code
		return dojo.mixin(dijit.getViewport(), { 
			sx: air.Capabilities.screenResolutionX, 
			sy: air.Capabilities.screenResolutionY
		}); //Object
	};
	var buildWin = function(){
		var v = getViewport();
		var w = popWidth;
		var mr = 0;
		var mb = 100;
		return new dair.Window({
			size:{
				h:v.sy, w:w, t:0, l:v.sx - w - mr,
			},
			href:"Mini.html",
			transparent:true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			type:"utility",
			systemChrome:"none",
			alwaysInFront:true
		});	// dair.Window
	};
	
	var getItems = function(/*String*/type){
		if (type) {
			return qd.app.queue.getNotifications(type);
		} else { 
			var a = qd.app.queue.getItems.call(qd.app.queue, "atHomeList"); // Array
			//	make SURE we have the right image urls.
			dojo.forEach(a, function(item){
				item.title.art.large = qd.services.util.image.url(item.title.art.large);
				item.title.art.small = qd.services.util.image.url(item.title.art.small);
			});
			return a;
 		}
	};
	
	qd.app.systray = new (function(){
		// summary:
		//		Handles functionality that involves the taskbar icon
		//		and the mini window that opens when the app is in the
		//		background.
		//	NOTE: 
		//		Consistently using the term "systray" as in the 
		//		Lower right system tray used in Windows. However, this
		//		handles the Mac Dock and Dock Icon in a similar manner.
		//
		this.allowExit = false;
		this.showing = true;
		this.winshowing = false;
		this.miniDisplaying = "";
		
		this.init = function(){
			// summary: 
			// 		Initialize. Set the icon in the systray,
			//		set menu for icon, and set up connections.	
			if(!di.initialized){
				dojo.connect(di, "onReady", this, "init");
				return;
			}
			
			di.setIcon(qIcon);
			
			this.setMenu();
			this._doConnect();
			//this.win = buildWin();
		};
		
		this.showApp = function(){
			// summary: Show main window
			if(!this.showing){
				window.nativeWindow.visible = true;
	      		this.showing = true;
				this.allowExit = false;
			}
			window.nativeWindow.orderToFront();
		};
		
		this.hideApp = function(){
			// summary: Hide main window
			if(this.showing){
				window.nativeWindow.visible = false;
				this.showing = false;
				this.allowExit = true;
			}
			
		};
		
		this.doSearch = function(/*String*/value){
			//	summary:
			// 		Called from mini when user inserts
			//		a search term and hits enter
			console.log("VALUE", value);
			value = dojo.trim(value);
			if(value){
				this.showApp();
				// timeout needed here or mini doesn't close
				setTimeout(dojo.hitch(this, "hideMini"), 100);
				qd.app.search.search(value);
			}
		};

		this.showMini = function(){
			if(!this.winshowing && this.nativeWindow){
				this.nativeWindow.animate("open");
				this.winshowing = true;
			}
			
		};
		
		this.hideMini = function(){
			// summary:
			//		Hides mini.
			if(this.nativeWindow && this.winshowing){
				this.nativeWindow.animate("close");
				this.winshowing = false;
			}
		};
		this.isReady = function(){
			// summary:
			//		Checks if Mini window has been built yet.
			//		If so, returns true. If false, builds the
			//		window and then retriggers original request.
			if(this.nativeWindow){ return true;}
			this.win = buildWin();
			var callback = this.isReady.caller;
			var args = this.isReady.caller.arguments;
			var c = dojo.connect(this, "onWinLoad", this, function(){
				dojo.disconnect(c);
				callback.apply(this, args);		
			});
			return false;
		}
		
		this.showAtHome = function(){
			if(!this.isReady()){ return false; }
			this.miniDisplaying = "atHome";
			this.nativeWindow.atHome(getItems());
			this.showMini();
		};
		this.showShipped = function(/*Array*/shipped){
			if(!this.isReady()){ return; }
			this.miniDisplaying = "shipped";
			this.nativeWindow.shipped(shipped || getItems("shipped"));
			this.showMini();
		};
		this.showReceived = function(/*Array*/receieved){
			if(!this.isReady()){ return; }
			this.miniDisplaying = "receieved";
			this.nativeWindow.received(receieved ||getItems("received"));
			this.showMini();
		};
		this.showShippedAndReceived = function(/*Array*/shipped, /*Array*/receieved){
			console.log("systray.showShippedAndReceived", shipped, receieved)
			if(!this.isReady()){ return; }
			console.log("systray.showShippedAndReceived GO!", shipped, receieved)
			this.miniDisplaying = "shippedAndReceived";
			this.nativeWindow.shippedAndReceived(shipped || getItems("shipped"), receieved ||getItems("received"));
			this.showMini();
		};
		
		this.devShipped = function(){
			qd.app.queue.polling.dev(true);
			qd.app.queue.polling.devS = true;
		};
		this.devReceived = function(){
			qd.app.queue.polling.dev(true);
			qd.app.queue.polling.devR = true;
		};
		this.devShippedAndReceived = function(){
			qd.app.queue.polling.dev(true);
			qd.app.queue.polling.devSR = true;
		};
		
		this.onListChange = function(list){
			// just changes the atHome list. does not show the window.
			if(this.nativeWindow && list && list.type=="at_home" && this.miniDisplaying == "atHome"){
				console.info("UPDATE AT_HOME LIST", getItems().length);
				this.nativeWindow.atHome(getItems());
			}
		};
		
		this.onWinLoad = function(w){
			console.info("MINI WINDOW LOADED", w);
			this.nativeWindow = w;
		};
		
		this.onClick = function(){
			// summary:
			//		Called when systray icon is clicked
			//		AND the app is not showing. If app is
			//		showing, this is not triggered.
			//		NOTE: No event, due to Mac compatibility.
			this.showAtHome();
		};
		
		this.setMenu = function(){
			// 	summary:
			//		Sets the right-click menu for the systray icon
			//		Called multiple times, and changes menu according
			//		to app state - like if the user is logged in.
			//
			if(this.wasLoggedIn === qd.app.authorized){ return; }
			this.wasLoggedIn = qd.app.authorized;
			
			di.setMenu({
				"At Home Mini-Queue": this.wasLoggedIn ? dojo.hitch(this, function(){
					this.showAtHome();
				}) : false,
				"Your Queue": this.wasLoggedIn ? dojo.hitch(this, function(){
					this.showApp();
					qd.app.queue.switchPage("queue");
				}) : false,
				"Top 100 Movies": dojo.hitch(this, function(){
					this.showApp();
					qd.app.switchPage("topMovies");
					qd.app.selectNav("", "topMoviesSubNav");
				}),
				"Preferences": this.wasLoggedIn ? dojo.hitch(this, function(){
					this.showApp();
					qd.app.switchPage("preferences");
				}) : false,	
				"divider":true,
				/*
				"Hide App (dev)": dojo.hitch(this, function(){
					this.hideApp();
				}),	
				"Show Shipped (dev)": dojo.hitch(this, function(){
					this.devShipped();
				}),	
				"Show Received (dev)": dojo.hitch(this, function(){
					this.devReceived();
				}),	
				"Show Shipped and Received (dev)": dojo.hitch(this, function(){
					this.devShippedAndReceived();
				}),
				*/		
				"Quit Queued": dojo.hitch(this, function(){
					this.allowExit = true;
					qd.app.exit();
				})
			});
		};
		
		this._doConnect = function(){
			//	summary: 
			//		Building connections
			// When the app is minimized, clicking the icon should
			//	show the Mini popup. 
			if(di.isTray){
				// windows. supports icon click.
				dojo.connect(di, "onClick", this, function(){
					if(!this.showing && !this.winshowing){ this.onClick(); }
				});
			}else{
				// Mac does not support icon click.
				// the next best thing is to catch onFocus
				//	This will work but you'll need to blur first
				//	So: minimizing the app and immediately clicking
				//	on the button will NOT work.
				dojo.connect(di, "onFocus", this, function(){
					if(!this.showing && !this.winshowing){ this.onClick(); }
				});
			}
			
			// some crazy handlers to allow and disallow 
			//	the app to exit or move to the system tray
			dojo.connect(window, "keypress", this, function(evt){
				// if the console is open, allow keyboard exit
				//	else the app foobars
				if(dojo.config.isDebug){
					this.allowExit = true;	
				}
			});
			dojo.connect(window, "keyup", this, function(evt){
				this.allowExit = false;
			});
			dojo.connect(window, "blur", this, function(evt){
				// if the main window doesn't have focus and it is
				//	open don't block exit. It's most likely
				//	in debug mode and the console is in focus.
				if(this.showing){
					this.allowExit = true;	
				}
			});
			dojo.connect(window, "focus", this, function(evt){
				this.allowExit = false;
			});
			
			// connecting changes to the AtHome that would show
			//	in the mini
			dojo.connect(qd.app.queue, "onLoad", this, "onListChange");
			dojo.connect(qd.app.queue, "onChange", this, "onListChange");
		};

	})();
	
	var doLoad = function (){
		console.log('do load ')
		qd.app.systray.init();
	} 
	
	function onExit(evt){	
		if(!qd.app.systray.allowExit && dojo.attr(dojo.byId("runInBackground"), "checked")){
			evt.preventDefault();
			qd.app.systray.hideApp();
		}
	}
	window.nativeWindow.addEventListener(air.Event.CLOSING, onExit);
	
	// dev --->
	var c1, c2;
	var devShow = function(){ return;
		setTimeout(function(){
			//qd.app.systray.showAtHome();
			qd.app.systray.showShippedAndReceived();	
			dojo.disconnect(c1);
			dojo.disconnect(c2);
		}, 1000);
		
	}
	c1 = dojo.connect(qd.app, "switchPage", function(page){
		if(page=="auth"){ devShow(); }	
	});
	c2 = dojo.connect(qd.app, "hideBgLoader", function(){
		devShow();
	});
	//
	var onWin = function(evt){
		//console.warn("CHANGED!", evt.type)
	}
	// these events all work. Keeping here for a while for reference	
	window.nativeWindow.addEventListener(air.NativeWindowBoundsEvent.RESIZE,onWin);
	window.nativeWindow.addEventListener(air.NativeWindowBoundsEvent.RESIZING,onWin);
	window.nativeWindow.addEventListener(air.NativeWindowBoundsEvent.MOVING, onWin);
	window.nativeWindow.addEventListener(air.NativeWindowDisplayStateEvent.DISPLAY_STATE_CHANGING, onWin);
	window.nativeWindow.addEventListener(air.NativeWindowDisplayStateEvent.DISPLAY_STATE_CHANGE, onWin);
	// <-------- dev
	
	dojo.addOnLoad(doLoad);
	
})();

	/*
	 * 
	 * for reference. would like to ani the main window.
				 Can't animate window
				 because of minWidths/heights
				 Need to implement a dummy window
				 
				 this.restoreProps = {
					x:window.nativeWindow.x,
					y:window.nativeWindow.y,
					w:window.nativeWindow.width,
					h:window.nativeWindow.height
				}
				console.dir(this.getViewport())
				
				var self = this;
				dair.fx.animateWindow({
					pane: window.nativeWindow,
					y:500,//dair.getViewport().sy -100,
					height: 100,
				//	easing: dojo.fx.easing.backOut,
					duration:1000,
					onEnd: function(){
						window.nativeWindow.visible = false;
					}
				}).play();
				*/

}

if(!dojo._hasResource["qd.app.tooltip"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.tooltip"] = true;
dojo.provide("qd.app.tooltip");








qd.app.tooltip = new (function(){
	var tooltipTemplate = null,
		tooltipTimer = null,
		tooltipNode = null,
		bestPosition = null,

		STAR_WIDTH = 18, // pixel width of a single rating star
		TOOLTIP_DELAY = 750; // milliseconds to wait before showing the tooltip

	function getTooltipTemplate(){
		//	summary:
		//		Returns the DTL template for the tooltip, creating it
		//		if necessary.
		if(!tooltipTemplate){
			tooltipTemplate = new dojox.dtl.HtmlTemplate("movieInfoTooltipContentNode");
		}
		return tooltipTemplate;
	}
	
	// borrowed/ported from dijit.Tooltip
	function orientTooltip(/* String */aroundCorner, /* String */tooltipCorner){
		//	summary:
		//		Set CSS to position the arrow based on which position the tooltip is in.
		var node = dojo.byId("movieInfoTooltipNode"),
			css = {
				"TR-TL": "top right",
				"BR-BL": "bottom right",
				"TL-TR": "top left",
				"BL-BR": "bottom left"
			},
			art = dojo.hasClass(node, "noArt") ? " noArt" : "";

		node.className = css[aroundCorner + "-" + tooltipCorner] + art;
	}

	// borrowed/ported from a inner function inside dijit._place
	function tryTooltipPosition(/* Object */choice){
		//	summary:
		//		Try a position for the tooltip by positioning it and checking
		//		the bounds against the viewport.
		//	choice:
		//		An object produced by the for loop in placeTooltip :-)
		//		It looks like, e.g., {aroundCorner:"TR", corner:"TL", pos:{x:0,y:0}}
		var node = dojo.byId("movieInfoTooltipNode"),
			corner = choice.corner,
			pos = choice.pos,
			view = dijit.getViewport();

		orientTooltip(choice.aroundCorner, corner);

		var mb = dojo.marginBox(node);

		// coordinates and size of node with specified corner placed at pos,
		// and clipped by viewport
		var startX = (corner.charAt(1) == 'L' ? pos.x : Math.max(view.l, pos.x - mb.w)),
			startY = (corner.charAt(0) == 'T' ? pos.y : Math.max(view.t, pos.y -  mb.h)),
			endX = (corner.charAt(1) == 'L' ? Math.min(view.l + view.w, startX + mb.w) : pos.x),
			endY = (corner.charAt(0) == 'T' ? Math.min(view.t + view.h, startY + mb.h) : pos.y),
			width = endX - startX,
			height = endY - startY,
			overflow = (mb.w - width) + (mb.h - height);

		if(bestPosition == null || overflow < bestPosition.overflow){
			bestPosition = {
				corner: corner,
				aroundCorner: choice.aroundCorner,
				x: startX,
				y: startY,
				w: width,
				h: height,
				overflow: overflow
			};
		}
		return !overflow;
	}

	// borrowed/ported from dijit._base.placeOnScreenAroundNode, ._placeOnScreenAroundRect,
	// and ._place because something about the AIR environment breaks dojo.marginBox for
	// objects with visibility="hidden", which is what dijit._place sets as part of the
	// coordinate calculations
	function placeTooltip(/* Node */aroundNode){
		//	summary:
		//		Position the tooltip in relation to aroundNode in such a
		//		way as to minimize any clipping by the viewport.
		//	aroundNode:
		//		The node for which to position the tooltip.
		var align = {TR:"TL", BR:"BL", TL:"TR", BL:"BR"},
			node = dojo.byId("movieInfoTooltipNode"),
			pos = dojo.coords(aroundNode, true),
			choices = [];

		for(var nodeCorner in align){
			choices.push( {
				aroundCorner: nodeCorner,
				corner: align[nodeCorner],
				pos: {
					x: pos.x + (nodeCorner.charAt(1) == 'L' ? 0 : pos.w),
					y: pos.y + (nodeCorner.charAt(0) == 'T' ? 0 : pos.h)
				}
			});
		}

		bestPosition = null;
		dojo.some(choices, tryTooltipPosition); // set bestPosition to the optimal choice
		dojo.style(node, {left:bestPosition.x+"px", top:bestPosition.y+"px"});
		orientTooltip(bestPosition.aroundCorner, bestPosition.corner);
	}

	function showTooltip(/* String */movieId, /* Node */aroundNode, /* Boolean? */showBoxArt){
		//	summary:
		//		Display a movie info tooltip for the given movie.
		//	movieId:
		//		Netflix API movie ID or title.
		//	aroundNode:
		//		DOM Node at which to anchor the tooltip.
		//	showBoxArt:
		//		Pass true to show box art, false otherwise. Defaults to false.
		if(!movieId){
			console.error("Couldn't find a movie ID!");
			return;
		}

		if(qd.app.authorized){
			qd.app.loadingIcon.show();
			var def = qd.app.movies.fetchTitle(movieId);
			def.addCallback(this, function(movie){
				if(aroundNode == tooltipNode){ // still on the original movie node?
					var node = dojo.byId("movieInfoTooltipNode"),
						r = movie.ratings,
						template = getTooltipTemplate(),
						context = new dojox.dtl.Context({
							movie: movie,
							castMember1: movie.cast.length ? movie.cast[0].title : "",
							castMember2: (movie.cast.length && movie.cast.length > 1) ? movie.cast[1].title : ""
						});
					dojo[(showBoxArt||false) ? "removeClass" : "addClass"](node, "noArt");
					dojo.style(node, {display:"block", opacity:0});
					template.render(context);
					dojo.query(".userRatingStars", node).style("width", (r.user * STAR_WIDTH)+"px");
					dojo.query(".predictedRatingStars", node).style("width", (r.predicted * STAR_WIDTH)+"px");
					dojo.query(".averageRatingStars", node).style("width", (r.average * STAR_WIDTH)+"px");
					placeTooltip(aroundNode);

					qd.app.loadingIcon.hide();
					dojo.fadeIn({node:node}).play();
				}
			}).addErrback(this, function(err){
				qd.app.errorTooltip.show(
					"No information available.", 
					"Could not find extended information for this title."
				);
			});
		}
	}

	function hideTooltip(){
		//	summary:
		//		Hide the movie info tooltip.
		dojo.style("movieInfoTooltipNode", "display", "none");
		if(tooltipTimer){
			clearTimeout(tooltipTimer);
			tooltipTimer = null;
			tooltipNode = null;
		}
	}

	function tooltipIsDisabled(){
		return qd.app.isDragging();
	}

	function tooltipHandler(/* Boolean? */showBoxArt){
		//	summary:
		//		Create a handler for dojo.behavior to set up the tooltip.
		//	showBoxArt:
		//		Pass true to show box art, false otherwise. Defaults to false.
		return {
			onmouseover: function(evt){
				if(tooltipIsDisabled()){ return; }
				var node = evt.target;
				var movieId = qd.app.movies.getMovieIdByNode(node);
				if(movieId){
					if(tooltipTimer){ hideTooltip(); }
					tooltipTimer = setTimeout(function(){
						tooltipNode = node;
						showTooltip(movieId, node, showBoxArt);
					}, TOOLTIP_DELAY);
				}
			},
			onmouseout: function(evt){
				hideTooltip();
			},
			onmousewheel: function(evt){
				hideTooltip();
			}
		}
	}

	var tooltipCanceller = {
		onclick: function(evt){
			// cancel the tooltip if the user clicks somewhere
			hideTooltip();
		}
	};

	dojo.behavior.add({
		".listQueuedRow .title": dojo.mixin({}, tooltipCanceller, tooltipHandler(true)),
		"#artworkList .movie .boxArt img.gloss": tooltipHandler(false),

		"#artworkList .movie": tooltipCanceller
	});

})();


}

if(!dojo._hasResource["qd.app.sync"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.app.sync"] = true;
dojo.provide("qd.app.sync");




qd.app.sync = new (function(){
	var progress=0, nActions=0, current=0;

	function closeDialog(){
		dijit.byId("syncConfirmDialogNode").hide();
	}

	this.showDialog = function(){
		//	summary:
		//		Show the sync confirmation dialog. It always starts on the
		//		"question" page.
		nActions = 0;
		progress = 0;
		current = 0;
		this.switchPage("question");
		dijit.byId("syncConfirmDialogNode").show();
		dojo.style("progressNode", "width", "0");
	};

	this.switchPage = function(page){
		//	summary:
		//		Toggle the dialog page.
		//	page:
		//		One of "question", "progress".
		var question, progress;
		switch(page){
			case "progress":
				question = "none";
				progress = "block";
				break;
			case "question":
			default:
				question = "block";
				progress = "none";
		}
		dojo.style("syncQuestionNode", "display", question);
		dojo.style("syncProgressNode", "display", progress);
	};

	this.synchronizeChanges = function(){
		//	summary:
		//		Synchronized queued changes with Netflix.

		console.warn("SYNCHRONIZING CHANGES");
		this.switchPage("progress");
		current = 0;
		qd.services.online.synchronize();
	};

	this.discardChanges = function(){
		//	summary:
		//		Throw away queued changes that haven't been synchronized with Netflix.

		console.warn("DISCARDING CHANGES");
		var h = dojo.connect(qd.services.online, "onDiscardSync", function(){
			dojo.disconnect(h);
			closeDialog();
		});
		qd.services.online.discardSynchronizations();
	};

	this.progress = function(/* Number? */percent){
		//	summary:
		//		Get or set the sync progress as a percentage; this is just
		//		for display purposes; call it to provide a visual indication
		//		of where the sync process is at any given time.
		//	percent:
		//		Number representing the percentage complete.
		if(arguments.length){
			progress = percent;
			dojo.style("progressNode", "width", progress+"%");
		}else{
			return progress;
		}
	};

	this.closeDialog = function(){
		closeDialog();
	};

	dojo.behavior.add({
		"#syncQuestionNode .synchronizeButton": {
			onclick:dojo.hitch(this, "synchronizeChanges")
		},
		"#syncQuestionNode .discardButton": {
			onclick:dojo.hitch(this, "discardChanges")
		}
	});

	dojo.connect(qd.services.online, "onSyncNeeded", dojo.hitch(this, function(n){
		this.showDialog();
		nActions = n;
	}));
	dojo.connect(qd.services.online, "onSyncComplete", function(){
		closeDialog();
	});

	dojo.connect(qd.services.online, "onSyncItemStart", dojo.hitch(this, function(prompt){
		dojo.byId("syncProgressPrompt").innerHTML = prompt + "...";
	}));
	dojo.connect(qd.services.online, "onSyncItemComplete", dojo.hitch(this, function(){
		current++;
		this.progress(Math.min(100, Math.round((current/nActions)*100)));
	}));
})();

}

if(!dojo._hasResource["qd.init"]){ //_hasResource checks added by build. Do not use _hasResource directly in your code.
dojo._hasResource["qd.init"] = true;
dojo.provide("qd.init");
































// PATCH ===========================>
// For some reason, the Layout widget parent (top most layout item)
// doesn't get the window bounds, it measures itself. Strange. This 
// should be fixed in dijit.
dijit.layout._LayoutWidget.prototype._resize = dijit.layout._LayoutWidget.prototype.resize;
dijit.layout._LayoutWidget.prototype.resize = function(changeSize, resultSize){
	// in our case this is the parent, but _LayoutWidget
	//	would know if it were fixed in dijit
	if(this.id=="layoutNode"){ 
		changeSize = dijit.getViewport();
	}
	this._resize(changeSize, resultSize);
}
//<=============================PATCH

// PATCH ===========================>
/*
dojo.Deferred.prototype.addCallback = function(cb, cbfn){
	//	summary: 
	//		Add a single callback to the end of the callback sequence.
	var closure = dojo.hitch.apply(dojo, arguments);
	var h;
	var fn = cbfn;
	if(!cbfn){
		h = cb;
	}else{
		h = function(){
			var a = arguments
			setTimeout(
				dojo.hitch(cb, function(){
					try {
						closure.apply(null, a)
					}catch(err){
						console.error("App Error: "+ err.message)
						console.dir({ "Error origination:": fn.toString() });
					}
				}), 0);
		}	
	}
	return this.addCallbacks(h, null); // dojo.Deferred
};
*/
//<=============================PATCH

qd.init = qd.init || {};
(function(){
	//	setup the services getter
	qd.__defineGetter__("service", function(){
		var b = qd.services.network.available;
	//	console.warn("-----> Using the " + (b ? "online" : "offline") + " service.");
		return b ? qd.services.online : qd.services.offline;
	});
	dojo.addOnLoad(qd.services.init);

	function setupNavigation(){
		var __splash = dojo.connect(qd.app, "switchPage", function(){
			dojo.disconnect(__splash);
			var splash = dojo.byId("splashScreen"),
			    anim = dojo.fadeOut({node:splash}),
			    anim_h = dojo.connect(anim, "onEnd", function(){
					dojo.disconnect(anim_h);
					dojo.style(splash, "display", "none");
				});
			anim.play();
		});

		if(qd.app.authorized){
			var h = dojo.connect(qd.services.network, "onChange", function(){
				dojo.disconnect(h);
				qd.app.queue.gotoInitialPage();	
			});
		}else{
			qd.app.switchPage("auth");	
		}
		
		dojo.byId("searchBar").onsubmit = function(){ return false; };

		dojo.query("#topNavDelivered a").connect("onclick", function(){
			air.navigateToURL(new air.URLRequest("https://www.netflix.com/"));
		});

		//	view source link
		dojo.query("#viewSource").connect("onclick", function(evt){ 
			qd.app.source();
			dojo.stopEvent(evt);
			return false; 
		});

		//	authorization screen
		dojo.query("input.authorizeBtn").connect("onclick", function(){
			qd.services.authorization.request();
		});

		//	connect to auth and deauth.
		dojo.connect(qd.app, "authorize", function(){
			//	get the user information
			var dfd = qd.service.user.fetch();
			dfd.addCallback(function(obj){
				qd.app.user(obj);
				dojo.byId("topNavUser").innerHTML = "Welcome " + obj.name.first + " " + obj.name.last;
				dojo.byId("prefsUserName").innerHTML = obj.name.first + " " + obj.name.last;
			});
			qd.app.queue.gotoInitialPage();
			dojo.style("searchBar", "display", "block");
			dojo.removeClass(dojo.body(), "notLoggedIn");
		});

		dojo.connect(qd.app, "deauthorize", function(){
			qd.app.user(null);
			qd.app.switchPage("auth");
			dojo.style("searchBar", "display", "none");
			dojo.addClass(dojo.body(), "notLoggedIn");
		});

		//	the rest
		dojo.behavior.apply();
	}

	function setupLayout(){
		// The main layout
		//
		//	bc - all content, includes the header
		var bc = new dijit.layout.BorderContainer({gutters:false}, "layoutNode");
			//
			// sc - all content below the header
			var sc = new dijit.layout.StackContainer({region:"center", gutters:false}, "contentNode");
				//s
				//		single pages go in sc
				sc.addChild(new dijit.layout.ContentPane({region:"center"}, "prefsContainerNode"));
				//
				// cbc - top movies content
				var cbc = new dijit.layout.BorderContainer({gutters:false}, "topMoviesContainerNode");
				cbc.addChild(new dijit.layout.ContentPane({region:"top"}, "topMoviesSubNav"));
				cbc.addChild(new dijit.layout.ContentPane({region:"center"}, dojo.query(".contentTop","topMoviesContainerNode")[0]));
				sc.addChild(cbc);
				//
				// q - queued content with nav
				var q = new dijit.layout.BorderContainer({gutters:false}, "queueContentNode");
				q.addChild(new dijit.layout.ContentPane({region:"top"}, "queSubNav"));
				sc.addChild(q);
					//
					// qc - queued pages
					var qc = new dijit.layout.StackContainer({region:"center", gutters:false}, "queuePages");
					qc.addChild(new dijit.layout.ContentPane({region:"center"}, "queueContainerNode"));
					qc.addChild(new dijit.layout.ContentPane({region:"center"}, "instantContainerNode"));
					qc.addChild(new dijit.layout.ContentPane({region:"center"}, "historyContainerNode"));
					q.addChild(qc);
				//
				// a - auth content with nav
				var a = new dijit.layout.BorderContainer({gutters:false}, "authContentNode");
				a.addChild(new dijit.layout.ContentPane({region:"top"}, "authSubNav"));
				sc.addChild(a);
					//
					// au - auth pages 
					var au = new dijit.layout.StackContainer({region:"center", gutters:false}, "authPages");
					au.addChild(new dijit.layout.ContentPane({region:"center"}, "createAccountContainerNode"));
					a.addChild(au);
		
		bc.addChild(new dijit.layout.ContentPane({region:"top"}, "headerNode"));
		bc.startup();
		// done with main layout

		// generic underlay nodes; connect to underlay.show/hide for custom behavior
		// (closing a dialog, etc.); We use two underlay nodes, one for the header and
		// one for the content area; this makes it easier to nest DOM nodes inside the
		// content container(s)
		var underlays = [ ["topMoviesUnderlay", dojo.byId("genrePicker").parentNode],
		                  ["queueUnderlay", dojo.byId("queuePages")],
		                  ["headerUnderlay", dojo.body()] ];
		dojo.forEach(underlays, function(n){
			var u = document.createElement("div");
			dojo.connect(u, "onclick", qd.app.underlay, "hide");
			dojo.attr(u, "id", n[0]);
			dojo.place(u, n[1]);
		});

		// movie info dialog
		(new dojox.widget.Dialog({dimensions: [800,450]}, "movieInfoDialogNode")).startup();

		// sync confirmation dialog
		(new dojox.widget.Dialog({dimensions: [400,185], modal:true}, "syncConfirmDialogNode")).startup();
	}

	dojo.addOnLoad(setupLayout);
	dojo.addOnLoad(setupNavigation);
})();

}

