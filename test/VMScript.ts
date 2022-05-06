import { BigNumberish, BytesLike, ethers } from "ethers";
import { concat, op, Opcode, Type, VMState, Conditions } from "./utils";

export type currency = {
    type: number;
    address: string;
    tokenId?: number
}

export type price = {
    currency: currency;
    amount: ethers.BigNumber;
}

export type condition = {
    type: number;
    blockNumber?: number;
    tierAddress?: string;
    tierCondition?: number;
    address?: string;
    balance?: ethers.BigNumber;
    id?: ethers.BigNumber;
}

export function generatePriceScript(prices: price[]): VMState {
    let pos = -1;
    let sources: BytesLike[] = []
    let constants: BigNumberish[] = [];
    let i;
    for(i=0;i<prices.length;i++){
        let obj = prices[i];
        if(obj.currency.type == Type.ERC1155){
            sources.push(concat([op(Opcode.VAL, ++pos), op(Opcode.VAL, ++pos), op(Opcode.VAL, ++pos)]));
            constants.push(obj.currency.type);
            constants.push(obj.currency.tokenId);
            constants.push(obj.amount);
        }else{
            sources.push(concat([op(Opcode.VAL, ++pos), op(Opcode.VAL, ++pos)]));
            constants.push(obj.currency.type);
            constants.push(obj.amount);
        }
    }

    if(prices.length == 0){
        let state: VMState = {
            sources: [concat([op(Opcode.SKIP)])],
            constants: [],
            stackLength: 0,
            argumentsLength: 0
        };
        return state;
    }
    let state: VMState = {
        sources: sources,
        constants: constants,
        stackLength: 3,
        argumentsLength: 0
    };
    return state;
}

export function generatePriceConfig(
    priceScritp: VMState,
    currencies: string[]
  ): price[]{
    let prices: price[] = [];
    for (let i = 0; i < priceScritp.sources.length; i++) {
      let source = priceScritp.sources[i];
      if(source.length == 4){
          prices.push({
              currency:{
                  type: priceScritp.constants[source[1]],
                  address: currencies[i],
              },
              amount: priceScritp.constants[source[3]]
          })

      }else if(source.length == 6){
        prices.push({
            currency:{
                type: priceScritp.constants[source[1]],
                address: currencies[i],
                tokenId: priceScritp.constants[source[3]]
            },
            amount: priceScritp.constants[source[5]]
        })
      }
    }
    return prices;
  };

export function generateCanMintScript(conditions: condition[]): VMState {
    let pos = -1;
    let sources: Uint8Array[] = []
    let constants: BigNumberish[] = [];
    let i;
    let stackLenght = 3;

    for(i=0;i<conditions.length;i++){
        let condition = conditions[i];
        if(condition.type == Conditions.NONE){
            constants.push(1);
            sources.push(op(Opcode.VAL, ++pos));
        } else if(condition.type == Conditions.BLOCK_NUMBER){
            constants.push(condition.blockNumber);
            sources.push(op(Opcode.BLOCK_NUMBER));
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.GREATER_THAN));
        }else if(condition.type == Conditions.BALANCE_TIER){
            constants.push(condition.tierAddress);
            constants.push(condition.tierCondition);
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.ACCOUNT));
            sources.push(op(Opcode.REPORT));
            sources.push(op(Opcode.BLOCK_NUMBER));
            sources.push(op(Opcode.REPORT_AT_BLOCK));
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.GREATER_THAN));
        }else if(condition.type == Conditions.ERC20BALANCE){
            constants.push(condition.address);
            constants.push(condition.balance);
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.ACCOUNT));
            sources.push(op(Opcode.IERC20_BALANCE_OF));
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.GREATER_THAN));
        }else if(condition.type == Conditions.ERC721BALANCE){
            constants.push(condition.address);
            constants.push(condition.balance);
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.ACCOUNT));
            sources.push(op(Opcode.IERC721_BALANCE_OF));
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.GREATER_THAN));
        }else if(condition.type == Conditions.ERC1155BALANCE){
            constants.push(condition.address);
            constants.push(condition.id);
            constants.push(condition.balance);
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.ACCOUNT));
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.IERC1155_BALANCE_OF));
            sources.push(op(Opcode.VAL, ++pos));
            sources.push(op(Opcode.GREATER_THAN));
        }
    }
    sources.push(op(Opcode.EVERY, conditions.length))

    let state: VMState = {
        sources: [concat(sources)],
        constants: constants,
        stackLength: stackLenght + conditions.length,
        argumentsLength: 0
    };
    return state;
}

/**
  {
    type: ‘game-event’,
    id: 4,
    fromBlock: ‘latest’
  },
  {
    type: ‘tier’,
    address: ‘0xBC...C440’,
    status: 2,
    fromBlock: 14541053
  },
  {
    type: ‘token’,
    address: ‘0x279...4174’,
    threshold: 3000000000000000000
  }
 */