// SPDX-License-Identifier: CAL
pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
// solhint-disable-next-line max-line-length
import {ERC1155Burnable} from "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";

/// @title ReserveTokenERC1155
// Extremely basic ERC1155 implementation for testing purposes.
contract ReserveTokenERC1155 is ERC1155, ERC1155Burnable {
    /// Define and mint a erc1155 token.
    constructor() ERC1155("") {}

    function mintTokens(uint256 _tokenId, uint256 _amount) external {
        _mint(msg.sender, _tokenId, _amount, "");
    }
}
