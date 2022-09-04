// SPDX-License-Identifier: CAL
pragma solidity =0.8.10;

import "@beehiveinnovation/rain-protocol/contracts/vm/VMStateBuilder.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";

contract AllStandardOpsStateBuilder is VMStateBuilder {
    /// @inheritdoc VMStateBuilder
    function stackPopsFnPtrs() public pure override returns (bytes memory) {
        return AllStandardOps.stackPopsFnPtrs();
    }

    /// @inheritdoc VMStateBuilder
    function stackPushesFnPtrs() public pure override returns (bytes memory) {
        return AllStandardOps.stackPushesFnPtrs();
    }
}
