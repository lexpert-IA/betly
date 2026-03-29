const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "POL");

  // Native USDC on Polygon mainnet (Circle)
  const usdcAddr = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

  // Deploy BetlyLite
  const BetlyLite = await hre.ethers.getContractFactory("BetlyLite");
  const betly = await BetlyLite.deploy(usdcAddr);
  await betly.waitForDeployment();
  const betlyAddr = await betly.getAddress();
  console.log("BetlyLite deployed:", betlyAddr);

  // Create first market: "Bitcoin > 150k fin 2025 ?" — 30 days
  const deadline = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const tx = await betly.create(deadline);
  await tx.wait();
  console.log("Market #0 created (deadline:", new Date(deadline * 1000).toISOString(), ")");

  const bal2 = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Remaining balance:", hre.ethers.formatEther(bal2), "POL");

  console.log("\n=== POLYGON MAINNET DEPLOYMENT ===");
  console.log(`USDC (native): ${usdcAddr}`);
  console.log(`BetlyLite:     ${betlyAddr}`);
  console.log(`Admin:         ${deployer.address}`);
  console.log(`Market #0:     Bitcoin > 150k fin 2025 ?`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
