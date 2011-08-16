var xmlparser = require('xml2json'),
    Iconv = require("iconv").Iconv;

module.exports = NodePie;

/************* FEED *************/

/**
 * new NodePie(xml [, options])
 * - xml (String | Buffer): Feed XML data
 * - options (Object): options object
 * 
 * Generates a NodePie object for parsing RSS/Atom feed data
 * 
 * Usage:
 * 
 *     var np = new NodePie(feed);
 *     np.init();
 *     console.log(np.getTitle());
 * 
 *     np.getItems().forEach(function(item){
 *         console.log(item.getTitle());
 *     });
 **/
function NodePie(xml, options){
    
    this.encoding = "UTF-8";
    if(xml instanceof Buffer){
        this._checkEncoding(xml);
    }else{
        this.xml = (xml || "").trim();
    }
    
    this.options = options || {};
    
    this.feed;
    this.rootElement;
    this.channelElement;
    this.itemsElement;
    this.feedType;
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
    WFW:     'http://wellformedweb.org/CommentAPI/',
    DC:      'http://purl.org/dc/elements/1.1/',
    CONTENT: 'http://purl.org/rss/1.0/modules/content/',
    ATOM10:  'http://www.w3.org/2005/Atom'
}

/**
 * NodePie.HTMLEntities -> Object
 * 
 * Hash map to convert HTML entities into unicode symbols
 **/
NodePie.HTMLEntities = {
    nbsp: " ",   iexcl: "¡",  cent: "¢",   pound: "£",  curren: "¤",
    yen: "¥",    brvbar: "¦", sect: "§",   uml: "¨",    copy: "©",
    ordf: "ª",   laquo: "«",  not: "¬",    reg: "®",    macr: "¯",
    deg: "°",    plusmn: "±", sup2: "²",   sup3: "³",   acute: "´",
    micro: "µ",  para: "¶",   middot: "·", cedil: "¸",  sup1: "¹",
    ordm: "º",   raquo: "»",  frac14: "¼", frac12: "½", frac34: "¾",
    iquest: "¿", times: "×",  divide: "÷", Agrave: "À",
    Aacute: "Á", Acirc: "Â",  Atilde: "Ã", Auml: "Ä",
    Aring: "Å",  AElig: "Æ",  Ccedil: "Ç", Egrave: "È",
    Eacute: "É", Ecirc: "Ê",  Euml: "Ë",   Igrave: "Ì", Iacute: "Í",
    Icirc: "Î",  Iuml: "Ï",   ETH: "Ð",    Ntilde: "Ñ", Ograve: "Ò",
    Oacute: "Ó", Ocirc: "Ô",  Otilde: "Õ", Ouml: "Ö",   Oslash: "Ø",
    Ugrave: "Ù", Uacute: "Ú", Ucirc: "Û",  Uuml: "Ü",   Yacute: "Ý",
    THORN: "Þ",  szlig: "ß",  agrave: "à", aacute: "á", acirc: "â",
    atilde: "ã", auml: "ä",   aring: "å",  aelig: "æ",  ccedil: "ç",
    egrave: "è", eacute: "é", ecirc: "ê",  euml: "ë",   igrave: "ì",
    iacute: "í", icirc: "î",  iuml: "ï",   eth: "ð",    ntilde: "ñ",
    ograve: "ò", oacute: "ó", ocirc: "ô",  otilde: "õ",
    ouml: "ö",   oslash: "ø", ugrave: "ù", uacute: "ú",
    ucirc: "û",  uuml: "ü",   yacute: "ý", thorn: "þ",  yuml: "ÿ"
}

/**
 * NodePie._decodeHTMLEntities(text) -> String
 * - text (String): text to decode
 * 
 * Decodes any HTML entities in a string into their unicode form
 **/
NodePie._decodeHTMLEntities = function(text){
    return text.replace(/&#(\d{2,4});/g, function(o, nr){
        if(nr!="173"){ // keep &shy;
            return String.fromCharCode(nr);
        }else{
            return o;
        }
    }).replace(/&([a-zA-Z]+([0-9]+)?);/g, function(o, code){
        return NodePie.HTMLEntities[code] || o;
    });
}

/**
 * NodePie._walkForNS(node, that[, depth]) -> undefined
 * - node (Object): object to check for
 * - that (Object): current context
 * - depth Number): How deep are we
 * 
 * Walks all the feed object nodes to populate XML namespace object
 * NodePie#namespaces
 **/
