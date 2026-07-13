import { useQuery } from "@tanstack/react-query";
import { apiGetFdcCandidateDetail } from "../lib/api-client";
import { Button } from "./ui/button";
import { fdcDataTypeLabel, resolveUploadAssetUrl } from "../lib/fdc-labels";

type FdcCandidateDetailDialogProps = {
  candidateId: number | null;
  onClose: () => void;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  isMutating: boolean;
};

function NutrientTable({ rows }: { rows: { name: string; unitName: string; amount: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No nutrients recorded for this FDC record.</p>;
  }
  return (
    <div className="max-h-64 overflow-y-auto rounded border">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((n, i) => (
            <tr key={`${n.name}-${i}`} className="border-b last:border-b-0">
              <td className="px-2 py-1 text-slate-700">{n.name}</td>
              <td className="whitespace-nowrap px-2 py-1 text-right font-medium text-slate-900">
                {n.amount} {n.unitName}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FdcCandidateDetailDialog({
  candidateId,
  onClose,
  onAccept,
  onReject,
  isMutating
}: FdcCandidateDetailDialogProps) {
  const detailQ = useQuery({
    queryKey: ["fdc-candidate-detail", candidateId],
    queryFn: () => apiGetFdcCandidateDetail(candidateId!),
    enabled: candidateId != null
  });

  if (candidateId == null) return null;

  const data = detailQ.data;
  const existingNutrients =
    data && data.ingredient.nutrients && typeof data.ingredient.nutrients === "object"
      ? (data.ingredient.nutrients as Record<string, number>)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 mx-4 max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900">Review FDC match</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {detailQ.isLoading && <p className="mt-6 text-sm text-muted-foreground">Loading...</p>}
        {detailQ.isError && (
          <p className="mt-6 text-sm text-red-700">Failed to load match details. Try closing and reopening.</p>
        )}

        {data && (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>
                Match score <span className="font-semibold text-slate-900">{data.candidate.score.toFixed(2)}</span>
              </span>
              {data.candidate.fdcDataType && (
                <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {fdcDataTypeLabel(data.candidate.fdcDataType)}
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Digital Menu ingredient side */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Digital Menu ingredient</h3>
                <dl className="mt-2 space-y-2 text-sm">
                  <div>
                    <dt className="text-xs uppercase text-slate-400">Canonical name</dt>
                    <dd className="text-slate-900">{data.ingredient.canonicalName}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-400">Slug</dt>
                    <dd className="text-slate-700">{data.ingredient.slug}</dd>
                  </div>
                  {data.ingredient.description && (
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Description</dt>
                      <dd className="text-slate-700">{data.ingredient.description}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-xs uppercase text-slate-400">Allergen</dt>
                    <dd className="text-slate-700">
                      {data.ingredient.isCommonAllergen
                        ? `Yes${data.ingredient.commonAllergenGroup ? ` (${data.ingredient.commonAllergenGroup})` : ""}`
                        : "No"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-400">Approval status</dt>
                    <dd className="text-slate-700">{data.ingredient.approvalStatus}</dd>
                  </div>
                  {data.ingredient.aliases.length > 0 && (
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Aliases</dt>
                      <dd className="flex flex-wrap gap-1 text-slate-700">
                        {data.ingredient.aliases.map((a) => (
                          <span key={a.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                            {a.alias}
                            {a.languageCode ? ` (${a.languageCode})` : ""}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  {existingNutrients && Object.keys(existingNutrients).length > 0 && (
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Current nutrients (already saved)</dt>
                      <dd className="flex flex-wrap gap-2 text-slate-700">
                        {Object.entries(existingNutrients).map(([key, value]) => (
                          <span key={key} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                            {key}: {value}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  {data.ingredient.media && data.ingredient.media.length > 0 && (
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Media ({data.ingredient.media.length})</dt>
                      <dd className="mt-1 flex flex-wrap gap-2">
                        {data.ingredient.media.slice(0, 6).map((m) =>
                          m.kind === "image" ? (
                            <img
                              key={m.id}
                              src={resolveUploadAssetUrl(m.url)}
                              alt=""
                              className="h-14 w-14 rounded object-cover"
                            />
                          ) : (
                            <span key={m.id} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                              video
                            </span>
                          )
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* FDC record side */}
              <div>
                <h3 className="text-sm font-semibold text-slate-900">USDA FoodData Central record</h3>
                {data.fdc ? (
                  <dl className="mt-2 space-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Description</dt>
                      <dd className="text-slate-900">{data.fdc.description}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">FDC ID</dt>
                      <dd className="text-slate-700">{data.fdc.fdcId}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Source</dt>
                      <dd className="text-slate-700">{fdcDataTypeLabel(data.fdc.dataType)}</dd>
                    </div>
                    {data.fdc.foodCategory && (
                      <div>
                        <dt className="text-xs uppercase text-slate-400">Food category</dt>
                        <dd className="text-slate-700">{data.fdc.foodCategory}</dd>
                      </div>
                    )}
                    {data.fdc.portions.length > 0 && (
                      <div>
                        <dt className="text-xs uppercase text-slate-400">Household portions</dt>
                        <dd className="mt-1 space-y-1 text-slate-700">
                          {data.fdc.portions.map((p, i) => (
                            <div key={i} className="text-xs">
                              {p.amount ?? ""} {p.unit ?? ""} {p.portionDescription ?? p.modifier ?? ""} →{" "}
                              {p.gramWeight != null ? `${p.gramWeight}g` : "?"}
                            </div>
                          ))}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs uppercase text-slate-400">
                        Full nutrient panel ({data.fdc.nutrients.length})
                      </dt>
                      <dd className="mt-1">
                        <NutrientTable rows={data.fdc.nutrients} />
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-sm text-red-700">
                    This FDC record could no longer be found (the reference data may have been reloaded since this
                    match was queued).
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-red-700"
            disabled={isMutating}
            onClick={() => onReject(candidateId)}
          >
            Reject
          </Button>
          <Button type="button" disabled={isMutating} onClick={() => onAccept(candidateId)}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
