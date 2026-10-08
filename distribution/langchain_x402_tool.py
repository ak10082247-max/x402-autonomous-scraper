import os
import requests
import json
from web3 import Web3
from langchain.tools import BaseTool

class X402ProxyScraperTool(BaseTool):
    name = "x402_proxy_scraper"
    description = "Use this tool to scrape websites. Input is the target_url. The tool autonomously handles the crypto micro-payment required to bypass the paywall."

    def _run(self, target_url: str) -> str:
        api_url = "https://wicked-bears-laugh.loca.lt/api/v1/agent/proxy-scrape"
        
        # 1. Attempt unauthenticated request
        response = requests.post(api_url, json={"target_url": target_url})
        
        if response.status_code != 402:
            return response.text
            
        # 2. Extract 402 Payment Terms
        payment_info = response.json().get("payment_info")
        if not payment_info:
            return "Error: 402 received but no payment info provided."
            
        private_key = os.environ.get("AGENT_PRIVATE_KEY")
        rpc_url = os.environ.get("RPC_ENDPOINT", "https://mainnet.base.org")
        
        if not private_key:
            return "Execution Failed: Agent lacks AGENT_PRIVATE_KEY environment variable to execute the required L402 micro-payment."

        # 3. Execute Blockchain Transaction
        print(f"🤖 [Agent Web3] Executing {payment_info['amount']} token payment to {payment_info['receiver']}")
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        account = w3.eth.account.from_key(private_key)
        
        # Minimal ERC20 ABI
        erc20_abi = json.loads('[{"constant":false,"inputs":[{"name":"_to","type":"address"},{"name":"_value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"type":"function"}, {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"type":"function"}]')
        
        token_contract = w3.eth.contract(address=w3.to_checksum_address(payment_info['token']), abi=erc20_abi)
        decimals = token_contract.functions.decimals().call()
        amount_wei = int(float(payment_info['amount']) * (10 ** decimals))
        
        tx = token_contract.functions.transfer(
            w3.to_checksum_address(payment_info['receiver']), 
            amount_wei
        ).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 100000,
            'gasPrice': w3.eth.gas_price
        })
        
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        print(f"🤖 [Agent Web3] Transaction broadcast! Hash: {w3.to_hex(tx_hash)}")
        
        w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # 4. Redeem L402 Receipt
        headers = {"Authorization": f"L402 {w3.to_hex(tx_hash)}"}
        final_response = requests.post(api_url, json={"target_url": target_url}, headers=headers)
        
        return final_response.text

    def _arun(self, target_url: str):
        raise NotImplementedError("Async not implemented yet")
