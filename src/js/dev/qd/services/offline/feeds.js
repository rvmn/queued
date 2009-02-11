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
