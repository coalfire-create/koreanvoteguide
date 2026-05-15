import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isPollPublicationBlackout } from "../utils/election-blackout";

describe("isPollPublicationBlackout", () => {
  const original = process.env.ELECTION_DAY;
  beforeEach(() => {
    process.env.ELECTION_DAY = "2026-06-03";
  });
  afterEach(() => {
    if (original === undefined) delete process.env.ELECTION_DAY;
    else process.env.ELECTION_DAY = original;
  });

  it("returns false outside the window", () => {
    expect(isPollPublicationBlackout(new Date("2026-05-20T12:00:00+09:00"))).toBe(false);
  });

  it("returns true 6 days before election", () => {
    expect(isPollPublicationBlackout(new Date("2026-05-28T01:00:00+09:00"))).toBe(true);
  });

  it("returns true on election day before 18:00 KST", () => {
    expect(isPollPublicationBlackout(new Date("2026-06-03T15:00:00+09:00"))).toBe(true);
  });

  it("returns false after 18:00 KST on election day", () => {
    expect(isPollPublicationBlackout(new Date("2026-06-03T19:00:00+09:00"))).toBe(false);
  });

  it("returns false when ELECTION_DAY is unset", () => {
    delete process.env.ELECTION_DAY;
    expect(isPollPublicationBlackout(new Date())).toBe(false);
  });
});
