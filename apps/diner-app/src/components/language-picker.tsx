"use client";

import type { ChangeEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SOURCE_LOCALE, SUPPORTED_TRANSLATION_LOCALES } from "@digital-menu/shared";

/** Manual language picker for the diner-facing menu - the diner always has the final say (i18n-scout-m3 captain decision #1). */
export function LanguagePicker({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (next === SOURCE_LOCALE) {
      params.delete("locale");
    } else {
      params.set("locale", next);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <select
      value={currentLocale}
      onChange={handleChange}
      aria-label="Menu language"
      style={{
        fontFamily: "var(--mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--ink)",
        background: "var(--paper)",
        border: "1px solid var(--rule)",
        borderRadius: 999,
        padding: "4px 8px",
        cursor: "pointer",
      }}
    >
      <option value={SOURCE_LOCALE}>English</option>
      {SUPPORTED_TRANSLATION_LOCALES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
