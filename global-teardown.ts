/**
 * global-teardown.ts
 *
 * Runs once after all test suites complete.
 * Use this to clean up test data, reset WordPress state, etc.
 */

import { FullConfig } from "@playwright/test";

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log("\n[global-teardown] Test run complete. Performing cleanup…");
  // Add post-run cleanup here if needed (e.g., delete test posts via REST API)
  console.log("[global-teardown] Done.");
}
