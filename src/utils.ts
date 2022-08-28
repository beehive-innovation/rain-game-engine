import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { ERC20 } from "../generated/Rain1155/ERC20";
import { ERC721 } from "../generated/Rain1155/ERC721";
import { Rain1155 } from "../generated/Rain1155/Rain1155";
import { Currency } from "../generated/schema";


export let ZERO_BI = BigInt.fromI32(0)
export let ONE_BI = BigInt.fromI32(1)

export let ZERO_ADDRESS = Address.empty()

export enum ERCType{
    NONE,
    ERC20,
    ERC721,
    ERC1155
}
export function getERCType(address: Bytes): ERCType {
    let Contract = Rain1155.bind(Address.fromBytes(address));
    // let erc721InterfaceId = Contract.try_supportsInterface(Bytes.fromHexString('0x80ac58cd'))
    let erc1155InterfaceId = Contract.try_supportsInterface(Bytes.fromHexString('0xd9b67a26'))
    let erc20 = ERC20.bind(Address.fromBytes(address));
    let name = erc20.try_name()
    let symbol =  erc20.try_symbol()
    let decimals =  erc20.try_decimals()
    // if(!erc721InterfaceId.reverted){
    //     if(erc721InterfaceId.value == true){
    //         return ERCType.ERC721;
    //     }
    // }
    if (!erc1155InterfaceId.reverted){
        if(erc1155InterfaceId.value == true){
            return ERCType.ERC1155;
        }
    }

    if(!name.reverted && !symbol.reverted && !decimals.reverted){
        return ERCType.ERC20;

    }
    return ERCType.NONE
}


export function getCurrency(address: Bytes, type: ERCType, assetId: BigInt, tokenId: BigInt = ZERO_BI): Currency{
    let currency = Currency.load(assetId.toString() + "-" +address.toHex());
    if(!currency){
        currency = new Currency(assetId.toString() + "-" + address.toHex());
        currency.address = address;
        if(type == ERCType.ERC20){
            let erc20 = ERC20.bind(Address.fromBytes(address));
            currency.type = "ERC20";
            currency.name = erc20.name();
            currency.symbol = erc20.symbol();
            currency.decimals = erc20.decimals();
            currency.save()
        }else if (type == ERCType.ERC1155){
            let erc1155 = Rain1155.bind(Address.fromBytes(address));
            currency.type = "ERC1155";
            currency.tokenId = tokenId;
            currency.save();
        }else{
            currency.type = "UNKNOWN";
            currency.save();
        }
    }
    return currency as Currency;
}
