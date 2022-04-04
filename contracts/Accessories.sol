//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/Strings.sol';

contract Accessories is ERC1155, Ownable{
    using EnumerableSet for EnumerableSet.UintSet;
    using EnumerableSet for EnumerableSet.AddressSet;
    using SafeMath for uint256;
    using Strings for uint256;

    enum Class {
        S,A,B,C,D
    }

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
    
    EnumerableSet.AddressSet Creators;

    struct ItemDetails {
        bool inLootBox;
        uint256 price;
        Class class;
        Rarity rarity;
        address creator;
    }

    mapping(uint256 => ItemDetails) public items;

    string BaseURI = "";

    constructor() ERC1155("URI") {
        console.log("Deploying a ERC1155 Contract");
    }

    function setBaseURI(string memory _baseURI) external onlyOwner{
        BaseURI = _baseURI;
    }

    function uri(uint256 _tokenId) public view virtual override returns(string memory){
        require(_tokenId > 0, "Accessories:uri: Invalid TokenId.");
        return string(abi.encodePacked(BaseURI, "/", _tokenId.toString(), ".json"));
    }

    function newItem(bool _inLootBox, uint256 _price, uint8 _class, uint8 _rarity) external payable {
        require(_price > 0, "Accessories::newItem: Zero price not allowed.");
        require(Creators.contains(_msgSender()));
        totalItems = totalItems.add(1);
        items[totalItems] = ItemDetails(
            _inLootBox,
            _price,
            getClass(_class),
            getRarity(_rarity),
            _msgSender()
        );
    }

    function RemoveCreator(address _creator) onlyOwner external {
        Creators.remove(_creator);
    }

    function addCreator(address _creator) onlyOwner external {
        require(_creator != address(0), "Accessories::addCreator: Invalid Creator address.");
        Creators.add(_creator);
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

    function getClass(uint8 _class) internal pure returns(Class){
        if(_class == 0) return Class.S;
        else if(_class == 1) return Class.A;
        else if(_class == 2) return Class.B;
        else if(_class == 3) return Class.C;
        else if(_class == 4) return Class.D;
        else revert("Accessories::getClass: Invalid Class");
    }
}
