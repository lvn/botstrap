#!/usr/bin/env iojs

var program = require('commander'),
  fs = require('fs'),
  sequoria = require('sequoria'),
  createBot = require('./lib').createBot;

function main() {
  program
    .version(require('./package').version)
    .usage('[configFile]')
    .action(function(configFile){
      // this module is being directly run.
      var configFile = configFile || 'config.json';
      if (!configFile.startsWith('/')) {
        // hack: should use proper path joining package
        configFile = [
          process.cwd(),
          configFile
        ].join('/');
      }

      var config = JSON.parse(fs.readFileSync(configFile));
      var bot = createBot(config);
      bot.start();
    })
    .parse(process.argv);
}

if (require.main === module) {
  main();
}

module.exports = createBot;
