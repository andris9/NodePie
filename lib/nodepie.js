var xmlparser = require('xml2json'),
    fetch = require('fetch'),
    Iconv = require("iconv").Iconv,
    urllib = require("url");

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
function NodePie(xml, options){
    
    this.encoding = "UTF-8";
    this.options = options || {};
    this.xml = xml || "";
    
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
    WFW:     'http://wellformedweb.org/CommentAPI/',
    DC:      'http://purl.org/dc/elements/1.1/',
    CONTENT: 'http://purl.org/rss/1.0/modules/content/',
    ATOM10:  'http://www.w3.org/2005/Atom',
    GD:      'http://schemas.google.com/g/2005'
};

/**
 * NodePie.HTMLEntities -> Object
 * 
 * Does not convert &gt; and &lt;
 * 
 * Hash map to convert HTML entities into unicode symbols
 **/
NodePie.HTMLEntities = {
	apos:0x0027,quot:0x0022,amp:0x0026,nbsp:0x00A0,iexcl:0x00A1,cent:0x00A2,pound:0x00A3,
	curren:0x00A4,yen:0x00A5,brvbar:0x00A6,sect:0x00A7,uml:0x00A8,copy:0x00A9,ordf:0x00AA,laquo:0x00AB,
	not:0x00AC,shy:0x00AD,reg:0x00AE,macr:0x00AF,deg:0x00B0,plusmn:0x00B1,sup2:0x00B2,sup3:0x00B3,
	acute:0x00B4,micro:0x00B5,para:0x00B6,middot:0x00B7,cedil:0x00B8,sup1:0x00B9,ordm:0x00BA,raquo:0x00BB,
	frac14:0x00BC,frac12:0x00BD,frac34:0x00BE,iquest:0x00BF,Agrave:0x00C0,Aacute:0x00C1,Acirc:0x00C2,Atilde:0x00C3,
	Auml:0x00C4,Aring:0x00C5,AElig:0x00C6,Ccedil:0x00C7,Egrave:0x00C8,Eacute:0x00C9,Ecirc:0x00CA,Euml:0x00CB,
	Igrave:0x00CC,Iacute:0x00CD,Icirc:0x00CE,Iuml:0x00CF,ETH:0x00D0,Ntilde:0x00D1,Ograve:0x00D2,Oacute:0x00D3,
	Ocirc:0x00D4,Otilde:0x00D5,Ouml:0x00D6,times:0x00D7,Oslash:0x00D8,Ugrave:0x00D9,Uacute:0x00DA,Ucirc:0x00DB,
	Uuml:0x00DC,Yacute:0x00DD,THORN:0x00DE,szlig:0x00DF,agrave:0x00E0,aacute:0x00E1,acirc:0x00E2,atilde:0x00E3,
	auml:0x00E4,aring:0x00E5,aelig:0x00E6,ccedil:0x00E7,egrave:0x00E8,eacute:0x00E9,ecirc:0x00EA,euml:0x00EB,
	igrave:0x00EC,iacute:0x00ED,icirc:0x00EE,iuml:0x00EF,eth:0x00F0,ntilde:0x00F1,ograve:0x00F2,oacute:0x00F3,
	ocirc:0x00F4,otilde:0x00F5,ouml:0x00F6,divide:0x00F7,oslash:0x00F8,ugrave:0x00F9,uacute:0x00FA,ucirc:0x00FB,
	uuml:0x00FC,yacute:0x00FD,thorn:0x00FE,yuml:0x00FF,OElig:0x0152,oelig:0x0153,Scaron:0x0160,scaron:0x0161,
	Yuml:0x0178,fnof:0x0192,circ:0x02C6,tilde:0x02DC,Alpha:0x0391,Beta:0x0392,Gamma:0x0393,Delta:0x0394,
	Epsilon:0x0395,Zeta:0x0396,Eta:0x0397,Theta:0x0398,Iota:0x0399,Kappa:0x039A,Lambda:0x039B,Mu:0x039C,
	Nu:0x039D,Xi:0x039E,Omicron:0x039F,Pi:0x03A0,Rho:0x03A1,Sigma:0x03A3,Tau:0x03A4,Upsilon:0x03A5,
	Phi:0x03A6,Chi:0x03A7,Psi:0x03A8,Omega:0x03A9,alpha:0x03B1,beta:0x03B2,gamma:0x03B3,delta:0x03B4,
	epsilon:0x03B5,zeta:0x03B6,eta:0x03B7,theta:0x03B8,iota:0x03B9,kappa:0x03BA,lambda:0x03BB,mu:0x03BC,
	nu:0x03BD,xi:0x03BE,omicron:0x03BF,pi:0x03C0,rho:0x03C1,sigmaf:0x03C2,sigma:0x03C3,tau:0x03C4,
	upsilon:0x03C5,phi:0x03C6,chi:0x03C7,psi:0x03C8,omega:0x03C9,thetasym:0x03D1,upsih:0x03D2,piv:0x03D6,
	ensp:0x2002,emsp:0x2003,thinsp:0x2009,zwnj:0x200C,zwj:0x200D,lrm:0x200E,rlm:0x200F,ndash:0x2013,
	mdash:0x2014,lsquo:0x2018,rsquo:0x2019,sbquo:0x201A,ldquo:0x201C,rdquo:0x201D,bdquo:0x201E,dagger:0x2020,
	Dagger:0x2021,bull:0x2022,hellip:0x2026,permil:0x2030,prime:0x2032,Prime:0x2033,lsaquo:0x2039,rsaquo:0x203A,
	oline:0x203E,frasl:0x2044,euro:0x20AC,image:0x2111,weierp:0x2118,real:0x211C,trade:0x2122,alefsym:0x2135,
	larr:0x2190,uarr:0x2191,rarr:0x2192,darr:0x2193,harr:0x2194,crarr:0x21B5,lArr:0x21D0,uArr:0x21D1,
	rArr:0x21D2,dArr:0x21D3,hArr:0x21D4,forall:0x2200,part:0x2202,exist:0x2203,empty:0x2205,nabla:0x2207,
	isin:0x2208,notin:0x2209,ni:0x220B,prod:0x220F,sum:0x2211,minus:0x2212,lowast:0x2217,radic:0x221A,
	prop:0x221D,infin:0x221E,ang:0x2220,and:0x2227,or:0x2228,cap:0x2229,cup:0x222A,"int":0x222B,
	there4:0x2234,sim:0x223C,cong:0x2245,asymp:0x2248,ne:0x2260,equiv:0x2261,le:0x2264,ge:0x2265,
	sub:0x2282,sup:0x2283,nsub:0x2284,sube:0x2286,supe:0x2287,oplus:0x2295,otimes:0x2297,perp:0x22A5,
	sdot:0x22C5,lceil:0x2308,rceil:0x2309,lfloor:0x230A,rfloor:0x230B,lang:0x2329,rang:0x232A,loz:0x25CA,
	spades:0x2660,clubs:0x2663,hearts:0x2665,diams:0x2666
};

/**
 * NodePie._decodeHTMLEntities(text) -> String
 * - text (String): text to decode
 * 
 * Decodes any HTML entities in a string into their unicode form
 **/
NodePie._decodeHTMLEntities = function(text){
    return text.replace(/&(#?[a-z0-9]+?);/ig, function(str, ent){
        if(ent.charAt(0) !== '#'){
            return NodePie.HTMLEntities[ent] && String.fromCharCode(NodePie.HTMLEntities[ent]) || str;
        }else{
            return String.fromCharCode(ent.charAt(1) === 'x' ? parseInt(ent.substr(2),16) : parseInt(ent.substr(1), 10));
        }
      }
    );
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
NodePie._walkForNS = function(node, that, depth){
    depth  = depth || 0;
    
    if(depth>7){
        return;
    }
    
    var keys = Object.keys(node), key;
    for(var i=0, len = keys.length; i<len; i++){
        key = keys[i];
        if(typeof node[key] === "string"){
            if(key.trim().substr(0,6).toLowerCase() === "xmlns:"){
                that.namespaces[node[key]] = key.trim().substr(6);
            }
        }else if(node[key] && typeof node[key] === "object"){
            NodePie._walkForNS(node[key], that, depth+1);
        }
    }
};

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
};

/**
 * NodePie#_applyXMLPatches() -> undefined
 * 
 * Not used. Meant for modifying the xml before it is parsed.
 **/
NodePie.prototype._applyXMLPatches = function(){};

/**
 * NodePie#_checkEncoding(xml) -> undefined
 * - xml (Buffer): XML to convert encoding if it is not in UTF-8
 * 
 * Checks if the XML is not UTF-8 and encodes it accordingly
 **/
