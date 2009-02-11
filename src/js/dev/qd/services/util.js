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
