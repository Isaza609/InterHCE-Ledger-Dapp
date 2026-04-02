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
const bignumber_1 = require("@ethersproject/bignumber");
const contracts_1 = require("@ethersproject/contracts");
const providers_1 = require("@ethersproject/providers");
const wallet_1 = require("@ethersproject/wallet");
const cli_progress_1 = require("cli-progress");
const ZexNFTs_json_1 = __importDefault(require("../contracts/ZexNFTs.json"));
const logger_1 = __importDefault(require("../logger/logger"));
const errors_1 = __importDefault(require("./errors"));
class ERC721Runtime {
    constructor(mnemonic, url) {
        this.gasEstimation = bignumber_1.BigNumber.from(0);
        this.gasPrice = bignumber_1.BigNumber.from(0);
        this.defaultValue = bignumber_1.BigNumber.from(0);
        this.nftName = 'ZEXTokens';
        this.nftSymbol = 'ZEXes';
        this.nftURL = 'https://really-valuable-nft-page.io';
        this.mnemonic = mnemonic;
        this.provider = new providers_1.JsonRpcProvider(url);
        this.url = url;
        this.baseDeployer = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/0`).connect(this.provider);
    }
    Initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            this.contract = yield this.deployERC721();
        });
    }
    deployERC721() {
        return __awaiter(this, void 0, void 0, function* () {
            const contractFactory = new contracts_1.ContractFactory(ZexNFTs_json_1.default.abi, ZexNFTs_json_1.default.bytecode, this.baseDeployer);
            const contract = yield contractFactory.deploy(this.nftName, this.nftSymbol);
            yield contract.deployTransaction.wait();
            return contract;
        });
    }
    EstimateBaseTx() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.contract) {
                throw errors_1.default.errRuntimeNotInitialized;
            }
            // Estimate a simple transfer transaction
            this.gasEstimation = yield this.contract.estimateGas.createNFT(this.nftURL);
            return this.gasEstimation;
        });
    }
    GetNFTSymbol() {
        return this.nftSymbol;
    }
    GetValue() {
        return this.defaultValue;
    }
    GetGasPrice() {
        return __awaiter(this, void 0, void 0, function* () {
            this.gasPrice = yield this.provider.getGasPrice();
            return this.gasPrice;
        });
    }
    ConstructTransactions(accounts, numTx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.contract) {
                throw errors_1.default.errRuntimeNotInitialized;
            }
            const chainID = yield this.baseDeployer.getChainId();
            const gasPrice = this.gasPrice;
            logger_1.default.info(`Chain ID: ${chainID}`);
            logger_1.default.info(`Avg. gas price: ${gasPrice.toHexString()}`);
            const constructBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            logger_1.default.info(`\nConstructing ${this.nftName} mint transactions...`);
            constructBar.start(numTx, 0, {
                speed: 'N/A',
            });
            const transactions = [];
            for (let i = 0; i < numTx; i++) {
                const senderIndex = i % accounts.length;
                const sender = accounts[senderIndex];
                const wallet = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/${senderIndex}`).connect(this.provider);
                const contract = new contracts_1.Contract(this.contract.address, ZexNFTs_json_1.default.abi, wallet);
                const transaction = yield contract.populateTransaction.createNFT(this.nftURL);
                // Override the defaults
                transaction.from = sender.getAddress();
                transaction.chainId = chainID;
                transaction.gasPrice = gasPrice;
                transaction.gasLimit = this.gasEstimation;
                transaction.nonce = sender.getNonce();
                transactions.push(transaction);
                sender.incrNonce();
                constructBar.increment();
            }
            constructBar.stop();
            logger_1.default.success(`Successfully constructed ${numTx} transactions`);
            return transactions;
        });
    }
    GetStartMessage() {
        return '\n⚡️ ERC721 NFT mints initialized ️⚡️\n';
    }
}
exports.default = ERC721Runtime;
