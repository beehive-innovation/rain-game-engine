//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import "@beehiveinnovation/rain-protocol/contracts/tier/libraries/TierReport.sol";
import {VMState, StateConfig} from "@beehiveinnovation/rain-protocol/contracts/vm/libraries/VMState.sol";
import {AllStandardOps, ALL_STANDARD_OPS_START, ALL_STANDARD_OPS_LENGTH} from "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";

struct AssetConfig {
    string name;
    string description;
    uint256 lootBoxId;
    StateConfig priceScript;
    StateConfig canMintScript;
    address[] currencies;
    address recipient;
    string tokenURI;
}

contract Rain1155 is ERC1155Supply, RainVM, VMState {
    using Strings for uint256;

    uint256 internal constant TIER_REPORT_AT_BLOCK = 0;

    uint256 internal constant ACCOUNT = 1;

    uint256 internal constant CURRENT_UNITS = 2;

    uint256 internal constant LOCAL_OPS_LENGTH = 3;

    uint256 private immutable localOpsStart =
        ALL_STANDARD_OPS_START + ALL_STANDARD_OPS_LENGTH;

    uint256 public totalAssets;

    struct AssetDetails {
        uint256 lootBoxId;
        uint256 id;
        State priceScript;
        State canMintScript;
        address[] currencies;
        address recipient;
        string tokenURI;
    }

    mapping(uint256 => AssetDetails) public assets;

    // EVENTS
    event Initialize(address deployer_);
    event AssetCreated(
        uint256 assetId_,
        AssetDetails asset_,
        StateConfig priceScript_,
        StateConfig canMintScript_,
        string name_,
        string description_
    );

    // EVENTS END

    constructor() ERC1155("") {
        emit Initialize(msg.sender);
    }

    function canMint(uint256 assetId_, address account_)
        public
        view
        returns (bool)
    {
        State memory state_ = assets[assetId_].canMintScript;
        eval(abi.encode(account_), state_, 0);

        return (state_.stack[state_.stackIndex - 1] == 1);
    }

    function uri(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(exists(_tokenId), "Invalid TokenId.");
        return assets[_tokenId].tokenURI;
    }

    function createNewAsset(AssetConfig memory config_) external {
        totalAssets = totalAssets + 1;

        assets[totalAssets] = AssetDetails(
            config_.lootBoxId,
            totalAssets,
            _restore(_snapshot(_newState(config_.priceScript))),
            _restore(_snapshot(_newState(config_.canMintScript))),
            config_.currencies,
            config_.recipient,
            config_.tokenURI
        );

        emit AssetCreated(
            totalAssets,
            assets[totalAssets],
            config_.priceScript,
            config_.canMintScript,
            config_.name,
            config_.description
        );
    }

    function getAssetPrice(
        uint256 assetId_,
        address paymentToken_,
        uint256 units_
    ) public view returns (uint256[] memory) {
        uint256 sourceIndex = 0;
        while (paymentToken_ != assets[assetId_].currencies[sourceIndex]) {
            sourceIndex++;
        }

        State memory state_ = assets[assetId_].priceScript;
        eval(abi.encode(units_), state_, sourceIndex);
        state_.stack[state_.stackIndex - 1] = state_.stack[
            state_.stackIndex - 1
        ];

        return state_.stack;
    }

    function mintAssets(uint256 assetId_, uint256 units_) external {
        require(assetId_ <= totalAssets, "Invalid AssetId");
        require(canMint(assetId_, msg.sender), "Cant Mint");
        for (uint256 i = 0; i < assets[assetId_].currencies.length; i = i + 1) {
            uint256[] memory stack_ = getAssetPrice(
                assetId_,
                assets[assetId_].currencies[i],
                units_
            );
            // console.log(stack[0], stack[1], stack[2]);
            if (stack_[0] == 0) {
                ITransfer(assets[assetId_].currencies[i]).transferFrom(
                    msg.sender,
                    assets[assetId_].recipient,
                    stack_[1]
                );
            } else if (stack_[0] == 1) {
                ITransfer(assets[assetId_].currencies[i]).safeTransferFrom(
                    msg.sender,
                    assets[assetId_].recipient,
                    stack_[1],
                    stack_[2],
                    ""
                );
            }
        }
        _mint(_msgSender(), assetId_, units_, "");
    }

    function applyOp(
        bytes memory context_,
        State memory state_,
        uint256 opcode_,
        uint256 operand_
    ) internal view virtual override {
        unchecked {
            if (opcode_ < localOpsStart) {
                AllStandardOps.applyOp(
                    state_,
                    opcode_ - ALL_STANDARD_OPS_START,
                    operand_
                );
            } else {
                opcode_ -= localOpsStart;
                require(opcode_ < LOCAL_OPS_LENGTH, "MAX_OPCODE");
                // There's only one opcode, which stacks the address to report.
                if (opcode_ == TIER_REPORT_AT_BLOCK) {
                    state_.stack[state_.stackIndex - 2] = TierReport
                        .tierAtBlockFromReport(
                            state_.stack[state_.stackIndex - 2],
                            state_.stack[state_.stackIndex - 1]
                        );
                    state_.stackIndex--;
                } else if (opcode_ == ACCOUNT) {
                    address account_ = abi.decode(context_, (address));
                    state_.stack[state_.stackIndex] = uint256(
                        uint160(account_)
                    );
                    state_.stackIndex++;
                } else if (opcode_ == CURRENT_UNITS) {
                    uint256 units_ = abi.decode(context_, (uint256));
                    state_.stack[state_.stackIndex] = units_;
                    state_.stackIndex++;
                }
            }
        }
    }
}

interface ITransfer {
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes calldata data
    ) external;

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}
