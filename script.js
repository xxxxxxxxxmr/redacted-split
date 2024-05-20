document.getElementById('split-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '';

  const walletsFile = document.getElementById('wallets-file').files[0];
  const sourceWalletBase58 = document.getElementById('source-wallet').value;
  const tokenMint = document.getElementById('token-mint').value;

  if (!walletsFile || !sourceWalletBase58 || !tokenMint) {
      resultDiv.innerHTML = '<p style="color:red;">Please fill in all fields.</p>';
      return;
  }

  const wallets = await walletsFile.text();
  const targetWallets = wallets.trim().split('\n');

  const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('mainnet-beta'), 'confirmed');
  const sourceKeypair = solanaWeb3.Keypair.fromSecretKey(solanaWeb3.Keypair.fromSecretKey(Uint8Array.from(solanaWeb3.utils.bs58.decode(sourceWalletBase58))));
  const mintAddress = new solanaWeb3.PublicKey(tokenMint);

  try {
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
          const targetWallet = new solanaWeb3.PublicKey(target.trim());
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
