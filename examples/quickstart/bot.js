var botstrap = require('../../lib');

var bot = botstrap.createBot({
  token:
});

// responds to any message beginning with !reverse or !esrever
bot.command(['reverse', 'esrever'], function reverse(message, response) {
  var payload = message.argv[1];
  payload && response.write(payload.split('').reverse().join(''));
});

// responds to any message beginning with !random
bot.command('random', function random(message, response) {
  response.write(Math.random());
});

// responds to any message
bot.onMessage(function(message, response) {
  if (message.text === 'ping') {
    response.write('pong');
  }
});

bot.start();
