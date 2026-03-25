import { type ReactElement } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { apiLogout } from "./lib/api-client";
import { LoginPage } from "./routes/login";
import { RegisterPage } from "./routes/register";
import { RestaurantsPage } from "./routes/restaurants";
import { MenuBuilderPage } from "./routes/menu-builder";
import { MetaIngredientsPage } from "./routes/meta-ingredients";
import { useAuth } from "./auth-context";
import { cn } from "./components/utils";
import { getLastRestaurantForBuilder } from "@/lib/last-restaurant";

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function SuperAdminRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || user.role !== "superadmin") {
    return <Navigate to="/app/restaurants" replace />;
  }

  return children;
}

function AppShell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const builderMatch = useMatch("/app/restaurants/:restaurantId/builder");
  const builderRestaurantId = builderMatch?.params.restaurantId;
  const lastRestaurantId = getLastRestaurantForBuilder();

  const menuBuilderTo = builderRestaurantId
    ? `/app/restaurants/${builderRestaurantId}/builder`
    : lastRestaurantId != null
      ? `/app/restaurants/${lastRestaurantId}/builder`
      : "/app/restaurants";
  const menuBuilderIsBuilderRoute = menuBuilderTo.includes("/builder");

  async function handleLogout() {
    await apiLogout();
    navigate("/login", { replace: true });
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-slate-900 text-white"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-6 py-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-6">
          <div className="shrink-0 font-semibold">Digital Menu – Admin</div>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Main">
            <NavLink to="/app/restaurants" end className={navClass}>
              Restaurants
            </NavLink>
            {user?.role === "superadmin" && (
              <NavLink to="/app/meta/ingredients" className={navClass}>
                Ingredient catalog
              </NavLink>
            )}
            {menuBuilderIsBuilderRoute ? (
              <NavLink to={menuBuilderTo} className={navClass}>
                Menu builder
              </NavLink>
            ) : (
              <Link
                to={menuBuilderTo}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
                title="Opens your restaurants list — pick one, then use Open menu builder"
              >
                Menu builder
              </Link>
            )}
          </nav>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Log out
        </button>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { setUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const redirectPath =
    typeof location.state?.from?.pathname === "string" &&
    location.state.from.pathname.startsWith("/app/")
      ? location.state.from.pathname
      : "/app/restaurants";

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginPage
            onLoggedIn={(user) => {
              setUser(user);
              navigate(redirectPath, { replace: true });
            }}
          />
        }
      />
      <Route
        path="/register"
        element={
          <RegisterPage
            onRegistered={(user) => {
              setUser(user);
              navigate(redirectPath, { replace: true });
            }}
          />
        }
      />
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="restaurants" replace />} />
        <Route path="restaurants" element={<RestaurantsPage />} />
        <Route
          path="restaurants/:restaurantId/builder"
          element={<MenuBuilderPage />}
        />
        <Route
          path="meta/ingredients"
          element={
            <SuperAdminRoute>
              <MetaIngredientsPage />
            </SuperAdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/app/restaurants" replace />} />
      </Route>
    </Routes>
  );
}
