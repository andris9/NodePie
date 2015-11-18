'use strict';

var xmlparser = require('xml2json');
var encoding = require('encoding');
var urllib = require('url');
var he = require('he');

module.exports = NodePie;

/************* FEED *************/

/**
 * <p>Generates a NodePie object for parsing RSS/Atom feed data</p>
 *
 * <p>Usage:</p>
 *
 * <pre>
 * var np = new NodePie(feed);
 * np.init();
 * console.log(np.getTitle());
 *
 * np.getItems().forEach(function(item){
 *     console.log(item.getTitle());
 * });
 * </pre>
 *
 * @constructor
 * @param {String|Buffer} [xml] Feed XML data
 * @param {Object} [options] options object
 */
function NodePie(xml, options) {

    this.encoding = 'UTF-8';
    this.options = options || {};
    this.xml = xml || '';

    this.feed = undefined;
    this.rootElement = undefined;
    this.channelElement = undefined;
    this.itemsElement = undefined;
    this.feedType = undefined;
    this.namespaces = {};

    this._items = {};
    this._item_count = false;
}

/************* FEED CONSTRUCTOR PROPERTIES/METHODS *************/

/**
 * NodePie.NS -> Object
 *
 * Holds a list of known XML namespaces for parsing certain objects,
 * for example the WFW namespace declares a wfw:commentRSS element which
 * includes comments feed for the post
 **/
NodePie.NS = {
    WFW: 'http://wellformedweb.org/CommentAPI/',
    DC: 'http://purl.org/dc/elements/1.1/',
    CONTENT: 'http://purl.org/rss/1.0/modules/content/',
    ATOM10: 'http://www.w3.org/2005/Atom',
    GD: 'http://schemas.google.com/g/2005'
};

/**
 * NodePie._walkForNS(node, that[, depth]) -> undefined
 * - node (Object): object to check for
 * - that (Object): current context
 * - depth Number): How deep are we
 *
 * Walks all the feed object nodes to populate XML namespace object
 * NodePie#namespaces
 **/
NodePie._walkForNS = function(node, that, depth) {
    depth = depth || 0;

    var keys = Object.keys(node);
    var key;

    if (depth > 7) {
        return;
    }

    for (var i = 0, len = keys.length; i < len; i++) {
        key = keys[i];
        if (typeof node[key] === 'string') {
            if (key.trim().substr(0, 6).toLowerCase() === 'xmlns:') {
                that.namespaces[node[key]] = key.trim().substr(6);
            }
        } else if (node[key] && typeof node[key] === 'object') {
            NodePie._walkForNS(node[key], that, depth + 1);
        }
    }
};

/************* FEED LEVEL PRIVATE METHODS *************/

/**
 * NodePie#_fetchNamespaces() -> undefined
 *
 * Populates NodePie#namespaces object with used namespaces
 **/
NodePie.prototype._fetchNamespaces = function() {
    if (this.rootElement) {
        NodePie._walkForNS(this.rootElement, this);
    }
};

/**
 * NodePie#_checkEncoding(xml) -> undefined
 * - xml (Buffer): XML to convert encoding if it is not in UTF-8
 *
 * Checks if the XML is not UTF-8 and encodes it accordingly
 **/
NodePie.prototype._checkEncoding = function(xml) {

    //<?xml version='1.0' encoding='UTF-8'>
    if (!this.options.encoding) {
        xml.slice(0, xml.length < 255 ? xml.length : 255).toString('utf-8').replace(/<\?xml[^>]*>/i, (function(tag) {
            var m = tag.match(/encoding\s*=\s*["']([^"']+)["']/i);
            this.encoding = (m && m[1] || this.encoding).trim().toUpperCase();
        }).bind(this));
    } else {
        this.encoding = this.options.encoding.trim().toUpperCase();
    }

    if (['UTF-8', 'UTF8'].indexOf(this.encoding) < 0) {
        xml = encoding.convert(xml, 'UTF-8', this.encoding);
    }

    return xml.toString('utf-8').trim();
};

/**
 * NodePie#_checkType() -> undefined
 *
 * Detects the format of the feed (RSS, Atom or RDF), finds root elements,
 * entry arrays etc.
 **/
