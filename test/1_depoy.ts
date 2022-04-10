const { expect } = require("chai");
const { artifacts ,ethers } = require("hardhat");

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { it } from "mocha";
import type { Accessories } from "../typechain/Accessories"
import type { Token } from "../typechain/Token"
import type { ERC20BalanceTierFactory } from "../typechain/ERC20BalanceTierFactory"
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier"

import { eighteenZeros, op, Opcode, Rarity, concat, VMState, getEventArgs } from "./utils"
import { Contract } from "ethers";

const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros)
); // [1,2,3,4,5,6,7,8]

export let accessories: Accessories
export let USDT: Token
export let BNB: Token
export let SOL: Token
export let XRP: Token
export let rTKN: Token

export let erc20BalanceTier: ERC20BalanceTier

export let owner: SignerWithAddress,
  creator: SignerWithAddress,
  creator2: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress

before("Deploy Accessories Contract and subgraph", async function () {
  const signers = await ethers.getSigners();

  owner = signers[0];
  creator = signers[1];
  creator2 = signers[2];
  buyer1 = signers[3];
  buyer2 = signers[4];
  
  const Accessories = await ethers.getContractFactory("Accessories");
  accessories = await Accessories.deploy();
  await accessories.deployed();

  const Erc20 = await ethers.getContractFactory("Token");
  
  USDT = await Erc20.deploy("Tether", "USDC");
  await USDT.deployed();
  BNB = await Erc20.deploy("Binance", "BNB");
  await BNB.deployed();
  SOL = await Erc20.deploy("Solana", "SOL");
  await SOL.deployed();
  XRP = await Erc20.deploy("Ripple", "XRP");
  await XRP.deployed();

  rTKN = await Erc20.deploy("Rain Token", "rTKN");
  await rTKN.deployed()

  const erc20BalanceTierFactoryFactory = await ethers.getContractFactory("ERC20BalanceTierFactory");
  const erc20BalanceTierFactory = (await erc20BalanceTierFactoryFactory.deploy()) as ERC20BalanceTierFactory & Contract;
  await erc20BalanceTierFactory.deployed()

  const tx = await erc20BalanceTierFactory.createChildTyped({
    erc20: rTKN.address,
    tierValues: LEVELS
  });

  erc20BalanceTier = new ethers.Contract(
    ethers.utils.hexZeroPad(
      ethers.utils.hexStripZeros(
        (await getEventArgs(tx, "NewChild", erc20BalanceTierFactory)).child
      ),
      20
    ),
    (await artifacts.readArtifact("ERC20BalanceTier")).abi,
    owner
  ) as ERC20BalanceTier & Contract;

  await erc20BalanceTier.deployed();
})

