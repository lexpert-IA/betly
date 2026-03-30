const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Polygon Mainnet addresses
  const USDC_E      = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // USDC.e (bridged PoS)
  const A_USDC_E    = "0x625E7708f30cA75bfd92586e17077590C60eb4cD"; // aPolUSDC (Aave V3 aToken)
  const AAVE_POOL   = "0x794a61358D6845594F94dc1DB02A252b5b4814aD"; // Aave V3 Pool Polygon

  console.log("Deploying BetlyYield...");
  console.log("  USDC.e:    ", USDC_E);
  console.log("  aPolUSDC:  ", A_USDC_E);
  console.log("  Aave Pool: ", AAVE_POOL);

  const Factory = await ethers.getContractFactory("BetlyYield");
  const contract = await Factory.deploy(USDC_E, A_USDC_E, AAVE_POOL);
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("\nBetlyYield deployed at:", addr);
  console.log("Admin:", deployer.address);
  console.log("\nNext: update web/src/lib/contracts.js with new address");
}

main().catch((e) => { console.error(e); process.exit(1); });
