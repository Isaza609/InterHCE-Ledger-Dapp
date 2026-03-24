"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadJsonFile = loadJsonFile;
exports.saveJsonFile = saveJsonFile;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
function resolveDataPath(fileName) {
    return path_1.default.resolve(process.cwd(), "data", fileName);
}
function ensureDataDirectory(filePath) {
    const dirPath = path_1.default.dirname(filePath);
    if (!(0, fs_1.existsSync)(dirPath)) {
        (0, fs_1.mkdirSync)(dirPath, { recursive: true });
    }
}
function loadJsonFile(fileName, fallback) {
    const filePath = resolveDataPath(fileName);
    if (!(0, fs_1.existsSync)(filePath)) {
        return fallback;
    }
    try {
        return JSON.parse((0, fs_1.readFileSync)(filePath, "utf8"));
    }
    catch {
        return fallback;
    }
}
function saveJsonFile(fileName, value) {
    const filePath = resolveDataPath(fileName);
    ensureDataDirectory(filePath);
    (0, fs_1.writeFileSync)(filePath, JSON.stringify(value, null, 2), "utf8");
}
