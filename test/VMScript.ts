import { BigNumberish, BytesLike, ethers } from "ethers";
import { concat, op, Opcode, Type, VMState } from "./utils";

export type currency = {
    type: number;
    address: string;
    tokenId?: number
}

export type price = {
    currancy: currency;
    amount: ethers.BigNumber;
}

export function toScript(script: price[], stackLength: number): VMState {
    let pos = -1;
    let sources: BytesLike[] = []
    let constants: BigNumberish[] = [];
    let i;
    for(i=0;i<script.length;i++){
        let obj = script[i];
        console.log(obj.currancy.type)
        if(obj.currancy.type == Type.ERC1155){
            sources[i] = concat([op(Opcode.VAL, ++pos), op(Opcode.VAL, ++pos), op(Opcode.VAL, ++pos)])
            constants[constants.length] = obj.currancy.type;
            constants[constants.length] = obj.currancy.tokenId;
            constants[constants.length] = obj.amount;
        }else{
            sources[i] = concat([op(Opcode.VAL, ++pos), op(Opcode.VAL, ++pos)])
            constants[constants.length] = obj.currancy.type;
            constants[constants.length] = obj.amount;
        }
    }
    let state: VMState = {
        sources: sources,
        constants: constants,
        stackLength: stackLength,
        argumentsLength: 0
    };
    return state;
}