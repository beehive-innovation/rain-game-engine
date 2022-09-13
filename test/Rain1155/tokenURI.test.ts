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
let buyer: SignerWithAddress;

describe("Rain1155 TokenURI test", () => {
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

    let vmStateConfig_: StateConfig = {
      sources: [
        concat([op(VM.Opcodes.CONSTANT, 0), op(VM.Opcodes.CONSTANT, 1)]),
      ],
      constants: [10, BN("1000000")],
    };

    assetConfig = {
      lootBoxId: 0,
      name: "asset 1",
      description: "Asset Description",
      recipient: recipient.address,
      currencies: {
        token: [USDT.address],
        tokenId: [0],
        tokenType: [0]
      },
      tokenURI: "TOKEN_URI",
      vmStateConfig: vmStateConfig_,
    };

    await rain1155.connect(creator).createNewAsset(assetConfig);

    await USDT.connect(buyer).mintTokens(1);
    await USDT.connect(buyer).approve(rain1155.address, BN("1000000"));

    await rain1155.connect(buyer).mintAssets(1, 1);
  });

  it("Should return correct tokenURI", async () => {
    expect(await rain1155.uri(1)).to.equals("TOKEN_URI");
  });
});
