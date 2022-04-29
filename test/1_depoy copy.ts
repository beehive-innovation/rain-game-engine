const { expect } = require("chai");
const { artifacts ,ethers, } = require("hardhat");

import {GameAssets as GameAssetsSDK} from "rain-game-sdk";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { it } from "mocha";
import type { GameAssets, GameAssetsConfigStruct, AssetConfigStruct } from "../typechain/GameAssets"
import type { Token } from "../typechain/Token"
import type { ReserveToken } from "../typechain/ReserveToken"
import type { ReserveTokenERC1155 } from "../typechain/ReserveTokenERC1155"
import type { ERC20BalanceTierFactory } from "../typechain/ERC20BalanceTierFactory"
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier"

import { eighteenZeros, op, Opcode, Rarity, concat, VMState, getEventArgs, gameAssetsDeploy, fetchFile, writeFile, exec, Type, Role } from "./utils"
import { Contract } from "ethers";
import path from "path";
import { GameAssetsFactory__factory } from "../typechain/factories/GameAssetsFactory__factory";
import { price, toScript } from "./VMScript";

const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros)
); // [1,2,3,4,5,6,7,8]

export let gameAsstes: GameAssets
export let gameAsstesSDK;
export let USDT: ReserveToken

export let BNB: Token
export let SOL: Token
export let XRP: Token
export let rTKN: Token

export let CARS: ReserveTokenERC1155
export let PLANES: ReserveTokenERC1155

export let erc20BalanceTier: ERC20BalanceTier

export let owner: SignerWithAddress,
  creator: SignerWithAddress,
  creator2: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress,
  gameAsstesOwner: SignerWithAddress,
  admin: SignerWithAddress

const subgraphName = "vishalkale151071/blocks";

before("Deploy GameAssets Contract and subgraph", async function () {
  const signers = await ethers.getSigners();

  owner = signers[0];
  creator = signers[1];
  creator2 = signers[2];
  buyer1 = signers[3];
  buyer2 = signers[4];
  gameAsstesOwner = signers[5];
  admin = signers[6];

  const gameAssetsFactory = await new GameAssetsFactory__factory(owner).deploy()
  await gameAssetsFactory.deployed();

  const gameAssetsConfig: GameAssetsConfigStruct = {
    _creator: gameAsstesOwner.address,
    _baseURI: "www.baseURI.com/metadata"
  }

  gameAsstes = await gameAssetsDeploy(gameAssetsFactory, gameAsstesOwner, gameAssetsConfig, {gasLimit : 1500000});

  await gameAsstes.deployed();

  gameAsstesSDK = new GameAssetsSDK(gameAsstes.address, gameAsstesOwner)

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

  CARS = await Erc1155.deploy();
  await CARS.deployed()
  PLANES = await Erc1155.deploy();
  await PLANES.deployed()

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

  const pathExampleConfig = path.resolve(__dirname, "../config/localhost.json");
  const config = JSON.parse(fetchFile(pathExampleConfig));

  config.network = "localhost";

  config.gameAssetsFactory = gameAssetsFactory.address;
  config.gameAssetsFactoryBlock = gameAssetsFactory.deployTransaction.blockNumber;

  console.log("Config : ", JSON.stringify(config, null, 2));
  const pathConfigLocal = path.resolve(__dirname, "../config/localhost.json");
  writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

  // exec(`npm run deploy:localhost`);
})

