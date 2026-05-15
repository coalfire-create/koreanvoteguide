import { describe, expect, it } from "vitest";
import { calculateAge, calculateAgeGroup, parseBirthDate, normalizeGender } from "../utils/age";

// 본인확인 콜백으로 들어올 birthDate(YYYYMMDD)를 만나이/연령대로 변환하는 로직 검증.
// 모든 케이스는 referenceDate를 고정해 "오늘 날짜에 따라 깨지지 않게" 한다.
describe("age utils", () => {
  describe("parseBirthDate", () => {
    it("accepts YYYYMMDD", () => {
      expect(parseBirthDate("19980515")).toEqual({ year: 1998, month: 5, day: 15 });
    });
    it("accepts YYYY-MM-DD", () => {
      expect(parseBirthDate("1998-05-15")).toEqual({ year: 1998, month: 5, day: 15 });
    });
    it("rejects impossible dates", () => {
      expect(parseBirthDate("19980230")).toBeNull(); // 2월 30일
      expect(parseBirthDate("19981301")).toBeNull(); // 13월
      expect(parseBirthDate("19980132")).toBeNull(); // 32일
    });
    it("rejects malformed input", () => {
      expect(parseBirthDate("")).toBeNull();
      expect(parseBirthDate("abc")).toBeNull();
      expect(parseBirthDate("1998051")).toBeNull(); // 7자리
      expect(parseBirthDate(null)).toBeNull();
    });
  });

  describe("calculateAge", () => {
    const ref = new Date("2026-05-14T00:00:00Z");

    it("counts year diff when birthday has passed this year", () => {
      // 1998-05-13: 2026-05-14 기준 생일 하루 지남 → 만 28세
      expect(calculateAge("19980513", ref)).toBe(28);
    });

    it("counts year diff on the exact birthday", () => {
      expect(calculateAge("19980514", ref)).toBe(28);
    });

    it("subtracts 1 when birthday has NOT passed this year", () => {
      // 1998-05-15: 내일이 생일 → 아직 만 27세
      expect(calculateAge("19980515", ref)).toBe(27);
    });

    it("handles December birthdays in May correctly", () => {
      // 1995-12-31: 5월에는 아직 생일 안 지남 → 만 30세
      expect(calculateAge("19951231", ref)).toBe(30);
    });

    it("handles January birthdays in May correctly", () => {
      // 1995-01-01: 1월에 이미 생일 지남 → 만 31세
      expect(calculateAge("19950101", ref)).toBe(31);
    });

    it("returns null on invalid input", () => {
      expect(calculateAge("99999999", ref)).toBeNull();
    });
  });

  describe("calculateAgeGroup", () => {
    const ref = new Date("2026-05-14T00:00:00Z");

    it("buckets teens into 10", () => {
      // 2012-01-01 → 만 14세 → 10대
      expect(calculateAgeGroup("20120101", ref)).toBe(10);
    });
    it("buckets 20s into 20", () => {
      expect(calculateAgeGroup("20000101", ref)).toBe(20); // 만 26
      expect(calculateAgeGroup("19970101", ref)).toBe(20); // 만 29
    });
    it("buckets 30s into 30", () => {
      expect(calculateAgeGroup("19950101", ref)).toBe(30); // 만 31
      expect(calculateAgeGroup("19870101", ref)).toBe(30); // 만 39
    });
    it("buckets 40s into 40", () => {
      expect(calculateAgeGroup("19800101", ref)).toBe(40); // 만 46
    });
    it("buckets 50s into 50", () => {
      expect(calculateAgeGroup("19700101", ref)).toBe(50); // 만 56
    });
    it("caps 60+ at 60", () => {
      expect(calculateAgeGroup("19600101", ref)).toBe(60); // 만 66 → 60+
      expect(calculateAgeGroup("19400101", ref)).toBe(60); // 만 86 → 60+
    });
    it("transitions at decade boundary on birthday", () => {
      // 1996-05-14 → 2026-05-14 정확히 만 30세 → 30대
      expect(calculateAgeGroup("19960514", ref)).toBe(30);
      // 1996-05-15 → 아직 29세 → 20대
      expect(calculateAgeGroup("19960515", ref)).toBe(20);
    });
  });

  describe("normalizeGender", () => {
    it("normalizes various male representations", () => {
      expect(normalizeGender("M")).toBe("M");
      expect(normalizeGender("male")).toBe("M");
      expect(normalizeGender("남")).toBe("M");
      expect(normalizeGender("1")).toBe("M");
    });
    it("normalizes various female representations", () => {
      expect(normalizeGender("F")).toBe("F");
      expect(normalizeGender("female")).toBe("F");
      expect(normalizeGender("여")).toBe("F");
      expect(normalizeGender("2")).toBe("F");
    });
    it("returns null on unknown", () => {
      expect(normalizeGender("X")).toBeNull();
      expect(normalizeGender(null)).toBeNull();
    });
  });
});
