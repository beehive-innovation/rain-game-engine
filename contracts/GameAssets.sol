//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import "@beehiveinnovation/rain-protocol/contracts/tier/ITier.sol";
import "@beehiveinnovation/rain-protocol/contracts/tier/libraries/TierReport.sol";
import {VMState, StateConfig} from "@beehiveinnovation/rain-protocol/contracts/vm/libraries/VMState.sol";
import {AllStandardOps, ALL_STANDARD_OPS_START, ALL_STANDARD_OPS_LENGTH} from "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";

struct GameAssetsConfig {
    address _creator;
    string _baseURI;
}

enum Rarity {
    NONE,
    COMMON,
    UNCOMMON,
    RARE,
    ULTRARARE
}

enum Type {
    ERC20,
    ERC1155
}

struct AssetConfig {
    uint256 lootBoxId;
    StateConfig priceConfig;
    StateConfig canMintConfig;
    address[] currencies;
    uint256 assetClass;
    uint8 rarity;
}

contract GameAssets is
    ERC1155Upgradeable,
    ERC1155Holder,
    OwnableUpgradeable,
    RainVM,
    VMState
{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;
    using Strings for uint256;

    uint256 internal constant LOCAL_OP_TIER_REPORT_AT_BLOCK = 0;

    uint256 internal constant LOCAL_OPS_LENGTH = 1;

    uint256 private immutable localOpsStart =
        ALL_STANDARD_OPS_START + ALL_STANDARD_OPS_LENGTH;

    uint256 public totalAssets;

    EnumerableSet.UintSet Common;
    EnumerableSet.UintSet UnCommon;
    EnumerableSet.UintSet Rare;
    EnumerableSet.UintSet UltraRare;
    EnumerableSet.UintSet Classes;

    EnumerableSet.AddressSet Creators;

    struct AssetDetails {
        uint256 lootBoxId;
        uint256 id;
        State priceConfig;
        State canMintConfig;
        address[] currencies;
        uint256 assetClass;
        Rarity rarity;
        address creator;
    }

    address public Admin;

    mapping(uint256 => AssetDetails) public assets;

    string BaseURI = "";

    // EVENTS
    event Initialize(GameAssetsConfig config);
    event BaseURIChanged(string _baseURI);
    event ClassCreated(
        uint256 _classId,
        string[] _attributes,
        string _name,
        string _description
    );
    event AssetCreated(
        uint256 _assetId,
        AssetDetails _asset,
        StateConfig _priceConfig,
        StateConfig _canMintConfig
    );
    event AssetUpdated(
        uint256 _assetId,
        AssetDetails _asset,
        StateConfig _canMintConfig
    );
    event CreatorAdded(address _addedCreator);
    event CreatorRemoved(address _removedCreator);
    event AdminChanged(address _admin);
    // EVENTS END

    modifier canMint(uint256 _assetId) {
        AssetDetails memory asset = assets[_assetId];

        State memory _state = asset.canMintConfig;
        eval("", _state, 0);

        require(
            _state.stack[_state.stackIndex - 1] == 1,
            "GameAssets::canMint: Address does not satisfy the mint Conditions."
        );
        _;
    }

    function initialize(GameAssetsConfig memory _config) external initializer {
        BaseURI = _config._baseURI;
        __ERC1155_init(_config._baseURI);
        __Ownable_init();
        transferOwnership(_config._creator);
        emit Initialize(_config);
    }

    function setBaseURI(string memory _baseURI) external onlyOwner {
        BaseURI = _baseURI;
        emit BaseURIChanged(_baseURI);
    }

    function uri(uint256 _tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_tokenId > 0, "GameAssets:uri: Invalid TokenId.");
        return
            string(
                abi.encodePacked(
                    BaseURI,
                    "/",
                    Strings.toHexString(uint256(uint160(address(this))), 20),
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
    ) external {
        Classes.add(Classes.length().add(1));
        emit ClassCreated(Classes.length(), _attributes, _name, _description);
    }

    function createNewAsset(AssetConfig memory _config) external {
        require(
            Creators.contains(_msgSender()),
            "GameAssets:createNewAsset: Only Creators can create assets"
        );
        totalAssets = totalAssets.add(1);

        assets[totalAssets] = AssetDetails(
            _config.lootBoxId,
            totalAssets,
            _restore(_snapshot(_newState(_config.priceConfig))),
            _restore(_snapshot(_newState(_config.canMintConfig))),
            _config.currencies,
            getClass(_config.assetClass),
            getRarity((_config.rarity)),
            _msgSender()
        );

        emit AssetCreated(
            totalAssets,
            assets[totalAssets],
            _config.priceConfig,
            _config.canMintConfig
        );
    }

    function updateAsset(
        uint256 _assetId,
        uint256 _lootBoxId,
        StateConfig memory _canMintConfig
    ) external {
        require(
            _msgSender() == assets[_assetId].creator,
            "GameAssets::updateAsset: Only Creator can update the AssetDetails."
        );

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
        bool flag = false;
        AssetDetails memory asset = assets[_assetId];
        for (uint256 i = 0; i < asset.currencies.length; i = i + 1) {
            if (asset.currencies[i] == _paymentToken) {
                stackIndex = i;
                flag = true;
                break;
            }
        }
        require(flag, "GameAssets::getAssetPrice: Unsupported payment token.");

        State memory _state = asset.priceConfig;
        eval(abi.encode(1), _state, stackIndex);
        _state.stack[_state.stackIndex - 1] = _state
            .stack[_state.stackIndex - 1]
            .mul(_units);

        return _state.stack;
    }

    function mintAssets(uint256 _assetId, uint256 _units)
        external
        canMint(_assetId)
    {
        require(
            _assetId <= totalAssets,
            "GameAssets::mintAssets: Invalid AssetId."
        );
        AssetDetails memory asset = assets[_assetId];
        for (uint256 i = 0; i < asset.currencies.length; i = i + 1) {
            uint256[] memory stack = getAssetPrice(
                _assetId,
                asset.currencies[i],
                _units
            );
            // console.log(stack[0], stack[1], stack[2]);
            if (stack[0] == uint256(Type.ERC20)) {
                IERC20(asset.currencies[i]).transferFrom(
                    msg.sender,
                    address(this),
                    stack[1]
                );
            } else if (stack[0] == uint256(Type.ERC1155)) {
                IERC1155(asset.currencies[i]).safeTransferFrom(
                    msg.sender,
                    address(this),
                    stack[1],
                    stack[2],
                    ""
                );
            }
        }
        _mint(_msgSender(), _assetId, _units, "");
    }

    function addCreator(address _creator) external onlyOwner {
        require(
            _creator != address(0),
            "GameAssets::addCreator: Invalid Creator address."
        );
        Creators.add(_creator);
        emit CreatorAdded(_creator);
    }

    function RemoveCreator(address _creator) external onlyOwner {
        Creators.remove(_creator);
        emit CreatorRemoved(_creator);
    }

    function setAdmin(address _admin) external onlyOwner {
        require(
            _admin != address(0),
            "GameAssets::addCreator: Invalid Creator address."
        );
        Admin = _admin;
        emit AdminChanged(_admin);
    }

    function getRarity(uint8 _rarity) internal pure returns (Rarity) {
        if (_rarity == 0) return Rarity.NONE;
        else if (_rarity == 1) return Rarity.COMMON;
        else if (_rarity == 2) return Rarity.UNCOMMON;
        else if (_rarity == 3) return Rarity.RARE;
        else if (_rarity == 4) return Rarity.ULTRARARE;
        else revert("GameAssets::getRarity: Invalid Rarity");
    }

    function getClass(uint256 _class) internal view returns (uint256) {
        if (Classes.contains(_class)) return _class;
        else revert("GameAssets::getClass: Invalid class value.");
    }

    function withdraw(address[] memory _tokenAddresses) public onlyOwner {
        for (uint256 i = 0; i < _tokenAddresses.length; i++) {
            IERC20(_tokenAddresses[i]).transfer(
                owner(),
                IERC20(_tokenAddresses[i]).balanceOf(address(this))
            );
        }
    }

    function withdrawERC1155(
        address[] memory _tokenAddresses,
        uint256[] memory _ids
    ) external onlyOwner {
        for (uint256 i = 0; i < _tokenAddresses.length; i++) {
            IERC1155(_tokenAddresses[i]).safeTransferFrom(
                address(this),
                owner(),
                _ids[i],
                IERC1155(_tokenAddresses[i]).balanceOf(address(this), _ids[i]),
                ""
            );
        }
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
                uint256 _report = state_.stack[state_.stackIndex - 2];
                uint256 _block = state_.stack[state_.stackIndex - 1];
                state_.stackIndex -= 2;
                uint256 report = TierReport.tierAtBlockFromReport(
                    _report,
                    _block
                );

                state_.stack[state_.stackIndex] = report;
                state_.stackIndex++;
            }
        }
    }

    function getCreators() external view returns (address[] memory) {
        return Creators.values();
    }

    function getClasses() external view returns (uint256[] memory) {
        return Classes.values();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Receiver, ERC1155Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(ERC1155Receiver).interfaceId ||
            ERC1155Upgradeable.supportsInterface(interfaceId) ||
            super.supportsInterface(interfaceId);
    }
}
