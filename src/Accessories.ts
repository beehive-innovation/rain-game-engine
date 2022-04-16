import {
    AdminChanged,
    BaseURIChanged,
    ClassCreated,
    CreatorAdded,
    CreatorRemoved,
    Initialize,
    ItemCreated,
    ItemUpdated,
    OwnershipTransferred,
    Snapshot,
    TransferBatch,
    TransferSingle,
    URI
} from "../generated/templates/AccessoriesTemplate/Accessories";

import { 
    Accessory,
    Item,
    ItemClass,
    PriceConfig, 
    CanMintConfig,
    Creator,
    Holder,
    ItemOwned
} from "../generated/schema"
import { store, BigInt, log, Bytes, Address } from "@graphprotocol/graph-ts";
import { ONE_BI, ZERO_BI } from "./utils";

export function handleAdminChanged(event: AdminChanged): void {
    let accessory = Accessory.load(event.address.toHex())
    if(accessory){
        accessory.admin = event.params._admin;
        accessory.save();
    }
}
export function handleBaseURIChanged(event: BaseURIChanged): void {
    let accessory = Accessory.load(event.address.toHex())
    if(accessory){
        accessory.baseURI = event.params._baseURI;
        accessory.save();
    }
}
export function handleClassCreated(event: ClassCreated): void {
    let newClass = new ItemClass(event.address.toHex() + "-" + event.params._classId.toString());
    newClass.attributes = event.params._attributes;
    newClass.save()

    let accessory = Accessory.load(event.address.toHex());
    if(accessory){
        let classes = accessory.classes;
        if(classes) classes.push(newClass.id);
        accessory.classes = classes;
        accessory.save()
    }
}
export function handleCreatorAdded(event: CreatorAdded): void {
    let creator = new Creator(event.address.toHex() + "-" + event.params._addedCreator.toHex());
    creator.address = event.params._addedCreator;
    creator.save();

    let accessory = Accessory.load(event.address.toHex());
    
    if(accessory){
        let creators = accessory.creators
        if (creators) creators.push(creator.id);
        accessory.creators = creators;
        accessory.save()
    }
}
export function handleCreatorRemoved(event: CreatorRemoved): void {
    let accessory = Accessory.load(event.address.toHex()); 
    
    if(accessory && accessory.creators ){
        let creators = accessory.creators;
        let newCreators: string[];
        for(let i=0;creators;i++){
            let creator = Creator.load(creators.pop())
            if(creator && creator.address.notEqual(event.params._removedCreator)){
                if(newCreators) newCreators.push(creator.id);
            }
        }
        accessory.creators = newCreators;
        accessory.save()
        store.remove("Creator", event.address.toHex() + "-" + event.params._removedCreator.toHex())
    }
}
export function handleInitialize(event: Initialize): void {
    let accessory = Accessory.load(event.address.toHex())
    if(accessory){
        accessory.baseURI = event.params.config._baseURI;
        accessory.owner = event.params.config._accessoriesCreator;
        accessory.save();
    }
}
export function handleItemCreated(event: ItemCreated): void {
    let item = new Item(event.address.toHex() +"-"+ event.params._itemId.toString());
    item.itemId = event.params._itemId;
    item.lootBoxID = event.params._item.lootBoxId;
    item.itemClass = getClass(event.address.toHex(), event.params._item.itemClass);
    item.creator = event.params._item.creator;
    item.rarity = event.params._item.rarity;
    item.creationBock = event.block.number;
    item.creationTimestam = event.block.timestamp;

    let _currencies = event.params._item.currencies;
    let currencies = item.currencies;
    for(let i=0; i<_currencies.length;i++){
        currencies.push(_currencies[i].toHex());
    }

    item.currencies = currencies;

    let priceConfig = new PriceConfig(event.address.toHex() +"-"+ event.params._itemId.toString())
    priceConfig.constants = event.params._priceConfig.constants;
    priceConfig.sources = event.params._priceConfig.sources;
    priceConfig.argumentsLength = event.params._priceConfig.argumentsLength;
    priceConfig.stackLength = event.params._priceConfig.stackLength;
    priceConfig.save();

    item.priceConfig = priceConfig.id;

    let canMintConfig = new CanMintConfig(event.address.toHex() + "-" + event.params._itemId.toString())
    canMintConfig.constants = event.params._canMintConfig.constants;
    canMintConfig.sources = event.params._canMintConfig.sources;
    canMintConfig.argumentsLength = event.params._canMintConfig.argumentsLength;
    canMintConfig.stackLength = event.params._canMintConfig.stackLength;
    canMintConfig.save();

    item.canMintConfig = canMintConfig.id;

    item.save()

    let accessory = Accessory.load(event.address.toHex());
    if(accessory){
        let items = accessory.items;
        if(items) items.push(item.id);
        accessory.items = items;

        accessory.totalItems = accessory.totalItems.plus(ONE_BI);

        accessory.save();
    }

}
export function handleItemUpdated(event: ItemUpdated): void {
    let item = Item.load(event.address.toHex() + "-" + event.params._itemId.toString());
    if(item){
        item.lootBoxID = event.params._item.lootBoxId;

        let canMintConfig = CanMintConfig.load(item.canMintConfig);
        if(canMintConfig){
            canMintConfig.constants = event.params._canMintConfig.constants;
            canMintConfig.sources = event.params._canMintConfig.sources;
            canMintConfig.argumentsLength = event.params._canMintConfig.argumentsLength;
            canMintConfig.stackLength = event.params._canMintConfig.stackLength;
            canMintConfig.save();
        }
        item.save()
    }

}
export function handleOwnershipTransferred(event: OwnershipTransferred): void {
    let accessory = Accessory.load(event.address.toHex());
    if(accessory){
        accessory.owner = event.params.newOwner;
        accessory.save()
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
        receiver.itemsOwned = []
    }
        
    let itemsOwned = ItemOwned.load(event.address.toHex() + "-" + event.params.to.toHex() + "-" + event.params.id.toString());
    if(!itemsOwned){
        itemsOwned = new ItemOwned(event.address.toHex() + "-" + event.params.to.toHex() + "-" + event.params.id.toString());
        itemsOwned.count = ZERO_BI;
        let item = Item.load(event.address.toHex() + "-" + event.params.id.toString());
        if(item){
            itemsOwned.item = item.id;
            itemsOwned.itemId = item.itemId;
        }
    }
    itemsOwned.count = itemsOwned.count.plus(event.params.value);
    itemsOwned.save();

    let holdersitemsOwned = receiver.itemsOwned;
    if(holdersitemsOwned && !holdersitemsOwned.includes(itemsOwned.id)){
        holdersitemsOwned.push(itemsOwned.id);
    }
    receiver.itemsOwned = holdersitemsOwned;
    
    receiver.save();
}
export function handleURI(event: URI): void {

}

function getClass(accessory: string ,_classId: BigInt): string {
    let itemClass = ItemClass.load(accessory + "-" + _classId.toString());
    if(itemClass){
        return itemClass.id;
    }else{
        log.critical("Invalid classId for Items {}", [_classId.toString()])
    }
    return "";
}