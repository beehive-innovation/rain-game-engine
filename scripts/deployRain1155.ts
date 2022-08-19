import hre, { ethers } from "hardhat";
import path from "path";
//import { VmStateConfig } from "../generated/schema";
import { fetchFile, writeFile} from "../test/utils";
import { Rain1155ConfigStruct } from "../typechain/Rain1155";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {    
  
    const blockNumber = (await ethers.provider.getBlock("latest")).number;
    const pathExampleConfig = path.resolve(__dirname, `../config/${hre.network.name}.json`);
    const config = JSON.parse(fetchFile(pathExampleConfig));

    const rain1155Config: Rain1155ConfigStruct = {
      vmStateBuilder: config.vmStateBuilder
    }

    console.log("Deploying contract")
    const Rain1155 = await ethers.getContractFactory("Rain1155");
    const rain1155 = await Rain1155.deploy(rain1155Config);
    await rain1155.deployed()
    console.log("contract deployed : ", rain1155.address)


    config.network = hre.network.name;

    config.rain1155 = rain1155.address;
    config.rain1155Block = blockNumber;

    const pathConfigLocal = path.resolve(__dirname, `../config/${hre.network.name}.json`);
    writeFile(pathConfigLocal, JSON.stringify(config, null, 2));

    await sleep(30);

    console.log("Verifying smartcontract")
    await hre.run("verify:verify", {
      address: rain1155.address,
      contract: "contracts/Rain1155.sol:Rain1155",
      constructorArguments: [rain1155Config],
    });
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });