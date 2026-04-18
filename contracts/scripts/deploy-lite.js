const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "POL");

  const usdcAddr = "0x8bf84fd7efE6619545aB503d8e4f7018a61a6f16"; // MockUSDC already deployed

  // Deploy BetlyLite
  const BetlyLite = await hre.ethers.getContractFactory("BetlyLite");
  const betly = await BetlyLite.deploy(usdcAddr);
  await betly.waitForDeployment();
  const betlyAddr = await betly.getAddress();
  console.log("BetlyLite deployed:", betlyAddr);

  // Create test market (30 days)
  const deadline = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const tx = await betly.create(deadline);
  await tx.wait();
  console.log("Market #0 created (deadline:", new Date(deadline * 1000).toISOString(), ")");

  console.log("\n=== DONE ===");
  console.log(`MockUSDC:   ${usdcAddr}`);
  console.log(`BetlyLite:  ${betlyAddr}`);
  console.log(`Admin:      ${deployer.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
