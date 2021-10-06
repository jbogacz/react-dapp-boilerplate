const { expectEvent, BN } = require("@openzeppelin/test-helpers");
const { extractEventValue } = require("./helpers/events");
const bnChai = require("bn-chai");
const EVMRevert = require("./helpers/EVMRevert");
const ether = require("./helpers/ether");
const { expect } = require("chai");

require("chai").use(require("chai-as-promised")).use(require("chai-arrays")).use(bnChai(web3.utils.BN)).should();

const Galaxy721 = artifacts.require("Galaxy721");

contract("Galaxy721 - Offers", ([_, investor1, investor2]) => {
  beforeEach(async () => {
    this.maxSupply = 10;
    this.drawValue = web3.utils.toWei("0.1", "ether");
    this.freeDrawsCount = 2;
    this.token = await Galaxy721.new(this.maxSupply, this.drawValue, this.freeDrawsCount);
  });

  it("should place offer and emit event", async () => {
    const payment = web3.utils.toWei("0.1", "ether");
    const minOfferValue = web3.utils.toWei("0.2", "ether");
    const planetTx = await this.token.draw.sendTransaction({ value: payment, from: investor1 });
    const planetId = extractEventValue.call(planetTx, "Draw", "planetId");

    const offerTx = await this.token.offerForSale(planetId.toNumber(), minOfferValue, { from: investor1 });

    expectEvent(
      offerTx,
      "PlaceOffer",
      (eventArgs = { from: investor1, planetId: planetId, minValue: new BN(minOfferValue) })
    );
  });

  it("should revert when offered same planet for second time", async () => {
    const draw = await this.token.draw({ value: ether(0.1), from: investor1 });
    const planetId = extractEventValue.call(draw, "Draw", "planetId");

    this.token.offerForSale(planetId.toNumber(), ether(0.2), { from: investor1 }).should.be.fulfilled;
    this.token.offerForSale(planetId.toNumber(), ether(0.2), { from: investor1 }).should.be.rejectedWith(EVMRevert);
  });

  it("should return all active offers", async () => {
    const minValue = web3.utils.toWei("0.2", "ether");
    const payment = web3.utils.toWei("0.1", "ether");
    const planetTx1 = await this.token.draw.sendTransaction({ value: payment, from: investor1 });
    const planetTx2 = await this.token.draw.sendTransaction({ value: payment, from: investor1 });
    const planetId1 = extractEventValue.call(planetTx1, "Draw", "planetId");
    const planetId2 = extractEventValue.call(planetTx2, "Draw", "planetId");
    await this.token.offerForSale(planetId1.toNumber(), minValue, { from: investor1 });
    await this.token.offerForSale(planetId2.toNumber(), minValue, { from: investor1 });

    const activeOffers = await this.token.activeOffers();
    activeOffers.should.be.ofSize(2);
  });

  it("should revert when offered not owned planet", async () => {
    const drawTx = await this.token.draw.sendTransaction({ value: this.drawValue, from: investor1 });
    const planetId = extractEventValue.call(drawTx, "Draw", "planetId");

    this.token.offerForSale(planetId.toNumber(), ether(0.2), { from: investor2 }).should.be.rejectedWith(EVMRevert);
  });
});

/**
 *
 * @param {string} investor
 * @param {string} minOfferValue string representation of weis
 * @returns
 */
async function _drawAndOfferForSale(investor, minOfferValue) {
  const drawTx = await this.token.draw.sendTransaction({ value: this.drawValue, from: investor });
  const planetId = extractEventValue.call(drawTx, "Draw", "planetId");
  await this.token.offerForSale(planetId.toNumber(), minOfferValue, { from: investor });
  return planetId;
}
