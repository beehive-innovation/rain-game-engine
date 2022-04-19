import {
  Implementation,
  NewChild
} from "../generated/GameAssetsFactory/GameAssetsFactory"
import { GameAsset, GameAssetsFactory } from "../generated/schema"
import { GameAssetsTemplate } from "../generated/templates"
import { ZERO_ADDRESS, ZERO_BI } from "./utils";

export function handleImplementation(event: Implementation): void {
    let gameAssetsFactory = new GameAssetsFactory(event.address.toHex());
    gameAssetsFactory.implementation = event.params.implementation;
    gameAssetsFactory.children = [];
    gameAssetsFactory.save()
  }

export function handleNewChild(event: NewChild): void {
  let gameAsset = new GameAsset(event.params.child.toHex());
  gameAsset.totalAssets = ZERO_BI;
  gameAsset.owner = event.params.sender;
  gameAsset.admin = ZERO_ADDRESS;
  gameAsset.baseURI = "";
  gameAsset.creators = [];
  gameAsset.assets = [];
  gameAsset.classes = [];
  gameAsset.holders = [];
  gameAsset.deployBlock = event.block.number;
  gameAsset.deployTimestamp = event.block.timestamp;
  gameAsset.save()

  let gameAssetsFactory = GameAssetsFactory.load(event.address.toHex())
  
  if(gameAssetsFactory){
    let children = gameAssetsFactory.children;
    if(children) children.push(gameAsset.id);
    gameAssetsFactory.children = children;

    gameAssetsFactory.save()
  }
  GameAssetsTemplate.create(event.params.child);
}
