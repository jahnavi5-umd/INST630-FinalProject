import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Shell from "./components/Shell.jsx";
import Splash from "./pages/Splash.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import Discover from "./pages/Discover.jsx";
import Calendar from "./pages/Calendar.jsx";
import Groups from "./pages/Groups.jsx";
import Profile from "./pages/Profile.jsx";
import Admin from "./pages/Admin.jsx";

const SPLASH_MIN_MS = 1800;
const SPLASH_FADE_MS = 450;

function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status !== "authenticated") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function PublicOnly({ children }) {
  const { status } = useAuth();
  if (status === "authenticated") return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { status } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);
  const [splashGone, setSplashGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), SPLASH_MIN_MS);
    return () => clearTimeout(t);
  }, []);

  const ready = minElapsed && status !== "loading";
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSplashGone(true), SPLASH_FADE_MS);
    return () => clearTimeout(t);
  }, [ready]);

  return (
    <>
      {ready && (
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            element={
              <RequireAuth>
                <Shell />
              </RequireAuth>
            }
          >
            <Route index element={<Home />} />
            <Route path="discover" element={<Discover />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="groups" element={<Groups />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
      {!splashGone && <Splash leaving={ready} />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
