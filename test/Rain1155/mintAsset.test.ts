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
  eighteenZeros,
  fetchFile,
  getEventArgs,
  op,
  sixZeros,
  ZERO_ADDRESS,
} from "../utils";
import { BNB, CARS, deployer, PLANES, signers, USDT } from "./1_setup.test";
import { StateConfig, VM } from "rain-sdk";
import { assert } from "console";

let rain1155Config: Rain1155ConfigStruct;
let config;
let rain1155: Rain1155;
let creator: SignerWithAddress;
let assetConfig: AssetConfigStruct;
let recipient: SignerWithAddress;
let buyer: SignerWithAddress;

describe.only("Mint Asset test", async function () {
  before(async () => {
    creator = signers[1];
    recipient = signers[2];
    buyer = signers[3];

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
        token: [USDT.address],
        tokenType: [0],
        tokenId: [0],
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
    await USDT.transfer(buyer.address, assetCost);

    // Approving token
    await USDT.connect(buyer).approve(rain1155.address, assetCost);
    let buyerBalanceBefore = await USDT.balanceOf(buyer.address);
    let recepientBalanceBefore = await USDT.balanceOf(recipient.address);

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

    assert(operator == rain1155.address, "Invalid Operator Address");
    assert(to == buyer.address, "Invalid TO Address");
    assert(from == ZERO_ADDRESS, "Invalid FROM Address");
    assert(assetUnitsBought.eq(assetUnits), "Invalid Asset units bought");
    assert(id.eq(asset.id), "Invalid Asset ID bought");

    // Asserting the sender's wallet if the token was transferred
    let buyerBalanceAfter = await USDT.balanceOf(buyer.address);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore.sub(assetCost)),
      "Invalid Buyer Balance after Minting an asset"
    );

    // Asserting the recepient's wallet if the token was received
    let recepientBalanceAfter = await USDT.balanceOf(recipient.address);
    assert(
      recepientBalanceAfter.eq(recepientBalanceBefore.add(assetCost)),
      "Invalid Recepient Balance after Buyer mints an asset"
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = assetUnits;
    assert(
      buyerAssetCount.eq(1),
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
        token: [USDT.address],
        tokenType: [0],
        tokenId: [0],
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
    await USDT.transfer(buyer.address, assetCost);

    // Approving token
    await USDT.connect(buyer).approve(rain1155.address, assetCost);

    // Minting token
    await assertError(
     async () => await rain1155
       .connect(buyer)
       .mintAssets(asset.id, assetUnits),
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
        token: [USDT.address],
        tokenType: [0],
        tokenId: [0],
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
    await USDT.transfer(buyer.address, assetCost);

    // Approving token
    await USDT.connect(buyer).approve(rain1155.address, assetCost);

    // Minting token
    await assertError(
     async () => await rain1155
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
        token: [USDT.address],
        tokenType: [0],
        tokenId: [0],
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
    await USDT.transfer(buyer.address, totalAssetCost);

    // Approving token
    await USDT.connect(buyer).approve(rain1155.address, totalAssetCost);
    let buyerBalanceBefore = await USDT.balanceOf(buyer.address);
    let recepientBalanceBefore = await USDT.balanceOf(recipient.address);

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

    assert(operator == rain1155.address, "Invalid Operator Address");
    assert(to == buyer.address, "Invalid TO Address");
    assert(from == ZERO_ADDRESS, "Invalid FROM Address");
    assert(assetUnitsBought.eq(maxUnits_), "Invalid Asset units bought");
    assert(id.eq(asset.id), "Invalid Asset ID bought");

    // Asserting the sender's wallet if the token was transferred
    let buyerBalanceAfter = await USDT.balanceOf(buyer.address);
    assert(
      buyerBalanceAfter.eq(buyerBalanceBefore.sub(expectedAssetCost)),
      "Invalid Buyer Balance after Minting an asset"
    );

    // Asserting the recepient's wallet if the token was received
    let recepientBalanceAfter = await USDT.balanceOf(recipient.address);
    assert(
      recepientBalanceAfter.eq(recepientBalanceBefore.add(expectedAssetCost)),
      "Invalid Recepient Balance after Buyer mints an asset"
    );

    // Asserting if the sender has received the asset
    const buyerAssetCount = await rain1155.balanceOf(buyer.address, asset.id);
    const expectedAssetCount = maxUnits_;
    assert(
      buyerAssetCount.eq(1),
      `Invalid Asset Count expected ${expectedAssetCount} actual ${buyerAssetCount}`
    );
  });

});
