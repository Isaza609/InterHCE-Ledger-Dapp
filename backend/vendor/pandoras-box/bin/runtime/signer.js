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
exports.senderAccount = exports.Signer = void 0;
const providers_1 = require("@ethersproject/providers");
const wallet_1 = require("@ethersproject/wallet");
const cli_progress_1 = require("cli-progress");
const logger_1 = __importDefault(require("../logger/logger"));
class senderAccount {
    constructor(mnemonicIndex, nonce, wallet) {
        this.mnemonicIndex = mnemonicIndex;
        this.nonce = nonce;
        this.wallet = wallet;
    }
    incrNonce() {
        this.nonce++;
    }
    getNonce() {
        return this.nonce;
    }
    getAddress() {
        return this.wallet.address;
    }
}
exports.senderAccount = senderAccount;
class Signer {
    constructor(mnemonic, url) {
        this.mnemonic = mnemonic;
        this.provider = new providers_1.JsonRpcProvider(url);
    }
    getSenderAccounts(accountIndexes, numTxs) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info('\nGathering initial account nonces...');
            // Maps the account index -> starting nonce
            const walletsToInit = accountIndexes.length > numTxs ? numTxs : accountIndexes.length;
            const nonceBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            nonceBar.start(walletsToInit, 0, {
                speed: 'N/A',
            });
            const accounts = [];
            for (let i = 0; i < walletsToInit; i++) {
                const accIndex = accountIndexes[i];
                const wallet = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/${accIndex}`).connect(this.provider);
                const accountNonce = yield wallet.getTransactionCount();
                accounts.push(new senderAccount(accIndex, accountNonce, wallet));
                nonceBar.increment();
            }
            nonceBar.stop();
            logger_1.default.success('Gathered initial nonce data\n');
            return accounts;
        });
    }
    signTransactions(accounts, transactions) {
        return __awaiter(this, void 0, void 0, function* () {
            const failedTxnSignErrors = [];
            const signBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            logger_1.default.info('\nSigning transactions...');
            signBar.start(transactions.length, 0, {
                speed: 'N/A',
            });
            const signedTxs = [];
            for (let i = 0; i < transactions.length; i++) {
                const sender = accounts[i % accounts.length];
                try {
                    signedTxs.push(yield sender.wallet.signTransaction(transactions[i]));
                }
                catch (e) {
                    failedTxnSignErrors.push(e);
                }
                signBar.increment();
            }
            signBar.stop();
            logger_1.default.success(`Successfully signed ${signedTxs.length} transactions`);
            if (failedTxnSignErrors.length > 0) {
                logger_1.default.warn('Errors encountered during transaction signing:');
                for (const err of failedTxnSignErrors) {
                    logger_1.default.error(err.message);
                }
            }
            return signedTxs;
        });
    }
}
exports.Signer = Signer;
