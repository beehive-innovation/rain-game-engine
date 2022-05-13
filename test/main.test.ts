const { expect } = require("chai");
const { artifacts ,ethers, } = require("hardhat");

import { expectRevert } from "@openzeppelin/test-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { it } from "mocha";
import type { Rain1155, AssetConfigStruct } from "../typechain/Rain1155";
import type { Token } from "../typechain/Token";
import type { ReserveToken } from "../typechain/ReserveToken";
import type { ReserveTokenERC1155 } from "../typechain/ReserveTokenERC1155";
import type { ReserveTokenERC721 } from "../typechain/ReserveTokenERC721";
import type { ERC20BalanceTierFactory } from "../typechain/ERC20BalanceTierFactory";
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier";
import { AssetConfig, Rain1155 as Rain1155SDK } from "rain-game-sdk";
import { price, condition, Type, Conditions} from "rain-game-sdk";
import { eighteenZeros, getEventArgs} from "./utils"
import { Contract } from "ethers";
import { CONNREFUSED } from "dns";

const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros)
); // [1,2,3,4,5,6,7,8]

export let rain1155: Rain1155
export let rain1155SDK: Rain1155SDK

export let USDT: ReserveToken

export let BNB: Token
export let SOL: Token
export let XRP: Token
export let rTKN: Token

export let BAYC: ReserveTokenERC721

export let CARS: ReserveTokenERC1155
export let PLANES: ReserveTokenERC1155
export let SHIPS: ReserveTokenERC1155

export let erc20BalanceTier: ERC20BalanceTier

export let signer1: SignerWithAddress,
  creator: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress,
  buyer3: SignerWithAddress,
  buyer4: SignerWithAddress


const subgraphName = "vishalkale151071/blocks";

before("Deploy Rain1155 Contract and subgraph", async function () {
  const signers = await ethers.getSigners();

  signer1 = signers[0];
  creator = signers[1];
  buyer1 = signers[2];
  buyer2 = signers[3];
  buyer3 = signers[4];
  buyer4 = signers[5];


  let Rain1155 = await ethers.getContractFactory("Rain1155");
  
  rain1155 = await Rain1155.deploy();

  await rain1155.deployed();

  rain1155SDK = new Rain1155SDK(rain1155.address, signer1);

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
  await rTKN.deployed()

  const erc20BalanceTierFactoryFactory = await ethers.getContractFactory("ERC20BalanceTierFactory");
  const erc20BalanceTierFactory = (await erc20BalanceTierFactoryFactory.deploy()) as ERC20BalanceTierFactory & Contract;
  await erc20BalanceTierFactory.deployed();

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
    signer1
  ) as ERC20BalanceTier & Contract;

  await erc20BalanceTier.deployed();
})

