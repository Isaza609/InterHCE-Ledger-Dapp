import { BigNumber } from '@ethersproject/bignumber';
import { TransactionRequest } from '@ethersproject/providers';
import { senderAccount } from './signer';
export declare enum RuntimeType {
    EOA = "EOA",
    ERC20 = "ERC20",
    ERC721 = "ERC721",
    GREETER = "GREETER"
}
export interface Runtime {
    EstimateBaseTx(): Promise<BigNumber>;
    GetGasPrice(): Promise<BigNumber>;
    GetValue(): BigNumber;
    ConstructTransactions(accounts: senderAccount[], numTxs: number): Promise<TransactionRequest[]>;
    GetStartMessage(): string;
}
export interface InitializedRuntime extends Runtime {
    Initialize(): Promise<void>;
}
export interface TokenRuntime extends Runtime, InitializedRuntime {
    GetTransferValue(): number;
    GetTokenBalance(address: string): Promise<number>;
    GetSupplierBalance(): Promise<number>;
    GetTokenSymbol(): string;
    FundAccount(address: string, amount: number): Promise<void>;
}
export interface NFTRuntime extends Runtime, InitializedRuntime {
}
