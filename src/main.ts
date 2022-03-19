import { Wallet, Contract, providers, BigNumber } from "ethers";
import cEthAbi from "./abis/cEth.json";
import cTokenAbi from "./abis/cToken.json";
import compAbi from "./abis/comptroller.json";
import erc20Abi from "./abis/erc20.json";
import { Erc20 } from "./abis/types";
const provider = new providers.JsonRpcProvider(
  "https://kovan.infura.io/v3/2b17a18942384c25ad91e8636764a89f"
);
const privateKey =
  "4f4b5c6ddc896de134f2a8e3d0cc5925a15e2b20656eab74f423b31eaf14d69c";
const wallet = new Wallet(privateKey, provider);
const myWalletAddress = wallet.address;

// Mainnet Contract for cDAI (https://compound.finance/docs#networks)
const assetName = "DAI"
const cTokenContractAddress = "0xF0d0EB522cfa50B716B3b1604C4F0fA6f04376AD";
const cTokenContract = new Contract(cTokenContractAddress, cTokenAbi, wallet);
const underlyingContractAddress = "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa";
const underlyingContract = new Contract(
  underlyingContractAddress,
  erc20Abi,
  wallet
) as Erc20;
const underlyingDecimals = 18; // Number of decimals defined in this ERC20 token's contract
const cEthContractAddress = "0x41b5844f4680a8c38fbb695b7f9cfd1f64474a72";
const cEthContract = new Contract(cEthContractAddress, cEthAbi, wallet);
const comptrollerContractAddress = "0x5eae89dc1c671724a672ff0630122ee834098657";
const comptrollerContract = new Contract(
  comptrollerContractAddress,
  compAbi,
  wallet
);

const main = async function () {
  // Supply APY
  const supplyRatePerBlock = await cEthContract.callStatic.supplyRatePerBlock();
  const supplAPY = calculateAPY(supplyRatePerBlock);
  console.log(supplAPY);

  // Distribution APY
  const compSpeed = await comptrollerContract.compSpeeds(cTokenContractAddress);
  console.log(compSpeed);

  // Collateral Factor
  let { 1: collateralFactor } = await comptrollerContract.callStatic.markets(
    cTokenContractAddress
  );
  collateralFactor = (collateralFactor / 1e18) * 100; // Convert to percent
  console.log(collateralFactor);

  // isApproved
  const allowance = await underlyingContract.callStatic.allowance(
    await wallet.getAddress(),
    cTokenContractAddress
  );

  // Approve To Supply
  const inputToSupply = "0.1";
  const underlyingToSupply = BigNumber.from(
    (+inputToSupply * Math.pow(10, underlyingDecimals)).toString()
  );
  console.log(underlyingToSupply.toString(), allowance.toString());
  if (underlyingToSupply.gt(allowance)) {
    const approve = await underlyingContract.approve(
      cTokenContractAddress,
      underlyingToSupply.toString()
    );
    await approve.wait(1);
    console.log("Approved");
  } else {
    console.log("is Enable");
  }

  // Use xxx as Collateral
  // to Collateral cDAI
  const collaterals = await comptrollerContract.getAssetsIn(
    wallet.getAddress()
  );
  console.log(collaterals);
  if (!collaterals.includes(cTokenContractAddress)) {
    const enterMarkets = await comptrollerContract.enterMarkets([
      cTokenContractAddress,
    ]);
    await enterMarkets.wait(1);
    console.log(`Use c${assetName} as Collateral`);
  } else {
    console.log(`c${assetName} already used as Collateral`);
  }

  // Revoke xxx as Collateral
  const exitMarkets = await comptrollerContract.exitMarket(
    cTokenContractAddress
  );
  await exitMarkets.wait(1);
  console.log(`Revoke c${assetName} as Collateral`);
  console.log(await comptrollerContract.getAssetsIn(wallet.getAddress()));

  // Supply
  // Mint cTokens by supplying underlying tokens to the Compound Protocol
  const tx = await cTokenContract.mint(underlyingToSupply.toString());
  await tx.wait(1); // wait until the transaction has 1 confirmation on the blockchain
  console.log(`c${assetName} "Mint" operation successful.`, '\n');

  // Supply underlyingToken Balance
  const bal = await cTokenContract.callStatic.balanceOfUnderlying(myWalletAddress);
  const balanceOfUnderlying = +bal / Math.pow(10, underlyingDecimals);
  console.log(`${assetName} supplied to the Compound Protocol:`, balanceOfUnderlying, '\n');

  // Wallet cToken Balance
  let cTokenBalance = +(await cTokenContract.callStatic.balanceOf(myWalletAddress)) / 1e8;
  console.log(`My wallet's c${assetName} Token Balance:`, cTokenBalance);

  // Wallet underlyingToken Balance
  let underlyingBalance = await underlyingContract.callStatic.balanceOf(myWalletAddress);
  let underlyingBalanceNumber = +underlyingBalance / Math.pow(10, underlyingDecimals);
  console.log(`My wallet's ${assetName} Token Balance:`, underlyingBalanceNumber, '\n');

  // Withdraw
  console.log(`Redeeming the c${assetName} for ${assetName}...`);
  let underlyingAmount = balanceOfUnderlying * Math.pow(10, underlyingDecimals);
  const withdrawTx = await cTokenContract.redeemUnderlying(underlyingAmount.toString());
  await withdrawTx.wait(1); // wait until the transaction has 1 confirmation on the blockchain
  underlyingBalance = await underlyingContract.callStatic.balanceOf(myWalletAddress);
  underlyingBalanceNumber = +underlyingBalance / Math.pow(10, underlyingDecimals);
  console.log(`My wallet's ${assetName} Token Balance:`, underlyingBalanceNumber, '\n');

};

main().catch((err) => {
  console.error(err);
});

function calculateAPY(ratePerBlock: number) {
  const ethMantissa = 1e18;
  const blocksPerDay = 6570; // 13.15 seconds per block
  const daysPerYear = 365;

  return (
    (Math.pow((ratePerBlock / ethMantissa) * blocksPerDay + 1, daysPerYear) -
      1) *
    100
  );
}
