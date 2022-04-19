// SPDX-License-Identifier: CAL
pragma solidity ^0.8.10;

import {GameAssets, GameAssetsConfig} from "./GameAssets.sol";
// solhint-disable-next-line max-line-length
import {Factory} from "@beehiveinnovation/rain-protocol/contracts/factory/Factory.sol";
// solhint-disable-next-line max-line-length
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract GameAssetsFactory is Factory {
    address private immutable implementation;

    constructor() {
        address implementation_ = address(new GameAssets());
        emit Implementation(msg.sender, implementation_);
        implementation = implementation_;
    }

    /// @inheritdoc Factory
    function _createChild(bytes calldata data_)
        internal
        virtual
        override
        returns (address)
    {
        GameAssetsConfig memory _config = abi.decode(data_, (GameAssetsConfig));
        address clone_ = Clones.clone(implementation);
        GameAssets(clone_).initialize(_config);
        return clone_;
    }

    function createChildTyped(GameAssetsConfig calldata config_)
        external
        returns (GameAssets)
    {
        return GameAssets(this.createChild(abi.encode(config_)));
    }
}
