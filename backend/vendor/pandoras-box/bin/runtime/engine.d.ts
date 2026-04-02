import { Runtime } from './runtimes';
declare class EngineContext {
    accountIndexes: number[];
    numTxs: number;
    batchSize: number;
    mnemonic: string;
    url: string;
    constructor(accountIndexes: number[], numTxs: number, batchSize: number, mnemonic: string, url: string);
}
declare class Engine {
    static Run(runtime: Runtime, ctx: EngineContext): Promise<string[]>;
}
export { Engine, EngineContext };
