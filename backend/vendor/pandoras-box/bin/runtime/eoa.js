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
const providers_1 = require("@ethersproject/providers");
const units_1 = require("@ethersproject/units");
const wallet_1 = require("@ethersproject/wallet");
const cli_progress_1 = require("cli-progress");
const logger_1 = __importDefault(require("../logger/logger"));
class EOARuntime {
    constructor(mnemonic, url) {
        this.gasEstimation = bignumber_1.BigNumber.from(0);
        this.gasPrice = bignumber_1.BigNumber.from(0);
        // The default value for the E0A to E0A transfers
        // is 0.0001 native currency
        this.defaultValue = (0, units_1.parseUnits)('0.0001');
        this.mnemonic = mnemonic;
        this.provider = new providers_1.JsonRpcProvider(url);
        this.url = url;
    }
    EstimateBaseTx() {
        return __awaiter(this, void 0, void 0, function* () {
            // EOA to EOA transfers are simple value transfers between accounts
            this.gasEstimation = yield this.provider.estimateGas({
                from: wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/0`)
                    .address,
                to: wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/1`).address,
                value: this.defaultValue,
            });
            return this.gasEstimation;
        });
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
            const queryWallet = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/0`).connect(this.provider);
            const chainID = yield queryWallet.getChainId();
            const gasPrice = this.gasPrice;
            logger_1.default.info(`Chain ID: ${chainID}`);
            logger_1.default.info(`Avg. gas price: ${gasPrice.toHexString()}`);
            const constructBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            logger_1.default.info('\nConstructing value transfer transactions...');
            constructBar.start(numTx, 0, {
                speed: 'N/A',
            });
            const transactions = [];
            for (let i = 0; i < numTx; i++) {
                const senderIndex = i % accounts.length;
                const receiverIndex = (i + 1) % accounts.length;
                const sender = accounts[senderIndex];
                const receiver = accounts[receiverIndex];
                transactions.push({
                    from: sender.getAddress(),
                    chainId: chainID,
                    to: receiver.getAddress(),
                    gasPrice: gasPrice,
                    gasLimit: this.gasEstimation,
                    value: this.defaultValue,
                    nonce: sender.getNonce(),
                });
                sender.incrNonce();
                constructBar.increment();
            }
            constructBar.stop();
            logger_1.default.success(`Successfully constructed ${numTx} transactions`);
            return transactions;
        });
    }
    GetStartMessage() {
        return '\n⚡️ EOA to EOA transfers initialized ️⚡️\n';
    }
}
exports.default = EOARuntime;
