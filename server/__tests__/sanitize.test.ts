import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeText } from "../utils/sanitize";

describe("sanitizeHtml", () => {
  it("removes script tags entirely", () => {
    expect(sanitizeHtml("<p>hi</p><script>alert(1)</script>")).toBe("<p>hi</p>");
  });
  it("strips on* event handlers", () => {
    const out = sanitizeHtml('<a href="https://x.com" onclick="bad()">x</a>');
    expect(out).not.toContain("onclick");
    expect(out).toContain('href="https://x.com"');
  });
  it("rejects javascript: scheme on href", () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript");
  });
  it("allows youtube iframe, drops others", () => {
    const ok = sanitizeHtml('<iframe src="https://www.youtube.com/embed/abc"></iframe>');
    expect(ok).toContain("youtube.com/embed/abc");
    const bad = sanitizeHtml('<iframe src="https://evil.com/x"></iframe>');
    expect(bad).not.toContain("evil.com");
  });
  it("keeps safe inline styles only", () => {
    const out = sanitizeHtml('<span style="color: red; expression(alert(1))">x</span>');
    expect(out).toContain("color: red");
    expect(out).not.toContain("expression");
  });
});

describe("sanitizeText", () => {
  it("strips tags", () => {
    expect(sanitizeText("<b>hi</b><script>x</script>")).toBe("hix");
  });
  it("enforces max length", () => {
    expect(sanitizeText("a".repeat(5000), 100).length).toBe(100);
  });
});