NodePie.prototype._checkType = function() {
    var root_keys = Object.keys(this.feed);
    var key;
    var type;
    var elem;

    for (var i = 0, len = root_keys.length; i < len; i++) {

        key = root_keys[i];
        elem = this.feed[key];

        if (typeof elem !== 'object' || Array.isArray(elem)) {
            continue;
        }

        type = key.trim().toLowerCase();

        if (type === 'feed') {
            this.feedType = 'atom';
            this.rootElement = elem;
            this.channelElement = elem || {};
            this.itemsElement = elem.entry || [];
            break;
        } else if (type === 'rss') {
            this.feedType = 'rss';
            this.rootElement = elem;
            this.channelElement = elem.channel || {};
            this.itemsElement = this.channelElement.item || [];
            break;
        } else if (type === 'rdf' || type.substr(-4) === ':rdf') {
            this.feedType = 'rdf';
            this.rootElement = elem;
            this.channelElement = elem.channel || {};
            this.itemsElement = elem.item || [];
            break;
        } else if (type === 'backslash') {
            this.feedType = 'backslash';
            this.rootElement = elem;
            this.channelElement = elem;
            this.itemsElement = this.channelElement.story || [];
            break;
        }
    }

    if (!this.rootElement) {
        throw new Error('Invalid feed!');
    }
};

/**
 * NodePie#_formatStr(str) -> String
 * - str (String): string to format
 *
 * Formats a string according to initial options. By default decodes any HTML
 * entities
 **/
NodePie.prototype._formatStr = function(str) {
    if (this.options.keepHTMLEntities) {
        return str;
    } else {
        return he.decode(str);
    }
};

/**
 * NodePie#_parseContents(str) -> String
 * - str (String | Object): string or object to fetch text from
 *
 * Fetches text contents from a string or feed text object
 **/
NodePie.prototype._parseContents = function(str) {
    if (typeof str === 'object') {
        str = str.$t;
    }
    
     if (typeof str === 'number') {
        str = str.toString();
    }

    if (typeof str === 'string') {
        str = str.trim();
        if (str !== '') {
            return this._formatStr(str);
        }
    }

    return false;
};

/**
 * NodePie#_processDate(str) -> Date || false
 * - str (String): string containing the date
 *
 * Processes a date
 **/
NodePie.prototype._processDate = function(date) {
    if (!date) {
        return false;
    }

    date = new Date(date);

    var stamp = date.getTime();

    if (!stamp) {
        return false;
    }

    if (stamp > Date.now()) {
        return new Date();
    }

    return date;
};

/************* FEED LEVEL PUBLIC METHODS *************/

/**
 * NodePie#init() -> undefined
 *
 * Parses XML and fetches any used namespaces from the object
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 **/
NodePie.prototype.init = function() {

    if (this.xml instanceof Buffer) {
        this.xml = this._checkEncoding(this.xml);
    } else {
        this.xml = (this.xml || '').toString('utf-8').trim();
    }

    this.feed = xmlparser.toJson(this.xml, {
        object: true,
        sanitize: false,
        trim: false
    });

    this._checkType();
    this._fetchNamespaces();
};

/**
 * NodePie#getTitle() -> String | False
 *
 * Fetches the title of the feed
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     title = np.getTitle();
 **/
NodePie.prototype.getTitle = function() {
    return this._parseContents(this.channelElement.title);
};

/**
 * NodePie#getEncoding() -> String
 *
 * Returns the encoding for the source feed
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     source_encoding = np.getEncoding();
 **/
NodePie.prototype.getEncoding = function() {
    return this.encoding;
};

/**
 * NodePie#getDescription() -> String | False
 *
 * Fetches the description of the feed
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     description = np.getDescription();
 **/
NodePie.prototype.getDescription = function() {
    return this._parseContents(
        this.channelElement.description || this.channelElement.subtitle ||
        this.channelElement.tagline
    );
};

/**
 * NodePie#getPermalink() -> String | False
 *
 * Fetches the URL of the blog
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     blog_url = np.getPermalink();
 **/
NodePie.prototype.getPermalink = function() {
    var link = this.channelElement.link;

    if (typeof link === 'string') {
        return link.trim();
    } else {
        return this.getLink();
    }
};

/**
 * NodePie#getHub() -> String | False
 *
 * Fetches the PubSubHubbub URL of the blog
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     pubsubhub = np.getHub();
 **/
NodePie.prototype.getHub = function() {
    return this.getLink('hub');
};

/**
 * NodePie#getSelf() -> String | False
 *
 * Fetches the rss/atom url of the current feed (useful when the feed is received from pubsubhubbub)
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     rss_url = np.getSelf();
 **/
NodePie.prototype.getSelf = function() {
    return this.getLink(NodePie.NS.GD + '#feed', 'application/atom+xml') ||
        this.getLink('self', 'application/rss+xml');
};

/**
 * NodePie#getImage() -> String | False
 *
 * Fetches the logo url of the feed
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     logo = np.getImage();
 **/
