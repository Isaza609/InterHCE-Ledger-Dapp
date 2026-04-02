#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const distributor_1 = require("./distributor/distributor");
const tokenDistributor_1 = __importDefault(require("./distributor/tokenDistributor"));
const logger_1 = __importDefault(require("./logger/logger"));
const outputter_1 = __importDefault(require("./outputter/outputter"));
const engine_1 = require("./runtime/engine");
const eoa_1 = __importDefault(require("./runtime/eoa"));
const erc20_1 = __importDefault(require("./runtime/erc20"));
const erc721_1 = __importDefault(require("./runtime/erc721"));
const errors_1 = __importDefault(require("./runtime/errors"));
const runtimes_1 = require("./runtime/runtimes");
const collector_1 = require("./stats/collector");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const program = new commander_1.Command();
        program
            .name('pandoras-box')
            .description('A small and simple stress testing tool for Ethereum-compatible blockchain clients ')
            .version('1.0.0');
        program
            .requiredOption('-url, --json-rpc <json-rpc-address>', 'The URL of the JSON-RPC for the client')
            .requiredOption('-m, --mnemonic <mnemonic>', 'The mnemonic used to generate spam accounts')
            .option('-s, -sub-accounts <sub-accounts>', 'The number of sub-accounts that will send out transactions', '10')
            .option('-t, --transactions <transactions>', 'The total number of transactions to be emitted', '2000')
            .option('--mode <mode>', 'The mode for the stress test. Possible modes: [EOA, ERC20, ERC721]', 'EOA')
            .option('-o, --output <output-path>', 'The output path for the results JSON')
            .option('-b, --batch <batch>', 'The batch size of JSON-RPC transactions', '20')
            .parse();
        const options = program.opts();
        const url = options.jsonRpc;
        const transactionCount = Number(options.transactions);
        const mode = options.mode;
        const mnemonic = options.mnemonic;
        const subAccountsCount = Number(options.subAccounts ?? options.SubAccounts);
        const batchSize = Number(options.batch);
        const output = options.output;
        let runtime;
        switch (mode) {
            case runtimes_1.RuntimeType.EOA:
                runtime = new eoa_1.default(mnemonic, url);
                break;
            case runtimes_1.RuntimeType.ERC20:
                runtime = new erc20_1.default(mnemonic, url);
                // Initialize the runtime
                yield runtime.Initialize();
                break;
            case runtimes_1.RuntimeType.ERC721:
                runtime = new erc721_1.default(mnemonic, url);
                // Initialize the runtime
                yield runtime.Initialize();
                break;
            default:
                throw errors_1.default.errUnknownRuntime;
        }
        // Distribute the native currency funds
        const distributor = new distributor_1.Distributor(mnemonic, subAccountsCount, transactionCount, runtime, url);
        const accountIndexes = yield distributor.distribute();
        // Distribute the token funds, if any
        if (mode === runtimes_1.RuntimeType.ERC20) {
            const tokenDistributor = new tokenDistributor_1.default(mnemonic, accountIndexes, transactionCount, runtime);
            // Start the distribution
            yield tokenDistributor.distributeTokens();
        }
        // Run the specific runtime
        const txHashes = yield engine_1.Engine.Run(runtime, new engine_1.EngineContext(accountIndexes, transactionCount, batchSize, mnemonic, url));
        // Collect the data
        const collectorData = yield new collector_1.StatCollector().generateStats(txHashes, mnemonic, url, batchSize);
        // Output the data if needed
        if (output) {
            outputter_1.default.outputData(collectorData, output);
        }
    });
}
run()
    .then()
    .catch((err) => {
    logger_1.default.error(err);
});
