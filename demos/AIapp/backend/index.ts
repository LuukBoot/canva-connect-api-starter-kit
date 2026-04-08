import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/user";
import assetRoutes from "./routes/assets";
import generateRoutes from "./routes/generate";
import claudeRoutes from "./routes/claude";
import cookieParser from "cookie-parser";
import { errorHandler } from "../../common/backend/middleware/errors";
import type { Client } from "@canva/connect-api-ts/client";
import { logger } from "../../common/backend/middleware/logger";

declare global {
  namespace Express {
    interface Request {
      client: Client;
      token: string;
    }
  }
}

const port = process.env.BACKEND_PORT;

if (!port) {
  throw new Error("'BACKEND_PORT' env variable not found.");
}

const app = express();
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);
app.use(bodyParser.json());
app.use(cookieParser(process.env.DATABASE_ENCRYPTION_KEY));

app.use(errorHandler);
app.use(logger);

app.use(authRoutes);
app.use(userRoutes);
app.use(assetRoutes);
app.use(generateRoutes);
app.use(claudeRoutes);

app.set(
  "views",
  path.join(__dirname, "..", "..", "common", "backend", "views"),
);
app.set("view engine", "pug");

app.listen(port, () => {
  console.log(`AIapp backend listening on port ${port}`);
});
