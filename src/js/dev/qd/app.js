dojo.provide("qd.app");

dojo.require("dojo.behavior");
dojo.require("dojox.io.OAuth");

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
		//air.trace("CLOSURE EXIT")
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
		//console.log("qd.app.onExit: FIRING");
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

	//	set up the application updater.
	var updater;
	dojo.addOnLoad(dojo.hitch(this, function(){
		updater = new runtime.air.update.ApplicationUpdaterUI();
		updater.configurationFile = new air.File("app:/updateConfig.xml");
		updater.addEventListener("initialized", function(evt){
			//	let the app finish it's thing first, then go hit for updates.
			setTimeout(function(){
				updater.checkNow();
			}, 15000);
		});
		updater.initialize();
	}));

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
