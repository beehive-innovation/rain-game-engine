const { expect } = require("chai");
const { artifacts ,ethers, } = require("hardhat");

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { it } from "mocha";
import type { Rain1155, AssetConfigStruct, Rain1155ConfigStruct } from "../typechain/Rain1155";
import type { Token } from "../typechain/Token";
import type { ReserveToken } from "../typechain/ReserveToken";
import type { ReserveTokenERC1155 } from "../typechain/ReserveTokenERC1155";
import type { ReserveTokenERC721 } from "../typechain/ReserveTokenERC721";

import { eighteenZeros, getEventArgs, fetchFile, writeFile,  exec, concat, op } from "./utils"
import path from "path";
import { AllStandardOps } from "rain-sdk";

const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros)
); // [1,2,3,4,5,6,7,8]

export let rain1155: Rain1155

export let USDT: ReserveToken

export let BNB: Token
export let SOL: Token
export let XRP: Token
export let rTKN: Token

export let BAYC: ReserveTokenERC721

export let CARS: ReserveTokenERC1155
export let PLANES: ReserveTokenERC1155
export let SHIPS: ReserveTokenERC1155

export let owner: SignerWithAddress,
  creator: SignerWithAddress,
  creator2: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress,
  gameAsstesOwner: SignerWithAddress,
  admin: SignerWithAddress

const subgraphName = "vishalkale151071/blocks";

before("Deploy Rain1155 Contract and subgraph", async function () {
  const signers = await ethers.getSigners();

  owner = signers[0];
  creator = signers[1];
  creator2 = signers[2];
  buyer1 = signers[3];
  buyer2 = signers[4];
  gameAsstesOwner = signers[5];
  admin = signers[6];

  const StateBuilder = await ethers.getContractFactory("AllStandardOpsStateBuilder");
  
  let stateBuilder = await StateBuilder.deploy();
  await stateBuilder.deployed();

  const rain1155Config: Rain1155ConfigStruct = {
    vmStateBuilder: stateBuilder.address
  }

  const Rain1155 = await ethers.getContractFactory("Rain1155")
  
  rain1155 = await Rain1155.deploy(rain1155Config)

  await rain1155.deployed();

  const Erc20 = await ethers.getContractFactory("Token");
  const stableCoins = await ethers.getContractFactory("ReserveToken");
  const Erc721 = await ethers.getContractFactory("ReserveTokenERC721");
  const Erc1155 = await ethers.getContractFactory("ReserveTokenERC1155");
  
  USDT = await stableCoins.deploy();
  await USDT.deployed();
  BNB = await Erc20.deploy("Binance", "BNB");
  await BNB.deployed();
  SOL = await Erc20.deploy("Solana", "SOL");
  await SOL.deployed();
  XRP = await Erc20.deploy("Ripple", "XRP");
  await XRP.deployed();

  BAYC = await Erc721.deploy("Boared Ape Yatch Club", "BAYC");
  await BAYC.deployed()

  CARS = await Erc1155.deploy();
  await CARS.deployed();
  PLANES = await Erc1155.deploy();
  await PLANES.deployed();
  SHIPS = await Erc1155.deploy();
  await SHIPS.deployed();

  rTKN = await Erc20.deploy("Rain Token", "rTKN");
  await rTKN.deployed();

  const pathExampleConfig = path.resolve(__dirname, "../config/localhost.json");
  const config = JSON.parse(fetchFile(pathExampleConfig));

  config.network = "localhost";

  config.rain1155 = rain1155.address;
  config.rain1155Block = rain1155.deployTransaction.blockNumber;

  console.log("Config : ", JSON.stringify(config, null, 2));
  const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
  writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

  try {
    exec(`npm run deploy:localhost`);
  }catch(error){
    console.log(`Subgraph deployment failed : ${error}`);
  }
})

