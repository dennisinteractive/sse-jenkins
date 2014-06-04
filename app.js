/**
 * Module dependencies.
 */

/**
 * TODO: Security in /rcvstatus and /ssestatus
 */
var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var sys = require('sys');
var fs = require('fs');
var url = require('url');

var app = express();

// Stores the active connections
var connections = {};
var exec = require('child_process').exec;
// Reconnect time for browsers if connection is dropped.
var reconnectTime = 15000;

// all environments
app.set('port', process.env.PORT || 8090);
app.set('mapfile', process.env.MAPFILE || '/path/to/mapping.file')
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
}

app.get('/', routes.index);
app.get('/users', user.list);

function removeConnection(site, res) {
  if (connections[site]) {
    var i = connections[site].indexOf(res);
    if (i !== -1) {
      connections[site].splice(i, 1);
      console.log('Removed connection for key ' + site);
    }
  }
}

/**
 * Set headers for SSE push notifications.
 */
function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(":" + Array(2049).join(" ") + "\n"); // 2kB padding for IE
  res.write("retry: " + reconnectTime + '\n');
}

/**
 * Send JSON data with the timestamp and message in the data.
 */
function sendSSE(site, res, id, message) {
  res.write('id: ' + id + '\n');
  res.write("data: {\n");
  res.write("data: \"timestamp\": \"" + id + "\",\n");
  res.write("data: \"msg\": \"" + message + "\"\n");
  res.write("data: }\n\n");
}

/**
 * Send a comment.
 */
function sendSSEComment(originPath, res, id, comment) {
  if (typeof(comment) === "undefined") {
    comment = "Keep-alive comment";
  }

  res.write(": " + comment + '\n\n');
  console.log("Comment sent for site " + originPath + " with id " + id);
}

/**
 * Debug function to spit out incoming headers.
 */
function debugHeaders(req) {
  sys.puts('URL: ' + req.url);
  for (var key in req.headers) {
    sys.puts(key + ': ' + req.headers[key]);
  }
  sys.puts('\n\n');
}

/**
 * Helper function to reduce a URL to its domain sans the protocol.
 */
function stripUrl(val) {
  var reg = /^(http\:\/\/|https\:\/\/)?([^\/:?#]+)(?:[\/:?#]|$)/i;

  var retVal = val;
  // Strip off the protocol part of the url, 
  // just to simplify our matching and storing.
  if ( (retVal = reg.exec(val)) == null ) {
    return val;
  }
  else {
    return retVal[2]; 
  }
}

/**
 * Wrapper to send an SSE message to an array of connections.
 */
function messageSites(sitesToMessage) {
  var len = sitesToMessage.length;
  for (var j=0; j<len; j++) {
    // Broadcast to all registered connections for this site.
    if (connections[sitesToMessage[j]]) {
      connections[sitesToMessage[j]].forEach(function (res) {
        console.log("Sending broadcast message to connected editors for " + sitesToMessage[j]);
        sendSSE(sitesToMessage[j], res, (new Date).getTime(), message);
      });
    }
    else {
      console.log("No open connections to send notifications for " + sitesToMessage[j]);
    }
  }
}

app.use(express.json()); // to support JSON-encoded bodies
app.use(express.urlencoded()); // to support URL-encoded bodies

// Browsers connect here for getting updates.
app.get('/ssestatus', function(req, res) {
  debugHeaders(req);

  if (req.headers.accept && req.headers.accept == 'text/event-stream') {
    var reg = /^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i;
    var originPath = reg.exec( req.headers.origin )[1];
    // Send a comment acknowledgement and keep the connection open.
    sseHeaders(res);
    sendSSEComment(originPath, res, (new Date).getTime(), "Connection acknowledgement");
  } else {
    console.log("Headers not accepted by browser. Closing connection");
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(fs.readFileSync(__dirname + '/sse-node.html'));
    res.end();
  }

  // As part of Yaffle Polyfill, send periodic comment to keep conn alive
  // https://github.com/Yaffle/EventSource
  var parsedURL = url.parse(req.url, true);
  var lastEventId = Number(req.headers["last-event-id"]) || Number(parsedURL.query.lastEventId) || 0;
  connections[originPath] = connections[originPath] || [];
  connections[originPath].push(res);
  console.log("Adding this connection to the list of connections.");

  // Sends a SSE every X seconds on a single connection.
  var commentInterval = setInterval(function() {
    sendSSEComment(originPath, res, (new Date).getTime());
  }, reconnectTime);

  res.on("close", function () {
    // Remove connection
    removeConnection(originPath, res);
    // Remove comment sending for this connection
    clearInterval(commentInterval);
  });
  
});


// Receive notifications from Jenkins
app.post('/rcvstatus', function(req, res) {
  console.log(req.body);
  var jobName = req.body.name;
  var buildNum = req.body.build.number;
  var buildStatus = req.body.build.status;
  var buildPhase = req.body.build.phase;
  var siteFor = stripUrl(req.body.build.parameters.Site);
  var sitesToMessage = [ siteFor ];

  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write('Thank you, status message received.');
  res.end();

  switch ( buildPhase ) {
    case 'STARTED':
      message = "A code release for this site will start in one minute." +
                "Please save your unfinished work to avoid loss of data.";
      break;
    case 'COMPLETED':
      // Do Nothing. Send nothing.
      return;
    case 'FINISHED':
      if (buildStatus == 'SUCCESS') {
        message = "Deployment completed successfully.";
      }
      else {
        message = "There was a problem in the release. Please contact the dev team.";
      }
      break;
      // Do nothing for other phases.
    default:
      return;
  }

  // Mapfile with any aliases for the siteFor,
  // as some sites may have multiple urls like auth servers.
  var mapfile = app.get('mapfile');

  fs.stat(mapfile, function(err, stats) {
    if (!err && stats.isFile()) {
      fs.readFile(mapfile, 'utf8', function (err, data) {
        if (err) {
          console.log('Error reading mapfile: ' + err);
          return;
        }

        // Read the data in JSON format from the map file.
        data = JSON.parse(data);
        
        var patt = new RegExp(siteFor);
        var matched = false;
        // Going through all arrays for matching siteFor.
        for (var key in data) {
          var len = data[key].length;
          for (var i=0; i<len; i++) {
            // As soon as match found, break. 'key' holds the array which we require.
            if (patt.test(data[key][i]) ) {
              matched = true;
              break;
            }
          }
          if (matched) {
            break;
          }
        }

        if (matched) {
          // Pass all site names corresponding to siteFor through 
          // a stripping function before they are sent for messaging.
          sitesToMessage = data[key].map(stripUrl);
          console.log('Message will be sent to connections on these urls: ');
          console.log(sitesToMessage);
        }
        messageSites(sitesToMessage);
      });
    }
    else {
      messageSites(sitesToMessage);
    }

  });

});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
