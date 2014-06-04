sse-jenkins
===========

This is an example of a node.js HTML5 Server Sent Events notifications server that sends real-time notifications to connected browsers (think site editors/administrators) about code deployment statuses.

The server consists of two components
-------------------------------------

1. /rcvstatus Receives notifications from Jenkins and broadcasts it to connected browsers. You can use the Notifications plugin https://wiki.jenkins-ci.org/display/JENKINS/Notification+Plugin on Jenkins to post JSON to this server to notify of build status.

2. /ssestatus Receives and manages connections from browsers. In this example, we manage a multi-site scenario. So it keeps an array of existing connections by sitename. It is expected that the Jenkins job is parameterized to include the sitename so as to match the job with the list of connected sites to broadcast to. 

Client side
-----------

The client side javascript could implement a straight forward EventSource connection. Sample JS and a polyfill (https://github.com/Yaffle/EventSource) has been included in public/javascripts/ folder. The notifications style uses Growl-like notifications using the jquery-notify widget https://github.com/ehynds/jquery-notify. The associated JS & CSS files are in the public/ folder as well.


How to use:
-----------

1. Install node.js and npm - http://www.joyent.com/blog/installing-node-and-npm
2. Download this repo.
3. Optionally set the PORT env variable.
4. Optionally also set the MAPFILE env variable if you would like to provide a mapping file (in JSON format) to additional urls to be notified. Sample format: {
  "cp" : ["http://cloudpro.vm.didev.co.uk", "http://cloudprod7.vm.didev.co.uk"],
  "ae" : ["http://autoexpressuk.vm.didev.co.uk", "http://autoexpressuk2.vm.didev.co.uk"]
}
 
5. Start the app: node app.js
6. Setup your Jenkins (deployment) job to notify your server (http://yourserver.com:port/rcvstatus) using JSON over HTTP.
7. Now assuming your site editors are running the above client-side JS, whenever a site deployment is triggered, they would get a notification.
