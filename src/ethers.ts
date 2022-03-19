import { BigNumber, Wallet, Contract, providers } from "ethers";
import cEthAbi from "./abis/cEth.json";
import cTokenAbi from "./abis/cToken.json";
const provider = new providers.JsonRpcProvider(
  "https://kovan.infura.io/v3/2b17a18942384c25ad91e8636764a89f"
);
const privateKey =
  "4f4b5c6ddc896de134f2a8e3d0cc5925a15e2b20656eab74f423b31eaf14d69c";
const wallet = new Wallet(privateKey, provider);
const myWalletAddress = wallet.address;

// Mainnet Contract for cUSDT (https://compound.finance/docs#networks)
const cTokenContractAddress = "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9";
const cTokenContract = new Contract(cTokenContractAddress, cTokenAbi, wallet);
const cEthContractAddress = "0x41b5844f4680a8c38fbb695b7f9cfd1f64474a72";
const cEthContract = new Contract(cEthContractAddress, cEthAbi, wallet);

const main = async function () {
  console.log(
    await provider.getCode(cEthContractAddress)
  );

  // Supply APY
  const supplyRatePerBlock = await cEthContract.supplyRatePerBlock();
  console.log(supplyRatePerBlock);

  const supplAPY = calculateAPY(supplyRatePerBlock);

  console.log(supplAPY);
};

main().catch((err) => {
  console.error(err);
});

function calculateAPY(ratePerBlock: BigNumber) {
  const ethMantissa = 1e18;
  const blocksPerDay = 6570; // 13.15 seconds per block
  const daysPerYear = 365;

  return ratePerBlock
    .div(ethMantissa)
    .mul(blocksPerDay)
    .add(1)
    .pow(daysPerYear)
    .sub(1)
    .mul(100)
    .toString();
}
