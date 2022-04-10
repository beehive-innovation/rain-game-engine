// SPDX-License-Identifier: CAL
pragma solidity ^0.8.10;

import { Accessories, AccessoriesConfig } from "./Accessories.sol";
// solhint-disable-next-line max-line-length
import { Factory } from "@beehiveinnovation/rain-protocol/contracts/factory/Factory.sol";
// solhint-disable-next-line max-line-length
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

contract AccessoriesFactory is Factory {
    address private immutable implementation;

    constructor() {
        address implementation_ = address(new Accessories());
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
        AccessoriesConfig memory _config = abi.decode(data_, (AccessoriesConfig));
        address clone_ = Clones.clone(implementation);
        Accessories(clone_).initialize(_config);
        Accessories(clone_).transferOwnership(msg.sender);
        return clone_;
    }

    function createChildTyped(AccessoriesConfig calldata config_) external returns (Accessories) {
        return Accessories(this.createChild(abi.encode(config_)));
    }
}
