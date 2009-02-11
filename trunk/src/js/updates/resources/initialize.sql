--	legacy drops, just in case they exist from older versions.
DROP INDEX IF EXISTS idxLink_Movie
DROP INDEX IF EXISTS idxLastUpdated_Movie
DROP INDEX IF EXISTS idxTerm_GenreFeed
DROP INDEX IF EXISTS idxLastUpdated_GenreFeed
DROP INDEX IF EXISTS idxName_People
DROP INDEX IF EXISTS idxLastUpdated_People
DROP INDEX IF EXISTS idxKey_MovieCategories
DROP INDEX IF EXISTS idxKey_MoviePeople
DROP INDEX IF EXISTS idxPeopleType_MoviePeople
DROP INDEX IF EXISTS idxGuid_Disc
DROP INDEX IF EXISTS idxLink_Disc
DROP INDEX IF EXISTS idxLastUpdated_Disc
DROP INDEX IF EXISTS idxKey_DiscImages
DROP INDEX IF EXISTS idxImageType_DiscImages
DROP INDEX IF EXISTS idxDiscAudio_Disc
DROP INDEX IF EXISTS idxDiscAudio_TitleFormat
DROP INDEX IF EXISTS idxDiscAudio_Language
DROP INDEX IF EXISTS idxDiscAudio_Audio
DROP INDEX IF EXISTS idxKey_DiscSimiliars
DROP INDEX IF EXISTS idxName_People
DROP INDEX IF EXISTS idxLastUpdated_People
DROP INDEX IF EXISTS idxKey_DiscGenres
DROP INDEX IF EXISTS idxKey_DiscFormats
DROP INDEX IF EXISTS idxFormatType_DiscFormats
DROP INDEX IF EXISTS idxTerm_AwardType
DROP INDEX IF EXISTS idxKey_DiscAwards
DROP INDEX IF EXISTS idxYear_DiscAwards
DROP INDEX IF EXISTS idxDiscAwardType_DiscAwards
DROP INDEX IF EXISTS idxTerm_DiscAwards
DROP INDEX IF EXISTS idxPeople_DiscAwards
DROP INDEX IF EXISTS idxTerm_GenreFeed
DROP INDEX IF EXISTS idxAverage_TitleRatings

DROP TABLE IF EXISTS Disc
DROP TABLE IF EXISTS DiscImages
DROP TABLE IF EXISTS DiscAudio
DROP TABLE IF EXISTS DiscSimilars
DROP TABLE IF EXISTS People
DROP TABLE IF EXISTS DiscPeople
DROP TABLE IF EXISTS DiscGenres
DROP TABLE IF EXISTS DiscFormats
DROP TABLE IF EXISTS AwardType
DROP TABLE IF EXISTS DiscAwards
DROP TABLE IF EXISTS Movie
DROP TABLE IF EXISTS MovieCategories
DROP TABLE IF EXISTS MoviePeople
DROP TABLE IF EXISTS Category
DROP TABLE IF EXISTS User_
DROP TABLE IF EXISTS UserQueue
DROP TABLE IF EXISTS UserHistory
DROP TABLE IF EXISTS UserAtHome

