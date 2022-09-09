import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import path from "path";
import {
  AssetConfigStruct,
  AssetDetailsStruct,
  Rain1155,
  Rain1155ConfigStruct,
} from "../../typechain/Rain1155";
import {
  BN,
  concat,
  eighteenZeros,
  fetchFile,
  getEventArgs,
  op,
} from "../utils";
import { BNB, CARS, deployer, PLANES, signers, USDT } from "./1_setup.test";
import { StateConfig, VM } from "rain-sdk";

let rain1155Config: Rain1155ConfigStruct;
let config;
let rain1155: Rain1155;
let creator: SignerWithAddress;
let assetConfig: AssetConfigStruct;
let recipient: SignerWithAddress;

describe("Create Asset test", () => {
  before(async () => {
    creator = signers[1];
    recipient = signers[2];

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

  it("Anyone should be able to create asset", async () => {
    let vmStateConfig_: StateConfig = {
      sources: [
        concat([
          op(VM.Opcodes.CONSTANT, 0),
          op(VM.Opcodes.CONSTANT, 1),

          op(VM.Opcodes.CONSTANT, 2),
          op(VM.Opcodes.CONSTANT, 3),

          op(VM.Opcodes.CONSTANT, 4),
          op(VM.Opcodes.CONSTANT, 5),

          op(VM.Opcodes.CONSTANT, 6),
          op(VM.Opcodes.CONSTANT, 7),
        ]),
      ],
      constants: [
        10,
        BN("1" + eighteenZeros),
        10,
        BN("25" + eighteenZeros),
        9,
        10,
        9,
        5,
      ],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT.address, BNB.address, CARS.address, PLANES.address],
        tokenId: [0, 0, 5, 15],
        tokenType: [0, 0, 1, 1]
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

    let token = assetConfig.currencies.token;
    let token_ = asset.currencies.token;

    let tokenType = assetConfig.currencies.tokenType;
    let tokenType_ = asset.currencies.tokenType;

    let tokenId = assetConfig.currencies.tokenId;
    let tokenId_ = asset.currencies.tokenId;

    expect(assetId_).to.deep.equals(BN(1));
    expect(name).to.deep.equals(assetConfig.name);
    expect(description).to.deep.equals(assetConfig.description);
    expect(asset.lootBoxId).to.deep.equals(BN(assetConfig.lootBoxId));
    expect(asset.recipient).to.deep.equals(assetConfig.recipient);
    expect(asset.vmStatePointer).to.not.null;

    expect(token_).to.deep.equals(token);
    expect(tokenType_).to.deep.equals(tokenType.map(type => BN(type)));
    expect(tokenId_).to.deep.equals(tokenId.map((id) => BN(id)));

    const [lootBoxId, id, vmStateConfig, vmStatePointer, currencies] =
      await rain1155.assets(assetId_);

    expect(BN(assetConfig.lootBoxId)).to.deep.equals(lootBoxId);
    expect(BN(1)).to.deep.equals(id);
    expect(asset.vmStatePointer).to.equals(vmStatePointer);

    [
      token,
      tokenType,
      tokenId,
    ] = currencies;

    expect(token_).to.deep.equals(token);
    expect(tokenType_).to.deep.equals(tokenType.map(type => BN(type)));
    expect(tokenId_).to.deep.equals(tokenId.map((id) => BN(id)));
  });
});
