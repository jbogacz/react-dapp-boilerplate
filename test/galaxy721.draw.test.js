const { extractEventValue } = require("./helpers/events");
const bnChai = require("bn-chai");
const EVMRevert = require("./helpers/EVMRevert");
const ether = require("./helpers/ether");

require("chai").use(require("chai-as-promised")).use(require("chai-arrays")).use(bnChai(web3.utils.BN)).should();

const Galaxy721 = artifacts.require("Galaxy721");

contract("Galaxy721 - Draw", ([owner, investor1, investor2]) => {
  beforeEach(async () => {
    this.maxSupply = 10;
    this.drawValue = ether(0.1);
    this.freeDrawsCount = 2;
    this.token = await Galaxy721.new(this.maxSupply, this.drawValue, this.freeDrawsCount);
  });

  it("should revert for insufficient transaction value", async () => {
    const transactionValue = web3.utils.toWei("0.09", "ether");
    await this.token.draw({ value: transactionValue, from: investor1 }).should.be.rejectedWith(EVMRevert);
  });

  it("draw should increase total supply", async () => {
    const payment = web3.utils.toWei("0.1", "ether");
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });

    const totalSupply = await this.token.totalSupply();

    totalSupply.should.be.eq.BN(2);
  });

  it("should revert when draw after cap reached", async () => {
    const payment = web3.utils.toWei("0.1", "ether");
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 }).should.be.rejectedWith(EVMRevert);
  });

  it("should track token type and balance of owned by user", async () => {
    const payment = web3.utils.toWei("0.1", "ether");
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });
    await this.token.draw({ value: payment, from: investor1 });

    const userTokenCount = await this.token.ownedPlanetCount(investor1);
    userTokenCount.should.be.eq.BN(3);

    this.token.ownedPlanetClass(investor1, 0).should.be.fulfilled;
    this.token.ownedPlanetClass(investor1, 1).should.be.fulfilled;
    this.token.ownedPlanetClass(investor1, 2).should.be.fulfilled;
    this.token.ownedPlanetClass(investor1, 3).should.be.rejectedWith(EVMRevert);
  });

  it("should draw and emit event", async () => {
    const payment = web3.utils.toWei("0.1", "ether");

    const receipt = await this.token.draw.sendTransaction({ value: payment, from: investor1 });

    const planetId = extractEventValue.call(receipt, "Draw", "planetId");
    planetId.should.be.eq.BN(1);
  });

  it("should create contract with free draws to give away", async () => {
    const freeDrawsLeft = await this.token.drawsToGiveAway();
    freeDrawsLeft.should.be.eq.BN(this.freeDrawsCount);
  });

  it("should allow to assign free draws only to contract's owner", async () => {
    await this.token.giveAwayFreeDraws(investor2, 1, { from: investor2 }).should.be.rejectedWith(EVMRevert);
    await this.token.giveAwayFreeDraws(investor2, 1, { from: owner }).should.be.fulfilled;
  });

  it("should assign and allow free draw", async () => {
    const freeDraw = 1;
    await this.token.giveAwayFreeDraws(investor2, freeDraw, { from: owner });
    
    await this.token.draw({ from: investor2 }).should.be.fulfilled;
    const freeDrawsLeft = await this.token.drawsToGiveAway();
    freeDrawsLeft.should.be.eq.BN(this.freeDrawsCount - freeDraw);
    // no more free draws
    await this.token.draw({ from: investor2 }).should.be.rejectedWith(EVMRevert);
  });
});
