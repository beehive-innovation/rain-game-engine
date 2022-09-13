import { Address, BigInt, Bytes, dataSource, log } from "@graphprotocol/graph-ts";
import { ERC20 } from "../generated/Rain1155/ERC20";
import { ERC721 } from "../generated/Rain1155/ERC721";
import { Rain1155 } from "../generated/Rain1155/Rain1155";
import { Asset, Currency } from "../generated/schema";


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


export function getCurrency(address: Bytes, type: ERCType, index: string, tokenId: BigInt = ZERO_BI): Currency{
    let currency = Currency.load(index + "-" + address.toHex() + "-" + tokenId.toString());
    if(!currency){
        currency = new Currency(index + "-" + address.toHex() + "-" + tokenId.toString());
        currency.address = address;
        if(type == ERCType.ERC20){
            let erc20 = ERC20.bind(Address.fromBytes(address));
            currency.type = "ERC20";
            currency.name = erc20.name();   
            currency.symbol = erc20.symbol();
            currency.decimals = erc20.decimals();
            currency.save()
        }else if (type == ERCType.ERC1155){
            currency.type = "ERC1155";
            currency.tokenId = tokenId;
            if(address == dataSource.address()){
                log.info("TEST {} - {}", [dataSource.address().toHex(), Address.fromBytes(address).toHex()])
                let asset = Asset.load(dataSource.address().toHex() + "-" + tokenId.toString());
                currency.tokenURI = (asset)? asset.tokenURI : `Token ${tokenId} not Minted yet`;
            }
            else{
                let erc1155 = Rain1155.bind(Address.fromBytes(address));
                let tokenUri = erc1155.try_uri(tokenId);
                currency.tokenURI = (!tokenUri.reverted)? tokenUri.value : `Token ${tokenId} not Minted yet`;
            }
            currency.save();
        }else{
            currency.type = "UNKNOWN";
            currency.save();
        }
    }
    return currency as Currency;
}