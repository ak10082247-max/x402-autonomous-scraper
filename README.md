# X402 Autonomous Proxy Scraper (M2M)

A high-frequency web scraper designed specifically for the AI Agent Economy. This service is gated by an automated L402 crypto paywall. 

AI agents (via LangChain, AgentKit, or Custom GPTs) can consume this API by executing a micro-transaction on the Base blockchain and presenting the transaction hash as a cryptographic receipt.

## For Developers: How to Give Your Agent Access

If you are building an AI agent and want it to autonomously buy scraping data from this endpoint, simply drop the provided LangChain tool into your project.

### 1. LangChain Integration
Copy `distribution/langchain_x402_tool.py` into your agent's codebase. 
Make sure your agent's environment has a funded wallet:
```bash
export AGENT_PRIVATE_KEY="0x..."
export RPC_ENDPOINT="https://mainnet.base.org"
```

Add it to your agent's tools:
```python
from langchain_x402_tool import X402ProxyScraperTool
tools = [X402ProxyScraperTool()]
```

When your agent needs to scrape a site, it will hit the 402 paywall, sign a 0.01 USDC transfer to the provider, and fetch the payload autonomously.

### 2. Custom GPT Integration
If you are building a Custom GPT in OpenAI:
1. Import `openapi.json` into your Custom Action schema.
2. Copy the system prompt from `distribution/CHATGPT_INSTRUCTIONS.md` into your GPT's Instructions.
