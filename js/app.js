window.sentraCurrentAllocation = { mETH: 0, USDY: 0, USDC: 0, mUSD: 0 };

// Wallet Connection Logic
const connectButtons = [
  document.getElementById("navConnectBtn"),
  document.getElementById("heroConnectBtn"),
  document.getElementById("mobileConnectBtn"),
].filter(Boolean);

const walletModal = document.getElementById("walletModal");
const walletList = document.getElementById("walletList");
const walletModalClose = document.getElementById("walletModalClose");
const walletModalBackdrop = document.getElementById("walletModalBackdrop");
const disconnectMenu = document.getElementById("disconnectMenu");
const disconnectWalletBtn = document.getElementById("disconnectWalletBtn");

const STORAGE_KEY = "sentra_wallet_address";
const WALLET_UUID_KEY = "sentra_wallet_uuid";
const WALLET_SESSION_KEY = "sentra_wallet_session_active";

const mantleSepolia = {
  chainId: "0x138b",
  chainName: "Mantle Sepolia Testnet",
  nativeCurrency: {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.sepolia.mantle.xyz"],
  blockExplorerUrls: ["https://explorer.sepolia.mantle.xyz"],
};

let connectedWalletAddress = localStorage.getItem(STORAGE_KEY) || "";
let selectedWalletProvider = null;
let selectedWalletUuid = localStorage.getItem(WALLET_UUID_KEY) || "";
let detectedWallets = [];

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function updateConnectButtons() {
  const label = connectedWalletAddress
    ? shortenAddress(connectedWalletAddress)
    : "Connect Wallet";

  connectButtons.forEach((btn) => {
    btn.textContent = label;
    btn.classList.toggle("wallet-connected", Boolean(connectedWalletAddress));
  });
}
// Toast Notifications
function showToast(type = "info", title = "Notice", message = "") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <span class="toast-dot"></span>
    <div class="toast-content">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 220);
  }, 3500);
}
// Toast Popup
function showToast(type = "success", title = "Success", message = "") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  toast.innerHTML = `
    <span class="toast-dot"></span>
    <div class="toast-content">
      <strong>${title}</strong>
      <span>${message}</span>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// Toast Helper
function requireWalletConnection(actionName = "perform this action") {
  if (!connectedWalletAddress) {
    showToast(
      "error",
      "Wallet disconnected",
      `Connect your wallet before you ${actionName}.`
    );
    return false;
  }

  if (!selectedWalletProvider) {
    showToast(
      "error",
      "Wallet unavailable",
      "Reconnect your wallet before continuing."
    );
    return false;
  }

  return true;
}
//Detected Wallet

function addDetectedWallet(walletDetail) {
  const exists = detectedWallets.some(
    (wallet) => wallet.info.uuid === walletDetail.info.uuid
  );
  if (!exists) detectedWallets.push(walletDetail);
}

window.addEventListener("eip6963:announceProvider", (event) => {
  addDetectedWallet(event.detail);
});

window.dispatchEvent(new Event("eip6963:requestProvider"));

setTimeout(() => {
  if (!detectedWallets.length && window.ethereum) {
    detectedWallets.push({
      info: {
        name: window.ethereum.isMetaMask ? "MetaMask" : "Browser Wallet",
        icon: "",
        uuid: "legacy-window-ethereum",
      },
      provider: window.ethereum,
    });
  }
}, 300);

function renderWalletList() {
  if (!walletList) return;

  walletList.innerHTML = "";

  if (!detectedWallets.length) {
    walletList.innerHTML = `
      <button class="wallet-item" type="button" disabled>
        No browser wallet found
      </button>
    `;
    return;
  }

  detectedWallets.forEach((wallet) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wallet-item";
    button.innerHTML = `
      ${
        wallet.info.icon
          ? `<img src="${wallet.info.icon}" alt="${wallet.info.name} logo" class="wallet-logo" />`
          : `<span class="wallet-logo-fallback">${wallet.info.name.charAt(0)}</span>`
      }
      <span>${wallet.info.name}</span>
    `;

    button.addEventListener("click", async () => {
      selectedWalletProvider = wallet.provider;
      selectedWalletUuid = wallet.info.uuid;
      await connectWallet();
    });

    walletList.appendChild(button);
  });
}

function openWalletModal() {
  if (!walletModal) return;
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  setTimeout(() => {
    renderWalletList();
    walletModal.classList.add("open");
    walletModal.setAttribute("aria-hidden", "false");
  }, 150);
}

function closeWalletModal() {
  if (!walletModal) return;
  walletModal.classList.remove("open");
  walletModal.setAttribute("aria-hidden", "true");
}

function closeDisconnectMenu() {
  if (!disconnectMenu) return;
  disconnectMenu.hidden = true;
}

function openDisconnectMenu(anchorButton) {
  if (!disconnectMenu || !anchorButton) return;
  const rect = anchorButton.getBoundingClientRect();
  disconnectMenu.style.top = `${rect.bottom + 8}px`;
  disconnectMenu.style.left = `${Math.max(12, rect.right - 160)}px`;
  disconnectMenu.hidden = false;
}

async function ensureMantleSepolia(provider) {
  const currentChainId = await provider.request({
    method: "eth_chainId",
  });

  if (currentChainId === mantleSepolia.chainId) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: mantleSepolia.chainId }],
    });
  } catch (error) {
    if (error.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [mantleSepolia],
      });
    } else {
      throw error;
    }
  }
}
// ── Load historical feed activities on session restore ──
async function loadFeedActivities(userAddress) {
  try {
    await loadEthers();

    const provider = selectedWalletProvider
      ? new ethers.BrowserProvider(selectedWalletProvider)
      : new ethers.JsonRpcProvider(READ_RPC_URL);

    const { vault } = getContracts(provider);

    // Fetch last 1000 blocks worth of events
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 1000);

    // Get Deposit events for this user
    const depositFilter = vault.filters.Deposit(userAddress);
    const depositEvents = await vault.queryFilter(depositFilter, fromBlock);

    // Get Withdrawal events for this user
    const withdrawFilter = vault.filters.Withdrawal(userAddress);
    const withdrawEvents = await vault.queryFilter(withdrawFilter, fromBlock);

    // Combine and sort by block number descending
    const allEvents = [...depositEvents, ...withdrawEvents].sort(
      (a, b) => b.blockNumber - a.blockNumber
    );

    if (!allEvents.length) return;

    // Log each event to the feed
    allEvents.forEach((event) => {
      const isDeposit = event.eventName === "Deposit";

      const assetName = Object.keys(ASSET_MAP).find(
        (key) => ASSET_MAP[key].toLowerCase() === event.args.asset.toLowerCase()
      ) || "Asset";

      const tokenAmount = parseFloat(
        ethers.formatUnits(event.args.amount, 18)
      ).toFixed(2);

      const date = new Date();
      const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (typeof addFeedActivity === "function") {
        addFeedActivity(
          isDeposit ? "rebalance" : "risk",
          isDeposit
            ? `${assetName} deposited into vault`
            : `${assetName} withdrawn from vault`,
          isDeposit
            ? `${tokenAmount} ${assetName} was deposited on-chain.`
            : `${tokenAmount} ${assetName} was withdrawn from the vault.`
        );
      }
    });

    console.log(`Loaded ${allEvents.length} historical feed events ✅`);
  } catch (err) {
    console.error("loadFeedActivities failed:", err);
  }
}
async function connectWallet() {
  if (!selectedWalletProvider) return;

  // Clear old session before connecting new wallet
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(WALLET_UUID_KEY);
  connectedWalletAddress = "";

  try {
    await ensureMantleSepolia(selectedWalletProvider);
    // ... rest of your code
    const accounts = await selectedWalletProvider.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || !accounts.length) return;

    connectedWalletAddress = accounts[0];
    localStorage.setItem(STORAGE_KEY, connectedWalletAddress);
    localStorage.setItem(WALLET_SESSION_KEY, "true");

    if (selectedWalletUuid) {
      localStorage.setItem(WALLET_UUID_KEY, selectedWalletUuid);
    }

    updateConnectButtons();
   if (typeof updateMintWalletLabel === "function") {
  updateMintWalletLabel();
}
    closeWalletModal();
    closeDisconnectMenu();

    if (typeof loadDashboardData === "function") {
      await loadDashboardData(connectedWalletAddress);
    }
    loadFeedFromStorage(connectedWalletAddress);
    loadDashboardActivity(connectedWalletAddress);
    updateVaultSelectedBalance?.();
if (typeof loadFeedActivities === "function") {
  loadFeedActivities(connectedWalletAddress);
}

    if (typeof startEventListener === "function") {
      startEventListener(connectedWalletAddress);
    }
  } catch (error) {
    console.error("Wallet connection failed:", error);
  }
}
async function getWalletForTransaction() {
 if (!connectedWalletAddress) {
  throw new Error("Connect your wallet first.");
}

if (!selectedWalletProvider) {
  selectedWalletProvider =
    window.ethereum || detectedWallets[0]?.provider || null;
}

if (!selectedWalletProvider) {
  throw new Error("No wallet provider found. Please reconnect your wallet.");
}

  await ensureMantleSepolia(selectedWalletProvider);

  const accounts = await selectedWalletProvider.request({
    method: "eth_accounts",
  });

  const stillConnected = accounts?.some(
    (account) => account.toLowerCase() === connectedWalletAddress.toLowerCase()
  );

  if (!stillConnected) {
    selectedWalletProvider = null;
    updateConnectButtons();

    if (typeof updateMintWalletLabel === "function") {
      updateMintWalletLabel();
    }

    throw new Error("Wallet is disconnected. Please reconnect your wallet.");
  }

  await loadEthers();

  const browserProvider = new ethers.BrowserProvider(selectedWalletProvider);
  const signer = await browserProvider.getSigner();

  return {
    provider: browserProvider,
    signer,
    address: connectedWalletAddress,
  };
}

async function restoreWalletSession() {
  const savedAddress = localStorage.getItem(STORAGE_KEY);
  const savedWalletUuid = localStorage.getItem(WALLET_UUID_KEY);

  if (!savedAddress) {
    connectedWalletAddress = "";
    selectedWalletProvider = null;
    selectedWalletUuid = "";
    updateConnectButtons();
    updateMintWalletLabel?.();
    return;
  }

  connectedWalletAddress = savedAddress;
  selectedWalletUuid = savedWalletUuid || "";
  updateConnectButtons();
  updateMintWalletLabel?.();

  if (typeof loadDashboardData === "function") {
    await loadDashboardData(savedAddress);
  }
  loadFeedFromStorage(savedAddress);
  loadDashboardActivity(savedAddress);
  setTimeout(updateVaultSelectedBalance, 500);
if (typeof loadFeedActivities === "function") {
  loadFeedActivities(connectedWalletAddress);
}

  window.dispatchEvent(new Event("eip6963:requestProvider"));

  setTimeout(async () => {
    const walletToRestore = detectedWallets.find(
      (wallet) => wallet.info.uuid === savedWalletUuid
    );

    selectedWalletProvider =
      walletToRestore?.provider ||
      window.ethereum ||
      detectedWallets[0]?.provider ||
      null;

    if (!selectedWalletProvider) {
      return;
    }

    try {
      const accounts = await selectedWalletProvider.request({
        method: "eth_accounts",
      });

      const stillConnected = accounts?.some(
        (account) => account.toLowerCase() === savedAddress.toLowerCase()
      );

      if (!stillConnected) {
        selectedWalletProvider = null;
        return;
      }

      connectedWalletAddress = savedAddress;
      updateConnectButtons();
      updateMintWalletLabel?.();

      if (typeof startEventListener === "function") {
        startEventListener(savedAddress);
      }
    } catch (error) {
      console.error("Wallet restore failed:", error);
      selectedWalletProvider = null;
    }
  }, 1000);
}
function disconnectWallet() {
  clearFeed();
  clearDashboardActivity();
  connectedWalletAddress = "";
  selectedWalletProvider = null;
  selectedWalletUuid = "";

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(WALLET_UUID_KEY);
  localStorage.removeItem(WALLET_SESSION_KEY);

  updateConnectButtons();

  if (typeof updateMintWalletLabel === "function") {
    updateMintWalletLabel();
  }

  closeDisconnectMenu();
}

walletModalClose?.addEventListener("click", closeWalletModal);
walletModalBackdrop?.addEventListener("click", closeWalletModal);
disconnectWalletBtn?.addEventListener("click", disconnectWallet);

document.addEventListener("click", (event) => {
  if (
    disconnectMenu &&
    !disconnectMenu.hidden &&
    !disconnectMenu.contains(event.target)
  ) {
    closeDisconnectMenu();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeWalletModal();
    closeDisconnectMenu();
  }
});

connectButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (connectedWalletAddress) {
      openDisconnectMenu(button);
    } else {
      openWalletModal();
    }
  });
});

updateConnectButtons();

// ── Contract Config ──
const READ_RPC_URL = "https://rpc.sepolia.mantle.xyz";
const CONTRACT_ADDRESSES = {
  vault: "0x09DB401F1352B72ea174D5E585224e643da97712",
  mETH: "0xDd308FCAaece67B1c7d8F0E2E0bfc2FF8846986C",
  USDY: "0x606adfA46B3c330f9Af50fB920E8a51ac4672f0C",
  USDC: "0xcE65cb8E9EF4592C758865fE62dBf98174bbf1eb",
  mUSD: "0x7d7E1d282a75812880D5027549D570DCe609f77d",
};
const TOKEN_PRICES = {
  mETH: 2500,
  USDY: 1,
  USDC: 1,
  mUSD: 1,
};

function toUsd(symbol, tokenAmount) {
  return tokenAmount * TOKEN_PRICES[symbol];
}

function formatUsd(value) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}b`;
  }
  if (value >= 10_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}m`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}m`;
  }
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
function formatToken(value, symbol) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}b ${symbol}`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}m ${symbol}`;
  }
  if (value >= 10_000) {
    return `${(value / 1_000).toFixed(2)}k ${symbol}`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;
}

