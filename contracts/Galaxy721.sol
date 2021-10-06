// contracts/MyNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";

contract Galaxy721 is ERC721Enumerable {
    enum GalaxyClass {Common, Rare, Epic, Legendary}

    struct Offer {
        address seller;
        uint256 minValue;
        address winner;
    }

    struct Bid {
        address bidder;
        uint256 value;
    }

    uint256 private _cap;
    uint256 private _commonCap;
    uint256 private _rareCap;
    uint256 private _epicCap;
    uint256 private _legendaryCap;
    uint256 private _drawValue;

    mapping(uint256 => GalaxyClass) private _planetIdToClass;

    // Draw for free
    uint256 _freeDrawsCount;
    mapping(address => uint256) _freeDraws;

    // Show offer for public
    mapping(uint256 => Offer) private _activeOffers;
    mapping(uint256 => uint256) private _offeredTokensListIndex;
    uint256[] private _offeredTokenIds;

    // Place bid
    mapping(uint256 => Bid) private _bids;

    // Withdrawals
    mapping (address => uint256) public _pendingWithdrawals;

    address payable _owner;

    constructor(uint16 cap_, uint256 drawValue_, uint256 freeDrawsCount_) ERC721("Galaxy721", "GALAXY") {
        _cap = cap_;
        _drawValue = drawValue_;
        _commonCap = cap_ * uint256(40);
        _rareCap = cap_ * uint256(70);
        _epicCap = cap_ * uint256(90);
        _legendaryCap = cap_ * uint256(100);
        _freeDrawsCount = freeDrawsCount_;
        _owner = payable(msg.sender);
    }

    event Draw(address indexed from, uint256 indexed planetId, GalaxyClass indexed class);
    event PlaceOffer(address indexed from, uint256 planetId, uint256 minValue);
    event PlaceBid(address indexed bidder, uint256 planetId, uint256 value);
    event AcceptBid(uint256 planetId, address indexed from, address indexed to, uint256 value);
    event OfferOutbidded(uint256 planetId, address indexed bidder, uint256 value, address indexed prevBidder, uint256 prevValue);
    event Withdrawn(address from, uint256 value);
    event AssignFreeDraws(address to, uint256 amount);
    event FreeDraw(address to);

    modifier onlyPlanetOwner(uint256 planetId) {
        require(msg.sender == ownerOf(planetId), "Galaxy721: only planet owner");
        _;
    }

    modifier onlyActiveOffer(uint256 planetId) {
        require(_activeOffers[planetId].seller > address(0), "Galaxy721: no active offer for planetId");
        _;
    }

    function draw() external payable returns (uint256) {
        require(totalSupply() < _cap, "Galaxy721: cap already reached");

        // Use free draw if available
        if (_freeDraws[msg.sender] > 0) {
            _freeDraws[msg.sender]--;
            emit FreeDraw(msg.sender);
        } else {
            require(msg.value >= _drawValue, "Galaxy721: not enouth ether to draw");
        }

        // Mint planet
        uint256 planetId = totalSupply() + 1;
        _mint(msg.sender, planetId);

        // Draw planet type
        uint16 seed = _pseudopseudo();
        _planetIdToClass[planetId] = _resolveClass(seed);

        emit Draw(msg.sender, planetId, _planetIdToClass[planetId]);

        return planetId;
    }

    function giveAwayFreeDraws(address to, uint256 amount) external {
        require(msg.sender == _owner, "Galaxy721: only contract owner");
        require(amount <= _freeDrawsCount, "Galaxy721: not enough free draws left to assign selected amount");
        _freeDraws[to] += amount;
        _freeDrawsCount -= amount;
        emit AssignFreeDraws(to, amount);
    }

    function drawsToGiveAway() external view returns (uint256) {
        return _freeDrawsCount;
    }

    function freeDrawsForAddress(address from) external view returns (uint256) {
        return _freeDraws[from];
    }

    function offerForSale(uint256 planetId, uint256 minValue) external onlyPlanetOwner(planetId) {
        require(_activeOffers[planetId].seller == address(0), "Galaxy721: planed already offered for sale");

        // Push active offer
        _activeOffers[planetId] = Offer(msg.sender, minValue, address(0));
        _offeredTokenIds.push(planetId);

        // Provide enumeration for active offer
        uint256 index = _offeredTokenIds.length - 1;
        _offeredTokensListIndex[planetId] = index;

        emit PlaceOffer(msg.sender, planetId, minValue);
    }

    function placeBid(uint256 planetId) external payable onlyActiveOffer(planetId) {
        require(msg.sender != _bids[planetId].bidder, "Galaxy721: can't place a bid with same address that has highest bid already");
        require(msg.value >= _activeOffers[planetId].minValue, "Galaxy721: min bid value not reached");
        require(msg.value > _bids[planetId].value, "Galaxy721: bid value doesn't top a current highest bid");

        // If bid already exists and new value out-bidding previous
        Bid memory prevBid = _bids[planetId];
        if (prevBid.value > 0 && prevBid.value < msg.value) {
            // Add previous bidder for withdawwal
            _pendingWithdrawals[prevBid.bidder] += prevBid.value;
            emit OfferOutbidded(planetId, msg.sender, msg.value, prevBid.bidder, prevBid.value);
        }

        _bids[planetId] = Bid(msg.sender, msg.value);

        emit PlaceBid(msg.sender, planetId, msg.value);
    }

    function acceptBid(uint256 planetId) external onlyPlanetOwner(planetId) onlyActiveOffer(planetId) {
        require(_bids[planetId].bidder > address(0), "Galaxy721: no winning bid for offered planet");

        // transfer planet ownership
        safeTransferFrom(msg.sender, _bids[planetId].bidder, planetId);

        // allow prev owner to withdraw reward
        _pendingWithdrawals[msg.sender] += _bids[planetId].value;
        
        emit AcceptBid(planetId, msg.sender, _bids[planetId].bidder, _bids[planetId].value);

        // drow offer and bid
        delete _activeOffers[planetId];
        delete _bids[planetId];
    }

    function recallOffer(uint256 planetId) external onlyPlanetOwner(planetId) onlyActiveOffer(planetId) {
        Bid memory topBid = _bids[planetId];
        if (topBid.bidder > address(0)) {
            _pendingWithdrawals[topBid.bidder] += topBid.value;
            delete _bids[planetId];
        }
        delete _activeOffers[planetId];
    }

    function withdraw() external {
        uint256 amount = _pendingWithdrawals[msg.sender];
        _pendingWithdrawals[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit Withdrawn(msg.sender, amount);
    }

    function cap() external view returns (uint256) {
        return _cap;
    }

    function ownedPlanetCount(address owner) external view returns (uint256) {
        return balanceOf(owner);
    }

    function ownedPlanetClass(address owner, uint256 index) external view returns (GalaxyClass) {
        uint256 planetId = tokenOfOwnerByIndex(owner, index);
        return _planetIdToClass[planetId];
    }

    function activeOffers() external view returns (uint256[] memory) {
        return _offeredTokenIds;
    }

    function bid(uint256 planetId) external view returns (Bid memory) {
        require(_bids[planetId].bidder > address(0), "Galaxy721: no bid for current planet");
        return _bids[planetId];
    }

    function activeOffer(uint256 planetId) external view returns (Offer memory) {
        require(_activeOffers[planetId].seller > address(0), "Galaxy721: no active offer");
        return _activeOffers[planetId];
    }

    function _pseudopseudo() internal view returns (uint16) {
        bytes32 pseudo = keccak256(abi.encodePacked(block.timestamp, block.difficulty));
        return uint16(uint256(pseudo) % (_cap * 100));
    }

    function _resolveClass(uint16 seed) internal view returns (GalaxyClass) {
        if (seed >= 1 && seed <= _commonCap) {
            return GalaxyClass.Common;
        } else if (seed > _commonCap && seed <= _rareCap) {
            return GalaxyClass.Rare;
        } else if (seed > _rareCap && seed <= _epicCap) {
            return GalaxyClass.Epic;
        } else if (seed > _epicCap && seed <= _legendaryCap) {
            return GalaxyClass.Legendary;
        }
        return GalaxyClass.Common;
    }
}
