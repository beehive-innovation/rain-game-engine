import {
    ClassCreated,
    Initialize,
    AssetCreated,
    Snapshot,
    TransferBatch,
    TransferSingle,
    URI
} from "../generated/templates/GameAssetsTemplate/GameAssets";

import { 
    GameAsset,
    Asset,
    AssetClass,
    PriceConfig, 
    CanMintConfig,
    Creator,
    Holder,
    AssetsOwned
} from "../generated/schema"
import { store, BigInt, log } from "@graphprotocol/graph-ts";
import { ONE_BI, ZERO_ADDRESS, ZERO_BI } from "./utils";

export function handleClassCreated(event: ClassCreated): void {
    let gameAsset = GameAsset.load(event.address.toHex());
    
    if(gameAsset){
        gameAsset.classCount = gameAsset.classCount.plus(ONE_BI);
        let classCount = gameAsset.classCount;
        let assetClass = new AssetClass(event.address.toHex() + "-" + classCount.toString());
        let params = event.params._classData
        let attributes = params.slice(2,params.length)
        assetClass.name = event.params._classData[0];
        assetClass.descciption = event.params._classData[1];
        assetClass.attributes = attributes;
        assetClass.save()

        let classes = gameAsset.classes;
        if(classes) classes.push(assetClass.id);
        gameAsset.classes = classes;
        gameAsset.save()
    }
}

export function handleInitialize(event: Initialize): void {
    let gameAsset = GameAsset.load(event.address.toHex())
    if(gameAsset){
        gameAsset.baseURI = event.params.config._baseURI;
        gameAsset.owner = event.params.config._creator;
        gameAsset.save();
    }
}

export function handleAssetCreated(event: AssetCreated): void {
    let asset = new Asset(event.address.toHex() + "-" + event.params._assetId.toString());
    asset.name = event.params._name;
    asset.descciption = event.params._description;
    asset.assetId = event.params._assetId;
    asset.lootBoxID = event.params._asset.lootBoxId;
    asset.assetClass = getClass(event.address.toHex(), event.params._asset.assetClass);
    asset.creator = event.params._asset.creator;
    asset.rarity = event.params._asset.rarity;
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

    let creator = Creator.load(event.address.toHex() + "-" + event.params._asset.creator.toHex());
    if(creator){
        let assetCreated = creator.assetesCreated;
        if(assetCreated) assetCreated.push(asset.id);
        creator.assetesCreated = assetCreated;

        creator.save();
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

function getClass(gameAsset: string ,_classId: BigInt): string {
    let assetClass = AssetClass.load(gameAsset + "-" + _classId.toString());
    if(assetClass){
        return assetClass.id;
    }else{
        log.info("Invalid classId for Asset {}", [_classId.toString()])
    }
    return "";
}