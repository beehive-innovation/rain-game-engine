import {
    Initialize,
    AssetCreated,
    Snapshot,
    TransferBatch,
    TransferSingle,
    URI
} from "../generated/Rain1155/Rain1155";

import { 
    Rain1155,
    Asset,
    PriceConfig, 
    CanMintConfig,
    Holder,
    AssetsOwned
} from "../generated/schema"
import { ONE_BI, ZERO_ADDRESS, ZERO_BI } from "./utils";

export function handleInitialize(event: Initialize): void {
    let rain1155 = new Rain1155(event.address.toHex())
    rain1155.deployBlock = event.block.number;
    rain1155.deployTimestamp = event.block.timestamp;
    rain1155.totalAssets = ZERO_BI;
    rain1155.assets = [];
    rain1155.holders = [];
    rain1155.save();
}

export function handleAssetCreated(event: AssetCreated): void {
    let asset = new Asset(event.address.toHex() + "-" + event.params._assetId.toString());
    asset.name = event.params._name;
    asset.description = event.params._description;
    asset.assetId = event.params._assetId;
    asset.lootBoxID = event.params._asset.lootBoxId;
    asset.recipient = event.params._asset.recepient;
    asset.creationBlock = event.block.number;
    asset.creationTimestamp = event.block.timestamp;
    asset.tokenURI = event.params._asset.tokenURI;

    let _currencies = event.params._asset.currencies;
    let currencies = asset.currencies;
    for(let i=0; i<_currencies.length;i++){
        currencies.push(_currencies[i].toHex());
    }

    asset.currencies = currencies;

    let priceConfig = new PriceConfig(event.address.toHex() + "-" + event.params._assetId.toString())
    priceConfig.constants = event.params._priceScript.constants;
    priceConfig.sources = event.params._priceScript.sources;
    priceConfig.argumentsLength = event.params._priceScript.argumentsLength;
    priceConfig.stackLength = event.params._priceScript.stackLength;
    priceConfig.save();

    asset.priceConfig = priceConfig.id;

    let canMintConfig = new CanMintConfig(event.address.toHex() + "-" + event.params._assetId.toString())
    canMintConfig.constants = event.params._canMintScript.constants;
    canMintConfig.sources = event.params._canMintScript.sources;
    canMintConfig.argumentsLength = event.params._canMintScript.argumentsLength;
    canMintConfig.stackLength = event.params._canMintScript.stackLength;
    canMintConfig.save();

    asset.canMintConfig = canMintConfig.id;

    asset.save()

    let rain1155 = Rain1155.load(event.address.toHex());
    if(rain1155){
        let assets = rain1155.assets;
        if(assets) assets.push(asset.id);
        rain1155.assets = assets;

        rain1155.totalAssets = rain1155.totalAssets.plus(ONE_BI);

        rain1155.save();
    }
}

export function handleSnapshot(event: Snapshot): void {

}
export function handleTransferBatch(event: TransferBatch): void {
    let ids = event.params.ids
    let values = event.params.values
    while(ids && values){
        let id = ids.pop()
        let value = values.pop()

        let receiver = Holder.load(event.address.toHex() + "-" + event.params.to.toHex());
        if(!receiver){
            receiver = new Holder(event.address.toHex() + "-" + event.params.to.toHex());
            receiver.address = event.params.to;
            receiver.assetsOwned = []
        }
            
        let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.to.toHex() + "-" + id.toString());
        if(!assetsOwned){
            assetsOwned = new AssetsOwned(event.address.toHex() + "-" + event.params.to.toHex() + "-" + id.toString());
            assetsOwned.count = ZERO_BI;
            let asset = Asset.load(event.address.toHex() + "-" + id.toString());
            if(asset){
                assetsOwned.asset = asset.id;
                assetsOwned.assetId = asset.assetId;
            }
        }
        assetsOwned.count = assetsOwned.count.plus(value);
        assetsOwned.save();

        let holdersAssetsOwned = receiver.assetsOwned;
        if(holdersAssetsOwned && !holdersAssetsOwned.includes(assetsOwned.id)){
            holdersAssetsOwned.push(assetsOwned.id);
        }
        receiver.assetsOwned = holdersAssetsOwned;
        
        receiver.save();

        if(event.params.from.notEqual(ZERO_ADDRESS)){
            let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.from.toHex() + "-" + id.toString());
            if(assetsOwned){
                assetsOwned.count = assetsOwned.count.minus(value);
                assetsOwned.save();
            }
        }

        let rain1155 = Rain1155.load(event.address.toHex());
        if(rain1155){
            let holders = rain1155.holders;
            if(holders && !holders.includes(receiver.id)){
                holders.push(receiver.id)
            }
            rain1155.holders = holders;
            rain1155.save();
        }
    }

}

export function handleTransferSingle(event: TransferSingle): void {
    let receiver = Holder.load(event.address.toHex() + "-" + event.params.to.toHex());
    if(!receiver){
        receiver = new Holder(event.address.toHex() + "-" + event.params.to.toHex());
        receiver.address = event.params.to;
        receiver.assetsOwned = []
    }
        
    let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.to.toHex() + "-" + event.params.id.toString());
    if(!assetsOwned){
        assetsOwned = new AssetsOwned(event.address.toHex() + "-" + event.params.to.toHex() + "-" + event.params.id.toString());
        assetsOwned.count = ZERO_BI;
        let asset = Asset.load(event.address.toHex() + "-" + event.params.id.toString());
        if(asset){
            assetsOwned.asset = asset.id;
            assetsOwned.assetId = asset.assetId;
        }
    }
    assetsOwned.count = assetsOwned.count.plus(event.params.value);
    assetsOwned.save();

    let holdersAssetsOwned = receiver.assetsOwned;
    if(holdersAssetsOwned && !holdersAssetsOwned.includes(assetsOwned.id)){
        holdersAssetsOwned.push(assetsOwned.id);
    }
    receiver.assetsOwned = holdersAssetsOwned;
    
    receiver.save();

    if(event.params.from.notEqual(ZERO_ADDRESS)){
        let assetsOwned = AssetsOwned.load(event.address.toHex() + "-" + event.params.from.toHex() + "-" + event.params.id.toString());
        if(assetsOwned){
            assetsOwned.count = assetsOwned.count.minus(event.params.value);
            assetsOwned.save();
        }
    }

    let rain1155 = Rain1155.load(event.address.toHex());
    if(rain1155){
        let holders = rain1155.holders;
        if(holders && !holders.includes(receiver.id)){
            holders.push(receiver.id)
        }
        rain1155.holders = holders;
        rain1155.save();
    }
}
export function handleURI(event: URI): void {

}