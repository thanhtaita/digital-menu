const ADMIN_API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3002/api/v1";

/** Resolves an uploaded media URL (relative API path or absolute) against the API origin. */
export function resolveUploadAssetUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  try {
    return `${new URL(ADMIN_API_BASE).origin}${url}`;
  } catch {
    return url;
  }
}

const FDC_DATA_TYPE_LABELS: Record<string, string> = {
  foundation_food: "Foundation",
  sr_legacy_food: "SR Legacy",
  survey_fndds_food: "Survey (FNDDS)"
};

/** Human-readable label for an fdc.food.data_type value (e.g. "sr_legacy_food" -> "SR Legacy"). */
export function fdcDataTypeLabel(dataType: string): string {
  return FDC_DATA_TYPE_LABELS[dataType] ?? dataType;
}