NodePie.prototype.getImage = function() {
    var gdns = this.namespaces[NodePie.NS.GD];

    return this._parseContents(
        (this.channelElement.image && this.channelElement.image.url) ||
        (this.channelElement.author && this.channelElement.author[gdns + ':image'] &&
            this.channelElement.author[gdns + ':image'].src) ||
        this.channelElement.logo ||
        this.channelElement.icon
    );
};

/**
 * NodePie#getLink([rel='alternate'[, type='text/html']]) -> String | False
 * - rel (String): link rel
 * - type (String): link content type
 *
 * Fetches a specified link from the links object
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     edit_link = np.getLink('edit','application/atom+xml');
 **/
NodePie.prototype.getLink = function(rel, type) {
    rel = rel || 'alternate';
    type = type || 'text/html';

    var atom10ns = this.namespaces[NodePie.NS.ATOM10];
    var link = (atom10ns && [].concat(this.channelElement[atom10ns + ':link'] || []).concat(this.channelElement.link)) || this.channelElement.link;

    if (link) {
        if (typeof link === 'string') {
            if (rel === 'alternate' && type === 'text/html') {
                return link.trim();
            }
        } else if (Array.isArray(link)) {
            for (var i = 0, len = link.length; i < len; i++) {
                if (rel === link[i].rel && (!link[i].type || type === link[i].type)) {
                    return link[i].href;
                }
            }
        } else if (typeof link === 'object') {
            if (rel === link.rel && (!link.type || type === link.type)) {
                return link.href;
            }
        }
    }

    if (rel == 'alternate' && type == 'text/html' && link && link.href && !link.rel && !link.type) {
        return link.href;
    }

    return false;
};

/**
 * NodePie#getDate() -> Date | False
 *
 * Fetches the publish date of the feed as a Date object
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     date = np.getDate();
 *     console.log(date.getFullYear))
 **/
NodePie.prototype.getDate = function() {
    var dcns = this.namespaces[NodePie.NS.DC];

    return this._processDate(
        this.channelElement.lastBuildDate || this.channelElement.updated ||
        (dcns && this.channelElement[dcns + ':date'])
    ) || this.getItems().map(function(item) {
        return item.getDate();
    }).reduce(function(previousValue, currentValue) {
        return (previousValue && previousValue.getTime() || 0) < (currentValue && currentValue.getTime() || 0) ? currentValue : previousValue;
    }, 0) || false;
};

/**
 * NodePie#getItemQuantity([max]) -> Number
 *
 * Fetches the count of the items in the feed or max
 *
 * Usage:
 *
 *     var np = new NodePie(feed);
 *     np.init();
 *     item_count = np.getItemQuantity();
 **/
NodePie.prototype.getItemQuantity = function(max) {
    max = max || 0;

    if (this._item_count !== false) {
        return max && max < this._item_count ? max : this._item_count;
    }

    this._item_count = 0;

    if (this.itemsElement) {
        if (Array.isArray(this.itemsElement)) {
            this._item_count = this.itemsElement.length;
        } else if (typeof this.itemsElement === 'object') {
            this._item_count = 1;
        }
    }

    return max && max < this._item_count ? max : this._item_count;
};

/**
 * NodePie#getItems([start[, length]) -> Array
 * - start (Number): start index
 * - length (Number): how many items to fetch
 *
 * Fetches an array of NodePie.Item objects
 **/
NodePie.prototype.getItems = function(start, length) {
    start = start || 0;

    var quantity = this.getItemQuantity();
    var items = [];

    length = length || quantity;

    if (start >= quantity) {
        start = quantity - 1;
        if (start === -1) {
            start = 0;
        }
    }

    if (length > quantity - start) {
        length = quantity - start;
    }

    for (var i = start; i < length; i++) {
        items.push(this.getItem(i));
    }
    return items;
};

/**
 * NodePie#getItem(i) -> NodePie.Item | False
 * - i (Number): item index
 *
 * Fetches a NodePie.Item object from defined index or false if out of bounds
 **/
NodePie.prototype.getItem = function(i) {
    i = i && !isNaN(i) && parseInt(Math.abs(i), 10) || 0;

    if (this._items[i]) {
        return this._items[i];
    }

    if (Array.isArray(this.itemsElement)) {
        if (this.itemsElement.length > i) {
            this._items[i] = new NodePie.Item(this.itemsElement[i], this);
            return this._items[i];
        }
    } else if (typeof this.itemsElement === 'object') {
        if (i === 0) {
            this._items[i] = new NodePie.Item(this.itemsElement, this);
            return this._items[i];
        }
    }

    return false;
};


