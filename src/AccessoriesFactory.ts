import {
  Implementation,
  NewChild
} from "../generated/AccessoriesFactory/AccessoriesFactory"
import { Accessory, AccessoriesFactory } from "../generated/schema"
import { AccessoriesTemplate } from "../generated/templates"
import { ZERO_ADDRESS, ZERO_BI } from "./utils";

export function handleImplementation(event: Implementation): void {
    let accessoriesFactory = new AccessoriesFactory(event.address.toHex());
    accessoriesFactory.implementation = event.params.implementation;
    accessoriesFactory.children = [];
    accessoriesFactory.save()
  }

export function handleNewChild(event: NewChild): void {
  let accessory = new Accessory(event.params.child.toHex());
  accessory.totalItems = ZERO_BI;
  accessory.owner = event.params.sender;
  accessory.admin = ZERO_ADDRESS;
  accessory.baseURI = "";
  accessory.creators = [];
  accessory.items = [];
  accessory.classes = [];
  accessory.deployBock = event.block.number;
  accessory.deployTimestam = event.block.timestamp;
  accessory.save()

  let accessoriesFactory = AccessoriesFactory.load(event.address.toHex())
  
  if(accessoriesFactory){
    let children = accessoriesFactory.children;
    if(children) children.push(accessory.id);
    accessoriesFactory.children = children;

    accessoriesFactory.save()
  }
  AccessoriesTemplate.create(event.params.child);
}
