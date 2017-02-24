'use strict';

// HERE BE DRAGONS.
// I'm patching node-slack-sdk's `BaseChannel` because I can't find a nice way
// to subclass it (yet).

let BaseChannel = require('@slack/client/lib/models/base-channel');
let OutgoingMessage = require('./message').OutgoingMessage;
let Thread = require('./thread').Thread;

BaseChannel.prototype.threads = {};

BaseChannel.prototype.send = function(msg, cb) {
  let sentMessage = new OutgoingMessage(this.bot, this);
  sentMessage.end(msg);
  return sentMessage;
};

BaseChannel.prototype.addThread = function(ts, thread) {
  if (ts.__proto__ === Thread.prototype) {
    thread = ts;
    ts = thread.ts;
  }

  this.threads[ts] = thread;
};

BaseChannel.prototype.getThread = function(ts) {
  return this.threads[ts];
};
