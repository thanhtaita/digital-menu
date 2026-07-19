export function SearchBox({ defaultValue }: { defaultValue?: string }) {
  return (
    <form
      action="/search"
      method="GET"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid var(--rule)",
        borderRadius: 999,
        padding: "6px 6px 6px 14px",
        background: "var(--paper)"
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        style={{ color: "var(--inkFaint)", flexShrink: 0 }}
      >
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11.5 11.5L15 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search dishes and restaurants…"
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "var(--ui)",
          fontSize: 13,
          color: "var(--ink)"
        }}
      />
      <button
        type="submit"
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--paper)",
          background: "var(--ink)",
          border: "none",
          borderRadius: 999,
          padding: "6px 14px",
          cursor: "pointer"
        }}
      >
        Search
      </button>
    </form>
  );
}
