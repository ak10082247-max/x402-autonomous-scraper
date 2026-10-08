require('dotenv').config();
const { ethers } = require('ethers');

// Local Hardhat Account #0 (Rich Test Account)
const AGENT_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const API_URL = 'http://localhost:4020/api/v1/agent/proxy-scrape';

async function executeAutonomousPurchase() {
    console.log("🤖 [AGENT] Initiating task: Fetch proxy scraping data...");
    
    let paymentInfo;

    // Step 1: Attempt to consume the API without paying
    try {
        console.log("🤖 [AGENT] Attempting to hit API without payment...");
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_url: "https://example-target.com/data" })
        });
        
        if (res.status === 402) {
            const data = await res.json();
            console.log("🤖 [AGENT] Received HTTP 402 Payment Required.");
            paymentInfo = data.payment_info;
            console.log(`🤖 [AGENT] Payment terms extracted: ${paymentInfo.amount} tokens to ${paymentInfo.receiver}`);
        } else {
            console.log("🤖 [AGENT] Unexpected response:", await res.text());
            return;
        }
    } catch (err) {
        console.error("🤖 [AGENT] Error contacting server:", err.message);
        return;
    }

    if (!paymentInfo) return;

    // Step 2: Execute the Payment autonomously on localhost
    console.log("🤖 [AGENT] Connecting to Local RPC to process payment...");
    const provider = new ethers.JsonRpcProvider(process.env.RPC_ENDPOINT);
    const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY, provider);

    const ERC20_ABI = ["function transfer(address to, uint256 amount) returns (bool)", "function decimals() view returns (uint8)"];
    const tokenContract = new ethers.Contract(paymentInfo.token, ERC20_ABI, wallet);

    try {
        const decimals = await tokenContract.decimals();
        const amountWei = ethers.parseUnits(paymentInfo.amount, decimals);

        console.log("🤖 [AGENT] Signing transaction to send MockUSDC...");
        const tx = await tokenContract.transfer(paymentInfo.receiver, amountWei);
        console.log(`🤖 [AGENT] Transaction broadcasted! Hash: ${tx.hash}`);
        console.log("🤖 [AGENT] Waiting for block confirmation...");
        
        await tx.wait(1); // Wait for 1 confirmation
        console.log("🤖 [AGENT] Payment confirmed on-chain.");

        // Check balance of receiver
        const balance = await tokenContract.interface.fragments.find(f => f.name === 'balanceOf') 
            ? await new ethers.Contract(paymentInfo.token, ["function balanceOf(address) view returns(uint256)"], provider).balanceOf(paymentInfo.receiver) 
            : null;
        if (balance !== null) {
            console.log(`💰 [NETWORK] Receiver Wallet ${paymentInfo.receiver} now has: ${ethers.formatUnits(balance, decimals)} MockUSDC`);
        }

        // Step 3: Redeem the receipt for the data payload
        console.log("🤖 [AGENT] Redeeming L402 receipt at the API...");
        const finalRes = await fetch(API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `L402 ${tx.hash}` 
            },
            body: JSON.stringify({ target_url: "https://example-target.com/data" })
        });

        const finalData = await finalRes.json();
        console.log("✅ [AGENT] Success! Data acquired:");
        console.log(JSON.stringify(finalData, null, 2));

    } catch (err) {
        console.error("❌ [AGENT] Blockchain interaction failed:", err.message);
    }
}

executeAutonomousPurchase();
