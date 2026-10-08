require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { ethers } = require('ethers');

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

// Load configurations
const PORT = process.env.PORT || 4020;
const RPC_ENDPOINT = process.env.RPC_ENDPOINT;
const RECEIVER_WALLET = (process.env.RECEIVER_WALLET_ADDRESS || '').toLowerCase();
const PAYMENT_TOKEN = (process.env.PAYMENT_TOKEN_ADDRESS || '').toLowerCase();
const PRICE_PER_CALL = process.env.PRICE_PER_CALL || "0.01";

// Minimal ERC20 ABI for Transfer event verification
const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "event Transfer(address indexed from, address indexed to, uint amount)"
];

// In-memory cache for spent transaction hashes to prevent replay attacks
// In production, use Redis or a database
const spentTxHashes = new Set();

// Ethers provider
let provider;
try {
    if (RPC_ENDPOINT) {
        provider = new ethers.JsonRpcProvider(RPC_ENDPOINT);
    }
} catch (error) {
    console.warn("WARNING: RPC_ENDPOINT not configured or invalid. Verification will fail.");
}

/**
 * M2M Autonomous Payment Verification Middleware
 * Returns HTTP 402 if payment is missing or invalid.
 */
async function requireL402(req, res, next) {
    const authHeader = req.headers['authorization'];
    
    // Check for L402 payment header containing the transaction hash
    // Format expected: "L402 <tx_hash>"
    if (!authHeader || !authHeader.startsWith('L402 ')) {
        return res.status(402).json({
            error: "Payment Required",
            message: "This endpoint requires an M2M micropayment.",
            payment_info: {
                receiver: RECEIVER_WALLET,
                token: PAYMENT_TOKEN,
                amount: PRICE_PER_CALL,
                chain_id: process.env.CHAIN_ID || 137,
                instructions: "Send the required amount to the receiver address on the specified chain. Attach the transaction hash in the Authorization header as 'L402 <tx_hash>'."
            }
        });
    }

    const txHash = authHeader.split(' ')[1];

    // Prevent replay attacks
    if (spentTxHashes.has(txHash)) {
        return res.status(402).json({ error: "Payment Required", message: "Transaction hash already spent." });
    }

    if (!provider) {
        return res.status(500).json({ error: "Internal Server Error", message: "Blockchain provider not configured." });
    }

    try {
        // Verify transaction on-chain
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt || receipt.status !== 1) {
            return res.status(402).json({ error: "Payment Required", message: "Transaction failed or not mined yet." });
        }

        // We assume token transfers. Look through logs for the Transfer event to the RECEIVER_WALLET.
        const tokenContract = new ethers.Contract(PAYMENT_TOKEN, ERC20_ABI, provider);
        const decimals = await tokenContract.decimals();
        const requiredAmount = ethers.parseUnits(PRICE_PER_CALL, decimals);

        let validTransferFound = false;

        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === PAYMENT_TOKEN) {
                try {
                    const parsedLog = tokenContract.interface.parseLog(log);
                    if (parsedLog && parsedLog.name === 'Transfer') {
                        const to = parsedLog.args.to.toLowerCase();
                        const amount = parsedLog.args.amount;

                        if (to === RECEIVER_WALLET && amount >= requiredAmount) {
                            validTransferFound = true;
                            break;
                        }
                    }
                } catch (e) {
                    // Log cannot be parsed, ignore
                }
            }
        }

        if (!validTransferFound) {
            return res.status(402).json({ error: "Payment Required", message: "Invalid payment amount or receiver." });
        }

        // Mark as spent
        spentTxHashes.add(txHash);
        
        // Payment verified, proceed to utility
        next();

    } catch (error) {
        console.error("Payment Verification Error:", error);
        return res.status(500).json({ error: "Internal Server Error", message: "Failed to verify transaction." });
    }
}

// -----------------------------------------------------------------------------
// AGENT UTILITY ENDPOINTS (Payload Delivery)
// -----------------------------------------------------------------------------

app.post('/api/v1/agent/proxy-scrape', requireL402, async (req, res) => {
    const { target_url } = req.body;
    if (!target_url) {
        return res.status(400).json({ error: "Bad Request", message: "Missing target_url" });
    }

    // Simulate high-speed autonomous proxy scraping
    const mockExtractedData = {
        url: target_url,
        timestamp: new Date().toISOString(),
        content: `Extracted machine-readable data for ${target_url}`,
        metadata: {
            links_found: Math.floor(Math.random() * 100),
            entities_extracted: Math.floor(Math.random() * 50)
        }
    };

    res.json({
        status: "success",
        delivered_by: "X402 Autonomous Node",
        data: mockExtractedData
    });
});

app.post('/api/v1/agent/llm-data-transform', requireL402, async (req, res) => {
    const { raw_text } = req.body;
    
    // Simulate complex data transformation for agents
    res.json({
        status: "success",
        structured_data: {
            summary: "Autonomously processed summary",
            word_count: raw_text ? raw_text.length : 0,
            sentiment: "neutral"
        }
    });
});

app.listen(PORT, () => {
    console.log(`[+] Autonomous M2M X402 Server running on port ${PORT}`);
    console.log(`[+] Awaiting machine payments at receiver: ${RECEIVER_WALLET}`);
});
