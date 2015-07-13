'use strict';

var exports = module.exports = {};

class Response {
  constructor(channel) {
    this.channel = channel;
    this.data = '';
    this.sent = false;
  }

  write(data) {
    this.data += data;
  }

  end(data) {
    if (!this.sent && data) {
      this.data += data;
      this.channel.send(this.data);
      this.sent = true;
    }
  }

  random(arr) {
    var data = arr[Math.floor(arr.length * Math.random())]
    this.end(data);
  }
}

exports.response = Response;
