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
exports.distributeAccount = exports.Distributor = void 0;
const bignumber_1 = require("@ethersproject/bignumber");
const providers_1 = require("@ethersproject/providers");
const units_1 = require("@ethersproject/units");
const wallet_1 = require("@ethersproject/wallet");
const cli_progress_1 = require("cli-progress");
const cli_table3_1 = __importDefault(require("cli-table3"));
const heap_1 = __importDefault(require("heap"));
const logger_1 = __importDefault(require("../logger/logger"));
const errors_1 = __importDefault(require("./errors"));
class distributeAccount {
    constructor(missingFunds, address, index) {
        this.missingFunds = missingFunds;
        this.address = address;
        this.mnemonicIndex = index;
    }
}
exports.distributeAccount = distributeAccount;
class runtimeCosts {
    constructor(accDistributionCost, subAccount) {
        this.accDistributionCost = accDistributionCost;
        this.subAccount = subAccount;
    }
}
// Manages the fund distribution before each run-cycle
class Distributor {
    constructor(mnemonic, subAccounts, totalTx, runtimeEstimator, url) {
        this.requestedSubAccounts = subAccounts;
        this.totalTx = totalTx;
        this.mnemonic = mnemonic;
        this.runtimeEstimator = runtimeEstimator;
        this.readyMnemonicIndexes = [];
        this.provider = new providers_1.JsonRpcProvider(url);
        this.ethWallet = wallet_1.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/0`).connect(this.provider);
    }
    distribute() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.title('💸 Fund distribution initialized 💸');
            const baseCosts = yield this.calculateRuntimeCosts();
            this.printCostTable(baseCosts);
            // Check if there are any addresses that need funding
            const shortAddresses = yield this.findAccountsForDistribution(baseCosts.subAccount);
            const initialAccCount = shortAddresses.size();
            if (initialAccCount == 0) {
                // Nothing to distribute
                logger_1.default.success('Accounts are fully funded for the cycle');
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
            const inherentValue = this.runtimeEstimator.GetValue();
            const baseTxEstimate = yield this.runtimeEstimator.EstimateBaseTx();
            const baseGasPrice = yield this.runtimeEstimator.GetGasPrice();
            const baseTxCost = baseGasPrice.mul(baseTxEstimate).add(inherentValue);
            // Calculate how much each sub-account needs
            // to execute their part of the run cycle.
            // Each account needs at least numTx * (gasPrice * gasLimit + value)
            const subAccountCost = bignumber_1.BigNumber.from(this.totalTx).mul(baseTxCost);
            // Calculate the cost of the single distribution transaction
            const singleDistributionCost = yield this.provider.estimateGas({
                from: wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/0`)
                    .address,
                to: wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/1`).address,
                value: subAccountCost,
            });
            return new runtimeCosts(singleDistributionCost, subAccountCost);
        });
    }
    findAccountsForDistribution(singleRunCost) {
        return __awaiter(this, void 0, void 0, function* () {
            const balanceBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            logger_1.default.info('\nFetching sub-account balances...');
            const shortAddresses = new heap_1.default();
            balanceBar.start(this.requestedSubAccounts, 0, {
                speed: 'N/A',
            });
            for (let i = 1; i <= this.requestedSubAccounts; i++) {
                const addrWallet = wallet_1.Wallet.fromMnemonic(this.mnemonic, `m/44'/60'/0'/0/${i}`).connect(this.provider);
                const balance = yield addrWallet.getBalance();
                balanceBar.increment();
                if (balance.lt(singleRunCost)) {
                    // Address doesn't have enough funds, make sure it's
                    // on the list to get topped off
                    shortAddresses.push(new distributeAccount(singleRunCost.sub(balance), addrWallet.address, i));
                    continue;
                }
                // Address has enough funds already, mark it as ready
                this.readyMnemonicIndexes.push(i);
            }
            balanceBar.stop();
            return shortAddresses;
        });
    }
    printCostTable(costs) {
        logger_1.default.info('\nCycle Cost Table:');
        const costTable = new cli_table3_1.default({
            head: ['Name', 'Cost [eth]'],
        });
        costTable.push(['Required acc. balance', (0, units_1.formatEther)(costs.subAccount)], ['Single distribution cost', (0, units_1.formatEther)(costs.accDistributionCost)]);
        logger_1.default.info(costTable.toString());
    }
    getFundableAccounts(costs, initialSet) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if the root wallet has enough funds to distribute
            const accountsToFund = [];
            let distributorBalance = bignumber_1.BigNumber.from(yield this.ethWallet.getBalance());
            while (distributorBalance.gt(costs.accDistributionCost) &&
                initialSet.size() > 0) {
                const acc = initialSet.pop();
                distributorBalance = distributorBalance.sub(acc.missingFunds);
                accountsToFund.push(acc);
            }
            // Check if there are accounts to fund
            if (accountsToFund.length == 0) {
                throw errors_1.default.errNotEnoughFunds;
            }
            return accountsToFund;
        });
    }
    fundAccounts(costs, accounts) {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.info('\nFunding accounts...');
            const fundBar = new cli_progress_1.SingleBar({
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591',
                hideCursor: true,
            });
            fundBar.start(accounts.length, 0, {
                speed: 'N/A',
            });
            for (const acc of accounts) {
                yield this.ethWallet.sendTransaction({
                    to: acc.address,
                    value: acc.missingFunds,
                });
                fundBar.increment();
                this.readyMnemonicIndexes.push(acc.mnemonicIndex);
            }
            fundBar.stop();
        });
    }
}
exports.Distributor = Distributor;
