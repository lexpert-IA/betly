const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // 1. Deploy MockUSDC
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();
  await mockUsdc.waitForDeployment();
  const usdcAddr = await mockUsdc.getAddress();
  console.log("MockUSDC deployed:", usdcAddr);

  // 2. Mint 10,000 mUSDC to deployer (for testing)
  const tx = await mockUsdc.mint(deployer.address, 10000n * 10n ** 6n);
  await tx.wait();
  console.log("Minted 10,000 mUSDC to deployer");

  // 3. Deploy BetlyMarket
  const BetlyMarket = await hre.ethers.getContractFactory("BetlyMarket");
  const betly = await BetlyMarket.deploy(usdcAddr);
  await betly.waitForDeployment();
  const betlyAddr = await betly.getAddress();
  console.log("BetlyMarket deployed:", betlyAddr);

  // 4. Create a test market (30 days from now)
  const deadline = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const createTx = await betly.createMarket("Bitcoin > 150k fin 2025 ?", deadline);
  await createTx.wait();
  console.log("Test market #0 created");

  console.log("\n=== DEPLOYMENT SUMMARY ===");
  console.log(`MockUSDC:    ${usdcAddr}`);
  console.log(`BetlyMarket: ${betlyAddr}`);
  console.log(`Network:     Polygon Amoy (chainId 80002)`);
  console.log(`Admin:       ${deployer.address}`);
  console.log("\nCopy these addresses to web/src/lib/contracts.js");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
