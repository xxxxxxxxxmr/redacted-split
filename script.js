document.addEventListener('DOMContentLoaded', () => {
  const walletsInputMethod = document.getElementById('wallets-input-method');
  const fileInputGroup = document.getElementById('file-input-group');
  const manualInputGroup = document.getElementById('manual-input-group');
  const recipientWallets = document.getElementById('recipient-wallets');
  const addWalletButton = document.getElementById('add-wallet-button');

  walletsInputMethod.addEventListener('change', () => {
      if (walletsInputMethod.value === 'file') {
          fileInputGroup.style.display = 'block';
          manualInputGroup.style.display = 'none';
      } else {
          fileInputGroup.style.display = 'none';
          manualInputGroup.style.display = 'block';
      }
  });

  addWalletButton.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'wallet-input';
      input.placeholder = 'Recipient Wallet Address';
      recipientWallets.appendChild(input);
  });

  document.getElementById('split-form').addEventListener('submit', async (event) => {
      event.preventDefault();

      const resultDiv = document.getElementById('result');
      resultDiv.innerHTML = '';

      const walletsInputMethodValue = walletsInputMethod.value;
      let targetWallets = [];

      if (walletsInputMethodValue === 'file') {
          const walletsFile = document.getElementById('wallets-file').files[0];
          if (!walletsFile) {
              resultDiv.innerHTML = '<p style="color:red;">Please upload a wallets file.</p>';
              return;
          }
          const wallets = await walletsFile.text();
          targetWallets = wallets.trim().split('\n');
      } else {
          const walletInputs = document.querySelectorAll('.wallet-input');
          walletInputs.forEach(input => {
              if (input.value.trim()) {
                  targetWallets.push(input.value.trim());
              }
          });
          if (targetWallets.length === 0) {
              resultDiv.innerHTML = '<p style="color:red;">Please enter at least one recipient wallet address.</p>';
              return;
          }
      }

      const sourceWalletBase58 = document.getElementById('source-wallet').value;
      const contractAddress = document.getElementById('contract-address').value;

      if (!sourceWalletBase58 || !contractAddress) {
          resultDiv.innerHTML = '<p style="color:red;">Please fill in all fields.</p>';
          return;
      }

      const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');
      const sourceKeypair = solanaWeb3.Keypair.fromSecretKey(Uint8Array.from(solanaWeb3.utils.bs58.decode(sourceWalletBase58)));
      const contractPubKey = new solanaWeb3.PublicKey(contractAddress);

      try {
          const mintAddress = await connection.getAccountInfo(contractPubKey).then(info => {
              if (!info || !info.data) {
                  throw new Error('Invalid contract address');
              }
              const mintInfo = solanaWeb3.AccountLayout.decode(info.data);
              return new solanaWeb3.PublicKey(mintInfo.mint);
          });

          const sourceTokenAccount = await splToken.Token.getAssociatedTokenAddress(
              splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
              splToken.TOKEN_PROGRAM_ID,
              mintAddress,
              sourceKeypair.publicKey
          );

          const totalTokens = await connection.getTokenAccountBalance(sourceTokenAccount);
          const numOfTargets = targetWallets.length;
          const tokensPerWallet = Math.floor(totalTokens.value.amount / numOfTargets);

          for (let target of targetWallets) {
              const targetWallet = new solanaWeb3.PublicKey(target);
              const targetTokenAccount = await splToken.Token.getAssociatedTokenAddress(
                  splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
                  splToken.TOKEN_PROGRAM_ID,
                  mintAddress,
                  targetWallet
              );

              const transaction = new solanaWeb3.Transaction().add(
                  splToken.Token.createTransferInstruction(
                      splToken.TOKEN_PROGRAM_ID,
                      sourceTokenAccount,
                      targetTokenAccount,
                      sourceKeypair.publicKey,
                      [],
                      tokensPerWallet
                  )
              );

              const signature = await solanaWeb3.sendAndConfirmTransaction(connection, transaction, [sourceKeypair]);
              resultDiv.innerHTML += `<p>Transferred ${tokensPerWallet} tokens to ${targetWallet.toBase58()}. Transaction Signature: ${signature}</p>`;
          }
      } catch (error) {
          resultDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
      }
  });
});
