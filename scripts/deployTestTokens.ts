import { ethers } from "hardhat";
import { BN, eighteenZeros, fetchFile, writeFile } from "../test/utils"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import path from "path";

export let owner: SignerWithAddress

const LEVELS = Array.from(Array(8).keys()).map((value) =>
  BN(++value + eighteenZeros)
); // [1,2,3,4,5,6,7,8]

async function main() {
  const signers = await ethers.getSigners();

  owner = signers[0];

  const Erc20 = await ethers.getContractFactory("Token");
  const stableCoins = await ethers.getContractFactory("ReserveToken");
  const Erc721 = await ethers.getContractFactory("ReserveTokenERC721");
  const Erc1155 = await ethers.getContractFactory("ReserveTokenERC1155");

  const USDT = await stableCoins.deploy();
  await USDT.deployed();
  const BNB = await Erc20.deploy("Binance", "BNB");
  await BNB.deployed();
  const SOL = await Erc20.deploy("Solana", "SOL");
  await SOL.deployed();
  const XRP = await Erc20.deploy("Ripple", "XRP");
  await XRP.deployed();

  const BAYC = await Erc721.deploy("Boared Ape Yatch Club", "BAYC");
  await BAYC.deployed()

  const CARS = await Erc1155.deploy();
  await CARS.deployed();
  const PLANES = await Erc1155.deploy();
  await PLANES.deployed();
  const SHIPS = await Erc1155.deploy();
  await SHIPS.deployed();

  const rTKN = await Erc20.deploy("Rain Token", "rTKN");
  await rTKN.deployed()

  const pathExampleConfig = path.resolve(__dirname, "../config/TestContracts.json");
  const config = JSON.parse(fetchFile(pathExampleConfig));

  config.network = "mumbai";

  config.USDT_ERC20 = USDT.address;
  config.BNB_ERC20 = BNB.address;
  config.SOL_ERC20 = SOL.address;
  config.XRP_ERC20 = XRP.address;
  config.rTKN_ERC20 = rTKN.address;

  config.PLANES_ERC1155 = PLANES.address;
  config.CARS_ERC1155 = CARS.address;
  config.SHIPS_ERC1155 = SHIPS.address;

  config.BAYC_ERC721 = BAYC.address;

  console.log("Config : ", JSON.stringify(config, null, 2));
  const pathConfigLocal = path.resolve(__dirname, "../config/TestContracts.json");
  writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

}

main()
  .then(() => {
    const exit = process.exit;
    exit(0);
  })
  .catch((error) => {
    console.error(error);
    const exit = process.exit;
    exit(1);
  });
