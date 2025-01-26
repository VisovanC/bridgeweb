import React, { useState } from "react";
import { useWallet, ConnectButton } from "@suiet/wallet-kit";
import { providers, Contract, utils } from 'ethers';

const ETH_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ETH_CONTRACT_ABI = [
    {
        "inputs": [],
        "name": "convertETHToIBT",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "spender", "type": "address", "internalType": "address"},
            {"name": "amount", "type": "uint256", "internalType": "uint256"}
        ],
        "name": "approveTokenForBridge",
        "outputs": [{"name": "", "type": "bool", "internalType": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"name": "bridgeContract", "type": "address", "internalType": "address"},
            {"name": "amount", "type": "uint256", "internalType": "uint256"}
        ],
        "name": "transferTokensToBridge",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const App = () => {
    const [ethereumAccount, setEthereumAccount] = useState("");
    const [amount, setAmount] = useState("");
    const [transactionStage, setTransactionStage] = useState("");
    const wallet = useWallet();

    const connectEthereumWallet = async () => {
        if (typeof window.ethereum !== "undefined") {
            try {
                const accounts = await window.ethereum.request({
                    method: "eth_requestAccounts",
                });
                setEthereumAccount(accounts[0]);
            } catch (error) {
                console.error("MetaMask connection failed:", error);
                alert(`Ethereum wallet connection failed: ${error.message}`);
            }
        } else {
            alert("MetaMask is not installed!");
        }
    };

    const bridgeToSui = async () => {
        if (!ethereumAccount || !wallet.connected || !amount) {
            alert("Connect both wallets and specify an amount");
            return;
        }
    
        try {
            const provider = new providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const contract = new Contract(ETH_CONTRACT_ADDRESS, ETH_CONTRACT_ABI, signer);
            setTransactionStage("Converting ETH to IBT...");
            const weiAmount = utils.parseEther(amount);
            const convertTx = await contract.convertETHToIBT({ value: weiAmount });
            await convertTx.wait();
            const ibtAmount = weiAmount.mul(1000);
            setTransactionStage("Approving tokens for bridge...");
            const approveTx = await contract.approveTokenForBridge(ETH_CONTRACT_ADDRESS, ibtAmount);
            await approveTx.wait();
            setTransactionStage("Transferring tokens to bridge...");
            const transferTx = await contract.transferTokensToBridge(ETH_CONTRACT_ADDRESS, ibtAmount);
            await transferTx.wait();
            setTransactionStage("Preparing Sui transaction...");
            const suiTransaction = {
                kind: "moveCall",
                data: {
                    packageObjectId: "0xe63e92137c2501c3f43b647f4ff4cd82ac030787e543ab5a26ba1fe554f81371  ",
                    module: "suipart",
                    function: "mint",
                    typeArguments: ["0xe63e92137c2501c3f43b647f4ff4cd82ac030787e543ab5a26ba1fe554f81371::suipart::SUIPART"],
                    arguments: [
                        "0xe63e92137c2501c3f43b647f4ff4cd82ac030787e543ab5a26ba1fe554f81371::suipart::SUIPART",
                        ibtAmount.toString(),
                        wallet.address
                    ]
                }
            };
            setTransactionStage("Executing Sui transaction...");
            const suiResult = await wallet.signAndExecuteTransactionBlock({
                transactionBlock: suiTransaction,
                chain: 'sui:mainnet'
            });
            console.log("Sui Result:", suiResult);
    
            alert("Successfully bridged tokens!");
        } catch (error) {
            console.error("Bridge Error:", error);
            alert(`Bridge failed at ${transactionStage}: ${error.message}`);
        } finally {
            setTransactionStage("");
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">Cross-Chain Bridge 🌉</h1>
            <div className="mb-4">
                <button
                    onClick={connectEthereumWallet}
                    className="px-4 py-2 bg-blue-500 text-white rounded shadow"
                    disabled={!!transactionStage}
                >
                    Connect Ethereum Wallet
                </button>
                {ethereumAccount && <p>Connected: {ethereumAccount}</p>}
            </div>
            <div className="mb-4">
                <ConnectButton />
                {wallet.connected && <p>Connected: {wallet.address}</p>}
            </div>
            <div className="mb-4">
                <input
                    type="number"
                    placeholder="Amount in ETH"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="p-2 border rounded w-64"
                    disabled={!!transactionStage}
                />
            </div>
            <button
                onClick={bridgeToSui}
                className="px-4 py-2 bg-purple-500 text-white rounded shadow"
                disabled={!!transactionStage}
            >
                {transactionStage || 'Bridge Tokens'}
            </button>
            {transactionStage && <p className="mt-2 text-blue-600">{transactionStage}</p>}
        </div>
    );
};

export default App;