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