const VAULT_ABI = [{"inputs":[{"internalType":"address","name":"_mETH","type":"address"},{"internalType":"address","name":"_USDY","type":"address"},{"internalType":"address","name":"_USDC","type":"address"},{"internalType":"address","name":"_mUSD","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"mETHPercentage","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"USDYPercentage","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"USDCPercentage","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"mUSDPercentage","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"Rebalanced","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"Withdrawal","type":"event"},{"inputs":[],"name":"USDC","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"USDY","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"currentAllocation","outputs":[{"internalType":"uint256","name":"mETHPercentage","type":"uint256"},{"internalType":"uint256","name":"USDYPercentage","type":"uint256"},{"internalType":"uint256","name":"USDCPercentage","type":"uint256"},{"internalType":"uint256","name":"mUSDPercentage","type":"uint256"},{"internalType":"uint256","name":"updatedAt","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"deposit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getSupportedAssets","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserPortfolio","outputs":[{"internalType":"uint256","name":"mETHBalance","type":"uint256"},{"internalType":"uint256","name":"USDYBalance","type":"uint256"},{"internalType":"uint256","name":"USDCBalance","type":"uint256"},{"internalType":"uint256","name":"mUSDBalance","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getVaultTokenBalance","outputs":[{"internalType":"uint256","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"isSupportedAsset","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"mETH","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"mUSD","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"supportedAssets","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_mETHPercentage","type":"uint256"},{"internalType":"uint256","name":"_USDYPercentage","type":"uint256"},{"internalType":"uint256","name":"_USDCPercentage","type":"uint256"},{"internalType":"uint256","name":"_mUSDPercentage","type":"uint256"}],"name":"updateAllocation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"userBalances","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}];

const TOKEN_ABI = [{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}];

// ── Load Ethers.js ──
async function loadEthers() {
  return new Promise((resolve) => {
    if (window.ethers) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/ethers@6.13.0/dist/ethers.umd.min.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

// ── Get contract instances ──
function getContracts(signerOrProvider) {
  return {
    vault: new ethers.Contract(CONTRACT_ADDRESSES.vault, VAULT_ABI, signerOrProvider),
    mETH:  new ethers.Contract(CONTRACT_ADDRESSES.mETH, TOKEN_ABI, signerOrProvider),
    USDY:  new ethers.Contract(CONTRACT_ADDRESSES.USDY, TOKEN_ABI, signerOrProvider),
    USDC:  new ethers.Contract(CONTRACT_ADDRESSES.USDC, TOKEN_ABI, signerOrProvider),
    mUSD:  new ethers.Contract(CONTRACT_ADDRESSES.mUSD, TOKEN_ABI, signerOrProvider),
  };
}

// ── Asset address map ──
const ASSET_MAP = {
  mETH: CONTRACT_ADDRESSES.mETH,
  USDY: CONTRACT_ADDRESSES.USDY,
  USDC: CONTRACT_ADDRESSES.USDC,
  mUSD: CONTRACT_ADDRESSES.mUSD,
};

// Donut Change
function updateDashboardDonut(allocation, balances) {
  const donut = document.getElementById("dashboardAllocationDonut");
  const assetCount = document.getElementById("dashboardAssetCount");

  const methPercent = document.getElementById("dashboardMETHPercent");
  const usdyPercent = document.getElementById("dashboardUSDYPercent");
  const usdcPercent = document.getElementById("dashboardUSDCPercent");
  const musdPercent = document.getElementById("dashboardMUSDPercent");

  const methValue = document.getElementById("dashboardMETHValue");
  const usdyValue = document.getElementById("dashboardUSDYValue");
  const usdcValue = document.getElementById("dashboardUSDCValue");
  const musdValue = document.getElementById("dashboardMUSDValue");

  if (!donut) return;

  const mETH = allocation.mETH || 0;
  const USDY = allocation.USDY || 0;
  const USDC = allocation.USDC || 0;
  const mUSD = allocation.mUSD || 0;

  const mETHDeg = mETH * 3.6;
  const USDYDeg = mETHDeg + USDY * 3.6;
  const USDCDeg = USDYDeg + USDC * 3.6;

  if (mETH + USDY + USDC + mUSD === 0) {
    donut.style.background = "conic-gradient(rgba(255,255,255,0.08) 0deg 360deg)";
  } else {
    donut.style.background = `
      conic-gradient(
        #00d395 0deg ${mETHDeg}deg,
        #8fa89e ${mETHDeg}deg ${USDYDeg}deg,
        #d6fff0 ${USDYDeg}deg ${USDCDeg}deg,
        #5a7066 ${USDCDeg}deg 360deg
      )
    `;
  }

  const activeAssets = [balances.mETH, balances.USDY, balances.USDC, balances.mUSD]
    .filter((value) => value > 0).length;

  if (assetCount) assetCount.textContent = activeAssets;

  if (methPercent) methPercent.textContent = `${mETH}%`;
  if (usdyPercent) usdyPercent.textContent = `${USDY}%`;
  if (usdcPercent) usdcPercent.textContent = `${USDC}%`;
  if (musdPercent) musdPercent.textContent = `${mUSD}%`;

  if (methValue) methValue.textContent = `$${balances.mETH.toFixed(2)}`;
  if (usdyValue) usdyValue.textContent = `$${balances.USDY.toFixed(2)}`;
  if (usdcValue) usdcValue.textContent = `$${balances.USDC.toFixed(2)}`;
  if (musdValue) musdValue.textContent = `$${balances.mUSD.toFixed(2)}`;
}
// Yield,Time,Apy, Risk Score Change
let nextCheckSeconds = 300;

function updateLiveDashboardStats(totalUsd, percentages) {
  const yieldEl = document.getElementById("yieldEarnedValue");
  const apyEl = document.getElementById("projectedApyValue");
  const riskEl = document.getElementById("aiRiskScoreValue");
  

  const methPercent = percentages.mETH || 0;
  const usdyPercent = percentages.USDY || 0;
  const usdcPercent = percentages.USDC || 0;
  const musdPercent = percentages.mUSD || 0;

  const projectedApy =
    methPercent * 0.048 +
    usdyPercent * 0.052 +
    usdcPercent * 0.031 +
    musdPercent * 0.044;

  const yearlyYield = totalUsd * (projectedApy / 100);
  const simulatedEarned = yearlyYield / 365;

  if (yieldEl) {
    yieldEl.textContent = `$${simulatedEarned.toFixed(2)}`;
  }

  if (apyEl) {
    apyEl.textContent = `${projectedApy.toFixed(2)}%`;
  }

  if (riskEl) {
    let risk = "Low";

    if (methPercent >= 55) {
      risk = "High";
    } else if (methPercent >= 35) {
      risk = "Medium";
    }

    riskEl.textContent = risk;
    riskEl.classList.remove("green", "yellow", "red");

    if (risk === "Low") riskEl.classList.add("green");
    if (risk === "Medium") riskEl.classList.add("yellow");
    if (risk === "High") riskEl.classList.add("red");
  }

 
}


// ── Load dashboard data from chain ──
async function loadDashboardData(userAddress) {
  try {
    await loadEthers();

    const provider = selectedWalletProvider
      ? new ethers.BrowserProvider(selectedWalletProvider)
      : new ethers.JsonRpcProvider(READ_RPC_URL);

    const { vault } = getContracts(provider);

    const portfolio = await vault.getUserPortfolio(userAddress);

    const mETHBal = parseFloat(ethers.formatUnits(portfolio.mETHBalance, 18));
    const USDYBal = parseFloat(ethers.formatUnits(portfolio.USDYBalance, 18));
    const USDCBal = parseFloat(ethers.formatUnits(portfolio.USDCBalance, 18));
    const mUSDBal = parseFloat(ethers.formatUnits(portfolio.mUSDBalance, 18));

    const mETHUsd = toUsd("mETH", mETHBal);
    const USDYUsd = toUsd("USDY", USDYBal);
    const USDCUsd = toUsd("USDC", USDCBal);
    const mUSDUsd = toUsd("mUSD", mUSDBal);

    const totalUsd = mETHUsd + USDYUsd + USDCUsd + mUSDUsd;

    const allocMETH = totalUsd > 0 ? Math.round((mETHUsd / totalUsd) * 100) : 0;
    const allocUSDY = totalUsd > 0 ? Math.round((USDYUsd / totalUsd) * 100) : 0;
    const allocUSDC = totalUsd > 0 ? Math.round((USDCUsd / totalUsd) * 100) : 0;

    let allocMUSD = totalUsd > 0 ? 100 - allocMETH - allocUSDY - allocUSDC : 0;

    if (allocMUSD < 0) {
      allocMUSD = 0;
    }

    const percentages = {
      mETH: allocMETH,
      USDY: allocUSDY,
      USDC: allocUSDC,
      mUSD: allocMUSD,
    };
    window.sentraCurrentAllocation = percentages;

    updateDashboardDonut(
      percentages,
      {
        mETH: mETHUsd,
        USDY: USDYUsd,
        USDC: USDCUsd,
        mUSD: mUSDUsd,
      }
    );

    updateLiveDashboardStats(totalUsd, percentages);

    const dashboardBalanceEl = document.querySelector(".portfolio-card h3");
    if (dashboardBalanceEl) {
      dashboardBalanceEl.textContent = formatUsd(totalUsd);
    }

    const homeBalanceEl = document.getElementById("homeVaultBalance");
    if (homeBalanceEl) {
      homeBalanceEl.textContent = formatUsd(totalUsd);
    }

    const homeProjectedApyEl = document.getElementById("homeProjectedApy");
    if (homeProjectedApyEl) {
      const projectedApy =
        allocMETH * 0.048 +
        allocUSDY * 0.052 +
        allocUSDC * 0.031 +
        allocMUSD * 0.044;

      homeProjectedApyEl.textContent = `${projectedApy.toFixed(2)}%`;
    }

    const homeRiskScoreEl = document.getElementById("homeRiskScore");
    if (homeRiskScoreEl) {
      let risk = "Low";

      if (allocMETH >= 55) {
        risk = "High";
      } else if (allocMETH >= 35) {
        risk = "Medium";
      }

      homeRiskScoreEl.textContent = risk;
    }

    document.querySelectorAll(".bar-meth").forEach((bar) => {
      bar.style.width = `${allocMETH}%`;
    });

    document.querySelectorAll(".bar-usdy").forEach((bar) => {
      bar.style.width = `${allocUSDY}%`;
    });

    document.querySelectorAll(".bar-usdc").forEach((bar) => {
      bar.style.width = `${allocUSDC}%`;
    });

    document.querySelectorAll(".bar-musd").forEach((bar) => {
      bar.style.width = `${allocMUSD}%`;
    });

    const homeLabels = document.getElementById("homeAllocationLabels");
    if (homeLabels) {
      homeLabels.innerHTML = `
        <span><i class="dot meth"></i>${allocMETH}% mETH</span>
        <span><i class="dot usdy"></i>${allocUSDY}% USDY</span>
        <span><i class="dot usdc"></i>${allocUSDC}% USDC</span>
        <span><i class="dot musd"></i>${allocMUSD}% mUSD</span>
      `;
    }

    const assetValues = document.querySelectorAll(".asset-value");

    if (assetValues[0]) {
      assetValues[0].innerHTML = `
        <strong>${allocMETH}%</strong>
        <span>${formatUsd(mETHUsd)}</span>
      `;
    }

    if (assetValues[1]) {
      assetValues[1].innerHTML = `
        <strong>${allocUSDY}%</strong>
        <span>${formatUsd(USDYUsd)}</span>
      `;
    }

    if (assetValues[2]) {
      assetValues[2].innerHTML = `
        <strong>${allocUSDC}%</strong>
        <span>${formatUsd(USDCUsd)}</span>
      `;
    }

    if (assetValues[3]) {
      assetValues[3].innerHTML = `
        <strong>${allocMUSD}%</strong>
        <span>${formatUsd(mUSDUsd)}</span>
      `;
    }

    console.log("Home + dashboard loaded with price data ✅");
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
  }
}
//AI CHECK
function markAgentMonitoringDeposit(amount, assetName) {
  const agentLastAction = document.getElementById("agentLastAction");
  const agentLastActionTime = document.getElementById("agentLastActionTime");
  const agentStatusText = document.getElementById("agentStatusText");

  if (agentStatusText) {
    agentStatusText.textContent = "Agent is Active";
  }

  if (agentLastAction) {
    agentLastAction.textContent = `Monitoring deposit of ${amount} ${assetName}`;
  }

  if (agentLastActionTime) {
    agentLastActionTime.textContent = "Just now";
  }

  if (typeof addFeedActivity === "function") {
    addFeedActivity(
      "monitoring",
      `${amount} ${assetName} deposited`,
      `Sentra AI is monitoring the new ${amount} ${assetName} deposit and recalculating allocation, APY, and risk exposure.`
    );
  }
}
// ── Deposit ──
async function handleDeposit() {
  if (!requireWalletConnection("deposit")) return;
  const wallet = await getWalletForTransaction();
  if (!wallet) return;

  const signer = wallet.signer;
  const amountInput = document.querySelector(".vault-form input[type='number']");
  const assetSelect = document.querySelector(".vault-form select");
  if (!amountInput || !assetSelect) return;

  const confirmBtn = document.getElementById("confirmVaultAction");
  const amount = amountInput.value.trim();
  const assetName = assetSelect.value;
  const assetAddress = ASSET_MAP[assetName];

  if (!amount || parseFloat(amount) <= 0) {
   showToast("warning", "Invalid amount", "Enter a valid amount before depositing.");
    return;
  }

  try {
    await loadEthers();
    const contracts = getContracts(signer);
    const amountWei = ethers.parseUnits(amount, 18);

    confirmBtn.textContent = "Approving...";
    confirmBtn.disabled = true;

    const tokenContract = contracts[assetName];
    const approveTx = await tokenContract.approve(CONTRACT_ADDRESSES.vault, amountWei);
    await approveTx.wait();

    confirmBtn.textContent = "Depositing...";
    const depositTx = await contracts.vault.deposit(assetAddress, amountWei);
    await depositTx.wait();

    confirmBtn.textContent = "Deposit Successful ✅";
    showToast("success", "Deposit successful", `${amount} ${assetName} was deposited into your vault.`);
    amountInput.value = "";
    await loadDashboardData(connectedWalletAddress);
    updateVaultSelectedBalance?.();
 setTimeout(() => {
  window.dispatchEvent(new CustomEvent("sentra:vault-updated"));
}, 100);

if (typeof addFeedActivity === "function") {
  addFeedActivity(
    "rebalance",
    `${assetName} deposited into vault`,
    `${amount} ${assetName} was added to the vault. Sentra AI refreshed allocation, APY, and risk score from the updated portfolio.`
  );
}


    setTimeout(() => {
      confirmBtn.textContent = "Confirm Deposit";
      confirmBtn.disabled = false;
    }, 3000);
  } catch (err) {
    console.error("Deposit failed:", err);
    showToast(
  "error",
  "Deposit failed",
  err?.shortMessage || err?.message || "Wallet is disconnected. Please reconnect your wallet."
);
    confirmBtn.textContent = "Deposit Failed ❌";
    confirmBtn.disabled = false;
    setTimeout(() => {
      confirmBtn.textContent = "Confirm Deposit";
    }, 3000);
  }
}

// ── Withdraw ──
async function handleWithdraw() {
  if (!requireWalletConnection("withdraw")) return;
  const wallet = await getWalletForTransaction();
  if (!wallet) return;

  const signer = wallet.signer;
  const amountInput = document.querySelector(".vault-form input[type='number']");
  const assetSelect = document.querySelector(".vault-form select");
  if (!amountInput || !assetSelect) return;

  const confirmBtn = document.getElementById("confirmVaultAction");
  const amount = amountInput.value.trim();
  const assetName = assetSelect.value;
  const assetAddress = ASSET_MAP[assetName];

  if (!amount || parseFloat(amount) <= 0) {
    showToast("warning", "Invalid amount", "Enter a valid amount before withdrawing.");
    return;
  }

  try {
    await loadEthers();
    const contracts = getContracts(signer);
    const amountWei = ethers.parseUnits(amount, 18);

    confirmBtn.textContent = "Withdrawing...";
    confirmBtn.disabled = true;

    const withdrawTx = await contracts.vault.withdraw(assetAddress, amountWei);
    await withdrawTx.wait();

    confirmBtn.textContent = "Withdrawal Successful ✅";
    showToast("success", "Withdrawal successful", `${amount} ${assetName} was withdrawn from your vault.`);
    amountInput.value = "";
    await loadDashboardData(connectedWalletAddress);
    updateVaultSelectedBalance?.();
    
setTimeout(() => {
  window.dispatchEvent(new CustomEvent("sentra:vault-updated"));
}, 100);
    if (typeof addFeedActivity === "function") {
  addFeedActivity(
    "risk",
    `${assetName} withdrawn from vault`,
    `${amount} ${assetName} was withdrawn. Sentra AI recalculated the remaining vault exposure and updated the portfolio risk profile.`
  );
}

    setTimeout(() => {
      confirmBtn.textContent = "Confirm Withdraw";
      confirmBtn.disabled = false;
    }, 3000);
  } catch (err) {
    console.error("Withdraw failed:", err);
   showToast(
  "error",
  "Withdrawal failed",
  err?.shortMessage || err?.message || "Wallet is disconnected. Please reconnect your wallet."
);
    confirmBtn.textContent = "Withdrawal Failed ❌";
    confirmBtn.disabled = false;
    setTimeout(() => {
      confirmBtn.textContent = "Confirm Withdraw";
    }, 3000);
  }
}
// ── Listen for real-time vault events ──
async function startEventListener(userAddress) {
  try {
    await loadEthers();
    const provider = new ethers.BrowserProvider(selectedWalletProvider);
    const { vault } = getContracts(provider);

    // Listen for Deposit events
    vault.on("Deposit", (user, asset, amount, timestamp) => {
      if (user.toLowerCase() === userAddress.toLowerCase()) {
        console.log("Deposit detected on-chain ✅");
        loadDashboardData(userAddress);
      }
    });

    // Listen for Withdrawal events
    vault.on("Withdrawal", (user, asset, amount, timestamp) => {
      if (user.toLowerCase() === userAddress.toLowerCase()) {
        console.log("Withdrawal detected on-chain ✅");
        loadDashboardData(userAddress);
      }
    });

    console.log("Event listener started ✅");
  } catch (err) {
    console.error("Event listener failed:", err);
  }
}

// Balance Check
async function updateVaultSelectedBalance() {
  const assetSelect = document.getElementById("vaultAssetSelect");
  const balanceLabel = document.getElementById("vaultBalanceLabel");
  const balanceValue = document.getElementById("vaultSelectedBalance");
  const activeTab = document.querySelector(".action-tab.active");

  if (!assetSelect || !balanceLabel || !balanceValue) return;

  const assetName = assetSelect.value;
  const mode = activeTab?.dataset.actionTab || "deposit";

  if (!connectedWalletAddress) {
    balanceLabel.textContent = mode === "deposit" ? "Wallet balance" : "Vault balance";
    balanceValue.textContent = "--";
    return;
  }

 try {
    const tokenAddress = ASSET_MAP[assetName];
    console.log("Token address:", tokenAddress);
    console.log("Mode:", mode);
    console.log("Wallet:", connectedWalletAddress);
    if (mode === "deposit") {
      balanceLabel.textContent = "Wallet balance";

     await loadEthers();
    const provider = selectedWalletProvider
      ? new ethers.BrowserProvider(selectedWalletProvider)
      : new ethers.JsonRpcProvider(READ_RPC_URL);

const tokenContract = new ethers.Contract(
  tokenAddress,
  [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ],
  provider
);

      const [rawBalance, decimals] = await Promise.all([
        tokenContract.balanceOf(connectedWalletAddress),
        tokenContract.decimals(),
      ]);

      const formatted = Number(ethers.formatUnits(rawBalance, decimals)).toLocaleString(undefined, {
        maximumFractionDigits: 4,
      });

      balanceValue.textContent = `${formatted} ${assetName}`;
    } else {
      balanceLabel.textContent = "Vault balance";

        const readProvider = selectedWalletProvider
    ? new ethers.BrowserProvider(selectedWalletProvider)
    : new ethers.JsonRpcProvider(READ_RPC_URL);

  const vaultContract = new ethers.Contract(
    CONTRACT_ADDRESSES.vault,
    ["function userBalances(address,address) view returns (uint256)"],
    readProvider
  );

      const rawBalance = await vaultContract.userBalances(connectedWalletAddress, tokenAddress);

      const rawFormatted = parseFloat(ethers.formatUnits(rawBalance, 18));
const display = rawFormatted >= 1_000_000
  ? `${(rawFormatted / 1_000_000).toFixed(2)}m`
  : rawFormatted >= 1_000
  ? `${(rawFormatted / 1_000).toFixed(2)}k`
  : rawFormatted.toLocaleString(undefined, { maximumFractionDigits: 4 });

balanceValue.textContent = `${display} ${assetName}`;
    }
  } catch (error) {
    console.error("Balance update failed:", error);
    balanceValue.textContent = "--";
  }
}
document.getElementById("vaultAssetSelect")?.addEventListener("change", updateVaultSelectedBalance);

document.querySelectorAll(".action-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setTimeout(updateVaultSelectedBalance, 50);
  });
});

// Mobile menu
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");

if (menuBtn && menuPanel) {
  menuBtn.addEventListener("click", () => {
    menuPanel.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!menuBtn.contains(e.target) && !menuPanel.contains(e.target)) {
      menuPanel.classList.remove("open");
    }
  });
}

// Single-page navigation
const appPages = document.querySelectorAll("[data-page]");
const pageLinks = document.querySelectorAll("[data-page-link]");

function showPage(pageName) {
  const targetPage = document.querySelector(`[data-page="${pageName}"]`);
  if (!targetPage) pageName = "home";

  appPages.forEach((page) => {
    page.classList.toggle("active", page.dataset.page === pageName);
  });

  pageLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.pageLink === pageName);
  });

  if (menuPanel) {
    menuPanel.classList.remove("open");
  }
  const pageTitles = {
  home: "Sentra AI — Overview",
  dashboard: "Sentra AI — Vault Dashboard",
  feed: "Sentra AI — AI Decision Feed",
  performance: "Sentra AI — Yield Performance",
  settings: "Sentra AI — Risk Profile",
  mint: "Sentra AI — Test Faucet",
};

document.title = pageTitles[pageName] || "Sentra AI";
  if (window.location.hash !== `${pageName}`) {
    window.history.pushState(null, "", `${pageName}`);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

pageLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showPage(link.dataset.pageLink);
  });
});