NodePie._walkForNS = function(node, that, depth){
    depth  = depth || 0;
    
    if(depth>7){
        return;
    }
    
    var keys = Object.keys(node), key;
    for(var i=0, len = keys.length; i<len; i++){
        key = keys[i];
        if(typeof node[key] == "string"){
            if(key.trim().substr(0,6).toLowerCase() == "xmlns:"){
                that.namespaces[node[key]] = key.trim().substr(6);
            }
        }else if(node[key] && typeof node[key] == "object"){
            NodePie._walkForNS(node[key], that, depth+1);
        }
    }
}

/************* FEED LEVEL PRIVATE METHODS *************/

/**
 * NodePie#_fetchNamespaces() -> undefined
 * 
 * Populates NodePie#namespaces object with used namespaces
 **/
NodePie.prototype._fetchNamespaces = function(){
    if(this.rootElement){
        NodePie._walkForNS(this.rootElement, this);
    }
}

/**
 * NodePie#_applyXMLPatches() -> undefined
 * 
 * Not used. Meant for modifying the xml before it is parsed.
 **/
NodePie.prototype._applyXMLPatches = function(){}

/**
 * NodePie#_checkEncoding(xml) -> undefined
 * - xml (Buffer): XML to convert encoding if it is not in UTF-8
 * 
 * Checks if the XML is not UTF-8 and encodes it accordingly
 **/
NodePie.prototype._checkEncoding = function(xml){

    //<?xml version="1.0" encoding="UTF-8">
    xml.slice(0, xml.length<255?xml.length:255).toString("utf-8").replace(/<\?xml[^>]*>/i, (function(tag){
        var m = tag.match(/encoding\s*=\s*["']([^"']+)["']/i);
        this.encoding = (m && m[1] || encoding).toUpperCase();
    }).bind(this));
    
    if(["UTF-8", "UTF8"].indexOf(this.encoding)<0){
        var iconv = new Iconv(this.encoding, 'UTF-8//TRANSLIT//IGNORE');
        xml = iconv.convert(xml);
    }
    
    this.xml = xml.toString("utf-8").trim();
}

/**
 * NodePie#_checkType() -> undefined
 * 
 * Detects the format of the feed (RSS, Atom or RDF), finds root elements,
 * entry arrays etc.
 **/
NodePie.prototype._checkType = function(){
    var root_keys = Object.keys(this.feed), key;
    
    for(var i=0, len = root_keys.length; i<len; i++){
        
        key = root_keys[i];
        
        if(typeof this.feed[key] != "object" || Array.isArray(this.feed[key])){
            continue;
        }
        
        if(key.trim().toLowerCase() == "rdf" || key.trim().substr(-4).toLowerCase() == ":rdf"){
            this.feedType = "rdf";
            this.rootElement = this.feed[root_keys[i]];
            this.channelElement = this.rootElement["channel"] || {};
            this.itemsElement = this.rootElement["item"] || [];
            break;
        }
        
        if(key.trim().toLowerCase() == "feed"){
            this.feedType = "atom";
            this.rootElement = this.feed[root_keys[i]];
            this.channelElement = this.rootElement || {};
            this.itemsElement = this.rootElement["entry"] || [];
            break;
        }
        
        if(key.trim().toLowerCase() == "rss"){
            this.feedType = "rss";
            this.rootElement = this.feed[root_keys[i]];
            this.channelElement = this.rootElement["channel"] || {};
            this.itemsElement = this.channelElement["item"] || [];
            break;
        }
    }
    
    if(!this.rootElement){
        throw new Error("Invalid feed!");
    }
}

/**
 * NodePie#_formatStr(str) -> String
 * - str (String): string to format
 * 
 * Formats a string according to initial options. By default decodes any HTML
 * entities
 **/
NodePie.prototype._formatStr = function(str){
    return this.options.keepHTMLEntities ? str : NodePie._decodeHTMLEntities(str);
}

/**
 * NodePie#_parseContents(str) -> String
 * - str (String | Object): string or object to fetch text from
 * 
 * Fetches text contents from a string or feed text object
 **/
