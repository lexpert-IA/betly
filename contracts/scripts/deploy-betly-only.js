const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "POL");

  // MockUSDC already deployed
  const usdcAddr = "0x8bf84fd7efE6619545aB503d8e4f7018a61a6f16";
  console.log("Using MockUSDC:", usdcAddr);

  // Deploy BetlyMarket
  const BetlyMarket = await hre.ethers.getContractFactory("BetlyMarket");
  const betly = await BetlyMarket.deploy(usdcAddr);
  await betly.waitForDeployment();
  const betlyAddr = await betly.getAddress();
  console.log("BetlyMarket deployed:", betlyAddr);

  // Create test market (30 days)
  const deadline = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const createTx = await betly.createMarket("Bitcoin > 150k fin 2025 ?", deadline);
  await createTx.wait();
  console.log("Test market #0 created");

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log(`MockUSDC:    ${usdcAddr}`);
  console.log(`BetlyMarket: ${betlyAddr}`);
  console.log(`Network:     Polygon Amoy (chainId 80002)`);
  console.log(`Admin:       ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
