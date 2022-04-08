// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
contract Token is ERC20 {
    
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol){
    }

    function mintTokens(uint256 _amount) external {
        _mint(msg.sender, _amount * 10 ** 18);
    }

}