NodePie.prototype._parseContents = function(str){
    if(!str){
        return false;
    }
    
    if(typeof str == "string"){
        str = str.trim();
        return str && this._formatStr(str) || false;
    }
    
    if(typeof str == "object"){
        if(typeof str.$t == "string"){
            str.$t = str.$t.trim();
            return str.$t && this._formatStr(str.$t) || false;
        }
    }
    
    return false;
}

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
NodePie.prototype.init = function(){
    
    this._applyXMLPatches();
    
    this.feed = xmlparser.toJson(this.xml, {object: true});
    this._checkType();
    this._fetchNamespaces();
}

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
NodePie.prototype.getTitle = function(){
    var title = this.channelElement.title;
    return this._parseContents(title);
}

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
NodePie.prototype.getEncoding = function(){
    return this.encoding;
}

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
NodePie.prototype.getDescription = function(){
    var description = this.channelElement.description || this.channelElement.subtitle ||
         this.channelElement.tagline;
    
    return this._parseContents(description);
}

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
NodePie.prototype.getPermalink = function(){
    var link = this.channelElement.link;
    
    if(!link){
        return false;
    }
    
    if(typeof link=="string"){
        return link.trim();
    }
    
    return this.getLink();
}

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
NodePie.prototype.getHub = function(){
    return this.getLink("hub");
}

/**
 * NodePie#getLink([rel="alternate"[, type="text/html"]]) -> String | False
 * - rel (String): link rel
 * - type (String): link content type
 * 
 * Fetches a specified link from the links object
 * 
 * Usage:
 * 
 *     var np = new NodePie(feed);
 *     np.init();
 *     edit_link = np.getLink("edit","application/atom+xml");
 **/
NodePie.prototype.getLink = function(rel, type){
    var atom10ns = this.namespaces[NodePie.NS.ATOM10];
    
    rel = rel || "alternate";
    type = type || "text/html";
    
    var link = (atom10ns && this.channelElement[atom10ns+":link"]) || this.channelElement.link || false;
    
    if(!link){
        return false;
    }
    
    if(typeof link == "string"){
        if(rel == "alternate" && type == "text/html"){
            return link.trim();
        }else{
            return false;
        }
    }
    
    if(typeof link == "object" && !Array.isArray(link)){
        if(rel == link.rel && (!link.type || type==link.type)){
            return link.href;
        }else{
            return false;
        }
    }
    
    if(Array.isArray(link)){
        for(var i=0, len = link.length; i<len; i++){
            if(rel == link[i].rel && (!link[i].type || type==link[i].type)){
                return link[i].href;
            }
        }
    }
    
    return false;
}

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
NodePie.prototype.getDate = function(){
    var dcns = this.namespaces[NodePie.NS.DC], date;
    
    date = this.channelElement.lastBuildDate || this.channelElement.updated || 
            (dcns && this.channelElement[dcns+":date"]) || false;
    
    if(!date){
        return false;
    }
    
    date = new Date(date);
    if(!date.getFullYear()){
        return false;
    }
    
    if(date.getTime() > Date.now()){
        return new Date();
    }
    
    return date;
}

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
NodePie.prototype.getItemQuantity = function(max){
    max = max || 0;
    
    if(this._item_count !== false){
        return max && max<this._item_count ? max : this._item_count;
    }
    
    this._item_count = 0;
    
    if(!this.itemsElement){
        this._item_count = 0;
    }else if(Array.isArray(this.itemsElement)){
        this._item_count = this.itemsElement.length;
    }else if(typeof this.itemsElement == "object"){
        this._item_count = 1;
    }
    
    return max && max<this._item_count ? max : this._item_count;
}

/**
 * NodePie#getItems([start[, length]) -> Array
 * - start (Number): start index
 * - length (Number): how many items to fetch
 * 
 * Fetches an array of NodePie.Item objects
 **/
NodePie.prototype.getItems = function(start, length){
    start = start || 0;
    length = length || this.getItemQuantity();
    
    if(start >= this.getItemQuantity()){
        start = this.getItemQuantity()-1;
        if(start<0){
            start = 0;
        }
    }
    
    if(length > this.getItemQuantity() - start){
        length = this.getItemQuantity() - start;
    }
    
    var items = [];
    for(var i=start; i<length; i++){
        items.push(this.getItem(i));
    }
    return items;
}

/**
 * NodePie#getItem(i) -> NodePie.Item | False
 * - i (Number): item index
 * 
 * Fetches a NodePie.Item object from defined index or false if out of bounds
 **/
