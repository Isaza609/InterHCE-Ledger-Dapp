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
const ZexCoinERC20_json_1 = __importDefault(require("../contracts/ZexCoinERC20.json"));
const logger_1 = __importDefault(require("../logger/logger"));
const errors_1 = __importDefault(require("./errors"));
class ERC20Runtime {
    constructor(mnemonic, url) {
        this.gasEstimation = bignumber_1.BigNumber.from(0);
        this.gasPrice = bignumber_1.BigNumber.from(0);
        this.defaultValue = bignumber_1.BigNumber.from(0);
        this.defaultTransferValue = 1;
        this.totalSupply = 500000000000;
        this.coinName = 'Zex Coin';
        this.coinSymbol = 'ZEX';
        this.mnemonic = mnemonic;
        this.provider = new providers_1.JsonRpcProvider(url);
        this.url = url;
        this.baseDeployer = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/0`).connect(this.provider);
    }
    Initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            // Initialize it
            this.contract = yield this.deployERC20();
        });
    }
    deployERC20() {
        return __awaiter(this, void 0, void 0, function* () {
            const contractFactory = new contracts_1.ContractFactory(ZexCoinERC20_json_1.default.abi, ZexCoinERC20_json_1.default.bytecode, this.baseDeployer);
            const contract = yield contractFactory.deploy(this.totalSupply, this.coinName, this.coinSymbol);
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
            this.gasEstimation = yield this.contract.estimateGas.transfer(wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/1`).address, this.defaultTransferValue);
            return this.gasEstimation;
        });
    }
    GetTransferValue() {
        return this.defaultTransferValue;
    }
    GetTokenBalance(address) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.contract) {
                throw errors_1.default.errRuntimeNotInitialized;
            }
            return yield this.contract.balanceOf(address);
        });
    }
    GetSupplierBalance() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.GetTokenBalance(this.baseDeployer.address);
        });
    }
    FundAccount(to, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.contract) {
                throw errors_1.default.errRuntimeNotInitialized;
            }
            const tx = yield this.contract.transfer(to, amount);
            // Wait for the transfer transaction to be mined
            yield tx.wait();
        });
    }
    GetTokenSymbol() {
        return this.coinSymbol;
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
            logger_1.default.info(`\nConstructing ${this.coinName} transfer transactions...`);
            constructBar.start(numTx, 0, {
                speed: 'N/A',
            });
            const transactions = [];
            for (let i = 0; i < numTx; i++) {
                const senderIndex = i % accounts.length;
                const receiverIndex = (i + 1) % accounts.length;
                const sender = accounts[senderIndex];
                const receiver = accounts[receiverIndex];
                const wallet = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/${senderIndex}`).connect(this.provider);
                const contract = new contracts_1.Contract(this.contract.address, ZexCoinERC20_json_1.default.abi, wallet);
                const transaction = yield contract.populateTransaction.transfer(receiver.getAddress(), this.defaultTransferValue);
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
        return '\n⚡️ ERC20 token transfers initialized ️⚡️\n';
    }
}
exports.default = ERC20Runtime;
