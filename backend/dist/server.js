"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = require("body-parser");
const episodes_1 = require("./routes/episodes");
const app = (0, express_1.default)();
exports.app = app;
app.use((0, body_parser_1.json)());
app.use("/episodes", episodes_1.episodesRouter);
app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "interhce-backend" });
});
if (require.main === module) {
    const port = process.env.PORT ? Number(process.env.PORT) : 3001;
    app.listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`InterHCE backend escuchando en puerto ${port}`);
    });
}