describe.only("GameAssets Test", function () {
  it("Contract should be deployed.", async function () {
    expect(gameAsstesSDK.address).to.be.not.null;
    expect(await gameAsstesSDK.uri(1)).to.equals(`www.baseURI.com/metadata/${gameAsstesSDK.address.toLowerCase()}/1.json`);
  });

  it("Should deploy all tokens", async function () {
    expect(USDT.address).to.be.not.null;
    expect(BNB.address).to.be.not.null;
    expect(SOL.address).to.be.not.null;
    expect(XRP.address).to.be.not.null;
    // console.log(USDT.address, BNB.address, SOL.address, XRP.address)
  });

  it("Should create asset from creator.", async function () {

    const expectedUSDTPrice = ethers.BigNumber.from("1" + eighteenZeros);
    const expectedBNBPrice = ethers.BigNumber.from("25" + eighteenZeros);

    let script: price[] = [
      {
        currency:{
          type: Type.ERC20,
          address: USDT.address,
        },
        amount: expectedUSDTPrice
      },
      {
        currency:{
          type: Type.ERC20,
          address: BNB.address,
        },
        amount: expectedBNBPrice
      },
      {
        currency:{
          type: Type.ERC1155,
          address: CARS.address,
          tokenId: 5,
        },
        amount: ethers.BigNumber.from("10")
      },
      {
        currency:{
          type: Type.ERC1155,
          address: PLANES.address,
          tokenId: 15,
        },
        amount: ethers.BigNumber.from("5")
      },
    ] ;

    let state = toScript(script, 3);

    const currencies = [USDT.address, BNB.address, CARS.address, PLANES.address]

    const classCarName = "Car";
    const classCarDescription = "A really good car.";
    const classCarAttributes = [classCarName, classCarDescription, "Top speed", "Acceleration", "Break", "Handling", "Weight"]
    await gameAsstesSDK.createClass(classCarAttributes);

    // expect(await gameAsstes.getClasses()).to.deep.include(ethers.BigNumber.from("1"))

    const tierCondition = 4
    const blockCondition = 15

    const canMintConstants = [ erc20BalanceTier.address, tierCondition, blockCondition]

    const canMintSource = concat([
      op(Opcode.VAL, 0),
      op(Opcode.SENDER),
      op(Opcode.REPORT),
      op(Opcode.BLOCK_NUMBER),
      op(Opcode.REPORT_AT_BLOCK),
      op(Opcode.VAL, 1),
      op(Opcode.GREATER_THAN),
      op(Opcode.BLOCK_NUMBER),
      op(Opcode.VAL, 2),
      op(Opcode.GREATER_THAN),
      op(Opcode.EVERY, 2)
    ])


    const canMintConfig: VMState = {
      sources: [
        canMintSource
      ],
      constants: canMintConstants,
      stackLength: 10,
      argumentsLength: 0,
    }

    const assetConfig: AssetConfigStruct = {
      lootBoxId: 0,
      priceConfig: state,
      canMintConfig: canMintConfig,
      currencies: currencies,
      assetClass: 1,
      rarity: Rarity.NONE,
      name: "F1",
      description: "BRUUUUMMM BRUUUMMM",
      creator: creator.address
    }

    await gameAsstes.connect(gameAsstesOwner).createNewAsset(assetConfig);

    let assetData = await gameAsstes.assets(1)
    let expectAsset = {
      lootBoxId: assetData.lootBoxId,
      assetClass: assetData.assetClass,
      rarity: assetData.rarity,
      creator: assetData.creator,
    }

    expect(expectAsset).to.deep.equals({
      lootBoxId: ethers.BigNumber.from("0"),
      assetClass: ethers.BigNumber.from("1"),
      rarity: ethers.BigNumber.from(Rarity.NONE),
      creator: creator.address,
    })
  });

  it("Should buy asset '1'", async function() {
    await rTKN.connect(buyer1).mintTokens(5)

    await USDT.connect(buyer1).mintTokens(1);
    await BNB.connect(buyer1).mintTokens(25);
    
    await CARS.connect(buyer1).mintTokens(ethers.BigNumber.from("5"), 10)
    await PLANES.connect(buyer1).mintTokens(ethers.BigNumber.from("15"), 5)

    let USDTPrice = (await gameAsstesSDK.getAssetPrice(1, USDT.address, 1))[1]
    let BNBPrice = (await gameAsstesSDK.getAssetPrice(1, BNB.address, 1))[1]

    await USDT.connect(buyer1).approve(gameAsstesSDK.address, USDTPrice);
    await BNB.connect(buyer1).approve(gameAsstesSDK.address, BNBPrice);
    
    await CARS.connect(buyer1).setApprovalForAll(gameAsstesSDK.address, true);
    await PLANES.connect(buyer1).setApprovalForAll(gameAsstesSDK.address, true);
    
    await gameAsstes.connect(buyer1).mintAssets(1,1);

    expect(await gameAsstesSDK.balanceOf(buyer1.address, 1)).to.deep.equals(ethers.BigNumber.from("1"))
    // expect(await gameAsstes.balanceOf(buyer2.address, 1)).to.deep.equals(ethers.BigNumber.from("2"))

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
