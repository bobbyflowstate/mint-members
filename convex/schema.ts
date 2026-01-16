import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Schema will be expanded in Task 4 with applications, ops_authorizations, event_logs, and config tables
export default defineSchema({
  ...authTables,
});