window.addEventListener("popstate", () => {
  showPage(window.location.hash.replace("#", "") || "home");
});

showPage(window.location.hash.replace("#", "") || "home");

// Agent toggle
const agentToggleBtn = document.getElementById("agentToggleBtn");

// Deposit / Withdraw tabs
const actionTabs = document.querySelectorAll("[data-action-tab]");
const confirmBtn = document.getElementById("confirmVaultAction");

confirmBtn?.addEventListener("click", () => {
  const activeTab = document.querySelector("[data-action-tab].active");
  if (activeTab?.dataset.actionTab === "deposit") {
    handleDeposit();
  } else {
    handleWithdraw();
  }
});


actionTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    actionTabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    if (confirmBtn) {
      confirmBtn.textContent =
        tab.dataset.actionTab === "withdraw" ? "Confirm Withdraw" : "Confirm Deposit";
    }
  });
});
const timeframeButtons = document.querySelectorAll(".timeframe-tabs button");

timeframeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    timeframeButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

const riskCards = document.querySelectorAll(".risk-card");

const riskData = {
  conservative: {
    title: "Conservative Profile",
    apy: "4–8%",
    drawdown: "Low",
    speed: "Fast defensive exits",
    oneLabel: "USDY / mUSD",
    oneValue: "70%",
    twoLabel: "mETH",
    twoValue: "25%",
    threeLabel: "Reserve liquidity",
    threeValue: "5%",
    simReturn: "+6.8%",
    simDrawdown: "-1.4%",
    simVolatility: "Low",
    simBest: "+1.8%",
    simWorst: "-0.6%",
    simBenchmark: "+2.1%",
    summary:
      "Your profile prioritizes capital preservation and stable treasury yield. Sentra AI will keep higher USDY/mUSD exposure, exit risky pools quickly, and avoid volatile APY spikes."
  },
  balanced: {
    title: "Balanced Profile",
    apy: "10–18%",
    drawdown: "Medium",
    speed: "Moderate",
    oneLabel: "mETH",
    oneValue: "50%",
    twoLabel: "USDY / mUSD",
    twoValue: "40%",
    threeLabel: "Active opportunities",
    threeValue: "10%",
    simReturn: "+14.2%",
    simDrawdown: "-4.8%",
    simVolatility: "Medium",
    simBest: "+3.6%",
    simWorst: "-1.9%",
    simBenchmark: "+5.4%",
    summary:
      "Your profile prioritizes moderate growth with controlled downside exposure. Sentra AI will dynamically allocate between mETH and USDY/mUSD strategies while avoiding high-volatility pools."
  },
  aggressive: {
    title: "Aggressive Profile",
    apy: "18–35%",
    drawdown: "High",
    speed: "Fast strategy rotation",
    oneLabel: "mETH",
    oneValue: "80%",
    twoLabel: "High-yield strategies",
    twoValue: "20%",
    threeLabel: "Reserve liquidity",
    threeValue: "0%",
    simReturn: "+28.6%",
    simDrawdown: "-12.4%",
    simVolatility: "High",
    simBest: "+8.9%",
    simWorst: "-6.7%",
    simBenchmark: "+11.8%",
    summary:
      "Your profile targets maximum yield and accepts higher volatility. Sentra AI will rotate faster into high-APY opportunities and tolerate larger temporary drawdowns."
  }
};

