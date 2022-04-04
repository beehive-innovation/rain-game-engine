const { expect } = require("chai");
const { ethers } = require("hardhat");

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { it } from "mocha";
import type { Accessories } from "../typechain/Accessories"

import { eighteenZeros } from "./utils"

export let accessories: Accessories

export let owner: SignerWithAddress,
  creator: SignerWithAddress,
  creator2: SignerWithAddress

before("Deploy Accessories Contract and subgraph", async function () {
  const signers = await ethers.getSigners();

  owner = signers[0];
  creator = signers[1];
  creator2 = signers[2];
  
  const Accessories = await ethers.getContractFactory("Accessories");
  accessories = await Accessories.deploy();
  await accessories.deployed();
})

describe("Greeter", function () {
  it("Contract should be deployed.", async function () {
    expect(accessories.address).to.be.not.null;
    expect(await accessories.owner()).to.equals(owner.address);
  });

  it("Should add creator",async function () {
    await accessories.connect(owner).addCreator(creator.address);
    await accessories.connect(owner).addCreator(creator2.address);

    let expected_creator = await accessories.getCreators()
    expect(expected_creator).to.deep.include(creator.address);
    expect(expected_creator).to.deep.include(creator2.address);
  });

  it("Should create Item from creator.", async function () {
    await accessories.connect(creator).newItem(false, ethers.BigNumber.from("1"+ eighteenZeros), 4, 0);

    let ItemData = await accessories.items(1)

    let expectItem = {
      inLootBox: ItemData.inLootBox,
      price: ItemData.price,
      class: ItemData.class,
      rarity: ItemData.rarity,
      creator: ItemData.creator,
    }

    expect(expectItem).to.deep.equals({
      inLootBox: false,
      price: ethers.BigNumber.from("1"+ eighteenZeros),
      class: 4,
      rarity: 0,
      creator: creator.address
    })
  });

  it("Should create second Item from creator.", async function () {
    await accessories.connect(creator2).newItem(true, ethers.BigNumber.from("100"+ eighteenZeros), 0, 4);

    let ItemData = await accessories.items(2)

    let expectItem = {
      inLootBox: ItemData.inLootBox,
      price: ItemData.price,
      class: ItemData.class,
      rarity: ItemData.rarity,
      creator: ItemData.creator,
    }

    expect(expectItem).to.deep.equals({
      inLootBox: true,
      price: ethers.BigNumber.from("100"+ eighteenZeros),
      class: 0,
      rarity: 4,
      creator: creator2.address
    })
  });
});
