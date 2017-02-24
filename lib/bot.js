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

require('./channel');

let CLIENT_EVENTS = Slack.CLIENT_EVENTS,
  RTM_EVENTS = Slack.RTM_EVENTS;

var constants = require('./constants'),
  Message = require('./message').Message,
  OutgoingMessage = require('./message').OutgoingMessage,
  Thread = require('./thread').Thread;

var _dispatchCommand = function _dispatchCommand(bot, context, message) {
  if (!message.text || !message.text.startsWith('!')) {
    return;
  }

  var text = message.text.slice(1);
  var words = text.split(' ');
  message.argv = context.argv = words;
  context.config = bot.configs[words[0]];
  bot.commands[words[0]] &&
    bot.injectedInvoke(bot.commands[words[0]], context);
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

Bot.prototype.getBaseContext = function() {
  let datastore = this.rtm.dataStore;

  // base context for injection.
  let baseContext = {
    bot: this,
    channels: datastore.channels,
    dms: datastore.dms,
    groups: datastore.groups,
    users: datastore.users,
    bots: datastore.bots,
    services: this.services,
    logger: sequoria,
    _rtm: this.rtm,
    _datastore: datastore,
    _web: this.web
  };

  return Object.assign({}, this.services, baseContext);
}

// Invoke the fn, injecting the data
Bot.prototype.injectedInvoke = function injectedInvoke(fn, context) {
  if (typeof fn !== 'function') {
    return;
  }

  let fnArgs = introject.argNames(fn);
  let fullContext = Object.assign({}, this.getBaseContext(), context);

  let missingDeps = fnArgs.filter((arg) => (typeof fullContext[arg] === 'undefined'));
  if (missingDeps.length) {
    sequoria.warn(`Failed to find these dependencies, so they will be undefined: ${missingDeps}`);
  }

  return introject.injectDeps(fn, fullContext)();
}

Bot.prototype.on = function on(type, cb, config) {
  let _this = this;
  this.rtm.on(type, function() {
    // build a context. We will use this to inject dependencies.
    // bootstrap context with non event specific resources. can be injected
    // into any event.
    let datastore = _this.rtm.dataStore;
    let context = _this.getBaseContext();

    // pretty sure this is causing a memory leak.
    // TODO: once we have proper module naming in place, kill this.
    var mergedConfig = _mergeConfig(cb, config);
    var cbid = uuid.v4();
    _this.configs[cbid] = mergedConfig;
    var configs = _this.configs;

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

      if (typeof context.message.channel === 'string') {
        context.channel = datastore
          .getChannelGroupOrDMById(context.message.channel);
      }
      context.channel.bot = _this;


      context.message = new Message(_this, context.message, context.channel);
      context.response = new OutgoingMessage(_this, context.channel);
      context.user = _this.rtm.dataStore.users[context.message.user];

      let threadTs = _message.thread_ts || _message.ts;
      if (context.channel.threads[threadTs]) {
        context.thread = context.channel.threads[threadTs];
      } else {
        context.thread = new Thread(_this, context.channel, threadTs);
        context.thread.push(context.message);
      }

      if (_message.thread_ts) {
        context.channel.addThread(context.thread);
      }

      context.message.setThread(context.thread);
      context.response.setThread(context.thread);
    }

    // add the context itself as a dependency!
    context.context = context;

    // add config as dependency.
    context.config = configs[cbid];

    // wrap in try block so stray plugin errors don't crash the entire bot
    try {
      // finally, inject stuff from our context to the callback, and run it
      _this.injectedInvoke(cb, context);
    } catch (e) {
      // log the error
      sequoria.error(e.stack);

      // TODO: this is breaking the framework, fix.
      // _this.rtm.emit('throw', e);
    }

    // if the callback put data into the response, send it.
    // TODO: somehow try to fix this for async callbacks.
    context.response && context.response.body && context.response.end();
  });

  return this;
};

Bot.prototype.onMessage = function onMessage(subtype, cb, config) {
  if (typeof subtype === 'function') {
    config = cb;
    cb = subtype;
    subtype = null;
  };

  return this.on(RTM_EVENTS.MESSAGE, function(context, bot, message) {
    if (message.subtype === subtype || !subtype) {
      bot.injectedInvoke(cb, context);
    }
  }, _mergeConfig(cb, config));
};

Bot.prototype.match = function match(pattern, cb, config) {
  return this.onMessage(function(context, bot, message) {
    var match;
    if (match = pattern.exec(message.text)) {
      // inject the match into the context
      context.match = match;
      bot.injectedInvoke(cb, context);
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
  // HACK: only call once by checking the "called" property on cb.
  // TODO: when we convert all commands to new style, remove this.
  if (typeof cb.setup === 'function' && !cb.setup.called) {
    var setupContext = botstrapUtil.merge(this.context,
      botstrapUtil.merge(this.services, {
        config: mergedConfig
      }));
    this.injectedInvoke(cb.setup, setupContext);
    cb.setup.called = true;
  }

  return this;
};

Bot.prototype.start = function start() {
  sequoria.log('Connecting...');
  this.rtm.start();

  this.rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
    sequoria.log('Connected!');
  });

  this.rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
    this.self = this.rtm.dataStore.getUserById(rtmStartData.self.id);
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
  var service = this.injectedInvoke(initFn, context);
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

Bot.prototype.rawSendMessage = function(msg, cb) {
  let channel = msg.channel;
  sequoria.log(
    `Sending message to ${channel.name || channel.id} (Thread ${msg.thread.ts}): "${truncate(msg.body, 20)}"`);

  return this.rtm.send({
    text: msg.body,
    channel: channel.id,
    thread_ts: msg.thread && msg.thread.ts,
    type: RTM_EVENTS.MESSAGE
  }, cb);
};

module.exports = Bot;
