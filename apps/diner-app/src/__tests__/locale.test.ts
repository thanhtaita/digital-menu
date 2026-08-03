import { describe, it, expect } from "vitest";
import { inferLocaleFromAcceptLanguage, isKnownLocale } from "@/lib/locale";

describe("isKnownLocale", () => {
  it("accepts codes from the supported list", () => {
    expect(isKnownLocale("fr")).toBe(true);
    expect(isKnownLocale("zh-Hans")).toBe(true);
  });

  it("rejects unsupported codes, the source locale, and empty values", () => {
    expect(isKnownLocale("xx")).toBe(false);
    expect(isKnownLocale("en")).toBe(false);
    expect(isKnownLocale(undefined)).toBe(false);
    expect(isKnownLocale(null)).toBe(false);
    expect(isKnownLocale("")).toBe(false);
  });
});

describe("inferLocaleFromAcceptLanguage", () => {
  it("returns undefined when the header is missing", () => {
    expect(inferLocaleFromAcceptLanguage(null)).toBeUndefined();
  });

  it("maps the first supported primary subtag, ignoring q-values", () => {
    expect(inferLocaleFromAcceptLanguage("vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("vi");
  });

  it("returns undefined (source) when English is the top preference", () => {
    expect(inferLocaleFromAcceptLanguage("en-US,en;q=0.9,fr;q=0.5")).toBeUndefined();
  });

  it("skips unsupported languages and falls through to a supported one", () => {
    expect(inferLocaleFromAcceptLanguage("nl-NL,nl;q=0.9,ja;q=0.5")).toBe("ja");
  });

  it("returns undefined when nothing in the header is supported", () => {
    expect(inferLocaleFromAcceptLanguage("nl-NL,sv;q=0.5")).toBeUndefined();
  });

  it("maps zh to the simplified-Chinese code", () => {
    expect(inferLocaleFromAcceptLanguage("zh-CN,zh;q=0.9")).toBe("zh-Hans");
  });
});
