//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import "@beehiveinnovation/rain-protocol/contracts/tier/libraries/TierReport.sol";
import {VMState, StateConfig} from "@beehiveinnovation/rain-protocol/contracts/vm/libraries/VMState.sol";
import {AllStandardOps, ALL_STANDARD_OPS_START, ALL_STANDARD_OPS_LENGTH} from "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";

struct GameAssetsConfig {
    address _creator;
    string _baseURI;
}

struct AssetConfig {
    string name;
    string description;
    uint256 lootBoxId;
    StateConfig priceConfig;
    StateConfig canMintConfig;
    address[] currencies;
    uint256 assetClass;
    uint8 rarity;
    address creator;
}

contract GameAssets is
    ERC1155SupplyUpgradeable,
    OwnableUpgradeable,
    RainVM,
    VMState
{
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
        uint256 assetClass;
        uint8 rarity;
        address creator;
    }

    mapping(uint256 => AssetDetails) public assets;
    mapping(address => uint8) public roleOf;

    string BaseURI;

    // EVENTS
    event Initialize(GameAssetsConfig config);
    event BaseURIChanged(string _baseURI);
    event ClassCreated(string[] _attributes, string _name, string _description);
    event AssetCreated(
        uint256 _assetId,
        AssetDetails _asset,
        StateConfig _priceConfig,
        StateConfig _canMintConfig,
        string _name,
        string _description
    );
    event AssetUpdated(
        uint256 _assetId,
        AssetDetails _asset,
        StateConfig _canMintConfig
    );
    event RoleChanged(address _account, uint8 _role);
    // EVENTS END

    modifier canMint(uint256 _assetId) {
        State memory _state = assets[_assetId].canMintConfig;
        eval("", _state, 0);

        require(
            _state.stack[_state.stackIndex - 1] == 1,
            "Unsatisfied conditions"
        );
        _;
    }

    function initialize(GameAssetsConfig memory _config) external initializer {
        BaseURI = _config._baseURI;
        __ERC1155Supply_init();
        __Ownable_init();
        transferOwnership(_config._creator);
        emit Initialize(_config);
    }

    function uri(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_tokenId > 0, "Invalid TokenId.");
        return
            string(
                abi.encodePacked(
                    BaseURI,
                    "/",
                    Strings.toHexString(uint160(address(this)), 20),
                    "/",
                    _tokenId.toString(),
                    ".json"
                )
            );
    }

    function createClass(
        string memory _name,
        string memory _description,
        string[] memory _attributes
    ) external onlyOwner {
        emit ClassCreated(_attributes, _name, _description);
    }

    function createNewAsset(AssetConfig memory _config) external onlyOwner {
        totalAssets = totalAssets + 1;

        assets[totalAssets] = AssetDetails(
            _config.lootBoxId,
            totalAssets,
            _restore(_snapshot(_newState(_config.priceConfig))),
            _restore(_snapshot(_newState(_config.canMintConfig))),
            _config.currencies,
            _config.assetClass,
            _config.rarity,
            _config.creator
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

    function updateAsset(
        uint256 _assetId,
        uint256 _lootBoxId,
        StateConfig memory _canMintConfig
    ) external onlyOwner {
        assets[_assetId].lootBoxId = _lootBoxId;
        assets[_assetId].canMintConfig = _restore(
            _snapshot(_newState(_canMintConfig))
        );

        emit AssetUpdated(totalAssets, assets[totalAssets], _canMintConfig);
    }

    function getAssetPrice(
        uint256 _assetId,
        address _paymentToken,
        uint256 _units
    ) public view returns (uint256[] memory) {
        uint256 stackIndex;
        while (_paymentToken != assets[_assetId].currencies[stackIndex]) {
            stackIndex++;
        }

        State memory _state = assets[_assetId].priceConfig;
        eval("", _state, stackIndex);
        _state.stack[_state.stackIndex - 1] =
            _state.stack[_state.stackIndex - 1] *
            _units;

        return _state.stack;
    }

    function mintAssets(uint256 _assetId, uint256 _units)
        external
        canMint(_assetId)
    {
        require(_assetId <= totalAssets, "Invalid AssetId");
        for (uint256 i = 0; i < assets[_assetId].currencies.length; i = i + 1) {
            uint256[] memory stack = getAssetPrice(
                _assetId,
                assets[_assetId].currencies[i],
                _units
            );
            // console.log(stack[0], stack[1], stack[2]);
            if (stack[0] == 0) {
                IERC20(assets[_assetId].currencies[i]).transferFrom(
                    msg.sender,
                    owner(),
                    stack[1]
                );
            } else if (stack[0] == 1) {
                IERC1155(assets[_assetId].currencies[i]).safeTransferFrom(
                    msg.sender,
                    owner(),
                    stack[1],
                    stack[2],
                    ""
                );
            }
        }
        _mint(_msgSender(), _assetId, _units, "");
    }

    function setRole(address _account, uint8 _role) external onlyOwner {
        roleOf[_account] = _role;
        emit RoleChanged(_account, _role);
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
