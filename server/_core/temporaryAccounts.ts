import type { User } from "../../drizzle/schema";

export function isTemporaryAccountExpired(_user: User) {
  return false;
}

export function getTemporaryAccountRestrictionsMessage() {
  return "Temporary account restrictions apply.";
}