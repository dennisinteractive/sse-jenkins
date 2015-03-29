sse-jenkins
===========

This is an example of a node.js HTML5 Server Sent Events notifications server that sends real-time notifications to connected browsers (think site editors/administrators) about code deployment statuses.

The server consists of two components
-------------------------------------

1. /rcvstatus Receives notifications from Jenkins and broadcasts it to connected browsers. You can use the Notifications plugin https://wiki.jenkins-ci.org/display/JENKINS/Notification+Plugin on Jenkins to post JSON to this server to notify of build status.

2. /ssestatus Receives and manages connections from browsers. In this example, we manage a multi-site scenario. So it keeps an array of existing connections by sitename. It is expected that the Jenkins job is parameterized to include the sitename so as to match the job with the list of connected sites to broadcast to.

Client side
-----------

The client-side JavaScript implements a straightforward EventSource connection. It includes an EventSource polyfill (https://github.com/Yaffle/EventSource) to ensure compatibility and the notifications are displayed using [humane.js](https://github.com/wavded/humane-js). The client JS and CSS are in the `dist/` folder.

A new version of the client script uses a standalone library. This supports asynchronous loading and execution and does not depend on jQuery or jQuery notify. This script and its CSS can be found in the `dist/` folder.

#### Async loading

Load the CSS

```html
<link rel="stylesheet" href="//www.example.com/sse-client.css">
```

Load the client

```js
<!-- // Load via a standard script tag -->
<script async src="//www.example.com/sse-client.min.js"></script>

<!-- // Or a compatible snippet -->
<script>
setTimeout(function(){
  var a=document.createElement("script"); var b=document.getElementsByTagName('script')[0];
  a.src=document.location.protocol+"//www.example.com/sse-client.min.js";
  a.async=true;a.type="text/javascript";b.parentNode.insertBefore(a,b)
},1);
</script>
```

Initialise the code

```js
<script>
  var sseClient = sseClient || {}; sseClient.q = sseClient.q || [];
  sseClient.q.push(['connect', {url: 'http://your-sse-server.com:8090/ssestatus'}]);
</script>
```

How to use:
-----------

1. Install node.js and npm - http://www.joyent.com/blog/installing-node-and-npm
2. Download this repo.
3. Optionally set the PORT env variable.
4. Optionally also set the MAPFILE env variable if you would like to provide a mapping file (in JSON format) to additional urls to be notified. Sample format:
{
  "key1" : ["url1a", "url1b"],
  "key2" : ["url2a", "url2b", "url2c"]
}
NOTE: This is useful in a scenario where for example an auth site may have multiple url aliases where editors could be working from.
5. Start the app: node app.js
6. Setup your Jenkins (deployment) job to notify your server (http://yourserver.com:port/rcvstatus) using JSON over HTTP.
7. Add a parameter to the Jenkins job to set the "Site" for which the task needs to notify.
7. Now assuming your site editors are running the above client-side JS, whenever a site deployment is triggered, they would get a notification.
