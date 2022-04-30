import { exec } from "child_process";
import hre, { ethers } from "hardhat";
import path from "path";
import { fetchFile, writeFile} from "../test/utils";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {    
  
    const blockNumber = (await ethers.provider.getBlock("latest")).number;

    console.log("Deploying smartcontract")
    const GameAssets = await ethers.getContractFactory("GameAssets");
    const gameAssets = await GameAssets.deploy();
    await gameAssets.deployed()
    console.log("contract deployed : ", gameAssets.address)

    const pathExampleConfig = path.resolve(__dirname, "../config/mumbai.json");
    const config = JSON.parse(fetchFile(pathExampleConfig));

    config.network = "mumbai";

    config.gameAssets = gameAssets.address;
    config.gameAssetsBlock = blockNumber;

    const pathConfigLocal = path.resolve(__dirname, "../config/mumbai.json");
    writeFile(pathConfigLocal, JSON.stringify(config, null, 2));


    // await sleep(30);

    // console.log("Verifying smartcontract")
    // await hre.run("verify:verify", {
    //   address: gameAssets.address,
    //   contract: "contracts/GameAssets.sol:GameAssets",
    //   constructorArguments: [],
    // });
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });