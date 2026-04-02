import { BigNumber } from '@ethersproject/bignumber';
import { Provider, TransactionRequest } from '@ethersproject/providers';
import { senderAccount } from './signer';
declare class EOARuntime {
    mnemonic: string;
    url: string;
    provider: Provider;
    gasEstimation: BigNumber;
    gasPrice: BigNumber;
    defaultValue: BigNumber;
    constructor(mnemonic: string, url: string);
    EstimateBaseTx(): Promise<BigNumber>;
    GetValue(): BigNumber;
    GetGasPrice(): Promise<BigNumber>;
    ConstructTransactions(accounts: senderAccount[], numTx: number): Promise<TransactionRequest[]>;
    GetStartMessage(): string;
}
export default EOARuntime;