riskCards.forEach((card) => {
  card.addEventListener("click", () => {
    riskCards.forEach((item) => item.classList.remove("active"));
    card.classList.add("active");

    const data = riskData[card.dataset.risk];

    document.getElementById("profileTitle").textContent = data.title;
    document.getElementById("apyRange").textContent = data.apy;
    document.getElementById("drawdown").textContent = data.drawdown;
    document.getElementById("reactionSpeed").textContent = data.speed;

    document.getElementById("allocationOneLabel").textContent = data.oneLabel;
    document.getElementById("allocationOneValue").textContent = data.oneValue;
    document.getElementById("allocationOneBar").style.width = data.oneValue;

    document.getElementById("allocationTwoLabel").textContent = data.twoLabel;
    document.getElementById("allocationTwoValue").textContent = data.twoValue;
    document.getElementById("allocationTwoBar").style.width = data.twoValue;

    document.getElementById("allocationThreeLabel").textContent = data.threeLabel;
    document.getElementById("allocationThreeValue").textContent = data.threeValue;
    document.getElementById("allocationThreeBar").style.width = data.threeValue;

    document.getElementById("simReturn").textContent = data.simReturn;
    document.getElementById("simDrawdown").textContent = data.simDrawdown;
    document.getElementById("simVolatility").textContent = data.simVolatility;
    document.getElementById("simBest").textContent = data.simBest;
    document.getElementById("simWorst").textContent = data.simWorst;
    document.getElementById("simBenchmark").textContent = data.simBenchmark;
    document.getElementById("aiSummary").textContent = data.summary;
  });
});

