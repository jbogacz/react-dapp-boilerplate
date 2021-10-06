const { expect } = require("chai");

/**
 * Returns emitted event value. If Emitted multiple events then returns all values as array.
 *
 * @param {string} eventName
 * @param {string} argName
 */
function extractEventValue(eventName, argName) {
  const events = this.logs.filter((e) => e.event === eventName);
  expect(events.length > 0).to.equal(true, `No '${eventName}' events found`);

  if (events.length == 1) {
    return events[0].args[argName];
  } else {
    throw "For multiple events not implemented yet";
  }
}

module.exports = {
  extractEventValue,
};
