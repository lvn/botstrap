'use strict';

var SlackClient = require('slack-client'),
  introject = require('introject'),
  relative = require('require-relative'),
  sequoria = require('sequoria'),
  util = require('util');

var constants = require('./constants'),
  Response = require('./response').Response;


var Bot = function Bot(options) {
  this.client = new SlackClient(options.token);

  this.commands = {};
  this.services = {};

  // base context for injection.
  this.baseContext = {
    bot: this,
    client: this.client,
    channels: this.client.channels,
    dms: this.client.dms,
    groups: this.client.groups,
    users: this.client.users,
    bots: this.client.bots,
    services: this.services,
    logger: sequoria
  };
};

Bot.prototype.on = function on(type, cb) {
  // build a context. We will use this to inject dependencies.
  // bootstrap context with non event specific resources. can be injected
  // into any event.
  var context = util._extend(this.services, this.baseContext);
  var response;

  var _this = this;

  this.client.on(type, function() {
    // build an array out of the arguments to this callback
    var args = Array.apply(null, arguments);

    // match up the arguments to constants.eventArgs, and then add to context
    constants.eventArgs[type].forEach(function(argName) {
      var arg = args.shift();
      context[argName] = arg;
    });

    // do some sort of seminonunintelligent context inference here
    if (context.message) {
      context.channel = context.client.getChannelGroupOrDMByID(context.message.channel);
      context.user = context.client.getUserByID(context.message.user);

      // TODO: don't construct response inside this if-block.
      response = new Response(context.channel);
    }

    // now, add our own deps
    context.response = response;

    // add the context itself as a dependency!
    context.context = context;

    // wrap in try block so stray plugin errors don't crash the entire bot
    try {
      // finally, inject stuff from our context to the callback, and run it
      introject.injectDeps(cb, context)();
    } catch (e) {
      // log the error
      sequoria.error(e);
      _this.client.emit('throw', e);
    }

    // if the callback put data into the response, send it.
    // TODO: somehow try to fix this for async callbacks.
    context.response.data && context.response.end();
  });

  return this;
};

Bot.prototype.onMessage = function onMessage(subtype, cb) {
  if (typeof subtype === 'function') {
    cb = subtype;
    subtype = null;
  };

  return this.on('message', function(context, message) {
    if (message.subtype === subtype || !subtype) {
      introject.injectDeps(cb, context)();
    }
  });
};

Bot.prototype.match = function match(pattern, cb) {
  return this.onMessage(function(context, message) {
    var match;
    if (match = pattern.exec(message.text)) {
      // inject the match into the context
      context.match = match;
      introject.injectDeps(cb, context)();
    }
  });
};

Bot.prototype.command = function command(name, cb) {
  // construct a hashset of the command names.
  var names = Array.isArray(name) ? name : [name];
  var commands = this.commands;
  names.forEach(function(name) {
    commands[name] = cb;
  });


  return this.onMessage(function(context, message) {
    if (message.text && message.text.startsWith('!')) {
      message.text = message.text.slice(1);
    }
    else {
      return;
    }

    var words = message.text.split(' ');
    message.argv = context.argv = words;
    commands[words[0]] && introject.injectDeps(commands[words[0]], context)();
  });
};

Bot.prototype.start = function start() {
  this.client.login();
  return this;
};

Bot.prototype.service = function service(name, initFn) {
  this.services[name] = introject.injectDeps(initFn, this.baseContext)();
  return this;
};

Bot.prototype.importBundle = function importBundle(bundle, config) {
  (typeof bundle === 'string') && (bundle = relative(bundle));
  bundle(this, config);
  return this;
};

Bot.prototype.catch = function(cb) {
  return this.on('throw', cb);
};

module.exports = Bot;
