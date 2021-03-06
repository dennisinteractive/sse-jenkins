/* jshint node: true */
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
var fs = require('fs');

var app = express();

// Stores the active connections
var connections = {};
// Reconnect time for browsers if connection is dropped.
var reconnectTime = 15000;

// all environments
app.set('port', process.env.PORT || 8090);
app.set('mapfile', process.env.MAPFILE || '/path/to/mapping.file');
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
if ('development' === app.get('env')) {
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
    'Access-Control-Allow-Origin': '*'
  });
  res.write(":" + new Array(2049).join(" ") + "\n"); // 2kB padding for IE
  res.write("retry: " + reconnectTime + '\n');
}

/**
 * Send JSON data with the timestamp and message in the data.
 */
function sendSSE(site, res, id, message) {
  res.write('id: ' + id + '\n');
  res.write("data: {\n");
  res.write("data: \"type\": \"" + message.type + "\",\n");
  res.write("data: \"title\": \"" + message.title + "\",\n");
  res.write("data: \"timestamp\": \"" + id + "\",\n");
  res.write("data: \"msg\": \"" + message.content + "\"\n");
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
  console.log('URL: ' + req.url);
  for (var key in req.headers) {
    console.log(key + ': ' + req.headers[key]);
  }
}

/**
 * Helper function to reduce a URL to its domain sans the protocol.
 */
function stripUrl(val) {
  var reg = /^(http\:\/\/|https\:\/\/)?([^\/:?#]+)(?:[\/:?#]|$)/i;

  var retVal = val;
  // Strip off the protocol part of the url,
  // just to simplify our matching and storing.
  if ( (retVal = reg.exec(val)) === null ) {
    return val;
  }
  else {
    return retVal[2];
  }
}

/**
 * Wrapper to send an SSE message to an array of connections.
 */
function messageSites(sitesToMessage, message) {
  var len = sitesToMessage.length;
  for (var j=0; j<len; j++) {
    // Broadcast to all registered connections for this site.
    if (connections[sitesToMessage[j]]) {
      connections[sitesToMessage[j]].forEach(function (res) {
        console.log("Sending broadcast message to connected editors for " + sitesToMessage[j]);
        var date = new Date();
        sendSSE(sitesToMessage[j], res, date.getTime(), message);
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

  if (!req.headers.accept && req.headers.accept !== 'text/event-stream') {
    console.log("Headers not accepted by browser. Closing connection");
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(fs.readFileSync(__dirname + '/sse-node.html'));
    res.end();
  }

  var reg = /^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i;
  var originPath = reg.exec( req.headers.origin )[1];
  var date = new Date();
  // Send a comment acknowledgement and keep the connection open.
  sseHeaders(res);
  sendSSEComment(originPath, res, date.getTime(), "Connection acknowledgement");

  // As part of Yaffle Polyfill, send periodic comment to keep conn alive
  // https://github.com/Yaffle/EventSource
  connections[originPath] = connections[originPath] || [];
  connections[originPath].push(res);
  console.log("Adding this connection to the list of connections.");

  // Sends a SSE every X seconds on a single connection.
  var commentInterval = setInterval(function() {
    var date = new Date();
    sendSSEComment(originPath, res, date.getTime());
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
  var buildStatus = req.body.build.status;
  var buildPhase = req.body.build.phase;
  var siteFor = stripUrl(req.body.build.parameters.Site);
  var sitesToMessage = [ siteFor ];
  var message;

  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write("Thank you, status message received.\n");
  res.end();

  switch ( buildPhase ) {
    case 'STARTED':
      message = {
        type: 'info',
        title: 'Deployment starting',
        content: 'A code update for this site will start in one minute, which will temporarily put the site ' +
          '& CMS into maintenance mode. Please save your unfinished work immediately to avoid loss of data.'
      };
      break;
    case 'COMPLETED':
      // Do Nothing. Send nothing.
      return;
    case 'FINISHED':
      if (buildStatus === 'SUCCESS') {
        message = {
          type: 'success',
          title: 'Deployment completed',
          content: 'The code update has finished successfully and the site and CMS should be back online. ' +
                   'Contact your product manager if you have any problems.'
        };
      }
      else {
        message = {
          type: 'error',
          title: 'Deployment problem',
          content: 'A problem occurred during the code update. We are aware and will be attempting to ' +
                   'resolve the issue and redeploy as soon as possible. There may be issues with the ' +
                   'site and CMS during this period.'
        };
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
        messageSites(sitesToMessage, message);
      });
    }
    else {
      messageSites(sitesToMessage, message);
    }

  });

});

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
