import { useQuery } from "@tanstack/react-query";
import { apiListRestaurants } from "../lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Link } from "react-router-dom";

export function RestaurantsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["restaurants"],
    queryFn: apiListRestaurants
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Your restaurants</h1>
        <p className="text-sm text-muted-foreground">
          This is a simple read-only list hitting the Fastify API.
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
              <p className="text-xs text-muted-foreground">Slug: {r.slug}</p>
              {r.description && (
                <p className="mt-1 text-xs text-slate-700 line-clamp-2">{r.description}</p>
              )}
              <Link
                to={`/app/restaurants/${r.id}/builder`}
                className="mt-2 inline-block text-xs font-medium text-blue-700 underline"
              >
                Open menu builder
              </Link>
            </CardContent>
          </Card>
        ))}
        {!isLoading && !error && data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">No restaurants yet. Register with a restaurant or create one via API.</p>
        )}
      </div>
    </div>
  );
}

