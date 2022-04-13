//SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import '@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol';
import '@beehiveinnovation/rain-protocol/contracts/tier/ITier.sol';
import '@beehiveinnovation/rain-protocol/contracts/tier/libraries/TierReport.sol';
import { VMState, StateConfig } from '@beehiveinnovation/rain-protocol/contracts/vm/libraries/VMState.sol';
import { AllStandardOps, ALL_STANDARD_OPS_START, ALL_STANDARD_OPS_LENGTH } from '@beehiveinnovation/rain-protocol/contracts/vm/ops/AllStandardOps.sol';

struct AccessoriesConfig {
    address _accessoriesCreator;
    string _baseURI;
}

contract Accessories is ERC1155, Ownable, RainVM, VMState, Initializable{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;
    using Strings for uint256;

    uint256 internal constant LOCAL_OP_TIER_REPORT_AT_BLOCK = 0;

    uint256 internal constant LOCAL_OPS_LENGTH = 1;

    uint256 private immutable localOpsStart;

    enum Rarity {
        NONE,
        COMMON,
        UNCOMMON,
        RARE,
        ULTRARARE
    }

    uint256 public totalItems;

    EnumerableSet.UintSet Common;
    EnumerableSet.UintSet UnCommon;
    EnumerableSet.UintSet Rare;
    EnumerableSet.UintSet UltraRare;
    EnumerableSet.UintSet Classes;
    
    EnumerableSet.AddressSet Creators;

    struct ItemDetails {
        bool inLootBox;
        uint256 id;
        State priceConfig;
        State canMintConfig;
        address[] currencies;
        uint256 class;
        Rarity rarity;
        address creator;
    }

    address public Admin;

    mapping(uint256 => ItemDetails) public items;

    string BaseURI = "";

    // EVENTS
    event Initialize(AccessoriesConfig config);
    event BaseURIChanged(string _baseURI);
    event ClassCreated(uint256 _classId, string[] _attributes);
    event ItemCreated(uint256 _itemId, ItemDetails _item);
    event ItemUpdated(uint256 _itemId, ItemDetails _item);
    event CreatorAdded(address _addedCreator);
    event CreatorRemoved(address _removedCreator);
    event AdminChanged(address _admin);
    // EVENTS END

    modifier canMint(uint256 _itemId) {
        ItemDetails memory item = items[_itemId];

        State memory _state = item.canMintConfig;
        eval("", _state, 0);

        require(_state.stack[_state.stackIndex - 1] == 1, "Accessories::canMint: Address does not satisfy the mint Conditions.");
        _;
    }

    constructor() ERC1155("URI") {
        localOpsStart = ALL_STANDARD_OPS_START + ALL_STANDARD_OPS_LENGTH;
    }

    function initialize(AccessoriesConfig memory _config) external initializer {
        BaseURI = _config._baseURI;
        _transferOwnership(_config._accessoriesCreator);
        emit Initialize(_config);
    }

    function setBaseURI(string memory _baseURI) external onlyOwner{
        BaseURI = _baseURI;
        emit BaseURIChanged(_baseURI);
    }

    function uri(uint256 _tokenId) public view virtual override returns(string memory){
        require(_tokenId > 0, "Accessories:uri: Invalid TokenId.");
        return string(abi.encodePacked(BaseURI, "/", _tokenId.toString(), ".json"));
    }

    function createClass(string[] memory _attributes) external {
        Classes.add(Classes.length().add(1));
        emit ClassCreated(Classes.length(), _attributes);
    }

    function newItem(
        bool _inLootBox,
        StateConfig memory _priceConfig,
        StateConfig memory _canMintConfig,
        address[] memory _paymentTokens,
        uint8 _class,
        uint8 _rarity
    ) external {
        require(Creators.contains(_msgSender()), "Accessories:newItem: Only Creators can create items");
        totalItems = totalItems.add(1);
        
        items[totalItems] = ItemDetails(
            _inLootBox,
            totalItems,
            _restore(_snapshot(_newState(_priceConfig))),
            _restore(_snapshot(_newState(_canMintConfig))),
            _paymentTokens,
            getClass(_class),
            getRarity(_rarity),
            _msgSender()
        );

        emit ItemCreated(totalItems, items[totalItems]);
    }

    function updateItem(
        uint256 _itemId,
        bool _inLootBox,
        StateConfig memory _canMintConfig
    ) external {
        require(_msgSender() == items[_itemId].creator, "Accessories::updateItem: Only Creator can update the ItemDetails.");

        items[_itemId].inLootBox = _inLootBox;
        items[_itemId].canMintConfig = _restore(_snapshot(_newState(_canMintConfig)));
        
        emit ItemUpdated(totalItems, items[totalItems]);
    }

    function getItemPrice(uint256 _itemId, address _paymentToken, uint256 _units) public view returns(uint256){
        uint256 stackIndex;
        bool flag = false;
        ItemDetails memory item = items[_itemId];
        for(uint256 i=0;i<item.currencies.length;i=i+1){
            if(item.currencies[i] == _paymentToken){
                stackIndex = i;
                flag = true;
                break;
            }
        }
        require(flag, "Accessories::getItemPrice: Unsupported payment token.");
        
        State memory _state = item.priceConfig;
        eval(abi.encode(_units), _state, stackIndex);

        return _state.stack[_state.stackIndex - 1];
    }

    function buyItem(uint256 _itemId, uint256 _units) external canMint(_itemId){
        require(_itemId <= totalItems, "Accessories::buyItem: Invalid ItemId.");
        ItemDetails memory item = items[_itemId];
        for(uint256 i=0;i<item.currencies.length;i=i+1){
            IERC20 token = IERC20(item.currencies[i]);
            token.transferFrom(_msgSender(), address(this), getItemPrice(_itemId, address(token), _units));
        }
        _mint(_msgSender(), _itemId, _units, "");
    }

    function addCreator(address _creator) onlyOwner external {
        require(_creator != address(0), "Accessories::addCreator: Invalid Creator address.");
        Creators.add(_creator);
        emit CreatorAdded(_creator);
    }

    function RemoveCreator(address _creator) onlyOwner external {
        Creators.remove(_creator);
        emit CreatorRemoved(_creator);
    }

    function setAdmin(address _admin) onlyOwner external {
        require(_admin != address(0), "Accessories::addCreator: Invalid Creator address.");
        Admin = _admin;
        emit AdminChanged(_admin);
    }

    function getCreators() external view returns (address[] memory){
        return Creators.values();
    }

    function getRarity(uint8 _rarity) internal pure returns(Rarity){
        if(_rarity == 0) return Rarity.NONE;
        else if(_rarity == 1) return Rarity.COMMON;
        else if(_rarity == 2) return Rarity.UNCOMMON;
        else if(_rarity == 3) return Rarity.RARE;
        else if(_rarity == 4) return Rarity.ULTRARARE;
        else revert("Accessories::getRarity: Invalid Rarity");
    }

    function getClass(uint256 _class) internal view returns(uint256){
        if(Classes.contains(_class)) return _class;
        else revert ("Accessories::getClass: Invalid class value.");
    }

    function withdraw(address _tokenAddress) public onlyOwner{
        IERC20(_tokenAddress).transfer(owner(), IERC20(_tokenAddress).balanceOf(address(this)));
    }

    function getReport(uint256 report_, uint256 blockNumber_) public view returns(uint256) {
        console.log(TierReport.tierAtBlockFromReport(report_, blockNumber_));
        return TierReport.tierAtBlockFromReport(report_, blockNumber_);
    }
    
    function applyOp(
        bytes memory context_,
        State memory state_,
        uint256 opcode_,
        uint256 operand_
    ) internal view virtual override{
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
                uint256 report = TierReport.tierAtBlockFromReport(_report, _block);
                
                state_.stack[state_.stackIndex] = report;
                state_.stackIndex++;
            }
        }
    }
}