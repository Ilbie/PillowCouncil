import { listSessions, resetDatabaseForTests } from "@pillow-council/shared";

if (process.env.NODE_ENV === "test") {
  resetDatabaseForTests();
}

console.log(JSON.stringify(listSessions(), null, 2));
