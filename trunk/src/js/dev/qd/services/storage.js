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
