import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGetRestaurantQr, apiListRestaurants, apiUpdateRestaurant } from "../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";

type QrModalState = { restaurantId: number; name: string; url: string };

export function RestaurantsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["restaurants"],
    queryFn: apiListRestaurants
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  function closeQrModal() {
    if (qrModal) URL.revokeObjectURL(qrModal.url);
    setQrModal(null);
  }

  const qrM = useMutation({
    mutationFn: async (r: { id: number; name: string }) => ({
      restaurantId: r.id,
      name: r.name,
      url: await apiGetRestaurantQr(r.id)
    }),
    onSuccess: (result: QrModalState) => {
      setQrError(null);
      setQrModal(result);
    },
    onError: () => {
      setQrError("Failed to load QR code.");
    }
  });

  const updateM = useMutation({
    mutationFn: ({ id, name, description }: { id: number; name: string; description: string }) =>
      apiUpdateRestaurant(id, { name, description: description.trim() || null }),
    onSuccess: async () => {
      setEditingId(null);
      setEditError(null);
      await queryClient.invalidateQueries({ queryKey: ["restaurants"] });
    },
    onError: (err: unknown) => {
      const e = err as { status?: number; data?: { error?: string } };
      if (e?.status === 409) {
        setEditError("That slug is already taken.");
        return;
      }
      setEditError(e?.data?.error ?? "Failed to save changes.");
    }
  });

  function startEdit(r: { id: number; name: string; description?: string | null }) {
    setEditingId(r.id);
    setEditName(r.name);
    setEditDescription(r.description ?? "");
    setEditError(null);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Your restaurants</h1>
        <p className="text-sm text-muted-foreground">
          Select a restaurant to open its menu builder, or edit its details below.
        </p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && (
        <p className="text-sm text-red-600">
          Failed to load restaurants. Check that the API is running on localhost:3002.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((r) => (
          <Card key={r.id}>
            <CardHeader>
              <CardTitle className="text-base">{r.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {editingId === r.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!editName.trim()) return;
                    updateM.mutate({ id: r.id, name: editName.trim(), description: editDescription });
                  }}
                >
                  <div>
                    <label className="mb-0.5 block text-xs text-slate-500">Name</label>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-slate-500">Description (optional)</label>
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Short description for diners"
                    />
                  </div>
                  {editError && <p className="text-xs text-red-600">{editError}</p>}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={updateM.isPending}>
                      {updateM.isPending ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Slug: {r.slug}</p>
                  {r.description && (
                    <p className="mt-1 text-xs text-slate-700 line-clamp-2">{r.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-3">
                    <Link
                      to={`/app/restaurants/${r.id}/builder`}
                      className="text-xs font-medium text-blue-700 underline"
                    >
                      Open menu builder
                    </Link>
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setQrError(null);
                        qrM.mutate({ id: r.id, name: r.name });
                      }}
                      disabled={qrM.isPending && qrM.variables?.id === r.id}
                      className="text-xs text-slate-500 hover:text-slate-800 hover:underline disabled:opacity-50"
                    >
                      {qrM.isPending && qrM.variables?.id === r.id ? "Loading QR…" : "QR code"}
                    </button>
                  </div>
                  {qrError && qrM.variables?.id === r.id && (
                    <p className="mt-1 text-xs text-red-600">{qrError}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && !error && data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">No restaurants yet. Register with a restaurant or create one via API.</p>
        )}
      </div>
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={closeQrModal} />
          <div className="relative z-10 mx-4 w-full max-w-xs rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-base font-semibold text-slate-900">QR code for {qrModal.name}</h2>
            <p className="mt-1 text-xs text-slate-500">Scan to open this restaurant's menu.</p>
            <img
              src={qrModal.url}
              alt={`QR code linking to ${qrModal.name}'s menu`}
              className="mx-auto mt-4 h-48 w-48"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeQrModal}
                className="rounded border border-slate-200 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <a
                href={qrModal.url}
                download={`qr-restaurant-${qrModal.restaurantId}.png`}
                className="rounded bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-800"
              >
                Download PNG
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
