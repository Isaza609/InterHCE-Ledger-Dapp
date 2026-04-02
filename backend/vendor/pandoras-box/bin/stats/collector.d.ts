import { BigNumber } from '@ethersproject/bignumber';
import { Provider } from '@ethersproject/providers';
declare class txStats {
    txHash: string;
    block: number;
    constructor(txHash: string, block: number);
}
declare class BlockInfo {
    blockNum: number;
    createdAt: number;
    numTxs: number;
    gasUsed: string;
    gasLimit: string;
    gasUtilization: number;
    constructor(blockNum: number, createdAt: number, numTxs: number, gasUsed: BigNumber, gasLimit: BigNumber);
}
declare class CollectorData {
    tps: number;
    blockInfo: Map<number, BlockInfo>;
    constructor(tps: number, blockInfo: Map<number, BlockInfo>);
}
declare class txBatchResult {
    succeeded: txStats[];
    remaining: string[];
    errors: string[];
    constructor(succeeded: txStats[], remaining: string[], errors: string[]);
}
declare class StatCollector {
    gatherTransactionReceipts(txHashes: string[], batchSize: number, provider: Provider): Promise<txStats[]>;
    fetchTransactionReceipts(txHashes: string[], batchSize: number, url: string): Promise<txBatchResult>;
    fetchBlockInfo(stats: txStats[], provider: Provider): Promise<Map<number, BlockInfo>>;
    calcTPS(stats: txStats[], provider: Provider): Promise<number>;
    printBlockData(blockInfoMap: Map<number, BlockInfo>): void;
    printFinalData(tps: number, blockInfoMap: Map<number, BlockInfo>): void;
    generateStats(txHashes: string[], mnemonic: string, url: string, batchSize: number): Promise<CollectorData>;
}
export { StatCollector, CollectorData, BlockInfo };
