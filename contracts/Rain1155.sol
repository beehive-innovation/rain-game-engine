//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol";
import "@beehiveinnovation/rain-protocol/contracts/tier/libraries/TierReport.sol";
import {AllStandardOps} from "@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol";
import "@beehiveinnovation/rain-protocol/contracts/vm/VMStateBuilder.sol";

struct Rain1155Config {
    address vmStateBuilder;
}

struct AssetConfig {
    string name;
    string description;
    uint256 lootBoxId;
    StateConfig vmStateConfig;
    address[] currencies;
    address recipient;
    string tokenURI;
}

contract Rain1155 is ERC1155Supply, RainVM {
    using Strings for uint256;

    uint256 public totalAssets;

    address private immutable self;
    address private immutable vmStateBuilder;

    mapping(uint256 => mapping(address => uint256)) private paymentToken;
    mapping(uint256 => AssetDetails) public assets;

    struct AssetDetails {
        uint256 lootBoxId;
        uint256 id;
        address[] currencies;
        StateConfig vmStateConfig;
        address vmStatePointer;
        address recipient;
        string tokenURI;
    }

    // EVENTS
    event Initialize(address deployer_, Rain1155Config config_);
    event AssetCreated(
        uint256 assetId_,
        AssetDetails asset_,
        string name_,
        string description_
    );

    // EVENTS END

    constructor(Rain1155Config memory config_) ERC1155("") {
        self = address(this);
        vmStateBuilder = config_.vmStateBuilder;
        emit Initialize(msg.sender, config_);
    }

    function _loadState(uint256 assetId_) internal view returns (State memory) {
        return
            LibState.fromBytesPacked(
                SSTORE2.read(assets[assetId_].vmStatePointer)
            );
    }

    function _priceEntryPoint(uint256 assetId_, address paymentToken_)
        internal
        view
        returns (uint256 entrtyPoint)
    {
        entrtyPoint = paymentToken[assetId_][paymentToken_];
        require(entrtyPoint != 0, "Invalid payment token");
    }

    function canMint(uint256 assetId_, address account_)
        public
        view
        returns (bool)
    {
        bytes memory context_ = new bytes(0x20);
        assembly {
            mstore(add(context_, 0x20), account_)
        }
        State memory state_ = _loadState(assetId_);
        eval(context_, state_, 0);
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

        Bounds memory canMintBound;
        canMintBound.entrypoint = 0;

        Bounds memory priceBound;
        priceBound.entrypoint = 1;

        Bounds[] memory bounds_ = new Bounds[](2);

        bounds_[0] = canMintBound;
        bounds_[1] = priceBound;

        for (uint256 i = 0; i < config_.currencies.length; i++) {
            paymentToken[totalAssets][config_.currencies[i]] = i + 1;
        }

        bytes memory vmStateBytes_ = VMStateBuilder(vmStateBuilder).buildState(
            self,
            config_.vmStateConfig,
            bounds_
        );

        // assets[totalAssets] = AssetDetails(
        //     config_.lootBoxId,
        //     totalAssets,
        //     config_.currencies,
        //     config_.vmStateConfig,
        //     SSTORE2.write(vmStateBytes_),
        //     config_.recipient,
        //     config_.tokenURI
        // );

        // emit AssetCreated(
        //     totalAssets,
        //     assets[totalAssets],
        //     config_.name,
        //     config_.description
        // );
    }

    function getAssetPrice(
        uint256 assetId,
        address paymentToken,
        uint256 units
    ) public view returns (uint256[] memory stack) {
        bytes memory context_ = new bytes(0x20);
        assembly {
            mstore(add(context_, 0x20), units)
        }
        State memory state_ = _loadState(assetId);
        eval(context_, state_, 0);
        stack = state_.stack;
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
        _mint(msg.sender, assetId_, units_, "");
    }

    function fnPtrs() public pure override returns (bytes memory) {
        return AllStandardOps.fnPtrs();
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