describe("Rain1155 Test", function () {
  it("Contract should be deployed.", async function () {
    expect(rain1155.address).to.be.not.null;
  });

  it("Should deploy all tokens", async function () {
    expect(USDT.address).to.be.not.null;
    expect(BNB.address).to.be.not.null;
    expect(SOL.address).to.be.not.null;
    expect(XRP.address).to.be.not.null;
    // console.log(USDT.address, BNB.address, SOL.address, XRP.address)
  });



  it("Should create asset from creator.", async function () {
    /// Minting before creating assets
    await PLANES.connect(buyer1).mintTokens(ethers.BigNumber.from("15"), 5)
    await SHIPS.connect(buyer1).mintTokens(ethers.BigNumber.from("1"), 11)



    const blockCondition = 15

    const vmStateConfig = {
      constants: [10, ethers.BigNumber.from("1" + eighteenZeros), 10, ethers.BigNumber.from("25" + eighteenZeros), 9, 10, 9, 5],
      sources: [
        concat([
          op(AllStandardOps.CONSTANT, 0),
          op(AllStandardOps.CONSTANT, 1),

          op(AllStandardOps.CONSTANT, 2),
          op(AllStandardOps.CONSTANT, 3),

          op(AllStandardOps.CONSTANT, 4),
          op(AllStandardOps.CONSTANT, 5),

          op(AllStandardOps.CONSTANT, 6),
          op(AllStandardOps.CONSTANT, 7),
        ])
      ]
    }

    //const [ vmStateConfig, currencies ] = Rain1155SDK.generateScript([ conditions], prices);

    const assetConfig: AssetConfigStruct = {
      lootBoxId: 0,
      vmStateConfig,
      currencies: {
        token: [USDT.address, BNB.address, CARS.address, PLANES.address],
        tokenType: [0, 0, 1, 1],
        tokenId: [0, 0, 5, 15]
      },
      name: "F1",
      description: "BRUUUUMMM BRUUUMMM",
      recipient: creator.address,
      tokenURI: "https://ipfs.io/ipfs/QmVfbKBM7XxqZMRFzRGPGkWT8oUFNYY1DeK5dcoTgLuV8H",
    }

    await rain1155.connect(gameAsstesOwner).createNewAsset(assetConfig);

    let assetData = await rain1155.assets(1)
    let expectAsset = {
      lootBoxId: assetData.lootBoxId,
      tokenURI: assetData.tokenURI,
      creator: assetData.recipient,
    }

    expect(expectAsset).to.deep.equals({
      lootBoxId: ethers.BigNumber.from("0"),
      tokenURI: "https://ipfs.io/ipfs/QmVfbKBM7XxqZMRFzRGPGkWT8oUFNYY1DeK5dcoTgLuV8H",
      creator: creator.address,
    })
  });

  it("Should buy asset '1'", async function() {

    await CARS.connect(buyer1).mintTokens(ethers.BigNumber.from("5"), 10)

    await rTKN.connect(buyer1).mintTokens(5)

    await USDT.connect(buyer1).mintTokens(1);
    await BNB.connect(buyer1).mintTokens(25);

    await SOL.connect(buyer1).mintTokens(11);

    await BAYC.connect(buyer1).mintNewToken();

    let USDTPrice = (await rain1155.getCurrencyPrice(1, USDT.address, buyer1.address, 1))[0]
    let BNBPrice = (await rain1155.getCurrencyPrice(1, BNB.address, buyer1.address, 1))[0]

    await USDT.connect(buyer1).approve(rain1155.address, USDTPrice);
    await BNB.connect(buyer1).approve(rain1155.address, BNBPrice);
    
    await CARS.connect(buyer1).setApprovalForAll(rain1155.address, true);
    await PLANES.connect(buyer1).setApprovalForAll(rain1155.address, true);
    
    await rain1155.connect(buyer1).mintAssets(1,1);

    expect(await rain1155.balanceOf(buyer1.address, 1)).to.deep.equals(ethers.BigNumber.from("1"))

    expect(await USDT.balanceOf(creator.address)).to.deep.equals(ethers.BigNumber.from("1" + eighteenZeros))
    expect(await BNB.balanceOf(creator.address)).to.deep.equals(ethers.BigNumber.from("25" + eighteenZeros))
    expect(await CARS.balanceOf(creator.address, 5)).to.deep.equals(ethers.BigNumber.from("10"))
    expect(await PLANES.balanceOf(creator.address, 15)).to.deep.equals(ethers.BigNumber.from("5"))
    
    expect(await USDT.balanceOf(buyer1.address)).to.deep.equals(ethers.BigNumber.from("0" + eighteenZeros))
    expect(await BNB.balanceOf(buyer1.address)).to.deep.equals(ethers.BigNumber.from("0" + eighteenZeros))
    expect(await CARS.balanceOf(buyer1.address, 5)).to.deep.equals(ethers.BigNumber.from("0"))
    expect(await PLANES.balanceOf(buyer1.address, 15)).to.deep.equals(ethers.BigNumber.from("0"))
  });
});