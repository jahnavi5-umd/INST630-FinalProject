import { useEffect, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import TerpMark, { Wordmark } from "../components/TerpMark.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function useButtonWidth() {
  const calc = () => Math.max(240, Math.min(400, window.innerWidth - 48));
  const [w, setW] = useState(calc);
  useEffect(() => {
    const onResize = () => setW(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
}

export default function Login() {
  const { authConfig, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const width = useButtonWidth();
  const domain = authConfig.allowedDomain || "umd.edu";

  const onSuccess = async ({ credential }) => {
    setError("");
    setBusy(true);
    try {
      await loginWithGoogle(credential);
      const to = location.state?.from;
      navigate(typeof to === "string" && to.startsWith("/") && !to.startsWith("//") ? to : "/", { replace: true });
    } catch (err) {
      setError(err.message);
      window.google?.accounts?.id?.disableAutoSelect?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-screen">
      <section className="login-hero">
        <img src="/images/featured-maryland-day.jpg" alt="Crowd enjoying a live outdoor concert" />
        <div className="login-shade" />
        <div className="brand login-brand">
          <TerpMark />
          <Wordmark />
        </div>
        <div className="login-hero-copy">
          <div className="live-pill">
            <i /> FOR UMD STUDENTS
          </div>
          <h1>
            One campus.
            <br />A thousand ways to explore.
          </h1>
        </div>
      </section>

      <section className="login-sheet">
        <p className="eyebrow">WELCOME, TERPS</p>
        <h2>Sign in to TerpLink</h2>
        <p className="login-sub">Discover campus events, RSVP in one tap and keep your schedule in sync.</p>

        <div className={`google-slot ${busy ? "busy" : ""}`}>
          {authConfig.googleClientId ? (
            <GoogleOAuthProvider clientId={authConfig.googleClientId}>
              <GoogleLogin
                onSuccess={onSuccess}
                onError={() => setError("Google sign-in was cancelled or failed. Please try again.")}
                theme="filled_black"
                shape="pill"
                size="large"
                text="continue_with"
                logo_alignment="center"
                width={String(width)}
                context="signin"
                ux_mode="popup"
              />
            </GoogleOAuthProvider>
          ) : (
            <div className="login-error" role="alert">
              Google OAuth is not configured on the server. Set <code>GOOGLE_CLIENT_ID</code> in{" "}
              <code>server/.env</code> and restart the server.
            </div>
          )}
        </div>

        {busy && <p className="login-status">Signing you in…</p>}
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <p className="login-note">
          <Icon name="shield" size={15} />
          <span>
            Only <b>@{domain}</b> (and <b>@terpmail.{domain}</b>) Google accounts can sign in.
          </span>
        </p>
      </section>
    </div>
  );
}
