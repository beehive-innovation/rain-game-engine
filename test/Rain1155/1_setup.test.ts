import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import path from "path";
import { AllStandardOpsStateBuilder } from "../../typechain/AllStandardOpsStateBuilder";
import { fetchFile, writeFile } from "../utils";
import { Token } from "../../typechain/Token";
import type { ReserveToken } from "../../typechain/ReserveToken";
import type { ReserveTokenERC1155 } from "../../typechain/ReserveTokenERC1155";
import type { ReserveTokenERC721 } from "../../typechain/ReserveTokenERC721";

export let vmStateBuilder: AllStandardOpsStateBuilder;
export let signers: SignerWithAddress[];
export let deployer: SignerWithAddress;

export let BNB: Token;
export let SOL: Token;
export let XRP: Token;
export let rTKN: Token;

export let USDT: ReserveToken;

export let BAYC: ReserveTokenERC721;

export let CARS: ReserveTokenERC1155;
export let PLANES: ReserveTokenERC1155;
export let SHIPS: ReserveTokenERC1155;

before(async () => {
  signers = await ethers.getSigners();
  deployer = signers[0];

  const configPath = path.resolve(
    __dirname,
    "../../config/test/localhost.json"
  );
  const config = JSON.parse(fetchFile(configPath));

  const VmStateBuilder = await ethers.getContractFactory(
    "AllStandardOpsStateBuilder"
  );
  vmStateBuilder =
    (await VmStateBuilder.deploy()) as AllStandardOpsStateBuilder;
  await vmStateBuilder.deployed();

  config.network = "localhost";
  config.vmStateBuilder = vmStateBuilder.address;

  writeFile(configPath, JSON.stringify(config, null, 2));

  const Erc20 = await ethers.getContractFactory("Token");
  const stableCoins = await ethers.getContractFactory("ReserveToken");
  const Erc721 = await ethers.getContractFactory("ReserveTokenERC721");
  const Erc1155 = await ethers.getContractFactory("ReserveTokenERC1155");

  USDT = (await stableCoins.deploy()) as ReserveToken;
  await USDT.deployed();
  BNB = (await Erc20.deploy("Binance", "BNB")) as Token;
  await BNB.deployed();
  SOL = (await Erc20.deploy("Solana", "SOL")) as Token;
  await SOL.deployed();
  XRP = (await Erc20.deploy("Ripple", "XRP")) as Token;
  await XRP.deployed();

  BAYC = (await Erc721.deploy(
    "Bored Ape Yatch Club",
    "BAYC"
  )) as ReserveTokenERC721;
  await BAYC.deployed();

  CARS = (await Erc1155.deploy()) as ReserveTokenERC1155;
  await CARS.deployed();
  PLANES = (await Erc1155.deploy()) as ReserveTokenERC1155;
  await PLANES.deployed();
  SHIPS = (await Erc1155.deploy()) as ReserveTokenERC1155;
  await SHIPS.deployed();

  rTKN = (await Erc20.deploy("Rain Token", "rTKN")) as Token;
  await rTKN.deployed();
});
