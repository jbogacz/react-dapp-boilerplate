const { expectEvent, BN } = require("@openzeppelin/test-helpers");
const { extractEventValue } = require("./helpers/events");
const bnChai = require("bn-chai");
const EVMRevert = require("./helpers/EVMRevert");
const ether = require("./helpers/ether");
const { assert, expect } = require("chai");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");

require("chai").use(require("chai-as-promised")).use(require("chai-arrays")).use(bnChai(web3.utils.BN)).should();

const Galaxy721 = artifacts.require("Galaxy721");

contract("Galaxy721 - Bids", ([_, investor1, investor2, investor3]) => {
  beforeEach(async () => {
    this.maxSupply = 10;
    this.drawValue = ether(0.1);
    this.freeDrawsCount = 2;
    this.token = await Galaxy721.new(this.maxSupply, this.drawValue, this.freeDrawsCount);
  });

  it("should revert when placed bid for planet that is not offered for sale", async () => {
    this.token.placeBid(1, { from: investor2 }).should.be.rejectedWith(EVMRevert);

    const drawTx = await this.token.draw.sendTransaction({ value: this.drawValue, from: investor1 });
    const planetId = extractEventValue.call(drawTx, "Draw", "planetId");
    this.token.placeBid(planetId, { from: investor2 }).should.be.rejectedWith(EVMRevert);
  });

  it("should revert when placed bid with value less then minValue", async () => {
    const minBidValue = 0.2;
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(minBidValue));

    this.token.placeBid(planetId, { from: investor2, value: ether(0.19) }).should.be.rejectedWith(EVMRevert);
  });

  it("should place a bid", async () => {
    const bidValue = ether(0.21);
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));

    const placedBidTx = await this.token.placeBid(planetId, { from: investor2, value: bidValue });

    expectEvent(
      placedBidTx,
      "PlaceBid",
      (eventArgs = { bidder: investor2, planetId: new BN(planetId), value: new BN(bidValue) })
    );
  });

  it("should reject when get not existing bid", async () => {
    const unknownPlanetId = 101;
    this.token.bid(unknownPlanetId).should.be.rejectedWith(EVMRevert);
  });

  it("should place and return bid", async () => {
    const bidValue = ether(0.21);
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));
    await this.token.placeBid(planetId, { from: investor2, value: bidValue });

    const bid = await this.token.bid(planetId);

    assert.equal(bid.bidder, investor2);
    assert.equal(bid.value, bidValue);
  });

  it("should revert when placed bid with value less then current highest bid", async () => {
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));
    await this.token.placeBid(planetId, { from: investor2, value: ether(0.3) });

    this.token.placeBid(planetId, { from: investor3, value: ether(0.25) }).should.be.rejectedWith(EVMRevert);
  });

  it("should revert when bidder has already highest bid", async () => {
    const planetId = 1;
    await this.token.draw({ value: ether(0.1), from: investor1 });
    await this.token.offerForSale(planetId, ether(0.2), { from: investor1 });
    await this.token.placeBid(planetId, { from: investor2, value: ether(0.3) });

    this.token.placeBid(planetId, { from: investor2, value: ether(0.35) }).should.be.rejectedWith(EVMRevert);
  });

  it("should outbid with higher bid value", async () => {
    const lowerBid = ether(0.32);
    const higherBid = ether(0.33);
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));

    await this.token.placeBid(planetId, { from: investor2, value: lowerBid });
    const bidTx = await this.token.placeBid(planetId, { from: investor3, value: higherBid });
    const highestBid = await this.token.bid(planetId);

    assert.equal(highestBid.bidder, investor3);
    assert.equal(highestBid.value, higherBid);
    expectEvent(
      bidTx,
      "OfferOutbidded",
      (eventArgs = {
        planetId: planetId,
        bidder: investor3,
        value: new BN(higherBid),
        prevBidder: investor2,
        prevValue: new BN(lowerBid),
      })
    );
  });

  it("should add money to pendingWithdrawals when highest bid is topped", async () => {
    const lowerBid = ether(0.32);
    const higherBid = ether(0.33);
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));
    await this.token.placeBid(planetId, { from: investor2, value: lowerBid });
    await this.token.placeBid(planetId, { from: investor3, value: higherBid });

    const beforeWithdraw = await web3.eth.getBalance(investor2);
    const withdrawTx = await this.token.withdraw({ from: investor2 });
    const afterWithdraw = await web3.eth.getBalance(investor2);

    assert.isTrue(afterWithdraw > beforeWithdraw);
    expectEvent(withdrawTx, "Withdrawn", (eventArgs = { from: investor2, value: new BN(lowerBid) }));
  });

  it("should revert when accept bid for planet that was not offered yet", async () => {
    const drawTx = await this.token.draw.sendTransaction({ value: this.drawValue, from: investor1 });
    const planetId = extractEventValue.call(drawTx, "Draw", "planetId");

    this.token.acceptBid(planetId, { from: investor1 }).should.be.rejectedWith(EVMRevert);
  });

  it("should revert when accept offer that doesn't have winning bid", async () => {
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));

    this.token.acceptBid(planetId, { from: investor1 }).should.be.rejectedWith(EVMRevert);
  });

  it("should revert when accepted bid for not owned planet", async () => {
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));
    await this.token.placeBid(planetId, { from: investor2, value: ether(0.2) });

    this.token.acceptBid(planetId, { from: investor3 }).should.be.rejectedWith(EVMRevert);
  });

  it("should accept bid and make approval", async () => {
    const bidValue = 0.2;
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));
    const initialOwner = await this.token.ownerOf(planetId);
    const initialBalance = await web3.eth.getBalance(investor1);
    await this.token.placeBid(planetId, { from: investor2, value: ether(bidValue) });

    const acceptBidTx = await this.token.acceptBid(planetId, { from: investor1 });

    // token was transferred to new owner
    const currentOwner = await this.token.ownerOf(planetId);
    assert.isTrue(initialOwner != currentOwner);
    assert.equal(currentOwner, investor2);

    // Planet seller received reward
    await this.token.withdraw({ from: investor1 });
    const afterWithdrawBalance = await web3.eth.getBalance(investor1);
    assert.isTrue(afterWithdrawBalance > initialBalance);

    // Emitted corresponding event
    expectEvent(
      acceptBidTx,
      "AcceptBid",
      (eventArgs = { planetId: new BN(planetId), from: investor1, to: investor2, value: ether(bidValue) })
    );
  });

  it("should recall offer and allow bidder to withdraw offered money", async () => {
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));
    const balanceBeforeBid = await web3.eth.getBalance(investor2);
    await this.token.placeBid(planetId, { from: investor2, value: ether(0.2) });
    const balanceAfterBid = await web3.eth.getBalance(investor2);

    this.token.recallOffer(planetId, { from: investor1 }).should.be.fulfilled;

    await this.token.withdraw({ from: investor2 });
    const balanceAfterWithdraw = await web3.eth.getBalance(investor2);
    assert.isTrue(balanceBeforeBid > balanceAfterWithdraw, "balanceBeforeBid must be gt balanceAfterWithdraw");
    assert.isTrue(balanceAfterWithdraw > balanceAfterBid, "balanceAfterWithdraw must be gt balanceAfterBid");
    await this.token.activeOffer(planetId).should.be.rejectedWith(EVMRevert);
  });

  it("should reject when recall not owned planet offer", async () => {
    const planetId = await _drawAndOfferForSale.call(this, investor1, ether(0.2));
    await this.token.recallOffer(planetId, {from: investor2}).should.be.rejectedWith(EVMRevert);
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
