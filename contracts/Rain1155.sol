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

    uint256 internal constant LOCAL_OPS_LENGTH = 2;

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
    event Initialize(address _deployer);
    event ClassCreated(string[] _classData);
    event AssetCreated(
        uint256 _assetId,
        AssetDetails _asset,
        StateConfig _priceScript,
        StateConfig _canMintScript,
        string _name,
        string _description
    );

    // EVENTS END

    constructor() ERC1155("") {
        emit Initialize(msg.sender);
    }

    function canMint(uint256 _assetId, address _account)
        public
        view
        returns (bool)
    {
        State memory state_ = assets[_assetId].canMintScript;
        eval(abi.encode(_account), state_, 0);

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

    function createNewAsset(AssetConfig memory _config) external {
        totalAssets = totalAssets + 1;

        assets[totalAssets] = AssetDetails(
            _config.lootBoxId,
            totalAssets,
            _restore(_snapshot(_newState(_config.priceScript))),
            _restore(_snapshot(_newState(_config.canMintScript))),
            _config.currencies,
            _config.recipient,
            _config.tokenURI
        );

        emit AssetCreated(
            totalAssets,
            assets[totalAssets],
            _config.priceScript,
            _config.canMintScript,
            _config.name,
            _config.description
        );
    }

    function getAssetPrice(
        uint256 _assetId,
        address _paymentToken,
        uint256 _units
    ) public view returns (uint256[] memory) {
        uint256 sourceIndex = 0;
        while (_paymentToken != assets[_assetId].currencies[sourceIndex]) {
            sourceIndex++;
        }

        State memory state_ = assets[_assetId].priceScript;
        eval("", state_, sourceIndex);
        state_.stack[state_.stackIndex - 1] =
            state_.stack[state_.stackIndex - 1] *
            _units;

        return state_.stack;
    }

    function mintAssets(uint256 _assetId, uint256 _units) external {
        require(_assetId <= totalAssets, "Invalid AssetId");
        require(canMint(_assetId, msg.sender), "Cant Mint");
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
                    assets[_assetId].recipient,
                    stack_[1]
                );
            } else if (stack_[0] == 1) {
                ITransfer(assets[_assetId].currencies[i]).safeTransferFrom(
                    msg.sender,
                    assets[_assetId].recipient,
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
