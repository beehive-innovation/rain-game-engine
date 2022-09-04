import hre from "hardhat";
import * as path from "path";
import fs from "fs";

import type { Contract } from "ethers";

/**
 * Write a file
 * @param _path Location of the file
 * @param file The file
 */
export function writeFile(_path: string, file: any): void {
  try {
    fs.writeFileSync(_path, file);
  } catch (error) {
    console.log(error);
  }
}

export function saveGameAssetsFactory(contract: Contract): void {
  const config = {
    network: hre.network.name,
    gameAssetsFactory: contract.address,
    gameAssetsFactoryBlock: contract.deployTransaction.blockNumber,
  };

  const pathConfigLocal = path.resolve(
    __dirname,
    `../config/${hre.network.name}.json`
  );
  writeFile(pathConfigLocal, JSON.stringify(config, null, 2));
}
