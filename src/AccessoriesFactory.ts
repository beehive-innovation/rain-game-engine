import {
  Implementation,
  NewChild
} from "../generated/AccessoriesFactory/AccessoriesFactory"
import { Accessory, AccessoriesFactory } from "../generated/schema"

export function handleImplementation(event: Implementation): void {
    let accessoriesFactory = new AccessoriesFactory(event.address.toHex());
    accessoriesFactory.implementation = event.params.implementation;
    accessoriesFactory.children = [];
    accessoriesFactory.save()
  }

export function handleNewChild(event: NewChild): void {
  let accessory = new Accessory(event.params.child.toHex());

  let accessoriesFactory = AccessoriesFactory.load(event.address.toHex())
  
  if(accessoriesFactory){
    let children = accessoriesFactory.children;
    if(children) children.push(accessory.id);
    accessoriesFactory.children = children;

    accessoriesFactory.save()
  }
  accessory.save()
}
