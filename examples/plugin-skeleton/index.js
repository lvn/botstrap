'use strict';

// This is the entry point of the command.
// Botstrap's dependency injection will automatically pass arguments
// when calling this, by matching the parameter names to objects in the
// event-specific context.
var cmd = function(argv, response) {
  response.end(argv.slice(1).reverse().join(' '));
};


// Convention for supplying metadata with the plugin. 
cmd.metadata = {
  name: 'cmd',
  type: 'command',
  command: ['reverse', 'r'],
  info: {
    description: 'Example command.',
    usage: 'reverse [arguments...]'
  }
}

// The entry point is exposed directly so that it can be
// simply require()d when integrating it.
module.exports = cmd;