describe("Rain1155 Test", () => {
  it("Contract should be deployed", async () => {
    expect(rain1155.address).to.be.not.null;
  });


  it("Should create asset with no minting and price script", async () => {

    const [priceScript, currencies] = rain1155SDK.generatePriceScript([]);

    const canMintConfig: condition[] = [
      {
        type: Conditions.NONE
      }
    ];
    const canMintScript = rain1155SDK.generateCanMintScript(canMintConfig);

    const assetConfig: AssetConfig = {
      lootBoxId: ethers.BigNumber.from("0"),
      priceScript: priceScript,
      canMintScript: canMintScript,
      currencies: currencies,
      name: "F1",
      description: "BRUUUUMMM BRUUUMMM",
      recipient: creator.address,
      tokenURI: "URI",
    };

    await rain1155SDK.connect(creator).createNewAsset(assetConfig);

    expect(await rain1155SDK.totalAssets()).to.deep.equals(ethers.BigNumber.from("1"));

    let assetData = await rain1155SDK.assets(1);

    let expectAsset = {
      lootBoxId: assetData.lootBoxId,
      tokenURI: assetData.tokenURI,
      recipient: assetData.recepient,
    };

    expect(expectAsset).to.deep.equals({
      lootBoxId: ethers.BigNumber.from("0"),
      tokenURI: "URI",
      recipient: creator.address,
    });
  });

  it("Should buy asset '1' with no price and minting conditions", async () =>{
    
    await rain1155SDK.connect(buyer1).mintAssets(1,1);
    expect(await rain1155SDK.uri(1)).to.equals(`URI`);

    expect(await rain1155SDK.balanceOf(buyer1.address, 1)).to.deep.equals(ethers.BigNumber.from("1"))
  });

  it("Should create asset with price but no Minting condition", async () => {
    const priceConfig: price[] = [
      {
        currency: {
          type: Type.ERC20,
          address: USDT.address,
        },
        amount: ethers.BigNumber.from("1" + eighteenZeros)
      },
      {
        currency: {
          type: Type.ERC1155,
          address: CARS.address,
          tokenId: ethers.BigNumber.from("1")
        },
        amount: ethers.BigNumber.from("10")
      }
    ];

    const canMintConfig: condition[] = [
      {
        type: Conditions.NONE
      }
    ];

    const [priceScript, currencies] = rain1155SDK.generatePriceScript(priceConfig);

    const canMintScript = rain1155SDK.generateCanMintScript(canMintConfig);

    const assetConfig: AssetConfig = {
      lootBoxId: ethers.BigNumber.from(0),
      priceScript: priceScript,
      canMintScript: canMintScript,
      currencies: currencies,
      name: "F2",
      description: "BRUUUUMMM2 BRUUUMMM2",
      recipient: creator.address,
      tokenURI: "URI2",
    };

    await rain1155SDK.connect(creator).createNewAsset(assetConfig);
    
    expect(await rain1155SDK.totalAssets()).to.deep.equals(ethers.BigNumber.from("2"));

    let assetData = await rain1155SDK.assets(2);

    let expectAsset = {
      lootBoxId: assetData.lootBoxId,
      tokenURI: assetData.tokenURI,
      recipient: assetData.recepient,
    };

    expect(expectAsset).to.deep.equals({
      lootBoxId: ethers.BigNumber.from("0"),
      tokenURI: "URI2",
      recipient: creator.address,
    });
  });

  it("Should be able to mint assete '2' after allowing tokens",async () => {
    await expectRevert(rain1155SDK.connect(buyer2).mintAssets(2,1), "ERC20: insufficient allowance");

    await USDT.connect(buyer2).mintTokens(1);

    expect(await USDT.balanceOf(buyer2.address)).to.deep.equals(ethers.BigNumber.from("1" + eighteenZeros))
    await USDT.connect(buyer2).approve(rain1155.address, ethers.BigNumber.from("1" + eighteenZeros))
    await expectRevert(rain1155SDK.connect(buyer2).mintAssets(2,1), "ERC1155: caller is not owner nor approved");
    
    await CARS.connect(buyer2).mintTokens(1, 10);
    expect(await CARS.balanceOf(buyer2.address, 1)).to.deep.equals(ethers.BigNumber.from("10"));
    await CARS.connect(buyer2).setApprovalForAll(rain1155.address, true);

    await rain1155SDK.connect(buyer2).mintAssets(2, 1);

    expect(await rain1155SDK.balanceOf(buyer2.address, 2)).to.deep.equals(ethers.BigNumber.from(1));
  });

  it("Should buy multiple assets",async () => {
    await USDT.connect(buyer3).mintTokens(1 * 5);
    await CARS.connect(buyer3).mintTokens(1, 10 * 5);
    
    await USDT.connect(buyer3).approve(rain1155.address, ethers.BigNumber.from("5" + eighteenZeros));
    await CARS.connect(buyer3).setApprovalForAll(rain1155.address, true);

    await rain1155SDK.connect(buyer3).mintAssets(2, 5);

    expect(await rain1155SDK.balanceOf(buyer3.address, 2)).to.deep.equals(ethers.BigNumber.from(5));
  });

  it("Should create assets with minting condition",async () => {
    const [priceScript, currencies] = rain1155SDK.generatePriceScript([]);

    const canMintConfig: condition[] = [
      {
        type: Conditions.BLOCK_NUMBER,
        blockNumber: 100,
      },
      {
        type: Conditions.BALANCE_TIER,
        tierAddress: erc20BalanceTier.address,
        tierCondition: 4
      },
      {
        type: Conditions.ERC20BALANCE,
        address: BNB.address,
        balance: ethers.BigNumber.from("10" + eighteenZeros)
      },
      {
        type: Conditions.ERC1155BALANCE,
        address: PLANES.address,
        balance: ethers.BigNumber.from("10"),
        id: ethers.BigNumber.from(1)
      },
      {
        type: Conditions.ERC721BALANCE,
        address: BAYC.address,
        balance: ethers.BigNumber.from(0)
      }
    ]

    const canMintScript = rain1155SDK.generateCanMintScript(canMintConfig);

    const assetConfig: AssetConfig = {
      lootBoxId: ethers.BigNumber.from(0),
      priceScript: priceScript,
      canMintScript: canMintScript,
      currencies: currencies,
      name: "F3",
      description: "BRUUUUMMM3 BRUUUMMM3",
      recipient: creator.address,
      tokenURI: "URI3",
    };

    await rain1155SDK.connect(creator).createNewAsset(assetConfig);

    await rTKN.connect(buyer4).mintTokens(5);
    await BNB.connect(buyer4).mintTokens(11);
    await PLANES.connect(buyer4).mintTokens(1,11);
    await BAYC.connect(buyer4).mintNewToken();

    await rain1155SDK.connect(buyer4).mintAssets(3,1);
    
    expect(await rain1155SDK.balanceOf(buyer4.address, 3)).to.deep.equals(ethers.BigNumber.from(1));
  })
});
