// Deploys VerdantRegistry and writes the address + ABI to deployments/<network>.json,
// which the backend reads. Usage: npx hardhat run scripts/deploy.js --network amoy
const fs = require("fs");
const path = require("path");
const { ethers, network, artifacts } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const reg = await (await ethers.getContractFactory("VerdantRegistry")).deploy();
  await reg.waitForDeployment();
  const address = await reg.getAddress();
  const { abi } = await artifacts.readArtifact("VerdantRegistry");

  const out = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    network: network.name, chainId: Number(network.config.chainId ?? 31337),
    address, deployer: deployer.address, deployedAt: new Date().toISOString(),
    tx: reg.deploymentTransaction().hash, abi,
  }, null, 2));
  console.log(`VerdantRegistry deployed to ${address} on ${network.name}\n-> ${out}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