NodePie.prototype.getItem = function(i){
    i = i && !isNaN(i) && parseInt(Math.abs(i), 10) || 0;
    
    if(this._items[i]){
        return this._items[i];
    }
    
    if(!this.itemsElement){
        return false;
    }
    
    if(Array.isArray(this.itemsElement)){
        if(this.itemsElement.length > i){
            this._items[i] = new NodePie.Item(this.itemsElement[i], this);
            return this._items[i];
        }else{
            return false;
        }
    }

    if(typeof this.itemsElement == "object"){
        if(i === 0){
            this._items[i] = new NodePie.Item(this.itemsElement, this);
            return this._items[i];
        }
    }
    
    return false;
}


/************* ITEM *************/

/**
 * new NodePie.Item(element, feed)
 * - element (Object): entry object
 * - feed (Object): NodePie parent object
 * 
 * Generates a NodePie.Item object. This is done by NodePie#getItem() method
 * automatically 
 **/
NodePie.Item = function(element, feed){
    this.element = element;
    this.feed = feed;
}

/************* ITEM LEVEL PRIVATE METHODS *************/

/**
 * NodePie.Item#_parseContents(str) -> String | False
 * - str (String | Object): a string or an object to parse text from
 * 
 * Derivated from NodePie#_parseContents 
 **/
NodePie.Item.prototype._parseContents = function(str){
    return this.feed._parseContents.call(this.feed, str);
}

/**
 * NodePie.Item#_formatStr(str) -> String | False
 * - str (String): a string to format
 * 
 * Derivated from NodePie#_formatStr 
 **/
NodePie.Item.prototype._formatStr = function(str){
    return this.feed._formatStr.call(this.feed, str);
}

/**
 * NodePie.Item#_parseAuthor(str) -> String
 * - str (String | Object): author string value
 * 
 * Parser the author name from "e-mail (name)" string
 **/
NodePie.Item.prototype._parseAuthor = function(author){
    // email (name)
    var name;
    if(name = author.trim().match(/^[\w.-]+@[\w.-]+ \(([^)]+)\)$/)){
        author = (name[1] || "").trim();
    }
    
    return this._formatStr(author);
}

/************* ITEM LEVEL PUBLIC METHODS *************/

/**
 * NodePie.Item#getLink([rel="alternate"[, type="text/html"]]) -> String | False
 * - rel (String): link rel
 * - type (String): link content type
 * 
 * Fetches a specified link from the links object
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     permalink = item.getLink("alternate","text/html");
 **/
NodePie.Item.prototype.getLink = function(rel, type){
    rel = rel || "alternate";
    type = type || "text/html";
    
    var link = this.element.link || false;
    
    if(!link){
        return false;
    }
    
    if(typeof link == "string"){
        if(rel == "alternate" && type == "text/html"){
            return link.trim();
        }else{
            return false;
        }
    }
    
    if(typeof link == "object" && !Array.isArray(link)){
        if(rel == link.rel && (!link.type || type==link.type)){
            return link.href;
        }else{
            return false;
        }
    }
    
    if(Array.isArray(link)){
        for(var i=0, len = link.length; i<len; i++){
            if(rel == link[i].rel && (!link[i].type || type==link[i].type)){
                return link[i].href;
            }
        }
    }
    
    return false;
}

/**
 * NodePie.Item#getPermalink() -> String | False
 * 
 * Fetches a permalink to the post
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     permalink = item.getPermalink();
 **/
NodePie.Item.prototype.getPermalink = function(){
    return this.getLink("alternate", "text/html");
}

/**
 * NodePie.Item#getAuthor() -> String | False
 * 
 * Fetches the (first) author of the post
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     author = item.getAuthor();
 **/
NodePie.Item.prototype.getAuthor = function(){
    var authors = this.getAuthors();
    return authors && authors[0];
}

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
NodePie.Item.prototype.getAuthors = function(){
    var author, authors = [], dcns = this.feed.namespaces[NodePie.NS.DC];
    
    if(this.element.author){
        author = this.element.author;
    }else if(this.element.creator){
        author = this.element.creator;
    }else if(dcns && this.element[dcns+":creator"]){
        author = this.element[dcns+":creator"];
    }
    
    if(typeof author == "string"){
        return [this._parseAuthor(author)];
    }
    
    if(typeof author == "object"){
        if(Array.isArray(author)){
            for(var i=0, len = author.length; i<len; i++){
                if(author[i] && author[i].name){
                    authors.push(author[i].name);
                }
            }
            return authors.length ? authors : false;
        }else if(typeof author.name == "string"){
            return [this._parseAuthor(author.name)];
        }
    }
    
    return false;
}

/**
 * NodePie.Item#getTitle() -> String | False
 * 
 * Fetches the title of the post
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     title = item.getTitle();
 **/
NodePie.Item.prototype.getTitle = function(){
    var title = this.element.title;
    return this._parseContents(title);
}

/**
 * NodePie.Item#getTitle() -> Date | False
 * 
 * Fetches the date of the post as a Date object
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     date = item.getDate();
 *     console.log(date.getFullYear());
 **/
NodePie.Item.prototype.getDate = function(){
    var dcns = this.feed.namespaces[NodePie.NS.DC], date;
    
    date = this.element.pubDate || this.element.published || this.element.created || this.element.issued || 
            this.element.updated || this.element.modified || (dcns && this.element[dcns+":date"]) || false;
    
    if(!date){
        return false;
    }
    
    date = new Date(date);
    if(!date.getFullYear()){
        return false;
    }
    
    if(date.getTime() > Date.now()){
        return new Date();
    }
    
    return date;
}

/**
 * NodePie.Item#getDescription() -> String | False
 * 
 * Fetches the description of the post (prefers summaries)
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     description = item.getDescription();
 **/
NodePie.Item.prototype.getDescription = function(){
    var str, cns = this.feed.namespaces[NodePie.NS.COTENT];
    
    str = this.element.description || this.element.summary || 
        this.element.content || (cns && this.element[cns+":encoded"]) || "";
    
    return this._parseContents(str);
}

/**
 * NodePie.Item#getContents() -> String | False
 * 
 * Fetches the contents of the post (prefers full text)
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     contents = item.getContents();
 **/
NodePie.Item.prototype.getContents = function(){
    var str, cns = this.feed.namespaces[NodePie.NS.CONTENT];
    
    str = this.element.content || (cns && this.element[cns+":encoded"]) || 
        this.element.description || this.element.summary || "";
    
    return this._parseContents(str);
}

/**
 * NodePie.Item#getCategory() -> String | False
 * 
 * Fetches the (first) category of the post
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     category = item.getCategory();
 **/
NodePie.Item.prototype.getCategory = function(){
    var categories = this.getCategories();
    return categories && categories[0] || false;
}

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
NodePie.Item.prototype.getCategories = function(){
    var category, categories = [], dcns = this.feed.namespaces[NodePie.NS.DC];
    
    category = this.element.category || this.element[dcns+":subject"] || false;
    
    if(!category){
        return false;
    }
    
    if(typeof category == "string"){
        category = category.trim();
        return category && [this._formatStr(category)] || false;
    }
    
    if(typeof category == "object" && !Array.isArray(category)){
         category = category.term || category.$t || false;
         if(!category){
             return false;
         }
         category = category.trim();
         return category && [this._formatStr(category)] || false
    }
    
    if(Array.isArray(category)){
        for(var i=0, len = category.length; i<len; i++){
            if(typeof category[i] == "string"){
                if(category[i].trim()){
                    categories.push(category[i].trim());
                }
                continue;
            }
            if(typeof category[i] == "object"){
                if((category[i].term || category[i].$t || "").trim()){
                    categories.push(this._formatStr((category[i].term || category[i].$t || "").trim()));
                }
            }
        }
        return categories.length && categories || false;
    }
    
    return false;
}

/**
 * NodePie.Item#getComments() -> Object | False
 * 
 * Fetches an object containing links to the HTML comments page and to an
 * Atom/RSS feed of comments for the post
 * 
 *     {
 *         html: "http://link_to_html_page",
 *         feed: "http://link_to_comments_feed"
 *     }
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     comments = item.getComments();
 *     console.log("See all comments: " + comments.html);
 **/
NodePie.Item.prototype.getComments = function(){
    var wfwns = this.feed.namespaces[NodePie.NS.WFW],
        html, feed;
    
    if(this.element.comments){
        html = this.element.comments;
    }else{
        html = this.getLink("replies", "text/html") || false;
    }
    
    if(wfwns && this.element[wfwns+":commentRss"]){
        feed = this.element[wfwns+":commentRss"];
    }else{
        feed = this.getLink("replies", "application/atom+xml") || false; 
    }
    
    return feed || html ? {feed: feed, html: html} : false;
}

