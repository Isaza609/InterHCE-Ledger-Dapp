import { BigNumber } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
import { Wallet } from '@ethersproject/wallet';
import Heap from 'heap';
import { Runtime } from '../runtime/runtimes';
declare class distributeAccount {
    missingFunds: BigNumber;
    address: string;
    mnemonicIndex: number;
    constructor(missingFunds: BigNumber, address: string, index: number);
}
declare class runtimeCosts {
    accDistributionCost: BigNumber;
    subAccount: BigNumber;
    constructor(accDistributionCost: BigNumber, subAccount: BigNumber);
}
declare class Distributor {
    ethWallet: Wallet;
    mnemonic: string;
    provider: Provider;
    runtimeEstimator: Runtime;
    totalTx: number;
    requestedSubAccounts: number;
    readyMnemonicIndexes: number[];
    constructor(mnemonic: string, subAccounts: number, totalTx: number, runtimeEstimator: Runtime, url: string);
    distribute(): Promise<number[]>;
    calculateRuntimeCosts(): Promise<runtimeCosts>;
    findAccountsForDistribution(singleRunCost: BigNumber): Promise<Heap<distributeAccount>>;
    printCostTable(costs: runtimeCosts): void;
    getFundableAccounts(costs: runtimeCosts, initialSet: Heap<distributeAccount>): Promise<distributeAccount[]>;
    fundAccounts(costs: runtimeCosts, accounts: distributeAccount[]): Promise<void>;
}
export { Distributor, Runtime, distributeAccount };
