/**
 * Convert ether to wei
 *
 * @param {number} eth
 * @returns {string} string representation of weis
 */
function ether(eth) {
  return web3.utils.toWei(`${eth}`, "ether");
}

module.exports = ether;
