import { BigInt } from "@graphprotocol/graph-ts";
import { Asset, AssetsOwned, Currency, Holder, Rain1155, VMStateConfig } from "../generated/schema";
import {
  ApprovalForAll,
  AssetCreated,
  Initialize,
  TransferBatch,
  TransferSingle,
} from "../generated/Rain1155/Rain1155"
import { ERCType, getCurrency, getERCType, ONE_BI, ZERO_ADDRESS, ZERO_BI } from "./utils";

export function handleApprovalForAll(event: ApprovalForAll): void {}

export function handleAssetCreated(event: AssetCreated): void {
  let asset = new Asset(event.address.toHex() + "-" + event.params.assetId_.toString());
    asset.name = event.params.name_;
    asset.description = event.params.description_;
    asset.assetId = event.params.assetId_;
    asset.lootBoxID = event.params.asset_.lootBoxId;
    asset.recipient = event.params.asset_.recipient;
    asset.creationBlock = event.block.number;
    asset.creationTimestamp = event.block.timestamp;
    asset.tokenURI = event.params.asset_.tokenURI;

    let _currencies = event.params.asset_.currencies.token;
    let currencies: string[] = [];
    let tokenId: BigInt
    let count = 0;

    for (let i = 0; i < _currencies.length; i++) {
        let currency: Currency;
        let tokenType = getERCType(_currencies[i]);

        if (tokenType === ERCType.ERC20) {
            currency = getCurrency(_currencies[i], tokenType);
        }
        else {
            tokenId = event.params.asset_.currencies.tokenId[count]
            currency = getCurrency(_currencies[i], tokenType, tokenId);
            count++;
        }
        if (currencies) currencies.push(currency.id);       
    }

    asset.currencies = currencies;

    let vmStateConfig = new VMStateConfig(event.address.toHex() + "-" + event.params.assetId_.toString())
    vmStateConfig.constants = event.params.asset_.vmStateConfig.constants;
    vmStateConfig.sources = event.params.asset_.vmStateConfig.sources;
    vmStateConfig.save();

    asset.vmStateConfig = vmStateConfig.id;

    asset.save()

    let rain1155 = Rain1155.load(event.address.toHex());
    if (rain1155) {
        let assets = rain1155.assets;
        if (assets) assets.push(asset.id);
        rain1155.assets = assets;

        rain1155.totalAssets = rain1155.totalAssets.plus(ONE_BI);

        rain1155.save();
    }
}

export function handleInitialize(event: Initialize): void {
  let rain1155 = new Rain1155(event.address.toHex());
    //rain1155.vmStateBuilder = event.params.config_.vmStateBuilder;
    rain1155.deployBlock = event.block.number;
    rain1155.deployTimestamp = event.block.timestamp;
    rain1155.totalAssets = ZERO_BI;
    rain1155.assets = [];
    rain1155.holders = [];
    rain1155.save();
}

export function handleTransferBatch(event: TransferBatch): void {
  let ids = event.params.ids
  let values = event.params.values
  while (ids && values) {
      let id = ids.pop()!;
      let value = values.pop()!;

      let receiver = Holder.load(event.address.toHex() + "-" + event.params.to.toHex());
      if (!receiver) {
          receiver = new Holder(event.address.toHex() + "-" + event.params.to.toHex());
          receiver.address = event.params.to;
          receiver.assetsOwned = []
      }

      let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.to.toHex() + "-" + id.toString());
      if (!assetsOwned) {
          assetsOwned = new AssetsOwned(event.address.toHex() + "-" + event.params.to.toHex() + "-" + id.toString());
          assetsOwned.count = ZERO_BI;
          assetsOwned.asset = event.address.toHex() + "-" + id.toString();
          assetsOwned.assetId = id || ZERO_BI;
      }
      assetsOwned.count = assetsOwned.count.plus(value);
      assetsOwned.save();

      let holdersAssetsOwned = receiver.assetsOwned;
      if (holdersAssetsOwned && !holdersAssetsOwned.includes(assetsOwned.id)) {
          holdersAssetsOwned.push(assetsOwned.id);
      }
      receiver.assetsOwned = holdersAssetsOwned;

      receiver.save();

      if (event.params.from.notEqual(ZERO_ADDRESS)) {
          let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.from.toHex() + "-" + id.toString());
          if (assetsOwned) {
              assetsOwned.count = assetsOwned.count.minus(value);
              assetsOwned.save();
          }
      }

      let rain1155 = Rain1155.load(event.address.toHex());
      if (rain1155) {
          let holders = rain1155.holders;
          if (holders && !holders.includes(receiver.id)) {
              holders.push(receiver.id)
          }
          rain1155.holders = holders;
          rain1155.save();
      }
  }
}

export function handleTransferSingle(event: TransferSingle): void {
  let receiver = Holder.load(event.address.toHex() + "-" + event.params.to.toHex());
  if (!receiver) {
      receiver = new Holder(event.address.toHex() + "-" + event.params.to.toHex());
      receiver.address = event.params.to;
      receiver.assetsOwned = []
  }

  let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.to.toHex() + "-" + event.params.id.toString());
  if (!assetsOwned) {
      assetsOwned = new AssetsOwned(event.address.toHex() + "-" + event.params.to.toHex() + "-" + event.params.id.toString());
      assetsOwned.count = ZERO_BI;
      assetsOwned.asset = event.address.toHex() + "-" + event.params.id.toString();
      assetsOwned.assetId = event.params.id;
  }
  assetsOwned.count = assetsOwned.count.plus(event.params.value);
  assetsOwned.save();

  let holdersAssetsOwned = receiver.assetsOwned;
  if (holdersAssetsOwned && !holdersAssetsOwned.includes(assetsOwned.id)) {
      holdersAssetsOwned.push(assetsOwned.id);
  }
  receiver.assetsOwned = holdersAssetsOwned;

  receiver.save();

  if (event.params.from.notEqual(ZERO_ADDRESS)) {
      let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.from.toHex() + "-" + event.params.id.toString());
      if (assetsOwned) {
          assetsOwned.count = assetsOwned.count.minus(event.params.value);
          assetsOwned.save();
      }
  }

  let rain1155 = Rain1155.load(event.address.toHex());
  if (rain1155) {
      let holders = rain1155.holders;
      if (holders && !holders.includes(receiver.id)) {
          holders.push(receiver.id)
      }
      rain1155.holders = holders;
      rain1155.save();
  }
}