-- Drop statements
DROP INDEX IF EXISTS idxGuid_Title
DROP INDEX IF EXISTS idxLink_Title
DROP INDEX IF EXISTS idxLastUpdated_Title
DROP INDEX IF EXISTS idxSortOrder_Recommendation
DROP INDEX IF EXISTS idxTitle_Recommendation
DROP INDEX IF EXISTS idxLastUpdated_Recommendation
DROP INDEX IF EXISTS idxKey_TitleImages
DROP INDEX IF EXISTS idxImageType_TitleImages
DROP INDEX IF EXISTS idxTitleAudio_Title
DROP INDEX IF EXISTS idxTitleAudio_TitleFormat
DROP INDEX IF EXISTS idxTitleAudio_Language
DROP INDEX IF EXISTS idxTitleAudio_Audio
DROP INDEX IF EXISTS idxKey_TitleSimiliars
DROP INDEX IF EXISTS idxName_People
DROP INDEX IF EXISTS idxLastUpdated_People
DROP INDEX IF EXISTS idxKey_TitleGenres
DROP INDEX IF EXISTS idxKey_TitleFormats
DROP INDEX IF EXISTS idxFormatType_TitleFormats
DROP INDEX IF EXISTS idxTerm_AwardType
DROP INDEX IF EXISTS idxKey_TitleAwards
DROP INDEX IF EXISTS idxYear_TitleAwards
DROP INDEX IF EXISTS idxTitleAwardType_TitleAwards
DROP INDEX IF EXISTS idxTerm_TitleAwards
DROP INDEX IF EXISTS idxPeople_TitleAwards
DROP INDEX IF EXISTS idxTerm_GenreFeed
DROP INDEX IF EXISTS idxFeed_GenreFeed
DROP INDEX IF EXISTS idxKey_TitleRatings
DROP INDEX IF EXISTS idxPredicted_TitleRatings
DROP INDEX IF EXISTS idxActual_TitleRatings
DROP INDEX IF EXISTS idxUserID_TransactionQueue
DROP INDEX IF EXISTS idxDateAdded_TransactionQueue
DROP INDEX IF EXISTS idxUserId_UserQueues
DROP INDEX IF EXISTS idxQueueType_UserQueues
DROP INDEX IF EXISTS idxETag_UserQueues
DROP INDEX IF EXISTS idxQueue_QueueItem
DROP INDEX IF EXISTS idxPosition_QueueItem
DROP INDEX IF EXISTS idxShipped_QueueItem
DROP INDEX IF EXISTS idxReturned_QueueItem
DROP INDEX IF EXISTS idxLastUpdated_QueueItem
DROP INDEX IF EXISTS idxTitleGuid_QueueItem
DROP INDEX IF EXISTS idxLastUpdated_QueueCache

DROP TABLE IF EXISTS Title
DROP TABLE IF EXISTS Recommendation
DROP TABLE IF EXISTS TitleImages
DROP TABLE IF EXISTS TitleAudio
DROP TABLE IF EXISTS TitleSimilars
DROP TABLE IF EXISTS TitleRatings
DROP TABLE IF EXISTS People
DROP TABLE IF EXISTS TitlePeople
DROP TABLE IF EXISTS TitleGenres
DROP TABLE IF EXISTS TitleFormats
DROP TABLE IF EXISTS AwardType
DROP TABLE IF EXISTS TitleAwards
DROP TABLE IF EXISTS GenreFeed
DROP TABLE IF EXISTS UserQueues
DROP TABLE IF EXISTS TransactionQueue
DROP TABLE IF EXISTS QueueItem
DROP TABLE IF EXISTS QueueCache

--	Title table
CREATE TABLE Title (
	guid TEXT PRIMARY KEY,
	link TEXT NOT NULL,
	title TEXT NOT NULL,
	lastUpdated DATE NOT NULL,
	synopsis TEXT NULL,
	rating TEXT NULL,
	averageRating TEXT NULL,
	predictedRating TEXT NULL,
	actualRating TEXT NULL,
	json TEXT NULL
)
-- indicies on Title
CREATE INDEX idxLink_Title ON Title ( link )
CREATE INDEX idxLastUpdated_Title ON Title ( lastUpdated )

CREATE TABLE Recommendation (
	guid TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	lastUpdated DATE NOT NULL
)
CREATE INDEX idxTitle_Recommendation ON Recommendation ( Title )
CREATE INDEX idxLastUpdated_Recommendation ON Recommendation ( lastUpdated )

-- People
CREATE TABLE People (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	bio TEXT NULL,
	webpage TEXT NULL,
	lastUpdated DATE NOT NULL,
	Xml TEXT NULL
)
CREATE INDEX idxName_People ON People ( name )
CREATE INDEX idxLastUpdated_People ON People ( lastUpdated )

--	Awards
CREATE TABLE AwardType (
	id INTEGER PRIMARY KEY,
	term TEXT NOT NULL,
	description TEXT NOT NULL
)
CREATE INDEX idxTerm_AwardType ON AwardType ( term )

