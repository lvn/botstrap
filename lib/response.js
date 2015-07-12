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
}

exports.response = Response;
