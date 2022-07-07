import hre, { ethers } from "hardhat";
import path from "path";
import { fetchFile, writeFile} from "../test/utils";
import { Rain1155ConfigStruct } from "../typechain/Rain1155";

const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay * 1000));

async function main() {    
  
    const pathExampleConfig = path.resolve(__dirname, `../config/${hre.network.name}.json`);
    const config = JSON.parse(fetchFile(pathExampleConfig));

    console.log("Deploying contract")
    const StateBuilder = await ethers.getContractFactory("AllStandardOpsStateBuilder");
    const stateBuilder = await StateBuilder.deploy();
    await stateBuilder.deployed()
    console.log("contract deployed : ", stateBuilder.address)

    config.vmStateBuilder = stateBuilder.address;

    const pathConfigLocal = path.resolve(__dirname, `../config/${hre.network.name}.json`);
    writeFile(pathConfigLocal, JSON.stringify(config, null, 2));


    await sleep(30);

    console.log("Verifying smartcontract")
    await hre.run("verify:verify", {
      address: stateBuilder.address,
      contract: "contracts/AllStandardOpsStateBuilder.sol:AllStandardOpsStateBuilder",
      constructorArguments: [],
    });
  }
  
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });