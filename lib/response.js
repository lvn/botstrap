'use strict';

var exports = module.exports = {};

var Response = exports.Response = function Response(channel) {
  this.channel = channel;
  this.data = '';
  this.sent = false;
};

Response.prototype.write = function write(data) {
  this.data += data;
};

Response.prototype.end = function end(data) {
  if (!this.sent) {
    this.data += (data || '');
    (this.data.length > 0) && this.channel.send(this.data);
    this.sent = true;
  }
};

Response.prototype.random = function random(arr) {
  var data = arr[Math.floor(arr.length * Math.random())]
  this.end(data);
};

exports.response = Response;
