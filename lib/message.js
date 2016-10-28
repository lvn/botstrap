'use strict';

let NotImplementedError = require('./constants').NotImplementedError;
let RTM_EVENTS = require('@slack/client').RTM_EVENTS;
let util = require('./util');
let lfmt = require('lfmt');

/*
A message is the most common event in a conversation.

Legacy stuff: The 'response' injected object used to be of a Response
type, but has been replaced with Message, which is a more generalized
abstraction.

In the standard use case, there shouldn't really be a need to manually
construct instances of these types, since the bot should automatically
build and inject them to callbacks.
*/

class Message {
  constructor(bot, message) {
    this.bot = bot;

    if (message) {
      this.sent = true;
      this.body = message.text;

      // deal with some event jankiness
      if (typeof message.channel === 'string') {
        this.channel = bot.rtm.dataStore.
          getChannelGroupOrDMById(message.channel);
      } else {
        this.channel = message.channel;
      }

    } else {
      this.sent = false;
      this.body = '';
    }

    this.reactions = [];
    this.reactionSubscribers = [];
    this.reactionBuffer = [];

    // single callback for subscriptions
    this.bot.on(RTM_EVENTS.REACTION_ADDED, (reaction, context) => {
      if (this.message &&
        reaction.item.channel === this.message.channel.id &&
        reaction.item.ts === this.message.ts) {

        this.reactions.push(reaction);

        // notify subscribers
        this.reactionSubscribers.forEach(cb =>
          introject.injectDeps(cb, context)());
      }
    });
  }

  // legacy alias
  get text() {
    return this.body;
  }

  write(data) {
    this.body += data;
    return this;
  }

  end(data, cb) {
    if (data) {
      this.write(data);
    } else {  // accept cb in first argument
      cb = data;
    }

    if (this.sent) {
      cb && cb(this);
      return;
    }
    else if (this.body.length > 0) {
      this.sent = true;
      this.bot.rawSendMessage(this.body, this.channel, (err, message) => {
        if (err) {
          this.sent = false;
        } else {
          this._message = message;

          // clear reactionBuffer
          this.reactionBuffer.forEach((rxn) => {
            this.react(rxn);
          });
          this.reactionBuffer = [];
        }

        cb && cb(err, this);
      });
    }
    return this;
  }

  endf(template, context, cb) {
    this.end(lfmt.format(template, context), cb);
  }

  random(arr, cb) {
    if (arr.length > 0) {
      this.write(util.sample(arr));
    }
    return this;
  }

  react(reaction) {
    if (this._message) {
      this.bot.web.reactions.add(reaction, {
        channel: this._message.channel,
        timestamp: this._message.ts
      });
    }
    else {
      this.reactionBuffer.push(reaction);
    }

    return this;
  }

  onReact(cb) {
    this.reactionSubscribers.push(cb);
    return this;
  }
}
exports.Message = Message;

/*
OutgoingMessage is used to provide a "future" type of sorts, for a message.
What this means is that you can do things like set callbacks on your message
before it's sent (and the underlying Slack API populates it with actual info).

OutgoingMessage is supposed to replace the old `Response` type, and currently
works as a drop-in replacement (i.e. in the injection step), but is not
currently 100% API compatible. I might not reimplement the old formatted
methods, e.g. `writef` and `endf`.

The current implementation is a bit hacky. Since most of the "deferred
processing" functionality resides in the superclass, OutgoingMessage is mostly
just a very thin wrapper that sets the channel.
*/
class OutgoingMessage extends Message {
  constructor(bot, channel) {
    super(bot);

    // can accept channel as string.
    if (typeof channel === 'string') {
      this.channel = bot.rtm.getChannelGroupOrDMById(channel);
    } else {
      this.channel = channel;
    }
  }
}
exports.OutgoingMessage = OutgoingMessage;
