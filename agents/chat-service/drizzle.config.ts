import type { Config } from "drizzle-kit";
import { config } from "./src/config.js";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: config.DB_PATH,
  },
} satisfies Config;