window.addEventListener("load", () => {
  restoreWalletSession();
});

// Mint Test Tokens Logic
const MINT_TOKEN_ABI = [
  "function mint(address to, uint256 amount) external",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)"
];

function setMintMessage(message) {
  const mintSummary = document.getElementById("mintSummary");
  if (mintSummary) mintSummary.textContent = message;
}

function updateMintWalletLabel() {
  const mintWalletAddress = document.getElementById("mintWalletAddress");

  if (!mintWalletAddress) return;

  if (connectedWalletAddress) {
    mintWalletAddress.textContent = `${connectedWalletAddress.slice(0, 6)}...${connectedWalletAddress.slice(-4)}`;
  } else {
    mintWalletAddress.textContent = "Not connected";
  }
}

async function getActiveMintSigner() {
  if (!connectedWalletAddress) {
    throw new Error("Connect your wallet first.");
  }

  const activeProvider = selectedWalletProvider || window.ethereum;

  if (!activeProvider) {
    throw new Error("No wallet provider found.");
  }

  const accounts = await activeProvider.request({
    method: "eth_accounts"
  });

  const isStillConnected = accounts.some(
    (account) => account.toLowerCase() === connectedWalletAddress.toLowerCase()
  );

  if (!isStillConnected) {
    throw new Error("Wallet is disconnected. Connect your wallet again.");
  }

  await ensureMantleSepolia(activeProvider);

  const browserProvider = new ethers.BrowserProvider(activeProvider);
  return browserProvider.getSigner(connectedWalletAddress);
}

async function handleMintTokens() {
  if (!requireWalletConnection("mint tokens")) return;
  const tokenSelect = document.getElementById("mintTokenSelect");
  const mintBtn = document.getElementById("mintTokenBtn");

  if (!tokenSelect || !mintBtn) return;

  const tokenSymbol = tokenSelect.value;
  const tokenAddress = CONTRACT_ADDRESSES[tokenSymbol];

  if (!tokenAddress) {
    setMintMessage("This token is not supported.");
    return;
  }

  let signer;

  try {
    signer = await getActiveMintSigner();
  } catch (error) {
    setMintMessage(error.message || "Connect your wallet first.");
    return;
  }

  const originalText = mintBtn.textContent;
  const mintExplorerBtn = document.getElementById("mintExplorerBtn");

  if (mintExplorerBtn) {
    mintExplorerBtn.hidden = true;
    mintExplorerBtn.href = "#";
  }

  try {
    mintBtn.disabled = true;
    mintBtn.textContent = "Minting...";

    const tokenContract = new ethers.Contract(tokenAddress, MINT_TOKEN_ABI, signer);
    const decimals = await tokenContract.decimals().catch(() => 18);

    // Hardcoded 10,000 tokens
    const mintAmount = BigInt("10000");

    const tx = await tokenContract.mint(connectedWalletAddress, mintAmount);

    mintBtn.textContent = "Confirming...";
    const receipt = await tx.wait();

    if (mintExplorerBtn) {
      mintExplorerBtn.href = `https://explorer.sepolia.mantle.xyz/tx/${receipt.hash}`;
      mintExplorerBtn.hidden = false;
      clearTimeout(window.mintExplorerTimeout);
      window.mintExplorerTimeout = setTimeout(() => {
        mintExplorerBtn.hidden = true;
        mintExplorerBtn.removeAttribute("href");
      }, 15000);
    }

    setMintMessage(`10,000 ${tokenSymbol} minted successfully to your wallet.`);
    showToast("success", "Mint successful", `10,000 ${tokenSymbol} was minted to your wallet.`);

    if (typeof addFeedActivity === "function") {
      addFeedActivity(
        "monitoring",
        `${tokenSymbol} test tokens minted`,
        `10,000 ${tokenSymbol} was minted to the connected wallet for Mantle Sepolia testing.`
      );
    }

    if (typeof updateVaultSelectedBalance === "function") {
      updateVaultSelectedBalance();
    }

    if (typeof loadDashboardData === "function") {
      await loadDashboardData(connectedWalletAddress);
    }

  } catch (error) {
    console.error("Mint failed:", error);
    setMintMessage(error?.shortMessage || error?.message || "Mint failed. Check your token contract.");
    showToast(
  "error",
  "Mint failed",
  error?.shortMessage || error?.message || "Mint failed. Check your token contract."
);
  } finally {
    mintBtn.disabled = false;
    mintBtn.textContent = originalText;
    updateMintWalletLabel();
  }
}

document.querySelectorAll("[data-token]").forEach((card) => {
  card.addEventListener("click", () => {
    const selectedToken = card.dataset.token;
    const tokenSelect = document.getElementById("mintTokenSelect");

    document.querySelectorAll("[data-token]").forEach((item) => {
      item.classList.remove("active");
    });

    card.classList.add("active");

    if (tokenSelect && selectedToken) {
      tokenSelect.value = selectedToken;
    }
  });
});

