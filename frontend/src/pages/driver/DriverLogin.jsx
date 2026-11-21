import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { BusFront, Eye, EyeOff, MapPin, ShieldCheck, ClipboardCheck } from "lucide-react";
import { Alert, Button, FormField } from "../../components/admin-ui/ui";
import { EMAIL_REGEX } from "../../components/admin-ui/format";
import { USE_MOCK, getErrorMessage } from "../../services/admin/http";
import { MOCK_DRIVER_LOGIN } from "../../services/admin/mockDriverTour";
import { loginDriver, restoreSession, useDriverSession } from "../../services/driver/session";
import "./driver-portal.css";

export default function DriverLogin() {
  const { user, status } = useDriverSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { restoreSession(); }, []);
  if (status === "ready" && user) return <Navigate to={location.state?.from || "/driver/dashboard"} replace />;

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setError(""); };

  const submit = async (event) => {
    event.preventDefault();
    const found = {};
    if (!EMAIL_REGEX.test(form.email.trim())) found.email = "Enter a valid email address.";
    if (!form.password) found.password = "Password is required.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setLoading(true);
    try {
      await loginDriver(form.email, form.password);
      navigate(location.state?.from || "/driver/dashboard", { replace: true });
    } catch (e) {
      const code = e?.response?.status;
      setError(code === 429 ? "Too many attempts. Please wait a minute and try again." : getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dp-login">
      <div className="dp-login-side">
        <div className="dp-brand">
          <div className="dp-brand-icon"><BusFront size={26} /></div>
          <div><strong style={{ fontSize: 18 }}>BusPool</strong><div style={{ fontSize: 11, color: "#a9b5ca" }}>Driver Portal</div></div>
        </div>
        <div>
          <h1>Your tours,<br />in your pocket.</h1>
          <p>See your assigned tours, answer requests and share your live location - all from your phone.</p>
          <ul className="dp-login-points">
            <li><ClipboardCheck size={18} /> Accept or reject tour assignments</li>
            <li><MapPin size={18} /> Share GPS while a tour is running</li>
            <li><ShieldCheck size={18} /> Secure, driver-only access</li>
          </ul>
        </div>
        <small style={{ color: "#8fa1c2" }}>© BusPool Management System</small>
      </div>

      <div className="dp-login-main">
        <form className="dp-login-card" onSubmit={submit} noValidate>
          <h2>Driver login</h2>
          <p>Sign in with the email and password given by your administrator.</p>
          {error && <Alert>{error}</Alert>}

          <FormField label="Email" type="email" autoComplete="username" value={form.email} error={errors.email}
            onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
          <div className="dp-pass">
            <FormField label="Password" type={show ? "text" : "password"} autoComplete="current-password" value={form.password}
              error={errors.password} onChange={(e) => set("password", e.target.value)} />
            <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <Button type="submit" loading={loading}>Sign in</Button>

          {USE_MOCK && (
            <div className="dp-demo">
              <strong>Demo mode (no backend connected)</strong>
              {MOCK_DRIVER_LOGIN.email} / {MOCK_DRIVER_LOGIN.password}
            </div>
          )}
          <div className="dp-login-foot">Forgot your password? Please contact the administrator.</div>
        </form>
      </div>
    </div>
  );
}
