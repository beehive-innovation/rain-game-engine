import hre, { ethers } from "hardhat";
import path from "path";
import { fetchFile, writeFile} from "../test/utils";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {    
  
    const blockNumber = (await ethers.provider.getBlock("latest")).number;

    console.log("Deploying smartcontract")
    const Rain1155 = await ethers.getContractFactory("Rain1155");
    const rain1155 = await Rain1155.deploy();
    await rain1155.deployed()
    console.log("contract deployed : ", rain1155.address)

    const pathExampleConfig = path.resolve(__dirname, "../config/mumbai.json");
    const config = JSON.parse(fetchFile(pathExampleConfig));

    config.network = "mumbai";

    config.rain1155 = rain1155.address;
    config.rain1155Block = blockNumber;

    const pathConfigLocal = path.resolve(__dirname, "../config/mumbai.json");
    writeFile(pathConfigLocal, JSON.stringify(config, null, 2));


    await sleep(30);

    console.log("Verifying smartcontract")
    await hre.run("verify:verify", {
      address: rain1155.address,
      contract: "contracts/Rain1155.sol:Rain1155",
      constructorArguments: [],
    });
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });