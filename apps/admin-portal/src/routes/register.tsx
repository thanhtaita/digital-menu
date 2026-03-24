import { FormEvent, useState } from "react";
import { apiRegister, type CurrentUser } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Link } from "react-router-dom";

interface Props {
  onRegistered(user: CurrentUser): void;
}

export function RegisterPage({ onRegistered }: Props) {
  const [email, setEmail] = useState("owner@test.com");
  const [password, setPassword] = useState("password123");
  const [displayName, setDisplayName] = useState("Owner");
  const [restaurantName, setRestaurantName] = useState("My Restaurant");
  const [restaurantSlug, setRestaurantSlug] = useState("my-restaurant");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRegister({
        email,
        password,
        displayName,
        restaurantName,
        restaurantSlug
      });
      onRegistered(res.user);
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to register");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Register restaurant admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Email</label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Password</label>
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Display name</label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Restaurant name</label>
              <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Restaurant slug</label>
              <Input value={restaurantSlug} onChange={(e) => setRestaurantSlug(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">
                Used in URLs, e.g. <code>/r/{restaurantSlug}</code>
              </p>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Registering..." : "Register and continue"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="font-medium text-slate-900 underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

