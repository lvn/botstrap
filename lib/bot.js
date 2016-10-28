'use strict';

var Slack = require('@slack/client'),
  RtmClient = Slack.RtmClient,
  WebClient = Slack.WebClient,
  MemoryDataStore = Slack.MemoryDataStore,
  introject = require('introject'),
  relative = require('require-relative'),
  sequoria = require('sequoria'),
  uuid = require('uuid'),
  util = require('util'),
  truncate = require('truncate'),
  botstrapUtil = require('./util');

let CLIENT_EVENTS = Slack.CLIENT_EVENTS,
  RTM_EVENTS = Slack.RTM_EVENTS;

var constants = require('./constants'),
  Message = require('./message').Message,
  OutgoingMessage = require('./message').OutgoingMessage;

var _dispatchCommand = function _dispatchCommand(bot, context, message) {
  if (!message.text || !message.text.startsWith('!')) {
    return;
  }

  var text = message.text.slice(1);
  var words = text.split(' ');
  message.argv = context.argv = words;
  context.config = bot.configs[words[0]];
  bot.commands[words[0]] &&
    introject.injectDeps(bot.commands[words[0]], context)();
};

var Bot = function Bot(options) {
  this.client = this.rtm = new RtmClient(options.token, {
    logLevel: 'error',
    dataStore: new MemoryDataStore()
  });
  this.web = new WebClient(options.token);

  this.commands = {};
  this.services = {};
  this.configs = {};

  this.on(RTM_EVENTS.MESSAGE, _dispatchCommand);
};

var _mergeConfig = function _mergeConfig(cb, config) {
  return botstrapUtil.merge(cb.metadata, config);
};

Bot.prototype.on = function on(type, cb, config) {
  let _this = this;
  this.rtm.on(type, function() {
    // build a context. We will use this to inject dependencies.
    // bootstrap context with non event specific resources. can be injected
    // into any event.
    let datastore = _this.rtm.dataStore;

    // base context for injection.
    let baseContext = {
      bot: _this,
      client: _this.rtm,
      channels: datastore.channels,
      dms: datastore.dms,
      groups: datastore.groups,
      users: datastore.users,
      bots: datastore.bots,
      services: this.services,
      logger: sequoria
    };

    var context = util._extend(_this.services, baseContext);

    var mergedConfig = _mergeConfig(cb, config);
    var cbid = uuid.v4();
    _this.configs[cbid] = mergedConfig;
    var configs = _this.configs;

    if (typeof cb.setup === 'function') {
      var setupContext = botstrapUtil.merge(context, {
        config: configs[cbid]
      });
      introject.injectDeps(cb.setup, setupContext)();
    }

    // build an array out of the arguments to this callback
    var args = Array.apply(null, arguments);

    // match up the arguments to constants.eventArgs, and then add to context
    constants.eventArgs[type].forEach(function(argName) {
      var arg = args.shift();
      context[argName] = arg;
    });

    // do some sort of seminonunintelligent context inference here
    if (context.message) {
      // hack: let arbitrary callbacks access context.message.
      let _message = context.message;

      // HACK: add the "send" method to channel.
      // TODO: make this not hacky.
      if (typeof context.message.channel === 'string') {
        context.channel = datastore
          .getChannelGroupOrDMById(context.message.channel);
      }

      context.channel = Object.assign({}, context.channel, {
        send: (msg, cb) => {
          let sentMessage = new OutgoingMessage(_this, context.message.channel);
          sentMessage.end(msg);
          return sentMessage;
        }
      });

      context.user = _this.rtm.dataStore.users[context.message.user];

      // TODO: connect these two in a single conversation/thread
      context.message = new Message(_this, context.message);
      context.response = new OutgoingMessage(_this, context.channel);
    }

    // add the context itself as a dependency!
    context.context = context;

    // add config as dependency.
    context.config = configs[cbid];

    // wrap in try block so stray plugin errors don't crash the entire bot
    try {
      // finally, inject stuff from our context to the callback, and run it
      introject.injectDeps(cb, context)();
    } catch (e) {
      // log the error
      sequoria.error(e.stack);

      // TODO: this is breaking the framework, fix.
      // _this.rtm.emit('throw', e);
    }

    // if the callback put data into the response, send it.
    // TODO: somehow try to fix this for async callbacks.
    context.response.body && context.response.end();
  });

  return this;
};

Bot.prototype.onMessage = function onMessage(subtype, cb, config) {
  if (typeof subtype === 'function') {
    config = cb;
    cb = subtype;
    subtype = null;
  };

  return this.on(RTM_EVENTS.MESSAGE, function(context, message) {
    if (message.subtype === subtype || !subtype) {
      introject.injectDeps(cb, context)();
    }
  }, _mergeConfig(cb, config));
};

Bot.prototype.match = function match(pattern, cb, config) {
  return this.onMessage(function(context, message) {
    var match;
    if (match = pattern.exec(message.text)) {
      // inject the match into the context
      context.match = match;
      introject.injectDeps(cb, context)();
    }
  }, _mergeConfig(cb, config));
};

Bot.prototype.command = function command(name, cb, config) {
  // construct a hashset of the command names.
  var names = Array.isArray(name) ? name : [name];
  var commands = this.commands;
  var mergedConfig = _mergeConfig(cb, config);
  var configs = this.configs;
  names.forEach(function(name) {
    commands[name] = cb;
    configs[name] = mergedConfig;
  });

  // perform setup on the command
  if (typeof cb.setup === 'function') {
    var setupContext = botstrapUtil.merge(this.context,
      botstrapUtil.merge(this.services, {
        config: mergedConfig
      }));
    introject.injectDeps(cb.setup, setupContext)();
  }

  return this;
};

Bot.prototype.start = function start() {
  sequoria.log('Connecting...');
  this.rtm.start();

  this.rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
    sequoria.log('Connected!');
  });

  this.rtm.on(CLIENT_EVENTS.RTM.ATTEMPTING_RECONNECT, () => {
    sequoria.log('Attempting to reconnect...')
  });

  this.rtm.on(CLIENT_EVENTS.RTM.DISCONNECT, () => {
    sequoria.log('Disconnected! Exiting...');
    process.exit();
  });

  return this;
};

Bot.prototype.service = function service(name, initFn, config) {
  var context = util._extend(this.services, this.baseContext);
  context.config = _mergeConfig(initFn, config);
  var service = introject.injectDeps(initFn, context)();
  this.services[name] = service;
  this.configs[name] = context.config;
  return this;
};

Bot.prototype.importBundle = function importBundle(bundle, config) {
  (typeof bundle === 'string') && (bundle = relative(bundle));
  bundle(this, config);
  return this;
};

Bot.prototype.catch = function(cb, config) {
  return this.on('throw', cb, _mergeConfig(cb, config));
};

Bot.prototype.rawSendMessage = function(msg, channel, cb) {
  sequoria.log(
    `Sending message to ${channel.name || channel.id}: "${truncate(msg, 20)}"`);
  this.rtm.sendMessage(msg, channel.id, cb);
}

module.exports = Bot;
