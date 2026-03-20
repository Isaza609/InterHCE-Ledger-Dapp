"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = require("body-parser");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const episodes_1 = require("./routes/episodes");
const infra_1 = require("./routes/infra");
const access_1 = require("./routes/access");
const auth_1 = require("./routes/auth");
const openapi_1 = require("./docs/openapi");
const app = (0, express_1.default)();
exports.app = app;
app.use((0, cors_1.default)());
app.use((0, body_parser_1.json)());
app.use("/episodes", episodes_1.episodesRouter);
app.use("/infra", infra_1.infraRouter);
app.use("/access", access_1.accessRouter);
app.use("/auth", auth_1.authRouter);
app.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.openApiSpec));
app.get("/", (_req, res) => {
    res.json({
        service: "interhce-backend",
        docs: "/docs",
        health: "/health"
    });
});
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