/************* ITEM *************/

/**
 * new NodePie.Item(element, feed)
 * - element (Object): entry object
 * - feed (Object): NodePie parent object
 *
 * Generates a NodePie.Item object. This is done by NodePie#getItem() method
 * automatically
 **/
NodePie.Item = function(element, feed) {
    this.element = element;
    this.feed = feed;
};

/************* ITEM LEVEL PRIVATE METHODS *************/

/**
 * NodePie.Item#_parseContents(str) -> String | False
 * - str (String | Object): a string or an object to parse text from
 *
 * Derivated from NodePie#_parseContents
 **/
NodePie.Item.prototype._parseContents = function(str) {
    return this.feed._parseContents(str);
};

/**
 * NodePie.Item#_formatStr(str) -> String | False
 * - str (String): a string to format
 *
 * Derivated from NodePie#_formatStr
 **/
NodePie.Item.prototype._formatStr = function(str) {
    return this.feed._formatStr(str);
};

/**
 * NodePie.Item#_parseAuthor(str) -> String
 * - str (String | Object): author string value
 *
 * Parser the author name from 'e-mail (name)' string
 **/
NodePie.Item.prototype._parseAuthor = function(author) {
    // email (name)
    var name = author.trim().match(/^[\w.\-]+@[\w.\-]+ \(([^)]+)\)$/);

    if (name) {
        author = (name[1] || '').trim();
    }

    return this._formatStr(author);
};

/************* ITEM LEVEL PUBLIC METHODS *************/

/**
 * NodePie.Item#getLink([rel='alternate'[, type='text/html']]) -> String | False
 * - rel (String): link rel
 * - type (String): link content type
 *
 * Fetches a specified link from the links object
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     permalink = item.getLink('alternate','text/html');
 **/
NodePie.Item.prototype.getLink = function(rel, type) {
    rel = rel || 'alternate';
    type = type || 'text/html';

    var link = this.element.link || this.element.url;

    if (!link) {} else if (typeof link === 'string') {
        if (rel === 'alternate' && type === 'text/html') {
            return link.trim();
        }
    } else if (typeof link === 'object' && !Array.isArray(link)) {
        if (rel === link.rel && (!link.type || type === link.type)) {
            return link.href;
        }
    } else if (Array.isArray(link)) {
        for (var i = 0, len = link.length; i < len; i++) {
            if (rel === link[i].rel && (!link[i].type || type === link[i].type)) {
                return link[i].href;
            }
        }
    }

    if (rel == 'alternate' && type == 'text/html' && link && link.href && !link.rel && !link.type) {
        return link.href;
    }

    return false;
};

/**
 * NodePie.Item#getPermalink() -> String | False
 *
 * Fetches a permalink to the post
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     permalink = item.getPermalink();
 **/
NodePie.Item.prototype.getPermalink = function() {
    var permalink = this.getLink();
    var feedLink;

    if (!permalink) {
        return permalink;
    }

    if ((feedLink = this.feed.getPermalink())) {
        return urllib.resolve(feedLink, permalink);
    } else {
        return permalink;
    }
};

/**
 * NodePie.Item#getAuthor() -> String | False
 *
 * Fetches the (first) author of the post
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     author = item.getAuthor();
 **/
NodePie.Item.prototype.getAuthor = function() {
    var authors = this.getAuthors();

    return authors && authors[0];
};

/**
 * NodePie.Item#getAuthors() -> Array
 *
 * Fetches an array of authors of the post
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     authors = item.getAuthors();
 *     console.log(author[0]);
 **/
NodePie.Item.prototype.getAuthors = function() {
    var author, authors = [];
    var dcns = this.feed.namespaces[NodePie.NS.DC];

    if (this.element.author) {
        author = this.element.author;
    } else if (this.element.creator) {
        author = this.element.creator;
    } else if (dcns && this.element[dcns + ':creator']) {
        author = this.element[dcns + ':creator'];
    } else {
        return false;
    }

    if (typeof author === 'string') {
        return [this._parseAuthor(author)];
    }

    if (typeof author === 'object') {
        if (Array.isArray(author)) {
            for (var i = 0, len = author.length; i < len; i++) {
                if (author[i] && author[i].name) {
                    authors.push(author[i].name);
                }
            }
            return authors || false;
        } else if (typeof author.name === 'string') {
            return [this._parseAuthor(author.name)];
        }
    }

    return false;
};

/**
 * NodePie.Item#getTitle() -> String | False
 *
 * Fetches the title of the post
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     title = item.getTitle();
 **/
