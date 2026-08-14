#!/bin/bash
set -e

RPC="$SEPOLIA_RPC_URL"
FACTORY="0xb59cf62962B5740694166DCa3a178e3e5383ce40"
ROUTER="0xb67a8a0E69919cfE4486B777EFcE1d461783cFB9"
USDC="0x7f837e0F0D3127AdfEEC592EB08578099A4e0501"
DAI="0x07592af899FD0160F3192Efb8A33D997709e1c71"
DEPLOYER="0x7ad0aafdEC81b27eF61998c4f761abB45E9756F8"

echo "=== Custom Uniswap V2 Test ==="
echo "Factory: $FACTORY"
echo "Router: $ROUTER"
echo "USDC: $USDC"
echo "DAI: $DAI"
echo ""

echo "1. Check factory allPairsLength"
cast call $FACTORY "allPairsLength()(uint256)" --rpc-url $RPC

echo ""
echo "2. Query getPair for USDC/DAI (before pool creation)"
EXISTING_POOL=$(cast call $FACTORY "getPair(address,address)(address)" $USDC $DAI --rpc-url $RPC)
echo "Existing pool: $EXISTING_POOL"

echo ""
echo "3. Approve tokens to Router (requires interaction)"
echo "Would need: cast send $USDC 'approve(address,uint256)' $ROUTER 1000000000000000000 --account deployer --rpc-url $RPC"

echo ""
echo "✓ Custom Uniswap V2 is ready for testing"
