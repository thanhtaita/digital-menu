import { FormEvent, useState } from "react";
import { apiLogin, type CurrentUser } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Link, useLocation } from "react-router-dom";

interface Props {
  onLoggedIn(user: CurrentUser): void;
}

export function LoginPage({ onLoggedIn }: Props) {
  const [email, setEmail] = useState("owner@test.com");
  const [password, setPassword] = useState("password123");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation() as any;
  const from = location.state?.from?.pathname as string | undefined;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiLogin(email, password);
      onLoggedIn(res.user);
    } catch (err: any) {
      setError(err?.data?.error ?? "Failed to log in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Admin login</CardTitle>
        </CardHeader>
        <CardContent>
          {from && (
            <p className="mb-2 text-xs text-muted-foreground">
              Please log in to access <span className="font-medium">{from}</span>.
            </p>
          )}
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            No account yet?{" "}
            <Link to="/register" className="font-medium text-slate-900 underline">
              Register your restaurant
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

