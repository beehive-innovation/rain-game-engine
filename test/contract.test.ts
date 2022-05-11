import { expect } from "chai";
import { ethers } from "hardhat";

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import type { Rain1155, AssetConfigStruct } from "../typechain/Rain1155";
import type { Token } from "../typechain/Token";
import type { ReserveToken } from "../typechain/ReserveToken";
import type { ReserveTokenERC1155 } from "../typechain/ReserveTokenERC1155";
import type { ReserveTokenERC721 } from "../typechain/ReserveTokenERC721";
import type { ERC20BalanceTier } from "../typechain/ERC20BalanceTier";

import {
  eighteenZeros,
  Type,
  Conditions,
  deployERC20BalanceTier,
  deployToken,
  deployReserveToken,
  deployErc721,
  deployErc1155,
} from "./utils";
import {
  price,
  generatePriceScript,
  condition,
  generateCanMintScript,
  generatePriceConfig,
} from "./VMScript";

const LEVELS = Array.from(Array(8).keys()).map((value) =>
  ethers.BigNumber.from(++value + eighteenZeros)
); // [1,2,3,4,5,6,7,8]

export let rain1155: Rain1155;

export let USDT: ReserveToken;

export let BNB: Token;
export let SOL: Token;
export let XRP: Token;
export let rTKN: Token;

export let BAYC: ReserveTokenERC721;

export let CARS: ReserveTokenERC1155;
export let PLANES: ReserveTokenERC1155;
export let SHIPS: ReserveTokenERC1155;

export let erc20BalanceTier: ERC20BalanceTier;

export let owner: SignerWithAddress,
  creator: SignerWithAddress,
  creator2: SignerWithAddress,
  buyer1: SignerWithAddress,
  buyer2: SignerWithAddress,
  gameAsstesOwner: SignerWithAddress,
  admin: SignerWithAddress;

