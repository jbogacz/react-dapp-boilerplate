const Galaxy721 = artifacts.require("Galaxy721");

module.exports = async function (deployer) {
  const tokensCap = 2000;
  const freeDrawsCount = 200;
  const drawValue = web3.utils.toWei("0.1", "ether");
  await deployer.deploy(Galaxy721, tokensCap, drawValue, freeDrawsCount);
};
