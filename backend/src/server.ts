import "dotenv/config";
import express, { Application } from "express";
import cors from "cors";
import { json } from "body-parser";
import swaggerUi from "swagger-ui-express";
import { episodesRouter } from "./routes/episodes";
import { infraRouter } from "./routes/infra";
import { accessRouter } from "./routes/access";
import { authRouter } from "./routes/auth";
import { openApiSpec } from "./docs/openapi";

const app: Application = express();

app.use(cors());
app.use(json());

app.use("/episodes", episodesRouter);
app.use("/infra", infraRouter);
app.use("/access", accessRouter);
app.use("/auth", authRouter);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

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

export { app };

if (require.main === module) {
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`InterHCE backend escuchando en puerto ${port}`);
  });
}