before("Deploy Rain1155 Contract and subgraph", async function () {
  const signers = await ethers.getSigners();

  owner = signers[0];
  creator = signers[1];
  creator2 = signers[2];
  buyer1 = signers[3];
  buyer2 = signers[4];
  gameAsstesOwner = signers[5];
  admin = signers[6];

  let Rain1155 = await ethers.getContractFactory("Rain1155");

  rain1155 = (await Rain1155.deploy()) as Rain1155;

  await rain1155.deployed();

  USDT = await deployReserveToken();
  await USDT.deployed();
  BNB = await deployToken("Binance", "BNB");
  await BNB.deployed();
  SOL = await deployToken("Solana", "SOL");
  await SOL.deployed();
  XRP = await deployToken("Ripple", "XRP");
  await XRP.deployed();

  BAYC = await deployErc721("Boared Ape Yatch Club", "BAYC");
  await BAYC.deployed();

  CARS = await deployErc1155();
  await CARS.deployed();
  PLANES = await deployErc1155();
  await PLANES.deployed();
  SHIPS = await deployErc1155();
  await SHIPS.deployed();

  rTKN = await deployToken("Rain Token", "rTKN");
  await rTKN.deployed();

  erc20BalanceTier = await deployERC20BalanceTier(
    {
      erc20: rTKN.address,
      tierValues: LEVELS,
    },
    owner
  );
  await erc20BalanceTier.deployed();
});

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
    const prices: price[] = [
      {
        currency: {
          type: Type.ERC20,
          address: USDT.address,
        },
        amount: ethers.BigNumber.from("1" + eighteenZeros),
      },
      {
        currency: {
          type: Type.ERC20,
          address: BNB.address,
        },
        amount: ethers.BigNumber.from("25" + eighteenZeros),
      },
      {
        currency: {
          type: Type.ERC1155,
          address: CARS.address,
          tokenId: 5,
        },
        amount: ethers.BigNumber.from("10"),
      },
      {
        currency: {
          type: Type.ERC1155,
          address: PLANES.address,
          tokenId: 15,
        },
        amount: ethers.BigNumber.from("5"),
      },
    ];

    const priceConfig = generatePriceScript([]);
    const currencies = [
      USDT.address,
      BNB.address,
      CARS.address,
      PLANES.address,
    ];
    const priceScript = generatePriceConfig(priceConfig, currencies);

    const tierCondition = 4;
    const blockCondition = 15;

    const conditions: condition[] = [
      {
        type: Conditions.NONE,
      },
      {
        type: Conditions.BLOCK_NUMBER,
        blockNumber: blockCondition,
      },
      {
        type: Conditions.BALANCE_TIER,
        tierAddress: erc20BalanceTier.address,
        tierCondition: tierCondition,
      },
      {
        type: Conditions.ERC20BALANCE,
        address: SOL.address,
        balance: ethers.BigNumber.from("10" + eighteenZeros),
      },
      {
        type: Conditions.ERC721BALANCE,
        address: BAYC.address,
        balance: ethers.BigNumber.from("0"),
      },
      {
        type: Conditions.ERC1155BALANCE,
        address: SHIPS.address,
        id: ethers.BigNumber.from("1"),
        balance: ethers.BigNumber.from("10"),
      },
    ];

    const canMintConfig = generateCanMintScript(conditions);

    const assetConfig: AssetConfigStruct = {
      lootBoxId: 0,
      priceConfig: priceConfig,
      canMintConfig: canMintConfig,
      currencies: [],
      name: "F1",
      description: "BRUUUUMMM BRUUUMMM",
      recepient: creator.address,
      tokenURI: "URI",
    };

    await rain1155.connect(gameAsstesOwner).createNewAsset(assetConfig);

    let assetData = await rain1155.assets(1);
    let expectAsset = {
      lootBoxId: assetData.lootBoxId,
      tokenURI: assetData.tokenURI,
      creator: assetData.recepient,
    };

    expect(expectAsset).to.deep.equals({
      lootBoxId: ethers.BigNumber.from("0"),
      tokenURI: "URI",
      creator: creator.address,
    });
  });

  xit("Should buy asset '1'", async function () {
    await rTKN.connect(buyer1).mintTokens(5);

    await USDT.connect(buyer1).mintTokens(1);
    await BNB.connect(buyer1).mintTokens(25);

    await SOL.connect(buyer1).mintTokens(11);

    await BAYC.connect(buyer1).mintNewToken();

    await CARS.connect(buyer1).mintTokens(ethers.BigNumber.from("5"), 10);
    await PLANES.connect(buyer1).mintTokens(ethers.BigNumber.from("15"), 5);
    await SHIPS.connect(buyer1).mintTokens(ethers.BigNumber.from("1"), 11);

    // let USDTPrice = (await rain1155.getAssetPrice(1, USDT.address, 1))[1]
    // let BNBPrice = (await rain1155.getAssetPrice(1, BNB.address, 1))[1]

    // await USDT.connect(buyer1).approve(rain1155.address, USDTPrice);
    // await BNB.connect(buyer1).approve(rain1155.address, BNBPrice);

    // await CARS.connect(buyer1).setApprovalForAll(rain1155.address, true);
    // await PLANES.connect(buyer1).setApprovalForAll(rain1155.address, true);

    await rain1155.connect(buyer1).mintAssets(1, 1);
    // expect(await rain1155.uri(1)).to.equals(`URI`);

    expect(await rain1155.balanceOf(buyer1.address, 1)).to.deep.equals(
      ethers.BigNumber.from("1")
    );

    expect(await USDT.balanceOf(creator.address)).to.deep.equals(
      ethers.BigNumber.from("1" + eighteenZeros)
    );
    expect(await BNB.balanceOf(creator.address)).to.deep.equals(
      ethers.BigNumber.from("25" + eighteenZeros)
    );
    expect(await CARS.balanceOf(creator.address, 5)).to.deep.equals(
      ethers.BigNumber.from("10")
    );
    expect(await PLANES.balanceOf(creator.address, 15)).to.deep.equals(
      ethers.BigNumber.from("5")
    );

    expect(await USDT.balanceOf(buyer1.address)).to.deep.equals(
      ethers.BigNumber.from("0" + eighteenZeros)
    );
    expect(await BNB.balanceOf(buyer1.address)).to.deep.equals(
      ethers.BigNumber.from("0" + eighteenZeros)
    );
    expect(await CARS.balanceOf(buyer1.address, 5)).to.deep.equals(
      ethers.BigNumber.from("0")
    );
    expect(await PLANES.balanceOf(buyer1.address, 15)).to.deep.equals(
      ethers.BigNumber.from("0")
    );
  });
});
