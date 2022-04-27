import hre, { ethers } from "hardhat";
import * as path from "path";
import { saveGameAssetsFactory } from "./utils";

async function main() {
  const GameAssetsFactoryFactory = await hre.ethers.getContractFactory(
    "GameAssetsFactory"
  );
  const gameAssetsFactory = await GameAssetsFactoryFactory.deploy({gasLimit: 10000000});

  await gameAssetsFactory.deployed();

  saveGameAssetsFactory(gameAssetsFactory);

  console.log("GameAssetsFactory deployed ");
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