NodePie.prototype._checkEncoding = function(xml){

    //<?xml version="1.0" encoding="UTF-8">
    if(!this.options.encoding){
        xml.slice(0, xml.length<255?xml.length:255).toString("utf-8").replace(/<\?xml[^>]*>/i, (function(tag){
            var m = tag.match(/encoding\s*=\s*["']([^"']+)["']/i);
            this.encoding = (m && m[1] || this.encoding).trim().toUpperCase();
        }).bind(this));
    }else{
        this.encoding = this.options.encoding.trim().toUpperCase();
    }
    
    if(["UTF-8", "UTF8"].indexOf(this.encoding)<0){
        var iconv = new Iconv(this.encoding, 'UTF-8//TRANSLIT//IGNORE');
        xml = iconv.convert(xml);
    }
    
    return xml.toString("utf-8").trim();
};

/**
 * NodePie#_checkType() -> undefined
 * 
 * Detects the format of the feed (RSS, Atom or RDF), finds root elements,
 * entry arrays etc.
 **/
NodePie.prototype._checkType = function(){
    var root_keys = Object.keys(this.feed), key, type, elem;

    for(var i=0, len = root_keys.length; i<len; i++){
        
        key = root_keys[i];
        elem = this.feed[key];
        
        if(typeof elem !== "object" || Array.isArray(elem))
            continue;
        
        type = key.trim().toLowerCase();
        
        if(type === "feed"){
            this.feedType = "atom";
            this.rootElement = elem;
            this.channelElement = elem || {};
            this.itemsElement = elem.entry || [];
            break;
        }
        else if(type === "rss"){
            this.feedType = "rss";
            this.rootElement = elem;
            this.channelElement = elem.channel || {};
            this.itemsElement = this.channelElement.item || [];
            break;
        }
        else if(type === "rdf" || type.substr(-4) === ":rdf"){
            this.feedType = "rdf";
            this.rootElement = elem;
            this.channelElement = elem.channel || {};
            this.itemsElement = elem.item || [];
            break;
        }
        else if(type === "backslash"){
            this.feedType = "backslash";
            this.rootElement = elem;
            this.channelElement = elem;
            this.itemsElement = this.channelElement.story || [];
            break;
        }
    }
    
    if(!this.rootElement){
        throw new Error("Invalid feed!");
    }
};

/**
 * NodePie#_formatStr(str) -> String
 * - str (String): string to format
 * 
 * Formats a string according to initial options. By default decodes any HTML
 * entities
 **/
NodePie.prototype._formatStr = function(str){
    if(this.options.keepHTMLEntities)
        return str;
    else return NodePie._decodeHTMLEntities(str);
};

/**
 * NodePie#_parseContents(str) -> String
 * - str (String | Object): string or object to fetch text from
 * 
 * Fetches text contents from a string or feed text object
 **/
NodePie.prototype._parseContents = function(str){
	if(typeof str === "object")
		str = str.$t;

    if(typeof str === "string"){
        str = str.trim();
        if(str !== "") return this._formatStr(str);
    }

    return false;
};

/**
 * NodePie#_processDate(str) -> Date || false
 * - str (String): string containing the date
 * 
 * Processes a date
 **/
