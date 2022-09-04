import { BigNumber, BigNumberish } from "ethers/lib/ethers";
import { ethers, web3 } from "hardhat";
import { BN } from "./utils";

export async function getPrivate_uint256(
  contractAddress: string,
  slotIndex: BigNumberish
): Promise<BigNumber> {
  const variable = await ethers.provider.getStorageAt(
    contractAddress,
    slotIndex
  );
  return BN(variable);
}

export async function getPrivate_string(
  contractAddress: string,
  slotIndex: BigNumberish
): Promise<string> {
  const variable = await ethers.provider.getStorageAt(
    contractAddress,
    slotIndex
  );
  const hexLength = "0x" + variable.slice(64);
  const length = parseInt(hexLength, 16);
  return web3.utils.toAscii(variable.slice(0, length + 2));
}

const standardizeInput = (input) =>
  web3.utils.leftPad(web3.utils.toHex(input).replace("0x", ""), 64, "0");

export async function getPrivate_address(
  contractAddress: string,
  slotIndex: BigNumberish
): Promise<string> {
  const variable = await ethers.provider.getStorageAt(
    contractAddress,
    slotIndex
  );
  return "0x" + variable.slice(26);
}

export function getMappingSlot(
  key: BigNumberish,
  slot: BigNumberish
): BigNumberish {
  const slot_ = standardizeInput(slot);
  const key_ = standardizeInput(key);
  return web3.utils.soliditySha3(
    { t: "uint", v: key_ },
    { t: "uint", v: slot_ }
  );
}

export async function getPrivate_mapping_uint256_address(
  contractAddress: string,
  slotIndex: number,
  key: number
): Promise<string> {
  const new_key = web3.utils.soliditySha3(
    { t: "uint", v: key },
    { t: "uint", v: slotIndex }
  );
  return await getPrivate_address(contractAddress, new_key);
}

export async function getPrivate_mapping_address_uint256(
  contractAddress: string,
  slotIndex: number,
  key: string
): Promise<BigNumberish> {
  const new_key = web3.utils.soliditySha3(
    { t: "uint", v: key },
    { t: "uint", v: slotIndex }
  );
  return await ethers.provider.getStorageAt(contractAddress, new_key);
}

export async function getPrivate_nestedMapping_uint256(
  contractAddress: string,
  slotIndex: number,
  key1: number,
  key2: string
): Promise<BigNumber> {
  const location1 = web3.utils.soliditySha3(
    { t: "uint", v: standardizeInput(key1) },
    { t: "uint", v: standardizeInput(slotIndex) }
  );
  const location2 = web3.utils.soliditySha3(
    { t: "uint", v: key2 },
    { t: "uint", v: location1 }
  );
  return await getPrivate_uint256(contractAddress, location2);
}
