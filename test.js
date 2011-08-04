var http = require("http"),
    urllib = require("url"),
    NodePie = require("./nodepie");

var feed_url = "http://techcrunch.com/feed/";

request(feed_url, function(error, xml){
    if(error){
        throw error;
    }
    
    var np = new NodePie(xml), item;
    
    np.init();
    
    console.log(np.getTitle());
    console.log(new Array((np.getTitle() || "").length + 1).join("="));
    console.log(np.getDescription());
    console.log(np.getPermalink());
    
    for(var i=0, len = np.getItemQuantity(3); i<len; i++){
        item = np.getItem(i);
        
        console.log("");
        console.log(item.getTitle());
        console.log(new Array((item.getTitle() || "").length + 1).join("-"));
        console.log(item.getPermalink());
        console.log(item.getDescription());
    }
    
})

function request(url, callback){
    var urlparts = urllib.parse(url),
        options = {
            host: urlparts.hostname,
            port: 80,
            path: urlparts.pathname + (urlparts.search || "")
        };
    
    http.get(options, function(res) {
        if(res.statusCode != 200){
            return callback(new Error("Invalid response code "+res.statusCode));
        }
        
        var body = "";
        res.on("data", function(chunk){
            body += chunk.toString("utf-8");
        });
        
        res.on("end", function(){
            callback(null, body);
        });
        
        res.on("error", function(e){
            callback(e);
        });
        
    }).on('error', function(e) {
        callback(e);
    });    
}
