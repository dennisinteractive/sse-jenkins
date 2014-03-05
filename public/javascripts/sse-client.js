jQuery(document).ready(function($) {

  // jquery notify settings.
  $("#jquery-notify-container").notify({
    speed: 500,
    expires: false
  });

  // SSE
  if (!!window.EventSource) {
    var serverURL = Drupal.settings.dennis_sse['server'];
    var source = new EventSource(serverURL);
  } else {
    // Result to xhr polling :(
    var err = 'Your browser is not compatible with HTML5. You wont be receiving deployment notifications. Please contact the dev team on which browser  upgrade to use. ';
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
