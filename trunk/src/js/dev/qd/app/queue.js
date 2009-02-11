dojo.provide("qd.app.queue");
dojo.require("qd.app.queueList");
dojo.require("dojo.behavior");
dojo.require("dojo.date.locale");

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