describe("Accessories Test", function () {
  it("Contract should be deployed.", async function () {
    expect(accessories.address).to.be.not.null;
    expect(await accessories.owner()).to.equals(owner.address);
  });

  it("Should deploy all tokens", async function () {
    expect(USDT.address).to.be.not.null;
    expect(BNB.address).to.be.not.null;
    expect(SOL.address).to.be.not.null;
    expect(XRP.address).to.be.not.null;
    // console.log(USDT.address, BNB.address, SOL.address, XRP.address)
  });

  it("Should add creator",async function () {
    await accessories.connect(owner).addCreator(creator.address);
    await accessories.connect(owner).addCreator(creator2.address);

    let expected_creator = await accessories.getCreators()
    expect(expected_creator).to.deep.include(creator.address);
    expect(expected_creator).to.deep.include(creator2.address);
  });

  it("Should create Item from creator.", async function () {

    const expectedUSDTPrice = ethers.BigNumber.from("1" + eighteenZeros);
    const expectedBNBPrice = ethers.BigNumber.from("25" + eighteenZeros);
    const expectedSOLPrice = ethers.BigNumber.from("50" + eighteenZeros);
    const expectedXRPPrice = ethers.BigNumber.from("75" + eighteenZeros);

    const constants = [expectedUSDTPrice, expectedBNBPrice, expectedSOLPrice, expectedXRPPrice];
    const USDTPriceIndex = concat([op(Opcode.VAL, 0)]);
    const BNBPriceIndex = concat([op(Opcode.VAL, 1)]);
    const SOLPriceIndex = concat([op(Opcode.VAL, 2)]);
    const XRPPriceIndex = concat([op(Opcode.VAL, 3)]);

    const sources = [USDTPriceIndex, BNBPriceIndex, SOLPriceIndex, XRPPriceIndex];

    const priceConfig: VMState = {
      sources,
      constants,
      stackLength: 4,
      argumentsLength: 0,
    };

    const currencies = [USDT.address, BNB.address, SOL.address, XRP.address]
    await accessories.createClass(["A", "B"]);

    const canMintConstants = [ erc20BalanceTier.address ]

    const TierAddressOP = op(Opcode.VAL, 0)
    const SenderOP = op(Opcode.SENDER)
    const ReportOP = op(Opcode.REPORT)

    const canMintConfig: VMState = {
      sources: [
        concat([
          SenderOP,
          TierAddressOP,
          ReportOP
        ])
      ],
      constants: canMintConstants,
      stackLength: 3,
      argumentsLength: 0,
    }

    await accessories.connect(creator).newItem(false, priceConfig, canMintConfig, currencies , 1, Rarity.NONE);

    let ItemData = await accessories.items(1)

    let expectItem = {
      inLootBox: ItemData.inLootBox,
      class: ItemData.class,
      rarity: ItemData.rarity,
      creator: ItemData.creator,
    }

    expect(expectItem).to.deep.equals({
      inLootBox: false,
      class: ethers.BigNumber.from("1"),
      rarity: Rarity.NONE,
      creator: creator.address,
    })
    
    let priceUSDT  = await accessories.getItemPrice(1, USDT.address ,1);
    expect(priceUSDT).to.deep.equals(expectedUSDTPrice);
    // console.log({priceUSDT})

    let priceBNB  = await accessories.getItemPrice(1, BNB.address ,1);
    expect(priceBNB).to.deep.equals(expectedBNBPrice);
    // console.log({priceBNB})

    let priceSOL  = await accessories.getItemPrice(1, SOL.address ,1);
    expect(priceSOL).to.deep.equals(expectedSOLPrice);
    // console.log({priceSOL})

    let priceXRP  = await accessories.getItemPrice(1, XRP.address ,1);
    expect(priceXRP).to.deep.equals(expectedXRPPrice);
    // console.log({priceXRP})
  });

  it("Should buy Item '1'", async function() {
    // console.log("Before Balance : ", await rTKN.balanceOf(buyer1.address))
    // console.log("Before Tier Level : ", (await erc20BalanceTier.report(buyer1.address)).toHexString())
    await rTKN.connect(buyer1).mintTokens(1)
    // console.log("After Balance : ", await rTKN.balanceOf(buyer1.address))
    // console.log("After Tier Level : ", (await erc20BalanceTier.report(buyer1.address)).toHexString())
    // await rTKN.connect(buyer1).mintTokens(1)
    // console.log("After Balance : ", await rTKN.balanceOf(buyer1.address))
    // console.log("After Tier Level : ", (await erc20BalanceTier.report(buyer1.address)).toHexString())
    // console.log("Script Tier Level : ", (await erc20BalanceTier.report(buyer1.address)))
    console.log("Solidity Tier Level : ", (await accessories.getReport(erc20BalanceTier.address, buyer1.address)))

    await USDT.connect(buyer1).mintTokens(1);
    await BNB.connect(buyer1).mintTokens(25);
    await SOL.connect(buyer1).mintTokens(50);
    await XRP.connect(buyer1).mintTokens(75);

    await USDT.connect(buyer1).approve(accessories.address, await accessories.getItemPrice(1, USDT.address, 1));
    await BNB.connect(buyer1).approve(accessories.address, await accessories.getItemPrice(1, BNB.address, 1));
    await SOL.connect(buyer1).approve(accessories.address, await accessories.getItemPrice(1, SOL.address, 1));
    await XRP.connect(buyer1).approve(accessories.address, await accessories.getItemPrice(1, XRP.address, 1));
    
    await accessories.connect(buyer1).buyItem(1,1);

    expect(await accessories.balanceOf(buyer1.address, 1)).to.deep.equals(ethers.BigNumber.from("1"))

    expect(await USDT.balanceOf(accessories.address)).to.deep.equals(ethers.BigNumber.from("1" + eighteenZeros))
    expect(await BNB.balanceOf(accessories.address)).to.deep.equals(ethers.BigNumber.from("25" + eighteenZeros))
    expect(await SOL.balanceOf(accessories.address)).to.deep.equals(ethers.BigNumber.from("50" + eighteenZeros))
    expect(await XRP.balanceOf(accessories.address)).to.deep.equals(ethers.BigNumber.from("75" + eighteenZeros))

    expect(await USDT.balanceOf(buyer1.address)).to.deep.equals(ethers.BigNumber.from("0" + eighteenZeros))
    expect(await BNB.balanceOf(buyer1.address)).to.deep.equals(ethers.BigNumber.from("0" + eighteenZeros))
    expect(await SOL.balanceOf(buyer1.address)).to.deep.equals(ethers.BigNumber.from("0" + eighteenZeros))
    expect(await XRP.balanceOf(buyer1.address)).to.deep.equals(ethers.BigNumber.from("0" + eighteenZeros))
  });
});
