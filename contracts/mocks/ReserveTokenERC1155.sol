// SPDX-License-Identifier: CAL
pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// solhint-disable-next-line max-line-length

/// @title ReserveTokenERC1155
// Extremely basic ERC1155 implementation for testing purposes.
contract ReserveTokenERC1155 is ERC1155Supply {
    using Strings for uint256;

    /// Define and mint a erc1155 token.
    constructor() ERC1155("") {}

    function mintTokens(uint256 _tokenId, uint256 _amount) external {
        _mint(msg.sender, _tokenId, _amount, "");
    }

    function uri(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(exists(_tokenId), "TokenId not exists.");
        return
            string(
                abi.encodePacked(
                    "www.ipfs.com/metadata/",
                    _tokenId.toString(),
                    ".json"
                )
            );
    }
}
