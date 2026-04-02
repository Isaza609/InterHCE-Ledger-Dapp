import { Provider, TransactionRequest } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
declare class senderAccount {
    mnemonicIndex: number;
    nonce: number;
    wallet: Wallet;
    constructor(mnemonicIndex: number, nonce: number, wallet: Wallet);
    incrNonce(): void;
    getNonce(): number;
    getAddress(): string;
}
declare class Signer {
    mnemonic: string;
    provider: Provider;
    constructor(mnemonic: string, url: string);
    getSenderAccounts(accountIndexes: number[], numTxs: number): Promise<senderAccount[]>;
    signTransactions(accounts: senderAccount[], transactions: TransactionRequest[]): Promise<string[]>;
}
export { Signer, senderAccount };
