var botstrap = require('../../lib');

var bot = botstrap.createBot({
  token: 'TOKEN_HERE'
});
//
// // responds to any channel_joined events
// bot.on('channel_joined', function(channel, response) {
//   response.write('Hello' + channel.name + '!');
// });

// responds to any message beginning with !random
bot.command('random', function reverse(message, response) {
  response.write(Math.random());
});

// responds to any message beginning with !reverse or !esrever
bot.command(['reverse', 'esrever'], function reverse(message, response) {
  var payload = message.argv[1];
  response.write(payload.split('').reverse().join(''));
});

// responds to any message
bot.onMessage(function(message, response) {
  if (message.text === 'ping') {
    response.write('pong');
  }
});
//
// // responds to any message of subtype channel_join
// bot.onMessage('channel_join', function(message, response) {
//   response.write('Welcome ' + message.user.name + '!');
// });

bot.start();
