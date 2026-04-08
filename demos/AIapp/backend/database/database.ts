import { JSONFileDatabase } from "../../../common/backend/database/database";
import type { BaseDatabaseSchema } from "../../../common/backend/database/schema";

const db = new JSONFileDatabase<BaseDatabaseSchema>(
  { users: [] },
  __dirname,
);

export { db };
