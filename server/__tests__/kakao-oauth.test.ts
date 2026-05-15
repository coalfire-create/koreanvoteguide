import { describe, expect, it } from "vitest";
import { mapKakaoAgeRange, mapKakaoGender, mapKakaoBirthYear } from "../utils/kakao-oauth";

// Kakao /v2/user/me 응답의 kakao_account 필드를 우리 DB 컬럼으로 매핑하는 로직 검증.
describe("kakao-oauth mappers", () => {
  describe("mapKakaoAgeRange", () => {
    it("buckets teens (both 10~14 and 15~19) into 10", () => {
      expect(mapKakaoAgeRange("10~14")).toBe(10);
      expect(mapKakaoAgeRange("15~19")).toBe(10);
    });
    it("maps 20s/30s/40s/50s directly", () => {
      expect(mapKakaoAgeRange("20~29")).toBe(20);
      expect(mapKakaoAgeRange("30~39")).toBe(30);
      expect(mapKakaoAgeRange("40~49")).toBe(40);
      expect(mapKakaoAgeRange("50~59")).toBe(50);
    });
    it("caps 60+ into 60", () => {
      expect(mapKakaoAgeRange("60~69")).toBe(60);
      expect(mapKakaoAgeRange("70~79")).toBe(60);
      expect(mapKakaoAgeRange("80~89")).toBe(60);
      expect(mapKakaoAgeRange("90~")).toBe(60);
    });
    it("rejects under-10 (앱 가입 차단)", () => {
      expect(mapKakaoAgeRange("0~9")).toBeNull();
    });
    it("returns null when scope was rejected", () => {
      expect(mapKakaoAgeRange(undefined)).toBeNull();
      expect(mapKakaoAgeRange(null)).toBeNull();
      expect(mapKakaoAgeRange("")).toBeNull();
    });
  });

  describe("mapKakaoGender", () => {
    it("maps male/female to M/F", () => {
      expect(mapKakaoGender("male")).toBe("M");
      expect(mapKakaoGender("female")).toBe("F");
    });
    it("returns null for unknown or missing", () => {
      expect(mapKakaoGender(undefined)).toBeNull();
      expect(mapKakaoGender("other")).toBeNull();
    });
  });

  describe("mapKakaoBirthYear", () => {
    it("parses YYYY string", () => {
      expect(mapKakaoBirthYear("1998")).toBe(1998);
    });
    it("rejects out-of-range or malformed", () => {
      expect(mapKakaoBirthYear("99")).toBeNull();
      expect(mapKakaoBirthYear("abcd")).toBeNull();
      expect(mapKakaoBirthYear(undefined)).toBeNull();
    });
  });
});
