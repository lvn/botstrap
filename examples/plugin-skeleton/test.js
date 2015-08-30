'use strict';

// By far the most simplest way to test Botstrap plugins
// is just by mocking out the API the plugin needs, and
// then manually injecting them into the plguin call in the
// unit test.
// This is an example of this pattern.


var expect = require('chai').expect,
  cmd = require('./');


describe('cmd', function testCmd() {
  it('works', function() {

    // Mock all the plugin dependencies.
    var mockArgv = ['cmd', 'foo', 'bar', 'baz'];
    var mockResponseObj = {
      end: function mockResponseEnd(text) {
        expect(text).to.equal('baz bar foo');
      }
    };

    // Simulate calling the plugin by passing the
    // mocked dependencies.
    cmd(mockArgv, mockResponseObj);
  });
});
