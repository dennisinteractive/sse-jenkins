/* globals EventSource: true, console: true */
/* jshint unused: false */
(function(exports, undefined) {

  // Insert CSS.
  var domReady = require('domready');
  var aug = require('aug');
  var humane = require('humane-js');

  var defaults = {
    url: '',
    sseTimeout: 3000,
    timeout: 0,
    clickToClose: true,
    waitForMove: false,
    timeoutAfterMove: 0,
    showAdditional: true
  };
  var config;
  var logger;
  var sseClient = {
    status: false
  };
  require('event-source-polyfill');

  function log(entry) {
    try {
      console.log(entry);
    }
    catch (e) {}
    finally {
      return;
    }
  }

  /**
   * Helper function to return a formatted datetime.
   *
   * @param  {[type]} timestamp A UNIX
   * @return {[type]}           [description]
   */
  function getFormattedDate(timestamp) {
    timestamp = timestamp || false;
    var date = (!timestamp) ? new Date() : new Date(Number(timestamp));

    return date.toLocaleTimeString();
  }

  /**
   * EventSource callback for when the connection is open.
   */
  function onOpen() {
    log('SSE connection opened');
  }

  /**
   * EventSource callback for when the there is a message.
   */
  function onMessage(e) {
    notify(JSON.parse(e.data));
  }

  /**
   * EventSource callback for when there is an error.
   */
  function onError(e) {
    if (e.target.readyState === EventSource.CONNECTING) {
      log('SSE connection refused');
    }
    if (e.target.readyState === EventSource.CLOSED) {
      log('SSE connection closed');
    }
  }

  function notify(content, type) {
    type = type || content.type || 'default';
    content.title = content.title || 'Alert!';
    content.timestamp = content.timestamp || undefined;
    // Create humane-js instance if not created yet.
    logger = logger || humane.create(config);

    // Display the notification.
    logger.log([
      '<div class="message-title">' + content.title + '</div>',
      '<div class="message-timestamp">' + getFormattedDate(content.timestamp) + '</div>',
      '<div class="message">' + content.msg + '</div>'
    ], {
      addnCls: 'humane-libnotify-' + type
    });

    return logger;
  }

  sseClient.connect = function(options) {
    if (sseClient.status) {
      throw new Error('Already connected');
    }

    config = aug(defaults, options);

    if (!config.url) {
      throw new Error('Deployment notifications server URL is missing. Please contact dev team to resolve this issue.');
    }

    domReady(function() {
      var source = new EventSource(config.url);
      logger = humane.create(config);

      source.onopen = onOpen;
      source.onmessage = onMessage;
      source.onerror = onError;

      // Built-in timeout to prevent browser from trying forever.
      setTimeout(function() {
        if (source.readyState !== 1) {
          source.close();
          logger = humane.create(defaults);
          notify({
            title: 'Error',
            msg: 'Unable to connect to deployment notification server.'
          }, 'error');
        }
      }, config.sseTimeout);
    });
  };

  function run() {
    // Set context.
    var root = (typeof window !== 'undefined') ? window : this;
    var queue;

    if (typeof root.EventSource !== 'function') {
      throw new Error('Your browser does not support HTML5 properly. You won\'t be receiving deployment notifications. Please contact the dev team on which browser to use.');
    }

    // Set up command queue if not set already.
    root.sseClient = root.sseClient || {};
    root.sseClient.q = root.sseClient.q || [];

    // Set any initial queue items aside.
    queue = root.sseClient.q;

    // Implement our own push.
    root.sseClient.q.push = function(item) {
      if (sseClient.status || !(item instanceof Array) || !item[0] || typeof sseClient[item[0]] !== 'function') {
        return false;
      }
      var args = item[1] || {};
      sseClient[item[0]].apply(this, [args]);
    };

    // Process initial queue items.
    if (queue instanceof Array) {
      queue.forEach(root.sseClient.q.push);
    }
  }

  // Show a friendly error message if EventSource is not supported.
  try {
    run();
  }
  catch(err) {
    domReady(function() {
      logger = humane.create(defaults);
      notify({
        title: 'Error',
        msg: err.message
      }, 'error');
    });
  }

  exports.sseClient = sseClient;

}(typeof exports === 'object' && exports || this));