NodePie.Item.prototype.getTitle = function() {
    return this._parseContents(this.element.title);
};

/**
 * NodePie.Item#getDate() -> Date | False
 *
 * Fetches the date of the post as a Date object
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     date = item.getDate();
 *     console.log('Created: ' + date.getFullYear());
 **/
NodePie.Item.prototype.getDate = function() {
    var dcns = this.feed.namespaces[NodePie.NS.DC];

    return this.feed._processDate(
        this.element.pubDate || this.element.published || this.element.created || this.element.issued ||
        this.element.updated || this.element.modified || (dcns && this.element[dcns + ':date']) || this.element.time
    );
};

/**
 * NodePie.Item#getUpdateDate() -> Date | False
 *
 * Fetches the update date of the post as a Date object
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     date = item.getUpdateDate();
 *     console.log('Updated: ' + date.getFullYear());
 **/
NodePie.Item.prototype.getUpdateDate = function() {
    return this.feed._processDate(
        this.element.updated || this.element.modified
    ) || this.getDate(); // fallback to creation date
};

/**
 * NodePie.Item#getDescription() -> String | False
 *
 * Fetches the description of the post (prefers summaries)
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     description = item.getDescription();
 **/
NodePie.Item.prototype.getDescription = function() {
    var cns = this.feed.namespaces[NodePie.NS.CONTENT];
    var atom10ns = this.feed.namespaces[NodePie.NS.ATOM10];
    var summary = this.element[atom10ns + ':summary'];

    return this._parseContents(
        this.element.description || summary ||
        this.element.content || (cns && this.element[cns + ':encoded']) || ''
    );
};

/**
 * NodePie.Item#getContents() -> String | False
 *
 * Fetches the contents of the post (prefers full text)
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     contents = item.getContents();
 **/
NodePie.Item.prototype.getContents = function() {
    var cns = this.feed.namespaces[NodePie.NS.CONTENT];
    var atom10ns = this.feed.namespaces[NodePie.NS.ATOM10];
    var summary = this.element[atom10ns + ':summary'];

    return this._parseContents(
        this.element.content || (cns && this.element[cns + ':encoded']) ||
        this.element.description || summary || ''
    );
};

/**
 * NodePie.Item#getCategory() -> String | False
 *
 * Fetches the (first) category of the post
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     category = item.getCategory();
 **/
NodePie.Item.prototype.getCategory = function() {
    var categories = this.getCategories();

    return categories && categories[0];
};

/**
 * NodePie.Item#getCategories() -> Array | False
 *
 * Fetches an array of categories of the post
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     categories = item.getCategories();
 **/
NodePie.Item.prototype.getCategories = function() {
    var category, categories = [];
    var dcns = this.feed.namespaces[NodePie.NS.DC];

    category = this.element.category || this.element[dcns + ':subject'] || this.element.department;

    if (!category) {} else if (typeof category === 'string') {
        if ((category = category.trim())) {
            return [this._formatStr(category)];
        }
    } else if (Array.isArray(category)) {
        for (var i = 0, len = category.length; i < len; i++) {
            if (typeof category[i] === 'string') {
                if (category[i].trim()) {
                    categories.push(category[i].trim());
                }
            } else if (typeof category[i] === 'object') {
                if ((category[i].term || category[i].$t || '').toString().trim()) {
                    categories.push(this._formatStr((category[i].term || category[i].$t || '').toString().trim()));
                }
            }
        }
        return categories.length && categories;
    } else if (typeof category === 'object') {
        category = category.term || category.$t;
        if (category && (category = (category || '').toString().trim())) {
            return [this._formatStr(category)];
        }
    }

    return false;
};

/**
 * NodePie.Item#getComments() -> Object | False
 *
 * Fetches an object containing links to the HTML comments page and to an
 * Atom/RSS feed of comments for the post
 *
 *     {
 *         html: 'http://link_to_html_page',
 *         feed: 'http://link_to_comments_feed'
 *     }
 *
 * Usage:
 *
 *     var item = np.getItem(0);
 *     comments = item.getComments();
 *     console.log('See all comments: ' + comments.html);
 **/
NodePie.Item.prototype.getComments = function() {
    var wfwns = this.feed.namespaces[NodePie.NS.WFW];
    var html;
    var feed;

    if (!(html = this.element.comments)) {
        html = this.getLink('replies', 'text/html');
    }

    feed = wfwns && (feed = this.element[wfwns + ':commentRss']);

    if (!feed) {
        feed = this.getLink('replies', 'application/atom+xml');
    }

    return (feed || html) ? {
        feed: feed,
        html: html
    } : false;
};