document.getElementById("mintTokenSelect")?.addEventListener("change", (event) => {
  const selectedToken = event.target.value;

  document.querySelectorAll("[data-token]").forEach((card) => {
    card.classList.toggle("active", card.dataset.token === selectedToken);
  });
});

document.getElementById("mintTokenBtn")?.addEventListener("click", handleMintTokens);

window.addEventListener("load", updateMintWalletLabel);

// AI Decision Feed live activity
function addFeedActivity(type, title, message) {
  function getFeedStorageKey() {
  const wallet =
    connectedWalletAddress ||
    localStorage.getItem(STORAGE_KEY) ||
    "guest";

  return `sentra_feed_${wallet.toLowerCase()}`;
}

function saveFeedActivities() {
  const feedList = document.getElementById("feedList");
  if (!feedList) return;

  localStorage.setItem(getFeedStorageKey(), feedList.innerHTML);
}

function syncDashboardMiniFeed() {
  const feedList = document.getElementById("feedList");
  const dashboardList = document.getElementById("dashboardActivityList");

  if (!feedList || !dashboardList) return;

  const entries = Array.from(feedList.querySelectorAll(".feed-entry")).slice(0, 3);

  dashboardList.innerHTML = "";

  entries.forEach((entry) => {
    const dot = entry.querySelector(".feed-dot");
    const title = entry.querySelector(".feed-entry-top strong");
    const message = entry.querySelector(".feed-entry-body p");

    const dotClass = dot ? dot.className : "feed-dot yellow";

    const dashboardEntry = document.createElement("div");
    dashboardEntry.className = "feed-item";
    dashboardEntry.innerHTML = `
      <span class="${dotClass}"></span>
      <div>
        <strong>${title?.textContent || "AI activity"}</strong>
        <p>${message?.textContent || "Sentra AI updated vault activity."}</p>
      </div>
    `;

    dashboardList.appendChild(dashboardEntry);
  });
}

function loadFeedActivities() {
  const feedList = document.getElementById("feedList");
  const feedEmpty = document.getElementById("feedEmpty");

  if (!feedList) return;

  const savedFeed = localStorage.getItem(getFeedStorageKey());

  if (savedFeed) {
    feedList.innerHTML = savedFeed;

    if (feedEmpty) {
      feedEmpty.style.display = "none";
    }

    updateFeedStats();
    applyFeedFilter(activeFeedFilter || "all");
    syncDashboardMiniFeed();
  }
}
  const feedList = document.getElementById("feedList");
  const feedEmpty = document.getElementById("feedEmpty");

  if (!feedList) return;

  const config = {
    rebalance: {
      dot: "green",
      tag: "green",
      label: "Rebalance",
    },
    risk: {
      dot: "red",
      tag: "red",
      label: "Risk Alert",
    },
    monitoring: {
      dot: "yellow",
      tag: "yellow",
      label: "Monitoring",
    },
    yield: {
      dot: "green",
      tag: "green",
      label: "Yield Update",
    },
  };

  const feedType = config[type] ? type : "monitoring";
  const item = config[feedType];

  const now = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const entry = document.createElement("div");
  entry.className = "feed-entry";
  entry.dataset.type = feedType;

  entry.innerHTML = `
    <div class="feed-entry-left">
      <span class="feed-dot ${item.dot}"></span>
    </div>

    <div class="feed-entry-body">
      <div class="feed-entry-top">
        <strong>${title}</strong>
        <span class="feed-tag ${item.tag}">${item.label}</span>
      </div>
      <p>${message}</p>
      <small>Today, ${now}</small>
    </div>
  `;

  feedList.prepend(entry);
addDashboardActivity(item.dot, title, message);

  if (feedEmpty) {
    feedEmpty.style.display = "none";
  }

  const entries = feedList.querySelectorAll(".feed-entry");

  if (entries.length > 10) {
    entries[entries.length - 1].remove();
  }

  updateFeedStats();
saveFeedActivities();
syncDashboardMiniFeed();

saveFeedToStorage(connectedWalletAddress);
}
// ── Per-wallet dashboard activity storage ──
function getDashboardActivityKey(address) {
  return `sentra_activity_${address.toLowerCase()}`;
}

function saveDashboardActivity(address) {
  if (!address) return;
  const dashboardList = document.getElementById("dashboardActivityList");
  if (!dashboardList) return;

  const entries = Array.from(dashboardList.querySelectorAll(".feed-item")).map((entry) => ({
    dot: entry.querySelector(".feed-dot")?.className.replace("feed-dot ", "") || "green",
    title: entry.querySelector("strong")?.textContent || "",
    message: entry.querySelector("p")?.textContent || "",
  }));

  localStorage.setItem(getDashboardActivityKey(address), JSON.stringify(entries));
}

function loadDashboardActivity(address) {
  if (!address) return;
  const dashboardList = document.getElementById("dashboardActivityList");
  if (!dashboardList) return;

  dashboardList.innerHTML = "";

  const stored = localStorage.getItem(getDashboardActivityKey(address));
  if (!stored) return;

  const entries = JSON.parse(stored);
  if (!entries.length) return;

  entries.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "feed-item";
    entry.innerHTML = `
      <span class="feed-dot ${item.dot}"></span>
      <div>
        <strong>${item.title}</strong>
        <p>${item.message}</p>
      </div>
    `;
    dashboardList.appendChild(entry);
  });
}

function clearDashboardActivity() {
  const dashboardList = document.getElementById("dashboardActivityList");
  if (dashboardList) dashboardList.innerHTML = "";
}
// Mini Feed
function addDashboardActivity(dotColor, title, message) {
  const dashboardList = document.getElementById("dashboardActivityList");
  if (!dashboardList) return;

  const dashboardEntry = document.createElement("div");
  dashboardEntry.className = "feed-item";
  dashboardEntry.innerHTML = `
    <span class="feed-dot ${dotColor}"></span>
    <div>
      <strong>${title}</strong>
      <p>${message}</p>
    </div>
  `;

  dashboardList.prepend(dashboardEntry);

  const dashboardEntries = dashboardList.querySelectorAll(".feed-item");
  if (dashboardEntries.length > 3) {
    dashboardEntries[dashboardEntries.length - 1].remove();
  }
}

function updateFeedStats() {
  const feedEntries = document.querySelectorAll("#feedList .feed-entry");
  const feedStats = document.querySelectorAll(".feed-stat strong");

  if (!feedStats.length) return;

  const totalActions = feedEntries.length;
  const rebalanceCount = document.querySelectorAll('#feedList .feed-entry[data-type="rebalance"]').length;

  if (feedStats[0]) feedStats[0].textContent = totalActions;
  if (feedStats[1]) feedStats[1].textContent = rebalanceCount > 0 ? "Just now" : "No rebalance";
  if (feedStats[2]) feedStats[2].textContent = totalActions;
}

updateFeedStats();
saveDashboardActivity(connectedWalletAddress);

// feed filter
const feedFilterButtons = document.querySelectorAll(".feed-filter");
const feedList = document.getElementById("feedList");
let activeFeedFilter = "all";

function applyFeedFilter(filter) {
  activeFeedFilter = filter;

  if (!feedList) return;

  const entries = feedList.querySelectorAll(".feed-entry");
  entries.forEach((entry) => {
    const type = entry.dataset.type || "all";
    const show = filter === "all" || type === filter;
    entry.style.display = show ? "" : "none";
  });
}

feedFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    feedFilterButtons.forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    applyFeedFilter(button.dataset.filter || "all");
  });
});

window.addEventListener("load", () => {
  const activeButton = document.querySelector(".feed-filter.active");
  applyFeedFilter(activeButton?.dataset.filter || "all");
});


