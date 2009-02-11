(function(){
 	//	This is a basic updating command and queue mechanism.  Note
	//	that this should only be loaded by the qd application, and
	//	run from there.
	Updater = {
		commands: {
			data : {
				create: function(){
					if(!qd.services.data.initialized){
						qd.services._forceCreate = true;
					} else {
						qd.services.data.create();
					}
				},
				nuke: function(){
					var file = air.File.applicationStorageDirectory.resolvePath("queued.db");
					if(file.exists){
						file.deleteFile();
					}
				}
			},
			storage: {
				nuke: function(){
					qd.services.storage.clear();
				}
			}
		},
		execMap: [
			"storage.nuke",
			"data.nuke",
			"data.create"
		],
		invoke: function(oldVersion, newVersion){
			//	find all the update files between old and new,
			//	push unique commands into a specific map,
			//	and execute.
			var map = {},
				files = air.File.applicationDirectory.resolvePath("js/updates/versions").getDirectoryListing();

			files.sort(function(a, b){
				var a_name = parseFloat(a.name.substr(0, a.name.lastIndexOf(".")), 10),
					b_name = parseFloat(b.name.substr(0, a.name.lastIndexOf(".")), 10);
				if(a_name > b_name) return 1;
				if(b_name > a_name) return -1;
				return 0;
			});

			var commands = {};

			//	loop through all the files and compile a cumulative set of commands
			//	to invoke.
			for(var i=0, file; i<files.length; i++){
				file = files[i];
				var nm = parseFloat(file.name.substr(0, file.name.lastIndexOf(".")), 10);
				if(isNaN(nm)){
					continue;
				}

				if(nm > oldVersion && nm <= newVersion){
					//	we have a command that we need to push
					var fs = new air.FileStream();
					fs.open(file, air.FileMode.READ);
					var s = fs.readUTFBytes(fs.bytesAvailable);
					fs.close();

					var lines = s.split(/(\r\n|\r|\n)/g);
					for(var j=0; j<lines.length; j++){
						var c = dojo.trim(lines[j]);
						if(c){
							commands[c] = true;
						}
					}
				}
			}

			//	execute them using the map.
			for(var i=0; i<this.execMap.length; i++){
				if(commands[this.execMap[i]]){
					var t = this.execMap[i].split(".");
					var type = Updater.commands[t[0]];
					if(type && type[t[1]]){
						type[t[1]]();
					}
				}
			}

			console.warn("Upgrade path from " + oldVersion + " to " + newVersion + " is complete.");
		}
	}
})();
