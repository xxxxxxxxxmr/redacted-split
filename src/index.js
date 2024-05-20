import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import bs58 from 'bs58';

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

        const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        const sourceKeypair = Keypair.fromSecretKey(bs58.decode(sourceWalletBase58));
        const contractPubKey = new PublicKey(contractAddress);

        try {
            const mintAddress = contractPubKey;

            const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
                connection,
                sourceKeypair,
                mintAddress,
                sourceKeypair.publicKey
            );

            const totalTokens = await connection.getTokenAccountBalance(sourceTokenAccount.address);
            const numOfTargets = targetWallets.length;
            const tokensPerWallet = Math.floor(totalTokens.value.amount / numOfTargets);

            for (let target of targetWallets) {
                const targetWallet = new PublicKey(target);
                const targetTokenAccount = await getOrCreateAssociatedTokenAccount(
                    connection,
                    sourceKeypair,
                    mintAddress,
                    targetWallet
                );

                const transaction = new Transaction().add(
                    createTransferInstruction(
                        sourceTokenAccount.address,
                        targetTokenAccount.address,
                        sourceKeypair.publicKey,
                        tokensPerWallet,
                        [],
                        TOKEN_PROGRAM_ID
                    )
                );

                const signature = await sendAndConfirmTransaction(connection, transaction, [sourceKeypair]);
                resultDiv.innerHTML += `<p>Transferred ${tokensPerWallet} tokens to ${targetWallet.toBase58()}. Transaction Signature: ${signature}</p>`;
            }
        } catch (error) {
            resultDiv.innerHTML = `<p style="color:red;">Error: ${error.message}</p>`;
        }
    });
});
