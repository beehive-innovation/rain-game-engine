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
    StateConfig priceConfig;
    StateConfig canMintConfig;
    address[] currencies;
    address recepient;
    string tokenURI;
}

contract GameAssets is ERC1155Supply, RainVM, VMState {
    using Strings for uint256;

    uint256 internal constant LOCAL_OP_TIER_REPORT_AT_BLOCK = 0;

    uint256 internal constant LOCAL_OPS_LENGTH = 1;

    uint256 private immutable localOpsStart =
        ALL_STANDARD_OPS_START + ALL_STANDARD_OPS_LENGTH;

    uint256 public totalAssets;

    struct AssetDetails {
        uint256 lootBoxId;
        uint256 id;
        State priceConfig;
        State canMintConfig;
        address[] currencies;
        address recepient;
        string tokenURI;
    }

    mapping(uint256 => AssetDetails) public assets;

    // EVENTS
    event Initialize(address _deployer);
    event ClassCreated(string[] _classData);
    event AssetCreated(
        uint256 _assetId,
        AssetDetails _asset,
        StateConfig _priceConfig,
        StateConfig _canMintConfig,
        string _name,
        string _description
    );

    // EVENTS END

    constructor() ERC1155("") {
        emit Initialize(msg.sender);
    }

    function canMint(uint256 _assetId) public {
        State memory state_ = assets[_assetId].canMintConfig;
        eval("", state_, 0);

        require(state_.stack[state_.stackIndex - 1] == 1, "Can not mint.");
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

    function createNewAsset(AssetConfig memory _config) external {
        totalAssets = totalAssets + 1;

        assets[totalAssets] = AssetDetails(
            _config.lootBoxId,
            totalAssets,
            _restore(_snapshot(_newState(_config.priceConfig))),
            _restore(_snapshot(_newState(_config.canMintConfig))),
            _config.currencies,
            _config.recepient,
            _config.tokenURI
        );

        emit AssetCreated(
            totalAssets,
            assets[totalAssets],
            _config.priceConfig,
            _config.canMintConfig,
            _config.name,
            _config.description
        );
    }

    function getAssetPrice(
        uint256 _assetId,
        address _paymentToken,
        uint256 _units
    ) public view returns (uint256[] memory) {
        uint256 sourceIndex;
        while (_paymentToken != assets[_assetId].currencies[sourceIndex]) {
            sourceIndex++;
        }

        State memory state_ = assets[_assetId].priceConfig;
        eval("", state_, sourceIndex);
        state_.stack[state_.stackIndex - 1] =
            state_.stack[state_.stackIndex - 1] *
            _units;

        return state_.stack;
    }

    function mintAssets(uint256 _assetId, uint256 _units) external {
        require(_assetId <= totalAssets, "Invalid AssetId");
        canMint(_assetId);
        for (uint256 i = 0; i < assets[_assetId].currencies.length; i = i + 1) {
            uint256[] memory stack_ = getAssetPrice(
                _assetId,
                assets[_assetId].currencies[i],
                _units
            );
            // console.log(stack[0], stack[1], stack[2]);
            if (stack_[0] == 0) {
                ITransfer(assets[_assetId].currencies[i]).transferFrom(
                    msg.sender,
                    assets[_assetId].recepient,
                    stack_[1]
                );
            } else if (stack_[0] == 1) {
                ITransfer(assets[_assetId].currencies[i]).safeTransferFrom(
                    msg.sender,
                    assets[_assetId].recepient,
                    stack_[1],
                    stack_[2],
                    ""
                );
            }
        }
        _mint(_msgSender(), _assetId, _units, "");
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
                state_.stack[state_.stackIndex - 2] = TierReport
                    .tierAtBlockFromReport(
                        state_.stack[state_.stackIndex - 2],
                        state_.stack[state_.stackIndex - 1]
                    );
                state_.stackIndex--;
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
