"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("../logger/logger"));
class outputFormat {
    constructor(averageTPS, blocks) {
        this.averageTPS = averageTPS;
        this.blocks = blocks;
    }
}
class Outputter {
    static outputData(data, path) {
        logger_1.default.title('\n💾 Saving run results initialized 💾\n');
        const blocks = [];
        data.blockInfo.forEach((block) => {
            blocks.push(block);
        });
        try {
            fs_1.default.writeFileSync(path, JSON.stringify(new outputFormat(data.tps, blocks)));
            logger_1.default.success(`Run results saved to ${path}`);
        }
        catch (e) {
            logger_1.default.error(`Unable to write output to file: ${e.message}`);
        }
    }
}
exports.default = Outputter;
