import cTokenAbi from "../../abis/qiErc20.json";
import compAbi from "../../abis/qiComptroller.json";
import erc20Abi from "../../abis/erc20.json";
import priceOracleAbi from "../../abis/qiPriceOracle.json";

export default {
  abi: {
    token: cTokenAbi,
    comp: compAbi,
    erc20: erc20Abi,
    priceOracle: priceOracleAbi,
  },
  contractAddress: {
    comp: "0x0fEC306943Ec9766C1Da78C1E1b18c7fF23FE09e",
  },
  rewardTokenAddress: "0x7F3ACBab9d0C1Cb1bcDD30776AC2233d06249958",
  assets: {
    AVAX: {
      underlyingAddress: "0x219990FA1f91751539c65aE3f50040C6701cF219",
      address: "0x219990FA1f91751539c65aE3f50040C6701cF219",
      decimals: 8,
      underlyingDecimals: 18,
      native: true,
    },
    USDC: {
      underlyingAddress: "0x45ea5d57BA80B5e3b0Ed502e9a08d568c96278F9",
      address: "0x51203d73c94273C495F5d515dE87795649c21D53",
      decimals: 8,
      underlyingDecimals: 6,
      native: false,
    },
    USDT: {
      underlyingAddress: "0x3d1DF20A1F4f147d5597C59161a34CBF9B2B5023",
      address: "0x271A162055bD15E7375964eb7aDa0b1b3607C1d2",
      decimals: 8,
      underlyingDecimals: 6,
      native: false,
    },
    DAI: {
      underlyingAddress: "0x2125829808Fb3466d2114590b704f0266421951D",
      address: "0x900264f715F04e1C83CdA1dbAaaed1FAa77B02d9",
      decimals: 8,
      underlyingDecimals: 18,
      native: false,
    },
    BTC: {
      underlyingAddress: "0x385104afA0BfdAc5A2BcE2E3fae97e96D1CB9160",
      address: "0x1116E05cc3f64a9C4B90A5aDeE0f5C631C65ea38",
      decimals: 8,
      underlyingDecimals: 8,
      native: false,
    },
    ETH: {
      underlyingAddress: "0x4f5003fd2234Df46FB2eE1531C89b8bdcc372255",
      address: "0x906F11f3087ad54Dbf618E763427BD98AF16Bf9C",
      decimals: 8,
      underlyingDecimals: 18,
      native: false,
    },
    LINK: {
      underlyingAddress: "0x8913a950A5fBF2832B88B9F1e4D0EeBd5281Ac10",
      address: "0xf9D54ab000a2631ad3AA9e7adb40Bfab96F7EfdB",
      decimals: 8,
      underlyingDecimals: 18,
      native: false,
    },
    Qi: {
      underlyingAddress: "0x8729438EB15e2C8B576fCc6AeCdA6A148776C0F5",
      address: "0x7F3ACBab9d0C1Cb1bcDD30776AC2233d06249958",
      decimals: 8,
      underlyingDecimals: 18,
      native: false,
    },
  } as const,
  markets: ["AVAX", "USDC", "USDT", "DAI", "BTC", "ETH", "LINK", "Qi"] as const,
  provider: "https://api.avax-test.network/ext/bc/C/rpc",
  privateKey:
    "b8c1b5c1d81f9475fdf2e334517d29f733bdfa40682207571b12fc1142cbf329",
  rewards: ["Qi", "AVAX"] as const,
  testToken: "AVAX" as const,
};
