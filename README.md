sse-jenkins
===========

This is an example of a node.js HTML5 Server Sent Events notifications server that sends real-time notifications to connected browsers (think site editors/administrators) about code deployment statuses.

The server consists of two components
-------------------------------------

1. /rcvstatus Receives notifications from Jenkins and broadcasts it to connected browsers. You can use the Notifications plugin https://wiki.jenkins-ci.org/display/JENKINS/Notification+Plugin on Jenkins to post JSON to this server to notify of build status.

2. /ssestatus Receives and manages connections from browsers. In this example, we manage a multi-site scenario. So it keeps an array of existing connections by sitename. It is expected that the Jenkins job is parameterized to include the sitename so as to match the job with the list of connected sites to broadcast to.

Client side
-----------

The client side javascript could implement a straight forward EventSource connection like so:

```javascript
jQuery(document).ready(function($) {

  // jquery notify settings.
  $("#jquery-notify-container").notify({
    speed: 500,
    expires: false
  });

  // SSE
  if (!!window.EventSource) {
    // This is a specific example for Drupal. 
    // Change this to use http://myserver:port/ssestatus
    var serverURL = Drupal.settings.dennis_sse['server'];
    var source = new EventSource(serverURL);
  } else {
    // Result to xhr polling :(
    var err = 'Your browser is not compatible with HTML5. ' +
              'You wont be receiving deployment notifications. ' +
              'Please contact the dev team on which browser/upgrade to use.';
    var formatted_time = get_formatted_date();
    $("#jquery-notify-container").notify("create", {
      title: "Alert!",
      timestamp: formatted_time,
      text: err
    });
  }

  function get_formatted_date(timestamp) {
    if (typeof(timestamp) === "undefined") {
      var date = new Date();
    }
    else {
      var date = new Date(Number(timestamp));
    }
    var hour = date.getHours();
    var min = date.getMinutes() + "";
    if (min.length == 1) {
      min = "0" + min;
    }
    var sec = date.getSeconds();
    var formatted_time = hour + ":" + min + ":" + sec;
    return formatted_time;
  }

  /**
   * These are overrideable callbacks.
   * If sites want to implement different callbacks, it is possible.
   */

  source.onopen = function(e) {
    console.log('SSE connection opened');
  };

  source.onmessage = function(e) {
    var data = JSON.parse(e.data);
    var formatted_time = get_formatted_date(data.timestamp);
    $("#jquery-notify-container").notify("create", {
      title: "Alert!",
      timestamp: formatted_time,
      text: data.msg
    });
  };

  source.onerror = function(e) {
    console.log(e.data);
    if (e.readyState == EventSource.CLOSED) {
      alert("Connection closed");
    }
  };
});
```

How to use:
-----------

1. Install node.js and npm - http://www.joyent.com/blog/installing-node-and-npm
2. Download this repo.
3. Optionally set the PORT env variable.
3. Start the app: node app.js
4. Setup your Jenkins (deployment) job to notify your server using JSON over HTTP.
5. Now assuming your site editors are running the above client-side JS, whenever a site deployment is triggered, they would get a notification.
