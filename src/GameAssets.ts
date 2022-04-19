import {
    AdminChanged,
    BaseURIChanged,
    ClassCreated,
    CreatorAdded,
    CreatorRemoved,
    Initialize,
    AssetCreated,
    AssetUpdated,
    OwnershipTransferred,
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

export function handleAdminChanged(event: AdminChanged): void {
    let gameAsset = GameAsset.load(event.address.toHex())
    if(gameAsset){
        gameAsset.admin = event.params._admin;
        gameAsset.save();
    }
}
export function handleBaseURIChanged(event: BaseURIChanged): void {
    let gameAsset = GameAsset.load(event.address.toHex())
    if(gameAsset){
        gameAsset.baseURI = event.params._baseURI;
        gameAsset.save();
    }
}
export function handleClassCreated(event: ClassCreated): void {
    let assetClass = new AssetClass(event.address.toHex() + "-" + event.params._classId.toString());
    assetClass.name = event.params._name;
    assetClass.descciption = event.params._description;
    assetClass.attributes = event.params._attributes;
    assetClass.save()

    let gameAsset = GameAsset.load(event.address.toHex());
    if(gameAsset){
        let classes = gameAsset.classes;
        if(classes) classes.push(assetClass.id);
        gameAsset.classes = classes;
        gameAsset.save()
    }
}
export function handleCreatorAdded(event: CreatorAdded): void {
    let creator = new Creator(event.address.toHex() + "-" + event.params._addedCreator.toHex());
    creator.address = event.params._addedCreator;
    creator.assetesCreated = [];
    creator.save();

    let gameAsset = GameAsset.load(event.address.toHex());
    
    if(gameAsset){
        let creators = gameAsset.creators
        if (creators) creators.push(creator.id);
        gameAsset.creators = creators;
        gameAsset.save()
    }
}
export function handleCreatorRemoved(event: CreatorRemoved): void {
    let gameAsset = GameAsset.load(event.address.toHex()); 
    
    if(gameAsset && gameAsset.creators ){
        let creators = gameAsset.creators;
        let newCreators: string[];
        for(let i=0;creators;i++){
            let creator = Creator.load(creators.pop())
            if(creator && creator.address.notEqual(event.params._removedCreator)){
                if(newCreators) newCreators.push(creator.id);
            }
        }
        gameAsset.creators = newCreators;
        gameAsset.save()
        store.remove("Creator", event.address.toHex() + "-" + event.params._removedCreator.toHex())
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
export function handleAssetUpdated(event: AssetUpdated): void {
    let asset = Asset.load(event.address.toHex() + "-" + event.params._assetId.toString());
    if(asset){
        asset.lootBoxID = event.params._asset.lootBoxId;

        let canMintConfig = CanMintConfig.load(asset.canMintConfig);
        if(canMintConfig){
            canMintConfig.constants = event.params._canMintConfig.constants;
            canMintConfig.sources = event.params._canMintConfig.sources;
            canMintConfig.argumentsLength = event.params._canMintConfig.argumentsLength;
            canMintConfig.stackLength = event.params._canMintConfig.stackLength;
            canMintConfig.save();
        }
        asset.save()
    }

}
export function handleOwnershipTransferred(event: OwnershipTransferred): void {
    let gameAsset = GameAsset.load(event.address.toHex());
    if(gameAsset){
        gameAsset.owner = event.params.newOwner;
        gameAsset.save()
    }

}
export function handleSnapshot(event: Snapshot): void {

}
export function handleTransferBatch(event: TransferBatch): void {

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