NodePie.prototype._processDate = function(date){
	if(!date) return false;
	
	date = new Date(date);
	
	var stamp = date.getTime();
	
	if(!stamp) return false;
	
	if(stamp > Date.now())
        return new Date();
    
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
NodePie.prototype.init = function(){
    
    if(this.xml instanceof Buffer){
        this.xml = this._checkEncoding(this.xml);
    }else{
        this.xml = (this.xml || "").toString("utf-8").trim();
    }
    
    this._applyXMLPatches();
    
    this.feed = xmlparser.toJson(this.xml, {object: true, sanitize: false, trim: false});

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
NodePie.prototype.getTitle = function(){
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
NodePie.prototype.getEncoding = function(){
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
NodePie.prototype.getDescription = function(){
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
NodePie.prototype.getPermalink = function(){
    var link = this.channelElement.link;

    if(typeof link === "string") return link.trim();
    else return this.getLink();
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
NodePie.prototype.getHub = function(){
    return this.getLink("hub");
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
NodePie.prototype.getSelf = function(){
    return this.getLink(NodePie.NS.GD+"#feed", "application/atom+xml") || 
              this.getLink("self", "application/rss+xml");
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
NodePie.prototype.getImage = function(){
    var gdns = this.namespaces[NodePie.NS.GD];
    return this._parseContents(
        (this.channelElement.image && this.channelElement.image.url) || 
        (this.channelElement.author && this.channelElement.author[gdns+":image"] &&
            this.channelElement.author[gdns+":image"].src) ||
        this.channelElement.logo ||
        this.channelElement.icon
    );
};

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
    
    var link = (atom10ns && [].concat(this.channelElement[atom10ns+":link"] || []).concat(this.channelElement.link)) || this.channelElement.link;

    if(!link);
    
    else if(typeof link === "string"){
        if(rel === "alternate" && type === "text/html")
            return link.trim();
    }
    
    else if(Array.isArray(link)){
        for(var i=0, len = link.length; i<len; i++){
            if(rel === link[i].rel && (!link[i].type || type === link[i].type))
                return link[i].href;
        }
    }
    
    else if(typeof link === "object"){
        if(rel === link.rel && (!link.type || type === link.type))
            return link.href;
    }
    
    if(rel == "alternate" && type == "text/html" && link && link.href && !link.rel && !link.type){
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
NodePie.prototype.getDate = function(){
    var dcns = this.namespaces[NodePie.NS.DC];
    
    return this._processDate(
        this.channelElement.lastBuildDate || this.channelElement.updated || 
        (dcns && this.channelElement[dcns+":date"])
    ) || this.getItems().map(function(item){
        return item.getDate();
    }).reduce(function(previousValue, currentValue){
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
NodePie.prototype.getItemQuantity = function(max){
    max = max || 0;
    
    if(this._item_count !== false){
        return max && max<this._item_count ? max : this._item_count;
    }
    
    this._item_count = 0;
    
    if(this.itemsElement){
        if(Array.isArray(this.itemsElement))
            this._item_count = this.itemsElement.length;
        else if(typeof this.itemsElement === "object")
            this._item_count = 1;
    }
    
    return max && max<this._item_count ? max : this._item_count;
};

/**
 * NodePie#getItems([start[, length]) -> Array
 * - start (Number): start index
 * - length (Number): how many items to fetch
 * 
 * Fetches an array of NodePie.Item objects
 **/
NodePie.prototype.getItems = function(start, length){
    start = start || 0;
    var quantity = this.getItemQuantity();
    length = length || quantity;
    
    if(start >= quantity){
        start = quantity-1;
        if(start === -1) start = 0;
    }
    
    if(length > quantity - start){
        length = quantity - start;
    }
    
    var items = [];
    for(var i=start; i<length; i++){
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
NodePie.prototype.getItem = function(i){
    i = i && !isNaN(i) && parseInt(Math.abs(i), 10) || 0;
    
    if(this._items[i]){
        return this._items[i];
    }
    
    if(Array.isArray(this.itemsElement)){
        if(this.itemsElement.length > i)
            return this._items[i] = new NodePie.Item(this.itemsElement[i], this);
    }

    else if(typeof this.itemsElement === "object"){
        if(i === 0)
            return this._items[i] = new NodePie.Item(this.itemsElement, this);
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
NodePie.Item = function(element, feed){
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
NodePie.Item.prototype._parseContents = function(str){
    return this.feed._parseContents(str);
};

/**
 * NodePie.Item#_formatStr(str) -> String | False
 * - str (String): a string to format
 * 
 * Derivated from NodePie#_formatStr 
 **/
NodePie.Item.prototype._formatStr = function(str){
    return this.feed._formatStr(str);
};

/**
 * NodePie.Item#_parseAuthor(str) -> String
 * - str (String | Object): author string value
 * 
 * Parser the author name from "e-mail (name)" string
 **/
NodePie.Item.prototype._parseAuthor = function(author){
    // email (name)
    var name = author.trim().match(/^[\w.\-]+@[\w.\-]+ \(([^)]+)\)$/);

    if(name)
        author = (name[1] || "").trim();
    
    return this._formatStr(author);
};

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
    
    var link = this.element.link || this.element.url;
    
    if(!link){ }
    
    else if(typeof link === "string"){
        if(rel === "alternate" && type === "text/html")
            return link.trim();
    }
    
    else if(typeof link === "object" && !Array.isArray(link)){
        if(rel === link.rel && (!link.type || type === link.type))
            return link.href;
    }
    
    else if(Array.isArray(link)){
        for(var i=0, len = link.length; i<len; i++)
            if(rel === link[i].rel && (!link[i].type || type === link[i].type))
                return link[i].href;
    }
    
    if(rel == "alternate" && type == "text/html" && link && link.href && !link.rel && !link.type){
        return link.href;
    }

    return false;
};

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
    var permalink = this.getLink(),
        feedLink;
    if(!permalink){
        return permalink;
    }

    if((feedLink = this.feed.getPermalink())){
        return urllib.resolve(feedLink, permalink);
    }else{
        return permalink;
    }
};

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
NodePie.Item.prototype.getAuthors = function(){
    var author, authors = [], dcns = this.feed.namespaces[NodePie.NS.DC];
    
    if(author = this.element.author);
    else if(author = this.element.creator);
    else if(dcns && (author = this.element[dcns+":creator"]) );
    else return false;
    
    if(typeof author === "string"){
        return [this._parseAuthor(author)];
    }
    
    if(typeof author === "object"){
        if(Array.isArray(author)){
            for(var i=0, len = author.length; i<len; i++){
                if(author[i] && author[i].name){
                    authors.push(author[i].name);
                }
            }
            return authors || false;
        }else if(typeof author.name === "string")
            return [this._parseAuthor(author.name)];
    }
    
    return false;
};

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
    return this._parseContents( this.element.title );
};

/**
 * NodePie.Item#getDate() -> Date | False
 * 
 * Fetches the date of the post as a Date object
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     date = item.getDate();
 *     console.log("Created: " + date.getFullYear());
 **/
NodePie.Item.prototype.getDate = function(){
    var dcns = this.feed.namespaces[NodePie.NS.DC];
    
    return this.feed._processDate(
        this.element.pubDate || this.element.published || this.element.created || this.element.issued || 
        this.element.updated || this.element.modified || (dcns && this.element[dcns+":date"]) || this.element.time
    );
};

/**
 * NodePie.Item#getUpdateDate() -> Date | False
 * 
 * Fetches the update date of the post as a Date object
 * 
 * Usage:
 * 
 *     var item = np.getItem(0);
 *     date = item.getUpdateDate();
 *     console.log("Updated: " + date.getFullYear());
 **/
NodePie.Item.prototype.getUpdateDate = function(){
    return this.feed._processDate(
        this.element.updated || this.element.modified
    ) || this.getDate(); // fallback to creation date
};

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
    var cns = this.feed.namespaces[NodePie.NS.CONTENT];
    var atom10ns = this.feed.namespaces[NodePie.NS.ATOM10];
    var summary = this.element[atom10ns + ":summary"];
    
    return this._parseContents(
        this.element.description || summary || 
        this.element.content || (cns && this.element[cns+":encoded"]) || ""
    );
};

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
    var cns = this.feed.namespaces[NodePie.NS.CONTENT];
    var atom10ns = this.feed.namespaces[NodePie.NS.ATOM10];
    var summary = this.element[atom10ns + ":summary"];
    
    return this._parseContents(
        this.element.content || (cns && this.element[cns+":encoded"]) || 
        this.element.description || summary || ""
    );
};

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
NodePie.Item.prototype.getCategories = function(){
    var category, categories = [], dcns = this.feed.namespaces[NodePie.NS.DC];
    
    category = this.element.category || this.element[dcns+":subject"] || this.element.department;
    
    if(!category){ }
    
    else if(typeof category === "string"){
        if(category = category.trim())
            return [this._formatStr(category)];
    }
    
    else if(Array.isArray(category)){
        for(var i=0, len = category.length; i<len; i++){
            if(typeof category[i] === "string"){
                if(category[i].trim())
                    categories.push(category[i].trim());
            }
            else if(typeof category[i] === "object"){
                if((category[i].term || category[i].$t || "").trim())
                    categories.push(this._formatStr((category[i].term || category[i].$t || "").trim()));
            }
        }
        return categories.length && categories;
    }
    
    else if(typeof category === "object"){
         category = category.term || category.$t;
         if(category && (category = category.trim()) )
             return [this._formatStr(category)];
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
    
    if( !(html = this.element.comments) )
        html = this.getLink("replies", "text/html");
    
    feed = wfwns && (feed = this.element[wfwns+":commentRss"]);
    
    if(!feed)
        feed = this.getLink("replies", "application/atom+xml");
    
    return (feed || html) ? {feed: feed, html: html} : false;
};

