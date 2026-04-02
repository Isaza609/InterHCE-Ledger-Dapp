"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RuntimeErrors {
}
RuntimeErrors.errUnknownRuntime = new Error('Unknown runtime specified');
RuntimeErrors.errRuntimeNotInitialized = new Error('Runtime not initialized');
exports.default = RuntimeErrors;
