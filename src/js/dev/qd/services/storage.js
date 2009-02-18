dojo.provide("qd.services.storage");

(function(){
	var els = air.EncryptedLocalStore,
		ba = air.ByteArray;

	qd.services.storage = new (function(/* Boolean? */useCompression){
		//	summary:
		//		A singleton object that acts as the broker to the Encrypted Local Storage of AIR.
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
				return value;	//	Object
			}

			//	getter branch
			var stream = els.getItem(key);
			if(!stream){
				return null;	//	Object
			}

			if(compress){
				try {
					stream.uncompress();
				} catch(ex){
					//	odds are we have an uncompressed thing here, so simply kill it and return null.
					els.removeItem(key);
					return null;	//	Object
				}
			}

			//	just in case, we make sure there's no "undefined" in the pulled JSON.
			var s = stream.readUTFBytes(stream.length).replace("undefined", "null");
			return dojo.fromJson(s);	//	Object
		};

		this.remove = function(/* String */key){
			//	summary:
			//		Remove the item at key from the Encrypted Local Storage.
			if(key === null || key === undefined || !key.length){
				throw new Error("qd.services.storage.remove: you cannot pass an undefined or empty string as a key.");
			}
			els.removeItem(key);
		};

		this.clear = function(){
			//	summary:
			//		Clear out anything in the Encryped Local Storage.
			els.reset();
			this.onClear();
		};

		this.onClear = function(){
			//	summary:
			//		Stub function to run anything when the storage is cleared.
		};
	})();
 })();
