import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import path from "path";
import {
  AssetConfigStruct,
  Rain1155,
  Rain1155ConfigStruct,
} from "../../typechain/Rain1155";
import {
  BN,
  concat,
  eighteenZeros,
  fetchFile,
  getEventArgs,
  getPrivate_mapping_address,
  getPrivate_nestedMapping_uint256,
  getPrivate_uint256,
  op,
  ZERO_ADDRESS,
} from "../utils";
import { BNB, CARS, deployer, PLANES, signers, SOL, USDT } from "./1_setup.test";
import { StateConfig, VM } from "rain-sdk";
let rain1155Config: Rain1155ConfigStruct;
let config;
let rain1155: Rain1155;
let creator: SignerWithAddress;
let assetConfig: AssetConfigStruct;
let recipient: SignerWithAddress;
let buyer: SignerWithAddress;

const paymentTokenSlot = 5;

xdescribe("Rain1155 getAssetCost test", () => {
  describe("single ERC20 test", () => {
    const maxUnits = 10;
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
        constants: [maxUnits, BN("1000000")],
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

      await rain1155.connect(creator).createNewAsset(assetConfig);
    });

    it("Should return correct entryPoint for asset with one currency", async () => {
      expect(await getPrivate_nestedMapping_uint256(rain1155.address, paymentTokenSlot, 1, USDT.address)).to.equals(BN(0));
    });
  });

  describe("single ERC1155 test", () => {
    const maxUnits = 10;
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
        constants: [maxUnits, 20],
      };

      assetConfig = {
        lootBoxId: 0,
        name: "asset 1",
        description: "Asset Description",
        recipient: recipient.address,
        currencies: {
          token: [PLANES.address],
          tokenType: [1],
          tokenId: [10],
        },
        tokenURI: "TOKEN_URI",
        vmStateConfig: vmStateConfig_,
      };

      await rain1155.connect(creator).createNewAsset(assetConfig);
    });

    it("Should return correct entryPoint for asset with one currency", async () => {
        expect(await getPrivate_nestedMapping_uint256(rain1155.address, paymentTokenSlot, 1, USDT.address)).to.equals(BN(0));
      });
  });

  describe("multiple ERC20/ERC1155 test", () => {
    const max_units  = 10;
    const BNB_Price = BN(1 + eighteenZeros);
    const SOL_Price = BN(2 + eighteenZeros);
    const PLANES_Price = 5;
    const CARS_Price = 12;

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
          concat([
            op(VM.Opcodes.CONSTANT, 0),
            op(VM.Opcodes.CONSTANT, 1),

            op(VM.Opcodes.CONSTANT, 2),
            op(VM.Opcodes.CONSTANT, 3),

            op(VM.Opcodes.CONSTANT, 4),
            op(VM.Opcodes.CONSTANT, 5),

            op(VM.Opcodes.CONSTANT, 6),
            op(VM.Opcodes.CONSTANT, 5),
          ]),
        ],
        constants: [max_units, BNB_Price, max_units, SOL_Price, max_units, PLANES_Price, max_units, CARS_Price],
      };

      assetConfig = {
        lootBoxId: 0,
        name: "asset 1",
        description: "Asset Description",
        recipient: recipient.address,
        currencies: {
          token: [BNB.address, SOL.address, PLANES.address, CARS.address],
          tokenType: [0, 0, 1, 1],
          tokenId: [0, 0, 2, 4],
        },
        tokenURI: "TOKEN_URI",
        vmStateConfig: vmStateConfig_,
      };

      await rain1155.connect(creator).createNewAsset(assetConfig);
    });

    it("Should return correct entryPoint for asset with one currency", async () => {
        expect(await getPrivate_mapping_address(rain1155.address, paymentTokenSlot, 1)).to.equals(BNB.address.toLowerCase());
        // expect(await getPrivate_nestedMapping_uint256(rain1155.address, paymentTokenSlot, 1, SOL.address)).to.equals(BN(1));
        // expect(await getPrivate_nestedMapping_uint256(rain1155.address, paymentTokenSlot, 1, PLANES.address)).to.equals(BN(2));
        // expect(await getPrivate_nestedMapping_uint256(rain1155.address, paymentTokenSlot, 1, CARS.address)).to.equals(BN(3));
      });
  });
});
