const { ethers } = require("ethers");

// Connect to MetaMask
async function sendTransactionWithMemo() {
  try {
      if (!window.ethereum) {
          document.getElementById('status').textContent = "MetaMask not found! Please install MetaMask.";
          return;
      }

      // Check network
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      document.getElementById('network').textContent = network.name;
      
      if (network.name !== 'sepolia') {
          document.getElementById('status').textContent = "Please switch to Sepolia network in MetaMask!";
          return;
      }

      // Request access to MetaMask
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const signer = provider.getSigner();

      document.getElementById('status').textContent = "Sending transaction...";

      const tx = {
          to: "0x15322B546e31F5Bfe144C4ae133A9Db6F0059fe3",
          value: ethers.utils.parseEther("0.01"),
          data: ethers.utils.hexlify(ethers.utils.toUtf8Bytes("Please give me some nam tnam1qp045wqf0k8rk07yhlldngympwhl5fuksq45n9vd")),
          gasLimit: ethers.utils.hexlify(21000),
      };

      // Send transaction
      const transactionResponse = await signer.sendTransaction(tx);
      document.getElementById('status').textContent = `Transaction sent: ${transactionResponse.hash}`;

      // Wait for confirmation
      const receipt = await transactionResponse.wait();
      document.getElementById('status').textContent = `Transaction confirmed: ${receipt.transactionHash}`;

  } catch (error) {
      document.getElementById('status').textContent = `Error: ${error.message}`;
      console.error(error);
  }
}

// Check network on load
window.addEventListener('load', async () => {
  if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const network = await provider.getNetwork();
      document.getElementById('network').textContent = network.name;
  } else {
      document.getElementById('network').textContent = "MetaMask not found";
  }
});