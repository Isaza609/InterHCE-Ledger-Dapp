import Heap from 'heap';
import { TokenRuntime } from '../runtime/runtimes';
import { distributeAccount } from './distributor';
declare class tokenRuntimeCosts {
    totalCost: number;
    subAccount: number;
    constructor(totalCost: number, subAccount: number);
}
declare class TokenDistributor {
    mnemonic: string;
    tokenRuntime: TokenRuntime;
    totalTx: number;
    readyMnemonicIndexes: number[];
    constructor(mnemonic: string, readyMnemonicIndexes: number[], totalTx: number, tokenRuntime: TokenRuntime);
    distributeTokens(): Promise<number[]>;
    calculateRuntimeCosts(): Promise<tokenRuntimeCosts>;
    findAccountsForDistribution(singleRunCost: number): Promise<Heap<distributeAccount>>;
    printCostTable(costs: tokenRuntimeCosts): void;
    fundAccounts(costs: tokenRuntimeCosts, accounts: distributeAccount[]): Promise<void>;
    getFundableAccounts(costs: tokenRuntimeCosts, initialSet: Heap<distributeAccount>): Promise<distributeAccount[]>;
}
export default TokenDistributor;
