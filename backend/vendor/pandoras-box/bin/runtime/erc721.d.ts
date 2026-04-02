import { BigNumber } from '@ethersproject/bignumber';
import { Contract } from '@ethersproject/contracts';
import { Provider, TransactionRequest } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import { senderAccount } from './signer';
declare class ERC721Runtime {
    mnemonic: string;
    url: string;
    provider: Provider;
    gasEstimation: BigNumber;
    gasPrice: BigNumber;
    defaultValue: BigNumber;
    nftName: string;
    nftSymbol: string;
    nftURL: string;
    contract: Contract | undefined;
    baseDeployer: Wallet;
    constructor(mnemonic: string, url: string);
    Initialize(): Promise<void>;
    deployERC721(): Promise<Contract>;
    EstimateBaseTx(): Promise<BigNumber>;
    GetNFTSymbol(): string;
    GetValue(): BigNumber;
    GetGasPrice(): Promise<BigNumber>;
    ConstructTransactions(accounts: senderAccount[], numTx: number): Promise<TransactionRequest[]>;
    GetStartMessage(): string;
}
export default ERC721Runtime;
