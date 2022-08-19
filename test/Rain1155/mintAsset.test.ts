import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import path from "path";
import {
  AssetConfigStruct,
  AssetDetailsStruct,
  Rain1155,
  Rain1155ConfigStruct,
  TransferSingleEvent,
} from "../../typechain/Rain1155";
import {
  assertError,
  BN,
  concat,
  fetchFile,
  getEventArgs,
  op,
  sixZeros,
} from "../utils";
import { deployer, signers } from "./1_setup.test";
import { StateConfig, VM } from "rain-sdk";
import { assert } from "chai";
import { ReserveToken } from "../../typechain/ReserveToken";
import { ContractFactory } from "ethers";
import { ReserveTokenERC1155 } from "../../typechain/ReserveTokenERC1155";

let rain1155Config: Rain1155ConfigStruct;
let config;
let rain1155: Rain1155;
let creator: SignerWithAddress;
let assetConfig: AssetConfigStruct;
let recipient: SignerWithAddress;
let buyer: SignerWithAddress;

describe("Mint Asset test", async function () {
  let USDT_: ReserveToken;
  let TOKEN1155: ReserveTokenERC1155;
  let stableCoins: ContractFactory;
  let Erc1155: ContractFactory;

  before(async () => {
    creator = signers[1];
    recipient = signers[2];
    buyer = signers[3];

    // Tokens
    stableCoins = await ethers.getContractFactory("ReserveToken");
    Erc1155 = await ethers.getContractFactory("ReserveTokenERC1155");

    // Rain1155
    const pathExampleConfig = path.resolve(
      __dirname,
      "../../config/test/localhost.json"
    );

    config = JSON.parse(fetchFile(pathExampleConfig));
    rain1155Config = {
      vmStateBuilder: config.vmStateBuilder,
    };

    const Rain1155 = await ethers.getContractFactory("Rain1155");
    rain1155 = (await Rain1155.connect(deployer).deploy(
      rain1155Config
    )) as Rain1155;
    await rain1155.deployed();

    expect(rain1155.address).to.not.null;
  });

  beforeEach(async () => {
    USDT_ = (await stableCoins.deploy()) as ReserveToken;
    await USDT_.deployed();

    TOKEN1155 = (await Erc1155.deploy()) as ReserveTokenERC1155;
    await TOKEN1155.deployed();
  });

  it("should mint an asset with single currency", async () => {
    const assetUnits = 1;

    // Creating asset
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [10, BN("1" + sixZeros)],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address],
        tokenId: [],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnits // Units
    );

    const maxUnits = cost[0];
    const assetCost = cost[1][0];

    // Transferring token
    await USDT_.transfer(buyer.address, assetCost);

    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, assetCost);
    let buyerBalanceBefore = await USDT_.balanceOf(buyer.address);
    let recipientBalanceBefore = await USDT_.balanceOf(recipient.address);

    // Minting token
    const mintAssetTx = await rain1155
      .connect(buyer)
      .mintAssets(asset.id, assetUnits);

    // Asserting the event
    const [operator, from, to, id, assetUnitsBought] = (await getEventArgs(
      mintAssetTx,
      "TransferSingle",
      rain1155
    )) as TransferSingleEvent["args"];

    assert(assetUnitsBought.eq(assetUnits), "Invalid Asset units bought");
    assert(id.eq(asset.id), "Invalid Asset ID bought");

    // Asserting the sender's wallet if the token was transferred
    let buyerBalanceAfter = await USDT_.balanceOf(buyer.address);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore.sub(assetCost)),
      "Invalid Buyer Balance after Minting an asset"
    );

    // Asserting the recipient's wallet if the token was received
    let recipientBalanceAfter = await USDT_.balanceOf(recipient.address);
    assert(
      recipientBalanceAfter.eq(recipientBalanceBefore.add(assetCost)),
      "Invalid recipient Balance after Buyer mints an asset"
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = assetUnits;
    assert(
      buyerAssetCount.eq(expectedAssetCount),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });

  it("should not mint an asset if maxUnits is less than 1", async () => {
    const assetUnits = 1;

    // Creating asset
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [0, BN("1" + sixZeros)],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address],
        tokenId: [],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnits // Units
    );

    const maxUnits = cost[0];
    const assetCost = cost[1][0];

    // Transferring token
    await USDT_.transfer(buyer.address, assetCost);

    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, assetCost);

    // Minting token
    await assertError(
      async () =>
        await rain1155.connect(buyer).mintAssets(asset.id, assetUnits),
      "Cant Mint",
      "Error user is able to mint even after maxUnits less than 1"
    );
  });

  it("should not mint an asset if invalid assetId is passed", async () => {
    const assetUnits = 1;

    // Creating asset
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [0, BN("1" + sixZeros)],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address],
        tokenId: [],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnits // Units
    );

    const maxUnits = cost[0];
    const assetCost = cost[1][0];

    // Transferring token
    await USDT_.transfer(buyer.address, assetCost);

    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, assetCost);

    // Minting token
    await assertError(
      async () =>
        await rain1155
          .connect(buyer)
          .mintAssets(BN(asset.id).add(5), assetUnits),
      "Invalid AssetId",
      "Error user is able to mint invalid assetId"
    );
  });

  it("should mint maxUnits if more assets are requested", async () => {
    const assetUnitsToBuy = 10;
    const maxUnits_ = 5;

    // Creating asset
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [maxUnits_, BN("1" + sixZeros)],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address],
        tokenId: [],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnitsToBuy // Units
    );

    const maxUnits = cost[0];
    const assetCost = cost[1][0];
    const totalAssetCost = assetCost.mul(assetUnitsToBuy);
    const expectedAssetCost = assetCost.mul(maxUnits_);
    // Transferring token
    await USDT_.transfer(buyer.address, totalAssetCost);

    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, totalAssetCost);
    let buyerBalanceBefore = await USDT_.balanceOf(buyer.address);
    let recipientBalanceBefore = await USDT_.balanceOf(recipient.address);

    // Minting token
    const mintAssetTx = await rain1155
      .connect(buyer)
      .mintAssets(asset.id, assetUnitsToBuy);

    // Asserting the event
    const [operator, from, to, id, assetUnitsBought] = (await getEventArgs(
      mintAssetTx,
      "TransferSingle",
      rain1155
    )) as TransferSingleEvent["args"];

    assert(assetUnitsBought.eq(maxUnits_), "Invalid Asset units bought");
    assert(id.eq(asset.id), "Invalid Asset ID bought");

    // Asserting the sender's wallet if the token was transferred
    let buyerBalanceAfter = await USDT_.balanceOf(buyer.address);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore.sub(expectedAssetCost)),
      "Invalid Buyer Balance after Minting an asset"
    );

    // Asserting the recipient's wallet if the token was received
    let recipientBalanceAfter = await USDT_.balanceOf(recipient.address);
    assert(
      recipientBalanceAfter.eq(recipientBalanceBefore.add(expectedAssetCost)),
      "Invalid recipient Balance after Buyer mints an asset"
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = maxUnits_;
    assert(
      buyerAssetCount.eq(expectedAssetCount),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });

  it("should mint an asset with multiple currencies", async () => {
    const assetUnits = 1;
    const tokenIdToHold = 2;
    const maxUnits = 10;
    // Creating asset
    // prettier-ignore
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([
          op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1),
          op(VM.Opcodes.CONSTANT, 2), op(VM.Opcodes.CONSTANT, 3)
        ])
      ],
      constants: [
        maxUnits, BN("1" + sixZeros),
        maxUnits, 5
      ],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address, TOKEN1155.address],
        tokenId: [tokenIdToHold],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnits // Units
    );

    const USDTassetCost = cost[1][0];
    const TOKEN1155assetCost = cost[1][1];

    // Transferring token
    await USDT_.transfer(buyer.address, USDTassetCost);
    await TOKEN1155.connect(buyer).mintTokens(
      tokenIdToHold,
      TOKEN1155assetCost
    );

    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, USDTassetCost);
    let buyerUSDT_BalanceBefore = await USDT_.balanceOf(buyer.address);
    let recipientUSDT_BalanceBefore = await USDT_.balanceOf(recipient.address);

    await TOKEN1155.connect(buyer).setApprovalForAll(rain1155.address, true);
    let buyerTOKEN1155BalanceBefore = await TOKEN1155.balanceOf(
      buyer.address,
      tokenIdToHold
    );
    let recipientTOKEN1155BalanceBefore = await TOKEN1155.balanceOf(
      recipient.address,
      tokenIdToHold
    );

    // Minting token
    const mintAssetTx = await rain1155
      .connect(buyer)
      .mintAssets(asset.id, assetUnits);

    // Asserting the event
    const [operator, from, to, id, assetUnitsBought] = (await getEventArgs(
      mintAssetTx,
      "TransferSingle",
      rain1155
    )) as TransferSingleEvent["args"];

    assert(assetUnitsBought.eq(assetUnits), "Invalid Asset units bought");
    assert(id.eq(asset.id), "Invalid Asset ID bought");

    // Asserting the sender's wallet if the token was transferred
    let buyerUSDT_BalanceAfter = await USDT_.balanceOf(buyer.address);
    assert(
      buyerUSDT_BalanceAfter.eq(buyerUSDT_BalanceBefore.sub(USDTassetCost)),
      "Invalid Buyer USDT Balance after Minting an asset"
    );
    let buyerTOKEN1155BalanceAfter = await TOKEN1155.balanceOf(
      buyer.address,
      tokenIdToHold
    );
    assert(
      buyerTOKEN1155BalanceAfter.eq(
        buyerTOKEN1155BalanceBefore.sub(TOKEN1155assetCost)
      ),
      `Invalid Buyer TOKEN1155 Balance after Minting an asset`
    );

    // Asserting the recipient's wallet if the token was received
    let recipientUSDT_BalanceAfter = await USDT_.balanceOf(recipient.address);
    assert(
      recipientUSDT_BalanceAfter.eq(
        recipientUSDT_BalanceBefore.add(USDTassetCost)
      ),
      "Invalid recipient USDT Balance after Buyer mints an asset"
    );
    let recipientTOKEN1155BalanceAfter = await TOKEN1155.balanceOf(
      recipient.address,
      tokenIdToHold
    );
    assert(
      recipientTOKEN1155BalanceAfter.eq(
        recipientTOKEN1155BalanceBefore.add(TOKEN1155assetCost)
      ),
      `Invalid recipient TOKEN1155 Balance after Minting an asset`
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = assetUnits;
    assert(
      buyerAssetCount.eq(expectedAssetCount),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });

  it("should mint multiple assets with single currency", async () => {
    const assetUnitsToBuy = 9;
    const maxUnits_ = 10;

    // Creating asset
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [maxUnits_, BN("1" + sixZeros)],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address],
        tokenId: [],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnitsToBuy // Units
    );

    const maxUnits = cost[0];
    const assetCost = cost[1][0];
    const totalAssetCost = assetCost.mul(assetUnitsToBuy);
    const expectedAssetCost = assetCost.mul(assetUnitsToBuy);
    // Transferring token
    await USDT_.transfer(buyer.address, totalAssetCost);

    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, totalAssetCost);
    let buyerBalanceBefore = await USDT_.balanceOf(buyer.address);
    let recipientBalanceBefore = await USDT_.balanceOf(recipient.address);

    // Minting token
    const mintAssetTx = await rain1155
      .connect(buyer)
      .mintAssets(asset.id, assetUnitsToBuy);

    // Asserting the event
    const [operator, from, to, id, assetUnitsBought] = (await getEventArgs(
      mintAssetTx,
      "TransferSingle",
      rain1155
    )) as TransferSingleEvent["args"];

    assert(assetUnitsBought.eq(assetUnitsToBuy), "Invalid Asset units bought");
    assert(id.eq(asset.id), "Invalid Asset ID bought");

    // Asserting the sender's wallet if the token was transferred
    let buyerBalanceAfter = await USDT_.balanceOf(buyer.address);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore.sub(expectedAssetCost)),
      "Invalid Buyer Balance after Minting an asset"
    );

    // Asserting the recipient's wallet if the token was received
    let recipientBalanceAfter = await USDT_.balanceOf(recipient.address);
    assert(
      recipientBalanceAfter.eq(recipientBalanceBefore.add(expectedAssetCost)),
      "Invalid recipient Balance after Buyer mints an asset"
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = assetUnitsToBuy;
    assert(
      buyerAssetCount.eq(expectedAssetCount),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });

  it("should not mint an asset if insufficient token balance", async () => {
    const assetUnits = 1;

    // Creating asset
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [10, BN("2" + sixZeros)],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address],
        tokenId: [],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnits // Units
    );

    const maxUnits = cost[0];
    const assetCost = cost[1][0];

    // Transferring token
    await USDT_.transfer(buyer.address, BN("1" + sixZeros));
    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, BN("1" + sixZeros));
    let buyerBalanceBefore = await USDT_.balanceOf(buyer.address);
    let recipientBalanceBefore = await USDT_.balanceOf(recipient.address);

    // Minting token
    await assertError(
      async () =>
        await rain1155.connect(buyer).mintAssets(asset.id, assetUnits),
      "ERC20: insufficient allowance",
      "Asset was minted even after having insufficient balance"
    );

    // Asserting the sender's wallet if the token was transferred
    let buyerBalanceAfter = await USDT_.balanceOf(buyer.address);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore),
      "Invalid Buyer Balance after failing to mint an asset"
    );

    // Asserting the recipient's wallet if the token was received
    let recipientBalanceAfter = await USDT_.balanceOf(recipient.address);
    assert(
      recipientBalanceAfter.eq(recipientBalanceBefore),
      "Invalid recipient Balance after Buyer fails to mint an asset"
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = 0;
    assert(
      buyerAssetCount.eq(expectedAssetCount),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });

  it("should mint multiple assets with multiple currencies", async () => {
    const assetUnits = 9;
    const tokenIdToHold = 2;
    const maxUnits = 10;
    // Creating asset
    // prettier-ignore
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([
          op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1),
          op(VM.Opcodes.CONSTANT, 2), op(VM.Opcodes.CONSTANT, 3)
        ])
      ],
      constants: [
        maxUnits, BN("1" + sixZeros),
        maxUnits, 5
      ],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address, TOKEN1155.address],
        tokenId: [tokenIdToHold],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnits // Units
    );

    const USDTassetCost = cost[1][0].mul(assetUnits);
    const TOKEN1155assetCost = cost[1][1].mul(assetUnits);

    // Transferring token
    await USDT_.transfer(buyer.address, USDTassetCost);
    await TOKEN1155.connect(buyer).mintTokens(
      tokenIdToHold,
      TOKEN1155assetCost
    );

    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, USDTassetCost);
    let buyerUSDT_BalanceBefore = await USDT_.balanceOf(buyer.address);
    let recipientUSDT_BalanceBefore = await USDT_.balanceOf(recipient.address);

    await TOKEN1155.connect(buyer).setApprovalForAll(rain1155.address, true);
    let buyerTOKEN1155BalanceBefore = await TOKEN1155.balanceOf(
      buyer.address,
      tokenIdToHold
    );
    let recipientTOKEN1155BalanceBefore = await TOKEN1155.balanceOf(
      recipient.address,
      tokenIdToHold
    );

    // Minting token
    const mintAssetTx = await rain1155
      .connect(buyer)
      .mintAssets(asset.id, assetUnits);

    // Asserting the event
    const [operator, from, to, id, assetUnitsBought] = (await getEventArgs(
      mintAssetTx,
      "TransferSingle",
      rain1155
    )) as TransferSingleEvent["args"];

    assert(assetUnitsBought.eq(assetUnits), "Invalid Asset units bought");
    assert(id.eq(asset.id), "Invalid Asset ID bought");

    // Asserting the sender's wallet if the token was transferred
    let buyerUSDT_BalanceAfter = await USDT_.balanceOf(buyer.address);
    assert(
      buyerUSDT_BalanceAfter.eq(buyerUSDT_BalanceBefore.sub(USDTassetCost)),
      "Invalid Buyer USDT Balance after Minting an asset"
    );
    let buyerTOKEN1155BalanceAfter = await TOKEN1155.balanceOf(
      buyer.address,
      tokenIdToHold
    );
    assert(
      buyerTOKEN1155BalanceAfter.eq(
        buyerTOKEN1155BalanceBefore.sub(TOKEN1155assetCost)
      ),
      `Invalid Buyer TOKEN1155 Balance after Minting an asset`
    );

    // Asserting the recipient's wallet if the token was received
    let recipientUSDT_BalanceAfter = await USDT_.balanceOf(recipient.address);
    assert(
      recipientUSDT_BalanceAfter.eq(
        recipientUSDT_BalanceBefore.add(USDTassetCost)
      ),
      "Invalid recipient USDT Balance after Buyer mints an asset"
    );
    let recipientTOKEN1155BalanceAfter = await TOKEN1155.balanceOf(
      recipient.address,
      tokenIdToHold
    );
    assert(
      recipientTOKEN1155BalanceAfter.eq(
        recipientTOKEN1155BalanceBefore.add(TOKEN1155assetCost)
      ),
      `Invalid recipient TOKEN1155 Balance after Minting an asset`
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = assetUnits;
    assert(
      buyerAssetCount.eq(expectedAssetCount),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });

  it("should not mint asset if user does not have sufficient approval of token", async () => {
    const assetUnits = 1;

    // Creating asset
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [10, BN("2" + sixZeros)],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT_.address],
        tokenId: [],
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    let createAssetTrx = await rain1155
      .connect(creator)
      .createNewAsset(assetConfig);

    const [assetId_, asset_, name, description] = await getEventArgs(
      createAssetTrx,
      "AssetCreated",
      rain1155
    );

    const asset = asset_ as AssetDetailsStruct;

    // Getting the asset cost
    const cost = await rain1155.getAssetCost(
      asset.id, // assetId
      buyer.address, // Buyer
      assetUnits // Units
    );

    const maxUnits = cost[0];
    const assetCost = cost[1][0];

    // Transferring token
    await USDT_.transfer(buyer.address, BN("2" + sixZeros));
    // Approving token
    await USDT_.connect(buyer).approve(rain1155.address, BN("1" + sixZeros));
    let buyerBalanceBefore = await USDT_.balanceOf(buyer.address);
    let recipientBalanceBefore = await USDT_.balanceOf(recipient.address);

    // Minting token
    await assertError(
      async () =>
        await rain1155.connect(buyer).mintAssets(asset.id, assetUnits),
      "ERC20: insufficient allowance",
      "Asset was minted even after having insufficient balance"
    );

    // Asserting the sender's wallet if the token was transferred
    let buyerBalanceAfter = await USDT_.balanceOf(buyer.address);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore),
      "Invalid Buyer Balance after failing to mint an asset"
    );

    // Asserting the recipient's wallet if the token was received
    let recipientBalanceAfter = await USDT_.balanceOf(recipient.address);
    assert(
      recipientBalanceAfter.eq(recipientBalanceBefore),
      "Invalid recipient Balance after Buyer fails to mint an asset"
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = 0;
    assert(
      buyerAssetCount.eq(expectedAssetCount),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });
});
