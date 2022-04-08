//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';
import '@beehiveinnovation/rain-protocol/contracts/vm/RainVM.sol';
import { VMState, StateConfig } from '@beehiveinnovation/rain-protocol/contracts/vm/libraries/VMState.sol';

contract Accessories is ERC1155, Ownable, RainVM, VMState{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;
    using Strings for uint256;

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
        StateConfig priceConfig;
        address[] currencies;
        uint256 class;
        Rarity rarity;
        address creator;
    }

    mapping(uint256 => ItemDetails) public items;
    mapping(uint256 => address) pricePointer;

    string BaseURI = "";

    // EVENTS
    event BaseURIChanged(string _baseURI);
    event ClassCreated(uint256 _classId, string[] _attributes);
    event ClassRemoved(uint256 _classId);
    event ItemCreated(uint256 _itemId, ItemDetails _item);
    event ItemUpdated(uint256 _itemId, ItemDetails _item);
    event CreatorAdded(address _addedCreator);
    event CreatorRemoved(address _removedCreator);
    // EVENTS END

    constructor() ERC1155("URI") {
        console.log("Deploying a ERC1155 Contract");
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

    function removeClass(uint256 _class) external {
        Classes.remove(_class);
        emit ClassRemoved(_class);
    }

    function newItem(bool _inLootBox, StateConfig memory _priceConfig, address[] memory _paymentTokens, uint8 _class, uint8 _rarity) external {
        require(Creators.contains(_msgSender()), "Accessories:newItem: Only Creators can create items");
        totalItems = totalItems.add(1);
        
        items[totalItems] = ItemDetails(
            _inLootBox,
            totalItems,
            _priceConfig,
            _paymentTokens,
            getClass(_class),
            getRarity(_rarity),
            _msgSender()
        );

        pricePointer[totalItems] = _snapshot(_newState(_priceConfig));

        emit ItemCreated(totalItems, items[totalItems]);
    }

    function updateItem(uint256 _itemId, bool _inLootBox, StateConfig memory _priceConfig, address[] memory _paymentTokens, uint8 _class, uint8 _rarity) external {
        require(_msgSender() == items[_itemId].creator, "Accessories::updateItem: Only Creator can update the ItemDetails.");

        items[_itemId].inLootBox = _inLootBox;
        items[_itemId].priceConfig = _priceConfig;
        items[_itemId].currencies = _paymentTokens;
        items[_itemId].class = getClass(_class);
        items[_itemId].rarity = getRarity(_rarity);

        pricePointer[_itemId] = _snapshot(_newState(_priceConfig));
        
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
        
        State memory _state = _restore(pricePointer[_itemId]);
        eval(abi.encode(_units), _state, stackIndex);

        return _state.stack[_state.stackIndex - 1];
    }

    function buyItem(uint256 _itemId, address _paymentToken, uint256 _units) external {
        require(_itemId <= totalItems, "Accessories::buyItem: Invalid ItemId.");
            require(
                IERC20(_paymentToken)
                .allowance(_msgSender(), address(this)) >= getItemPrice(_itemId, _paymentToken, _units), "Accessories::buyItem: Insufficient allowance.");
            
            IERC20(_paymentToken).transferFrom(_msgSender(), address(this), getItemPrice(_itemId, _paymentToken, _units));
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
}
