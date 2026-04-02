declare class Batcher {
    static generateBatches<ItemType>(items: ItemType[], batchSize: number): ItemType[][];
    static batchTransactions(signedTxs: string[], batchSize: number, url: string): Promise<string[]>;
}
export default Batcher;
