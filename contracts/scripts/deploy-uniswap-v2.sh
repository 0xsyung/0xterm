#!/bin/bash
# Deploy Uniswap V2 on Sepolia testnet
# Usage: source .env && bash scripts/deploy-uniswap-v2.sh

set -e

RPC_URL="${SEPOLIA_RPC_URL:-https://eth-sepolia.g.alchemy.com/v2/}"
ACCOUNT="${ACCOUNT:-deployer}"
SENDER="${DEPLOYER_ADDRESS}"

echo "====== Deploying Uniswap V2 on Sepolia ======"
echo "RPC: $RPC_URL"
echo "Sender: $SENDER"
echo ""

# Build contracts
echo "🔨 Building contracts..."
forge build

# Deploy WETH9
echo "📦 Deploying WETH9..."
WETH_OUTPUT=$(forge create src/WETH9.sol:WETH9 \
  --rpc-url "$RPC_URL" \
  --account "$ACCOUNT" \
  --json)
WETH_ADDRESS=$(echo "$WETH_OUTPUT" | jq -r '.deployedTo')
echo "✅ WETH9 deployed at: $WETH_ADDRESS"

# Deploy Factory
echo "📦 Deploying UniswapV2Factory..."
FACTORY_OUTPUT=$(forge create lib/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory \
  --rpc-url "$RPC_URL" \
  --account "$ACCOUNT" \
  --constructor-args "$SENDER" \
  --json)
FACTORY_ADDRESS=$(echo "$FACTORY_OUTPUT" | jq -r '.deployedTo')
echo "✅ UniswapV2Factory deployed at: $FACTORY_ADDRESS"

# Deploy Router
echo "📦 Deploying UniswapV2Router02..."
ROUTER_OUTPUT=$(forge create lib/v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02 \
  --rpc-url "$RPC_URL" \
  --account "$ACCOUNT" \
  --constructor-args "$FACTORY_ADDRESS" "$WETH_ADDRESS" \
  --json)
ROUTER_ADDRESS=$(echo "$ROUTER_OUTPUT" | jq -r '.deployedTo')
echo "✅ UniswapV2Router02 deployed at: $ROUTER_ADDRESS"

echo ""
echo "====== DEPLOYMENT COMPLETE ======"
echo "WETH9:               $WETH_ADDRESS"
echo "Factory:             $FACTORY_ADDRESS"
echo "Router:              $ROUTER_ADDRESS"
echo "Fee Recipient:       $SENDER"
echo ""
echo "Add these to your .env file:"
echo "WETH_ADDRESS=$WETH_ADDRESS"
echo "UNISWAP_V2_FACTORY=$FACTORY_ADDRESS"
echo "UNISWAP_V2_ROUTER=$ROUTER_ADDRESS"
