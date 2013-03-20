NodePie
=======

Simple RSS/Atom parser for Node.JS that takes after [SimplePie](http://www.simplepie.org) and [MagPie](http://magpierss.sourceforge.net/).

Installation
------------

    npm install nodepie

Compatibility
-------------

Good for RSS0.92, RSS2.0, RDF and Atom1.0 feeds. 

Tested against [Wordpress](http://wordpress.com/), [Blogger](http://www.blogger.com/) and [Feedburner](http://feedburner.com/) feeds.

Usage
-----

    var NodePie = require("nodepie"),
        xml, feed;
    
    xml = require("fs").readFileSync("feed.xml");
    
    // create a new NodePie object
    feed = new NodePie(xml);
    feed.init();
    
    // output feed title
    console.log(feed.getTitle());
    
    // output the titles for the first 3 entries
    feed.getItems(0, 3).forEach(function(item){
        console.log(item.getTitle());
    });
    
API
---

Constructor
-----------

**new NodePie(xml[, options])**

Where

  * `xml` is a String or Buffer containing the feed XML
  * `options` is an optional options object

Constructor generates a NodePie object for parsing the feed

Usage

    var NodePie = require("nodepie")
    feed = new NodePie(xml_contents);

**NB!** `xml` should be a Buffer if the XML is not in UTF-8 encoding. If `xml` is a String it is automatically considered as UTF-8 and the encoding is not converted.

You can overwrite automatic detection of the encoding by setting explicitly it with an options property (only has effect when the input is a Buffer value):

    var np = new NodePie(xml_buffer, {encoding: "ISO-8859-1"});

Feed level methods
------------------

### - init()

**nodepie.init()**

Parses XML and fetches any used namespaces from the object

Usage:

     var feed = new NodePie(xml_contents);
     feed.init();

### - getDate()

**nodepie.getDate()** → Date

Fetches the update date of the feed and returns it as a Date object

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    date = feed.getDate();
    console.log(date.getFullYear());

Returns `false` if the date is not found from the feed or if it's in invalid format

### - getDescription()

**nodepie.getDescription()** → String

Fetches the description of the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    description = feed.getDescription();

Returns `false` if the description is not found from the feed

### - getEncoding()

**nodepie.getEncoding()** → String

Returns the encoding for the source feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    source_encoding = feed.getEncoding();

NB! The result is always UTF-8, this only indicates the encoding of the source feed file.

### - getHub()

**nodepie.getHub()** → String

Fetches the [PubSubHubbub](http://code.google.com/p/pubsubhubbub/) hub of the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    hub = feed.getHub();

Returns `false` if the hub is not found from the feed

### - getImage()

**nodepie.getImage()** → String

Returns the URL or the feed image or false if not found

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    imageUrl = feed.getImage();

### - getItem()

**nodepie.getItem(i)** → Array

Where

  * `i` is the index of the entry

Fetches a `NodePie.Item` object from defined index or `false` if the query is out of bounds

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    // fetch the first entry from the feed
    item = feed.getItem(0);

### - getItems()

**nodepie.getItems([start [,length]])** → Array

Where

  * `start` is start index
  * `length` indicates how many items to fetch

Fetches `NodePie.Item` objects from the feed as an array

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    // fetch the first 3 entries from the feed
    items = feed.getItems(0, feed.getItemQuantity(3));

### - getItemQuantity()

**nodepie.getItemQuantity([max])** → Number

Where

  * `max` is the maximum number to report

Returns the number of entries in the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    // total items in feed: 10
    total_entries = feed.getItemQuantity(); // 10
    total_entries = feed.getItemQuantity(5); // 5
    total_entries = feed.getItemQuantity(50); // 10

### - getPermalink()

**nodepie.getPermalink()** → String

Fetches the link of the blog

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    url = feed.getPermalink();

Returns `false` if the url is not found from the feed

### - getSelf()

**nodepie.getSelf()** → String

Fetches the rss/atom url of the current feed (useful when the feed is received from PubSubHubbub)

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    hub = feed.getSelf();

Returns `false` if the url is not found from the feed. Most probably if you have a hub url in the feed,
there's also the feed url.

### - getTitle()

**nodepie.getTitle()** → String

Fetches the title of the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    title = feed.getTitle();

Returns `false` if the title is not found from the feed


Item level methods
------------------

### - getAuthor()

**item.getAuthor()** → String

Fetches the (first) author of the entry

Usage:

    var item = feed.getItem(0);
    author = item.getAuthor();

Returns `false` if no authors are not found from the entry

### - getAuthors()

**item.getAuthors()** → Array

Fetches the authors (as an array of strings) of the entry

Usage:

    var item = feed.getItem(0);
    authors = item.getAuthors();

### - getCategory()

**item.getCategory()** → String

Fetches the (first) category of the entry.

Usage:

    var item = feed.getItem(0);
    category = item.getCategory();

Returns `false` if no categories are found from the entry

### - getCategories()

**item.getCategories()** → Array

Fetches the categories (as an array of strings) for the entry.

Usage:

    var item = feed.getItem(0);
    categories = item.getCategories();

Returns `false` if the categories are not found from the entry

### - getComments()

**item.getComments()** → Object

Fetches an object containing links to the HTML comments page and to an Atom/RSS feed of comments for the post

    {
        html: "http://link_to_html_page",
        feed: "http://link_to_comments_feed"
    }

Usage:

    var item = feed.getItem(0);
    comments = item.getComments();
    console.log("See all comments: " + comments.html);

Returns `false` if the no information about comments is found from the entry

### - getContents()

**item.getContents()** → String

Fetches the contents of the entry. Prefers full text, otherwise falls back to description.

Usage:

    var item = feed.getItem(0);
    contents = item.getContents();

Returns `false` if the description or contents are not found from the entry

### - getDate()

**item.getDate()** → Date

Fetches the date of the entry as a Date object

Usage:

    var item = feed.getItem(0);
    date = item.getDate();
    console.log(date.getFullYear());

Returns `false` if the date is not found from the entry or if it's in invalid format

### - getDescription()

**item.getDescription()** → String

Fetches the description of the entry. Prefers summaries, otherwise falls back to full content.

Usage:

    var item = feed.getItem(0);
    description = item.getDescription();

Returns `false` if the description or contents are not found from the entry

### - getPermalink()

**item.getPermalink()** → String

Fetches the link of the entry

Usage:

    var item = feed.getItem(0);
    url = item.getPermalink();

Returns `false` if the url is not found from the entry

### - getTitle()

**item.getTitle()** → String

Fetches the title of the entry

Usage:

    var item = feed.getItem(0);
    title = item.getTitle();

Returns `false` if the title is not found from the entry

### - getUpdateDate()

**item.getUpdateDate()** → Date

Fetches the update date of the entry as a Date object

Usage:

    var item = feed.getItem(0);
    date = item.getUpdateDate();
    console.log(date.getFullYear());

Falls back to getDate when update date not found or returns `false` if the date is not found from the entry or if it's in invalid format

