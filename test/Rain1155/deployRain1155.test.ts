import { expect } from "chai";
import { ethers } from "hardhat";
import path from "path";
import {
  InitializeEvent,
  Rain1155,
  Rain1155ConfigStruct,
} from "../../typechain/Rain1155";
import { fetchFile, getEventArgs, writeFile } from "../utils";
import { deployer } from "./1_setup.test";

let rain1155: Rain1155;
let config;

describe("Rain1155 Deploy test", () => {
  let rain1155Config: Rain1155ConfigStruct;
  before(async () => {
    const configPath = path.resolve(
      __dirname,
      "../../config/test/localhost.json"
    );

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

    config.rain1155 = rain1155.address;
    config.rain1155Block = rain1155.deployTransaction.blockNumber;
    writeFile(configPath, JSON.stringify(config, null, 2));
  });

  it("It should deploy rain1155 contract", async () => {
    expect(rain1155.address).to.not.null;

    const [deployer_, config_] = (await getEventArgs(
      rain1155.deployTransaction,
      "Initialize",
      rain1155
    )) as InitializeEvent["args"];
    expect(deployer_).to.equals(deployer.address);
    expect(config_.vmStateBuilder).to.equals(config.vmStateBuilder);
  });
});
