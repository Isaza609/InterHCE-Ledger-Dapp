"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEpisodioClinico = validateEpisodioClinico;
const hceValidationSchema_1 = require("./hceValidationSchema");
function validateEpisodioClinico(payload) {
    const result = hceValidationSchema_1.episodioClinicoUrgenciasSchema.safeParse(payload);
    if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            issue: issue.message
        }));
        return {
            valid: false,
            issues
        };
    }
    return {
        valid: true,
        data: result.data
    };
}