// AI Agent Logic
// AI Agent Logic
(() => {
  const targetAllocation = {
    mETH: 38,
    USDY: 26,
    USDC: 20,
    mUSD: 16,
  };

  let isAgentActive = true;
  let countdownSeconds = 300;
  let timer = null;

  const toggleBtn = document.getElementById("agentToggleBtn");

  function formatCountdown(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${String(secs).padStart(2, "0")}`;
  }

  function readPercent(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    return Number(el.textContent.replace("%", "").trim()) || 0;
  }

function getCurrentAllocation() {
  return window.sentraCurrentAllocation || { mETH: 0, USDY: 0, USDC: 0, mUSD: 0 };
}

  function getLargestGap(current) {
    let selectedAsset = "mETH";
    let selectedGap = current.mETH - targetAllocation.mETH;

    Object.keys(targetAllocation).forEach((asset) => {
      const gap = current[asset] - targetAllocation[asset];

      if (Math.abs(gap) > Math.abs(selectedGap)) {
        selectedAsset = asset;
        selectedGap = gap;
      }
    });

    return {
      asset: selectedAsset,
      gap: selectedGap,
    };
  }

  function buildDecision() {
    const current = getCurrentAllocation();

    const total =
      current.mETH + current.USDY + current.USDC + current.mUSD;

    if (total === 0) {
      return {
        status: "Agent is Active",
        action: "Waiting for vault activity",
        message:
          "No deposited vault balance detected yet. Sentra AI will scan once assets are deposited.",
        type: "monitoring",
      };
    }

    const { asset, gap } = getLargestGap(current);
    const absoluteGap = Math.abs(gap);

    if (absoluteGap < 4) {
      return {
        status: "Agent is Active",
        action: "Hold current allocation",
        message:
          "Vault allocation is close to the target range. No rebalance needed.",
        type: "monitoring",
      };
    }

    if (gap > 0) {
      return {
        status: "Rebalance Suggested",
        action: `Reduce ${asset} exposure by ${absoluteGap.toFixed(1)}%`,
        message: `${asset} is above the target allocation. Sentra AI recommends reducing exposure to keep the vault balanced.`,
        type: "risk",
      };
    }

    return {
      status: "Opportunity Found",
      action: `Increase ${asset} allocation by ${absoluteGap.toFixed(1)}%`,
      message: `${asset} is below the target allocation. Sentra AI sees room to increase exposure.`,
      type: "rebalance",
    };
  }

  function updateAgentCard(decision) {
    const statusEl = document.getElementById("agentStatusText");
    const actionEl = document.getElementById("agentLastAction");
    const timeEl = document.getElementById("agentLastActionTime");

    if (statusEl) statusEl.textContent = decision.status;
    if (actionEl) actionEl.textContent = decision.action;

    if (timeEl) {
      const now = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      timeEl.textContent = `${now} • ${decision.message}`;
    }
  }

  function updateCountdownUI() {
    const agentNextCheckEl = document.getElementById("agentNextCheck");
    const dashboardNextCheckEl = document.getElementById("nextCheckValue");

    const text = isAgentActive
      ? `In ${formatCountdown(countdownSeconds)}`
      : "Paused";

    if (agentNextCheckEl) agentNextCheckEl.textContent = text;
    if (dashboardNextCheckEl) dashboardNextCheckEl.textContent = text;
  }

  function runAgentScan() {
    if (!isAgentActive) return;

    const decision = buildDecision();

    updateAgentCard(decision);

    if (typeof addFeedActivity === "function") {
      addFeedActivity(
        decision.type,
        "AI agent scan",
        decision.message
      );
    }

    countdownSeconds = 300;
    updateCountdownUI();
  }

  window.runSentraAgentScan = runAgentScan;

  window.addEventListener("sentra:vault-updated", () => {
    setTimeout(() => {
      runAgentScan();
    }, 150);
  });

  function startAgentTimer() {
    if (timer) clearInterval(timer);

    updateCountdownUI();

    timer = setInterval(() => {
      if (!isAgentActive) {
        updateCountdownUI();
        return;
      }

      countdownSeconds -= 1;

      if (countdownSeconds <= 0) {
        runAgentScan();
        return;
      }

      updateCountdownUI();
    }, 1000);
  }

  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isAgentActive = !isAgentActive;

      toggleBtn.textContent = isAgentActive
        ? "Pause Agent"
        : "Resume Agent";

      toggleBtn.classList.toggle("paused", !isAgentActive);

      const statusEl = document.getElementById("agentStatusText");

      if (statusEl) {
        statusEl.textContent = isAgentActive
          ? "Agent is Active"
          : "Agent is Paused";
      }

      updateCountdownUI();
    });
  }

  runAgentScan();
  startAgentTimer();
})();
// ── Performance Page Logic ──

// Chart data per timeframe
const chartData = {
  "7D": {
    sentra:  "60,275 130,260 200,240 270,250 340,220 410,195 480,175 550,155 620,135 700,110 780,90 860,72",
    meth:    "60,275 130,255 200,225 270,260 340,230 410,205 480,185 550,170 620,150 700,135 780,125 860,115",
    usdy:    "60,275 130,272 200,268 270,264 340,260 410,256 480,252 550,248 620,244 700,238 780,232 860,222",
    musd:    "60,275 130,273 200,269 270,266 340,262 410,258 480,254 550,250 620,246 700,241 780,236 860,233",
    usdc:    "60,275 130,274 200,273 270,273 340,272 410,272 480,271 550,271 620,270 700,270 780,269 860,268",
    tooltip: { apy: "18.42%", ret: "+3.2%", vol: "Medium", dd: "-1.1%"}
  },
  "30D": {
    sentra:  "60,275 180,250 300,210 420,230 540,165 660,130 780,95 860,72",
    meth:    "60,275 180,235 300,185 420,245 540,170 660,150 780,130 860,115",
    usdy:    "60,275 180,268 300,260 420,252 540,245 660,238 780,230 860,222",
    musd:    "60,275 180,270 300,263 420,258 540,251 660,246 780,239 860,233",
    usdc:    "60,275 180,274 300,273 420,272 540,271 660,270 780,269 860,268",
    tooltip: { apy: "18.42%", ret: "+12.4%", vol: "Medium", dd: "-4.2%"}
  },
  "90D": {
    sentra:  "60,290 180,270 300,240 420,255 540,200 660,155 780,110 860,72",
    meth:    "60,290 180,260 300,210 420,265 540,195 660,165 780,140 860,115",
    usdy:    "60,290 180,280 300,272 420,265 540,258 660,250 780,240 860,222",
    musd:    "60,290 180,282 300,275 420,268 540,262 660,255 780,245 860,233",
    usdc:    "60,290 180,285 300,284 420,282 540,280 660,278 780,274 860,268",
    tooltip: { apy: "18.42%", ret: "+28.6%", vol: "Medium", dd: "-6.8%"}
  },
  "1Y": {
    sentra:  "60,295 180,280 300,255 420,265 540,210 660,160 780,105 860,60",
    meth:    "60,295 180,270 300,225 420,275 540,205 660,170 780,145 860,110",
    usdy:    "60,295 180,285 300,278 420,272 540,265 660,258 780,245 860,218",
    musd:    "60,295 180,287 300,281 420,275 540,268 660,261 780,250 860,228",
    usdc:    "60,295 180,290 300,289 420,288 540,286 660,284 780,280 860,272",
    tooltip: { apy: "18.42%", ret: "+42.8%", vol: "Medium", dd: "-9.4%"}
  },
  "ALL": {
    sentra:  "60,295 180,278 300,252 420,262 540,205 660,155 780,100 860,55",
    meth:    "60,295 180,268 300,220 420,272 540,200 660,165 780,140 860,105",
    usdy:    "60,295 180,284 300,276 420,270 540,263 660,256 780,243 860,215",
    musd:    "60,295 180,286 300,279 420,273 540,266 660,259 780,248 860,225",
    usdc:    "60,295 180,289 300,288 420,287 540,285 660,283 780,279 860,270",
    tooltip: { apy: "18.42%", ret: "+58.3%", vol: "Medium", dd: "-12.1%"}
  },
};

function updatePerformanceChart(range) {
  const data = chartData[range];
  if (!data) return;

  // Update chart lines
  const sentraLine = document.querySelector(".sentra-line");
  const methLine = document.querySelector(".meth-line");
  const usdyLine = document.querySelector(".usdy-line");
  const musdLine = document.querySelector(".musd-line");
  const usdcLine = document.querySelector(".usdc-line");

  if (sentraLine) sentraLine.setAttribute("points", data.sentra);
  if (methLine) methLine.setAttribute("points", data.meth);
  if (usdyLine) usdyLine.setAttribute("points", data.usdy);
  if (musdLine) musdLine.setAttribute("points", data.musd);
  if (usdcLine) usdcLine.setAttribute("points", data.usdc);

  // Update tooltip
  const tooltipSpans = document.querySelectorAll(".chart-tooltip span");
  if (tooltipSpans[0]) tooltipSpans[0].textContent = `APY: ${data.tooltip.apy}`;
  if (tooltipSpans[1]) tooltipSpans[1].textContent = `Cumulative return: ${data.tooltip.ret}`;
  if (tooltipSpans[2]) tooltipSpans[2].textContent = `Volatility: ${data.tooltip.vol}`;
  if (tooltipSpans[3]) tooltipSpans[3].textContent = `Max drawdown: ${data.tooltip.dd}`;
}

function updatePerformanceStats() {
  const alloc = window.sentraCurrentAllocation || { mETH: 38, USDY: 26, USDC: 20, mUSD: 16 };

  // Weighted APY
  const apy = (
    alloc.mETH * 0.048 +
    alloc.USDY * 0.052 +
    alloc.USDC * 0.031 +
    alloc.mUSD * 0.044
  ).toFixed(2);

  // Risk score
  let risk = "Low";
  if (alloc.mETH >= 55) risk = "High";
  else if (alloc.mETH >= 35) risk = "Medium";

  // Update stat cards
  const statCards = document.querySelectorAll(".performance-stats .metric-card strong");
  if (statCards[0]) statCards[0].textContent = `${apy}%`;
  if (statCards[2]) statCards[2].textContent = risk;

  // Update current allocation row in stacked bars
  const stackRows = document.querySelectorAll(".stack-row");
  const currentRow = stackRows[stackRows.length - 1];

  if (currentRow) {
    const bars = currentRow.querySelectorAll(".stack-bar i");
    if (bars[0]) bars[0].style.width = `${alloc.mETH}%`;
    if (bars[1]) bars[1].style.width = `${alloc.USDY}%`;
    if (bars[2]) bars[2].style.width = `${alloc.USDC}%`;
    if (bars[3]) bars[3].style.width = `${alloc.mUSD}%`;
  }

  // Update tooltip split
  const tooltipSpans = document.querySelectorAll(".chart-tooltip span");
  if (tooltipSpans[4]) {
    tooltipSpans[4].textContent = `Split: ${alloc.mETH}% mETH / ${alloc.USDY}% USDY / ${alloc.USDC}% USDC / ${alloc.mUSD}% mUSD`;
  }
}

function updateDecisionLog() {
  const decisionList = document.querySelector(".decision-list");
  if (!decisionList) return;

  const feedEntries = document.querySelectorAll("#feedList .feed-entry");
  if (!feedEntries.length) return;

  // Pull last 4 feed entries
  const recent = Array.from(feedEntries).slice(0, 4);

  decisionList.innerHTML = recent.map((entry) => {
    const text = entry.querySelector(".feed-entry-body p")?.textContent || "";
    const dotClass = entry.querySelector(".feed-dot")?.className || "feed-dot green";
    const color = dotClass.includes("red") ? "red" : dotClass.includes("yellow") ? "yellow" : "green";
    return `
      <div>
        <span style="background: var(--${color})"></span>
        <p>${text}</p>
      </div>
    `;
  }).join("");
}

// Timeframe tab switching
const timeframeBtns = document.querySelectorAll(".timeframe-tabs button");

timeframeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    timeframeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    updatePerformanceChart(btn.dataset.range);
  });
});

// Set default active tab
const defaultTab = document.querySelector('.timeframe-tabs button[data-range="30D"]');
if (defaultTab) {
  defaultTab.classList.add("active");
  updatePerformanceChart("30D");
}

// Run on page load and after dashboard updates
function refreshPerformancePage() {
  updatePerformanceStats();
  updateDecisionLog();
}

// Hook into page navigation
const originalShowPage = window.showPage;
window.showPage = function(pageName) {
  if (typeof originalShowPage === "function") originalShowPage(pageName);
  if (pageName === "performance") {
    setTimeout(refreshPerformancePage, 100);
  }
};

// Also run immediately in case performance is the landing page
refreshPerformancePage();

// Settings / Risk Profile Logic
const riskProfiles = {
  conservative: {
    title: "Conservative Profile",
    apy: "6–10%",
    drawdown: "Low",
    speed: "Fast Protection",
    allocations: [
      ["mETH", 20],
      ["USDY / mUSD", 70],
      ["Active opportunities", 10],
    ],
    simReturn: "+7.8%",
    simDrawdown: "-2.1%",
    simVolatility: "Low",
    simBest: "+1.8%",
    simWorst: "-0.7%",
    simBenchmark: "+2.4%",
    summary:
      "Your profile prioritizes capital preservation and stable yield. Sentra AI will favour USDY and mUSD exposure, reduce volatile mETH exposure, and react quickly when market risk increases.",
  },

  balanced: {
    title: "Balanced Profile",
    apy: "10–18%",
    drawdown: "Medium",
    speed: "Moderate",
    allocations: [
      ["mETH", 50],
      ["USDY / mUSD", 40],
      ["Active opportunities", 10],
    ],
    simReturn: "+14.2%",
    simDrawdown: "-4.8%",
    simVolatility: "Medium",
    simBest: "+3.6%",
    simWorst: "-1.9%",
    simBenchmark: "+5.4%",
    summary:
      "Your profile prioritizes moderate growth with controlled downside exposure. Sentra AI will dynamically allocate between mETH and USDY/mUSD strategies while avoiding high-volatility pools.",
  },

  aggressive: {
    title: "Aggressive Profile",
    apy: "18–30%",
    drawdown: "High",
    speed: "Rapid Rotation",
    allocations: [
      ["mETH", 70],
      ["USDY / mUSD", 15],
      ["Active opportunities", 15],
    ],
    simReturn: "+24.6%",
    simDrawdown: "-9.4%",
    simVolatility: "High",
    simBest: "+6.9%",
    simWorst: "-4.2%",
    simBenchmark: "+10.8%",
    summary:
      "Your profile targets stronger upside with higher volatility tolerance. Sentra AI will favour mETH and faster yield rotation while still monitoring liquidity and downside risk.",
  },
};

function updateRiskProfile(profileName) {
  const profile = riskProfiles[profileName];
  if (!profile) return;

  document.querySelectorAll(".risk-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.risk === profileName);
  });

  const profileTitle = document.getElementById("profileTitle");
  const apyRange = document.getElementById("apyRange");
  const drawdown = document.getElementById("drawdown");
  const reactionSpeed = document.getElementById("reactionSpeed");
  const aiSummary = document.getElementById("aiSummary");

  if (profileTitle) profileTitle.textContent = profile.title;
  if (apyRange) apyRange.textContent = profile.apy;
  if (drawdown) drawdown.textContent = profile.drawdown;
  if (reactionSpeed) reactionSpeed.textContent = profile.speed;
  if (aiSummary) aiSummary.textContent = profile.summary;

  profile.allocations.forEach(([label, value], index) => {
    const number = index + 1;
    const labelEl = document.getElementById(`allocation${number === 1 ? "One" : number === 2 ? "Two" : "Three"}Label`);
    const valueEl = document.getElementById(`allocation${number === 1 ? "One" : number === 2 ? "Two" : "Three"}Value`);
    const barEl = document.getElementById(`allocation${number === 1 ? "One" : number === 2 ? "Two" : "Three"}Bar`);

    if (labelEl) labelEl.textContent = label;
    if (valueEl) valueEl.textContent = `${value}%`;
    if (barEl) barEl.style.width = `${value}%`;
  });

  const simReturn = document.getElementById("simReturn");
  const simDrawdown = document.getElementById("simDrawdown");
  const simVolatility = document.getElementById("simVolatility");
  const simBest = document.getElementById("simBest");
  const simWorst = document.getElementById("simWorst");
  const simBenchmark = document.getElementById("simBenchmark");

  if (simReturn) simReturn.textContent = profile.simReturn;
  if (simDrawdown) simDrawdown.textContent = profile.simDrawdown;
  if (simVolatility) simVolatility.textContent = profile.simVolatility;
  if (simBest) simBest.textContent = profile.simBest;
  if (simWorst) simWorst.textContent = profile.simWorst;
  if (simBenchmark) simBenchmark.textContent = profile.simBenchmark;

  localStorage.setItem("sentra_risk_profile", profileName);
  updateFeedStrategyMode(profileName);
}

document.querySelectorAll(".risk-card").forEach((card) => {
  card.addEventListener("click", () => {
    updateRiskProfile(card.dataset.risk);
  });
});

const savedRiskProfile = localStorage.getItem("sentra_risk_profile") || "balanced";
updateRiskProfile(savedRiskProfile);
updateFeedStrategyMode(savedRiskProfile);

// Strategy Change
function updateFeedStrategyMode(profileName) {
  const strategyMode = document.getElementById("feedStrategyMode");
  if (!strategyMode) return;

  const labels = {
    conservative: "Conservative",
    balanced: "Balanced",
    aggressive: "Aggressive",
  };

  strategyMode.textContent = labels[profileName] || "Balanced";
}

// ── Per-wallet feed storage ──
function getFeedStorageKey(address) {
  return `sentra_feed_${address.toLowerCase()}`;
}

function saveFeedToStorage(address) {
  if (!address) return;
  const feedList = document.getElementById("feedList");
  if (!feedList) return;

  const entries = Array.from(feedList.querySelectorAll(".feed-entry")).map((entry) => ({
    type: entry.dataset.type || "monitoring",
    dot: entry.querySelector(".feed-dot")?.className.replace("feed-dot ", "") || "green",
    title: entry.querySelector(".feed-entry-top strong")?.textContent || "",
    message: entry.querySelector(".feed-entry-body p")?.textContent || "",
    time: entry.querySelector(".feed-entry-body small")?.textContent || "",
    tag: entry.querySelector(".feed-tag")?.textContent || "",
    tagClass: entry.querySelector(".feed-tag")?.className.replace("feed-tag ", "") || "green",
  }));

  localStorage.setItem(getFeedStorageKey(address), JSON.stringify(entries));
}

function loadFeedFromStorage(address) {
  if (!address) return;
  const feedList = document.getElementById("feedList");
  const feedEmpty = document.getElementById("feedEmpty");
  if (!feedList) return;

  // Clear current feed
  feedList.innerHTML = "";

  const stored = localStorage.getItem(getFeedStorageKey(address));
  if (!stored) {
    if (feedEmpty) feedEmpty.style.display = "";
    return;
  }

  const entries = JSON.parse(stored);
  if (!entries.length) {
    if (feedEmpty) feedEmpty.style.display = "";
    return;
  }

  if (feedEmpty) feedEmpty.style.display = "none";

  entries.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "feed-entry";
    entry.dataset.type = item.type;
    entry.innerHTML = `
      <div class="feed-entry-left">
        <span class="feed-dot ${item.dot}"></span>
      </div>
      <div class="feed-entry-body">
        <div class="feed-entry-top">
          <strong>${item.title}</strong>
          <span class="feed-tag ${item.tagClass}">${item.tag}</span>
        </div>
        <p>${item.message}</p>
        <small>${item.time}</small>
      </div>
    `;
    feedList.appendChild(entry);
  });

  updateFeedStats();
}

function clearFeed() {
  const feedList = document.getElementById("feedList");
  const feedEmpty = document.getElementById("feedEmpty");
  if (feedList) feedList.innerHTML = "";
  if (feedEmpty) feedEmpty.style.display = "";
  updateFeedStats();
}