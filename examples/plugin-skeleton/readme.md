# Simple Plugin Skeleton

Annotated example of a Botstrap plugin, a simple command that reverses arguments passed to it.

### Files
* `index.js` is the entry point of the plugin. The convention is to export the module such that Botstrap can directly `require()` the plugin module to register it with the bot.
* `test.js` contains the Mocha unit tests for the plugin, and demonstrates unit testing Botstrap plugins by injecting mocked dependencies.
* `config.json` is an example testing config. It's common to test your plugin on Slack by running it as a separate bot, and the barebones test bot config allows developers to livetest the plugin simply by running the command `botstrap`.
