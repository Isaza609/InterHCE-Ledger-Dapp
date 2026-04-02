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
const wallet_1 = require("@ethersproject/wallet");
const cli_progress_1 = require("cli-progress");
const cli_table3_1 = __importDefault(require("cli-table3"));
const heap_1 = __importDefault(require("heap"));
const logger_1 = __importDefault(require("../logger/logger"));
const distributor_1 = require("./distributor");
const errors_1 = __importDefault(require("./errors"));
class tokenRuntimeCosts {
    constructor(totalCost, subAccount) {
        this.totalCost = totalCost;
        this.subAccount = subAccount;
    }
}
class TokenDistributor {
    constructor(mnemonic, readyMnemonicIndexes, totalTx, tokenRuntime) {
        this.totalTx = totalTx;
        this.mnemonic = mnemonic;
        this.tokenRuntime = tokenRuntime;
        this.readyMnemonicIndexes = readyMnemonicIndexes;
    }
    distributeTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.title('\n🪙 Token distribution initialized 🪙');
            const baseCosts = yield this.calculateRuntimeCosts();
            this.printCostTable(baseCosts);
            // Check if there are any addresses that need funding
            const shortAddresses = yield this.findAccountsForDistribution(baseCosts.subAccount);
            const initialAccCount = shortAddresses.size();
            if (initialAccCount == 0) {
                // Nothing to distribute
                logger_1.default.success('Accounts are fully funded with tokens for the cycle');
                return this.readyMnemonicIndexes;
            }
            // Get a list of accounts that can be funded
            const fundableAccounts = yield this.getFundableAccounts(baseCosts, shortAddresses);
            if (fundableAccounts.length != initialAccCount) {
                logger_1.default.warn(`Unable to fund all sub-accounts. Funding ${fundableAccounts.length}`);
            }
            // Fund the accounts
            yield this.fundAccounts(baseCosts, fundableAccounts);
            logger_1.default.success('Fund distribution finished!');
            return this.readyMnemonicIndexes;
        });
    }
    calculateRuntimeCosts() {
        return __awaiter(this, void 0, void 0, function* () {
            const transferValue = this.tokenRuntime.GetTransferValue();
            const totalCost = transferValue * this.totalTx;
            const subAccountCost = Math.ceil(totalCost / this.readyMnemonicIndexes.length);
            return new tokenRuntimeCosts(totalCost, subAccountCost);
        });
    }
    findAccountsForDistribution(singleRunCost) {
        return __awaiter(this, void 0, void 0, function* () {
            const balanceBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            logger_1.default.info('\nFetching sub-account token balances...');
            const shortAddresses = new heap_1.default();
            balanceBar.start(this.readyMnemonicIndexes.length, 0, {
                speed: 'N/A',
            });
            for (const index of this.readyMnemonicIndexes) {
                const addrWallet = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/${index}`);
                const balance = yield this.tokenRuntime.GetTokenBalance(addrWallet.address);
                balanceBar.increment();
                if (balance < singleRunCost) {
                    // Address doesn't have enough funds, make sure it's
                    // on the list to get topped off
                    shortAddresses.push(new distributor_1.distributeAccount(bignumber_1.BigNumber.from(singleRunCost - balance), addrWallet.address, index));
                }
            }
            balanceBar.stop();
            logger_1.default.success('Fetched initial token balances');
            return shortAddresses;
        });
    }
    printCostTable(costs) {
        logger_1.default.info('\nCycle Token Cost Table:');
        const costTable = new cli_table3_1.default({
            head: ['Name', `Cost [${this.tokenRuntime.GetTokenSymbol()}]`],
        });
        costTable.push(['Required acc. token balance', costs.subAccount], ['Total token distribution cost', costs.totalCost]);
        logger_1.default.info(costTable.toString());
    }
    fundAccounts(costs, accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info('\nFunding accounts with tokens...');
            // Clear the list of ready indexes
            this.readyMnemonicIndexes = [];
            const fundBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            fundBar.start(accounts.length, 0, {
                speed: 'N/A',
            });
            for (const acc of accounts) {
                yield this.tokenRuntime.FundAccount(acc.address, acc.missingFunds.toNumber());
                fundBar.increment();
                this.readyMnemonicIndexes.push(acc.mnemonicIndex);
            }
            fundBar.stop();
        });
    }
    getFundableAccounts(costs, initialSet) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if the root wallet has enough token funds to distribute
            const accountsToFund = [];
            let distributorBalance = yield this.tokenRuntime.GetSupplierBalance();
            while (distributorBalance > costs.subAccount && initialSet.size() > 0) {
                const acc = initialSet.pop();
                distributorBalance -= acc.missingFunds.toNumber();
                accountsToFund.push(acc);
            }
            // Check if the distributor has funds at all
            if (accountsToFund.length == 0) {
                throw errors_1.default.errNotEnoughFunds;
            }
            return accountsToFund;
        });
    }
}
exports.default = TokenDistributor;
