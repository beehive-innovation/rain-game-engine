import { ethers } from "hardhat";
import env from "hardhat";
import path from "path";
import { GameAssetsFactory__factory } from "../typechain/factories/GameAssetsFactory__factory"
import { fetchFile, writeFile} from "../test/utils"

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {    
  const signers = await ethers.getSigners();

  let owner = signers[0];
    // const GameAssetsFactory = await ethers.getContractFactory("GameAssetsFactory")
    let gameAssetsFactory = await new GameAssetsFactory__factory(owner).deploy({gasLimit: 10000000});
    await gameAssetsFactory.deployed()

    const pathExampleConfig = path.resolve(__dirname, "../config/mumbai.json");
    const config = JSON.parse(fetchFile(pathExampleConfig));

    config.network = "mumbai";

    config.gameAssetsFactory = gameAssetsFactory.address;
    config.gameAssetsFactoryBlock = gameAssetsFactory.deployTransaction.blockNumber;

    console.log("Config : ", __dirname, JSON.stringify(config, null, 2));
    const pathConfigLocal = path.resolve(__dirname, "../config/mumbai.json");
    writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

  //   await sleep(20);
  //   await env.run("verify:verify", {
  //   address: gameAssetsFactory.address,
  //   contract: "contracts/GameAssetsFactory.sol:GameAssetsFactory",
  //   constructorArguments: [],
  // })
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });