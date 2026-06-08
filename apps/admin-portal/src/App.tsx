import { type ReactElement, type ReactNode } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import {
  Home,
  UtensilsCrossed,
  FlaskConical,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { apiLogout } from "./lib/api-client";
import { LoginPage } from "./routes/login";
import { RegisterPage } from "./routes/register";
import { RestaurantsPage } from "./routes/restaurants";
import { MenuBuilderPage } from "./routes/menu-builder";
import { MetaIngredientsPage } from "./routes/meta-ingredients";
import { useAuth } from "./auth-context";
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

  const userInitials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "??";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 232,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--rule)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}>
        {/* Brand */}
        <div style={{
          padding: "20px 18px",
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: "var(--ink)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--display)", fontSize: 15, fontStyle: "italic",
          }}>dM</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.1 }}>Digital Menu</div>
            <div style={{ fontSize: 10.5, color: "var(--inkFaint)", letterSpacing: 0.05, fontFamily: "var(--mono)", textTransform: "uppercase" }}>Admin Portal</div>
          </div>
        </div>

        {/* Restaurant context */}
        {builderRestaurantId && (
          <div style={{ padding: "12px 12px", borderBottom: "1px solid var(--rule)" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: "var(--radius-sm)",
              background: "var(--surfaceAlt)", border: "1px solid var(--rule)",
              cursor: "default",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: "linear-gradient(135deg, oklch(0.55 0.18 265), oklch(0.38 0.16 280))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 13, fontWeight: 600,
              }}>R</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", letterSpacing: -0.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Restaurant #{builderRestaurantId}
                </div>
                <div style={{ fontSize: 11, color: "var(--inkFaint)" }}>Active workspace</div>
              </div>
              <ChevronDown size={13} color="var(--inkFaint)" />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 1 }}>
          <SidebarNavLink to="/app/restaurants" end icon={<Home size={15} />} label="Restaurants" />
          <SidebarNavLink
            to={menuBuilderTo}
            icon={<UtensilsCrossed size={15} />}
            label="Menu builder"
            isActive={menuBuilderIsBuilderRoute ? undefined : false}
          />
          {user?.role === "superadmin" && (
            <SidebarNavLink to="/app/meta/ingredients" icon={<FlaskConical size={15} />} label="Ingredient catalog" />
          )}
        </nav>

        {/* User footer */}
        <div style={{
          padding: "12px 12px",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, oklch(0.65 0.14 265), oklch(0.48 0.18 280))",
            color: "#fff", fontSize: 11, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{userInitials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email ?? "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--inkFaint)", textTransform: "capitalize" }}>
              {user?.role ?? "user"}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            style={{
              all: "unset",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--inkFaint)",
              borderRadius: "var(--radius-sm)",
              padding: 4,
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--ink)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--inkFaint)")}
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 32px" }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function SidebarNavLink({
  to,
  icon,
  label,
  end,
  isActive: forceActive,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  end?: boolean;
  isActive?: boolean | undefined;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      style={({ isActive: routerActive }) => {
        const active = forceActive !== undefined ? forceActive : routerActive;
        return {
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          background: active ? "var(--surfaceSunken)" : "transparent",
          color: active ? "var(--ink)" : "var(--inkMuted)",
          fontSize: 13,
          fontWeight: active ? 600 : 500,
          textDecoration: "none",
          transition: "background .1s, color .1s",
        };
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        if (el.style.background === "transparent") {
          el.style.background = "var(--surfaceAlt)";
        }
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        if (el.style.background === "var(--surfaceAlt)") {
          el.style.background = "transparent";
        }
      }}
    >
      {({ isActive: routerActive }) => {
        const active = forceActive !== undefined ? forceActive : routerActive;
        return (
          <>
            <span style={{ color: active ? "var(--accent)" : "var(--inkMuted)", display: "flex" }}>
              {icon}
            </span>
            <span style={{ flex: 1 }}>{label}</span>
          </>
        );
      }}
    </NavLink>
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
