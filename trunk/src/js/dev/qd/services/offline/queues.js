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