-- GenreFeed
CREATE TABLE GenreFeed (
	id INTEGER PRIMARY KEY,
	label TEXT NOT NULL,
	term TEXT NOT NULL,
	lastUpdated DATE NOT NULL,
	isGenre BOOLEAN NOT NULL,
	isInstant BOOLEAN NOT NULL,
	synopsis TEXT NULL,
	feed TEXT NULL,
	xml TEXT NULL
)
CREATE INDEX idxTerm_GenreFeed ON GenreFeed ( term )
CREATE INDEX idxFeed_GenreFeed ON GenreFeed ( feed )

--	The user's queues
CREATE TABLE QueueCache (
	queue TEXT PRIMARY KEY,
	json TEXT NOT NULL,
	lastUpdated DATE NOT NULL
)
CREATE INDEX idxLastUpdated_QueueCache ON QueueCache ( lastUpdated )

-- the Transaction Queue: where we store up any offline commands for hitting the server when returning online
CREATE TABLE TransactionQueue (
	id INTEGER PRIMARY KEY,
	method TEXT NOT NULL,
	args TEXT NULL,
	prompt TEXT NULL,
	dateAdded DATE NOT NULL
)
CREATE INDEX idxDateAdded_TransactionQueue ON TransactionQueue( dateAdded )

-- Fill out categories based on the Netflix feed
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (1, 'Netflix Top 100', 'Netflix Top 100', DATETIME(), 0, 0, 'http://rss.netflix.com/Top100RSS')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2, 'New Releases', 'New Releases', DATETIME(), 0, 0, 'http://rss.netflix.com/NewReleasesRSS')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (296, 'Action & Adventure', 'Action & Adventure', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=296')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (623, 'Anime & Animation', 'Anime & Animation', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=623')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2444, 'Blu-ray', 'Blu-ray', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=2444')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (302, 'Children & Family', 'Children & Family', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=302')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (306, 'Classics', 'Classics', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=306')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (307, 'Comedy', 'Comedy', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=307')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (864, 'Documentary', 'Documentary', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=864')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (315, 'Drama', 'Drama', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=315')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2108, 'Faith & Spirituality', 'Faith & Spirituality', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=2108')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2514, 'Foreign', 'Foreign', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=2514')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (330, 'Gay & Lesbian', 'Gay & Lesbian', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=330')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (338, 'Horror', 'Horror', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=338')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (343, 'Independent', 'Independent', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=343')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2310, 'Music & Musicals', 'Music & Musicals', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=2310')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (371, 'Romance', 'Romance', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=371')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (373, 'Sci-Fi & Fantasy', 'Sci-Fi & Fantasy', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=373')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2223, 'Special Interest', 'Special Interest', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=2223')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2190, 'Sports & Fitness', 'Sports & Fitness', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=2190')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (2197, 'Television', 'Television', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=2197')
INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (387, 'Thrillers', 'Thrillers', DATETIME(), 1, 0, 'http://rss.netflix.com/Top25RSS?gid=387')

-- INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (3, 'New for Instant Watching', 'New for Instant Watching', DATETIME(), 1, 1, 'http://www.netflix.com/NewWatchInstantlyRSS')
-- INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (4, 'Top choices for Instant Watching', 'Top choices for Instant Watching', DATETIME(), 1, 1, 'http://www.netflix.com/TopWatchInstantlyRSS')
-- INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (5, 'Last week''s top Instant Watch choices', 'Last week''s top Instant Watch choices', DATETIME(), 1, 1, 'http://www.netflix.com/TopWatchInstantlyThisWeekRSS')
-- INSERT INTO GenreFeed (id, label, term, lastUpdated, isGenre, isInstant, feed) VALUES (6, 'Top Instant Watch choices for the past 3 months', 'Top Instant Watch choices for the past 3 months', DATETIME(), 1, 1, 'http://www.netflix.com/TopWatchInstantlyPastThreeMonthsRSS')

-- Fill out the Awards table
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'academy_awards', 'Academy Awards')
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'afi', 'American Film Institute (AFI)')
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'sundance_film_festival', 'Sundance Film Festival')
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'independent_spirit_awards', 'Independent Spirit Awards')
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'razzie', 'Golden Raspberry Awards (Razzies)')
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'time', 'Time')
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'baftas', 'British Academy of Film and Television Arts (BAFTAs)')
INSERT INTO AwardType (id, term, description) VALUES (NULL, 'golden_globe_awards', 'Golden Globe Awards')
