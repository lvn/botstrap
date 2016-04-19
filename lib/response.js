
var lfmt = require('lfmt'),
  constants = require('./constants');

var Response = exports.Response = function Response(channel) {
  this.channel = channel;
  this.data = '';
  this.sent = false;
};

Response.prototype.write = function write(data) {
  if (this.data.length < constants.msgMaxLen - data.length) {
    this.data += data;
  }
};

Response.prototype.writef = function writef(data, context) {
  this.write(lfmt.format(data, context));
};

Response.prototype.end = function end(data) {
  data && this.write(data);

  if (!this.sent) {
    (this.data.length > 0) && this.channel.send(this.data);
    this.sent = true;
  }
};

Response.prototype.endf = function endf(data, context) {
  this.writef(data, context);
  this.end();
};

Response.prototype.random = function random(arr) {
  var data = arr[Math.floor(arr.length * Math.random())]
  this.end(data);
};

exports.response = Response;
