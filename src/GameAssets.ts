import {
    Initialize,
    AssetCreated,
    Snapshot,
    TransferBatch,
    TransferSingle,
    URI
} from "../generated/GameAssets/GameAssets";

import { 
    GameAsset,
    Asset,
    PriceConfig, 
    CanMintConfig,
    Holder,
    AssetsOwned
} from "../generated/schema"
import { BigInt, log } from "@graphprotocol/graph-ts";
import { ONE_BI, ZERO_ADDRESS, ZERO_BI } from "./utils";

export function handleInitialize(event: Initialize): void {
    let gameAsset = new GameAsset(event.address.toHex())
    gameAsset.deployBlock = event.block.number;
    gameAsset.deployTimestamp = event.block.timestamp;
    gameAsset.totalAssets = ZERO_BI;
    gameAsset.assets = [];
    gameAsset.holders = [];
    gameAsset.save();
}

export function handleAssetCreated(event: AssetCreated): void {
    let asset = new Asset(event.address.toHex() + "-" + event.params._assetId.toString());
    asset.name = event.params._name;
    asset.descciption = event.params._description;
    asset.assetId = event.params._assetId;
    asset.lootBoxID = event.params._asset.lootBoxId;
    asset.recepient = event.params._asset.recepient;
    asset.creationBlock = event.block.number;
    asset.creationTimestamp = event.block.timestamp;

    let _currencies = event.params._asset.currencies;
    let currencies = asset.currencies;
    for(let i=0; i<_currencies.length;i++){
        currencies.push(_currencies[i].toHex());
    }

    asset.currencies = currencies;

    let priceConfig = new PriceConfig(event.address.toHex() + "-" + event.params._assetId.toString())
    priceConfig.constants = event.params._priceConfig.constants;
    priceConfig.sources = event.params._priceConfig.sources;
    priceConfig.argumentsLength = event.params._priceConfig.argumentsLength;
    priceConfig.stackLength = event.params._priceConfig.stackLength;
    priceConfig.save();

    asset.priceConfig = priceConfig.id;

    let canMintConfig = new CanMintConfig(event.address.toHex() + "-" + event.params._assetId.toString())
    canMintConfig.constants = event.params._canMintConfig.constants;
    canMintConfig.sources = event.params._canMintConfig.sources;
    canMintConfig.argumentsLength = event.params._canMintConfig.argumentsLength;
    canMintConfig.stackLength = event.params._canMintConfig.stackLength;
    canMintConfig.save();

    asset.canMintConfig = canMintConfig.id;

    asset.save()

    let gameAsset = GameAsset.load(event.address.toHex());
    if(gameAsset){
        let assets = gameAsset.assets;
        if(assets) assets.push(asset.id);
        gameAsset.assets = assets;

        gameAsset.totalAssets = gameAsset.totalAssets.plus(ONE_BI);

        gameAsset.save();
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

        let gameAsset = GameAsset.load(event.address.toHex());
        if(gameAsset){
            let holders = gameAsset.holders;
            if(holders && !holders.includes(receiver.id)){
                holders.push(receiver.id)
            }
            gameAsset.holders = holders;
            gameAsset.save();
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

    let gameAsset = GameAsset.load(event.address.toHex());
    if(gameAsset){
        let holders = gameAsset.holders;
        if(holders && !holders.includes(receiver.id)){
            holders.push(receiver.id)
        }
        gameAsset.holders = holders;
        gameAsset.save();
    }
}
export function handleURI(event: URI): void {

}