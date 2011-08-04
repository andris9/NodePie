NodePie
=======

Simple RSS/Atom parser for Node.JS that takes after [SimplePie](http://www.simplepie.org) and [MagPie](http://magpierss.sourceforge.net/).

Installation
------------

    npm install nodepie


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
    feed.getItems(3).forEach(function(item){
        console.log(item.getTitle());
    });
    
API
---

Constructor
-----------

**new NodePie(xml [, options])**

Where

  * `xml` is a String or Buffer containing the feed XML
  * `options` is am optional options object

Constructor generates a NodePie object for parsing the feed

Usage

    var NodePie = require("nodepie")
    feed = new NodePie(xml_contents);

Feed level methods
------------------

### - init()

**nodepie.init()**

Parses XML and fetches any used namespaces from the object

Usage:

     var feed = new NodePie(xml_contents);
     feed.init();

### - getTitle()

**nodepie.getTitle()** -> String

Fetches the title of the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    title = feed.getTitle();

Returns `false` if the title is not found from the feed

### - getDescription()

**nodepie.getDescription()** -> String

Fetches the description of the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    description = feed.getDescription();

Returns `false` if the description is not found from the feed

### - getPermalink()

**nodepie.getPermalink()** -> String

Fetches the link of the blog

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    url = feed.getPermalink();

Returns `false` if the url is not found from the feed

### - getHub()

**nodepie.getHub()** -> String

Fetches the [PubSubHubbub](http://code.google.com/p/pubsubhubbub/) hub of the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    hub = feed.getHub();

Returns `false` if the hub is not found from the feed

### - getDate()

**nodepie.getDate()** -> Date

Fetches the update date of the feed and returns it as a Date object

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    date = feed.getDate();
    console.log(date.getFullYear());

Returns `false` if the date is not found from the feed or if it's in invalid format

### - getItemQuantity()

**nodepie.getItemQuantity([max])** -> Number

Where

  * `max` is the maximum number to report

Returns the number of entries in the feed

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    total_entries = feed.getItemQuantity();

### - getItems()

**nodepie.getItems([start [,length]])** -> Array

Where

  * `start` is start index
  * `length` indicates how many items to fetch

Fetches `NodePie.Item` objects from the feed as an array

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    // fetch the first 3 entries from the feed
    items = feed.getItems(0, feed.getItemQuantity(3));

### - getItem()

**nodepie.getItems(i)** -> Array

Where

  * `i` is the index of the entry

Fetches a `NodePie.Item` object from defined index or `false` if the query is out of bounds

Usage:

    var feed = new NodePie(xml_contents);
    feed.init();
    // fetch the first entry from the feed
    item = feed.getItem(0); 