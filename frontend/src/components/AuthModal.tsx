import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Phone,
  Mail,
  User as UserIcon,
  Lock,
  MapPin,
  ShieldCheck,
  Landmark,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { isValidPhone } from "../lib/format";

type Mode = "login" | "signup";
type LoginTab = "otp" | "password";

interface Props {
  onClose: () => void;
  initialMode?: Mode;
}

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const anyErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
    const detail = anyErr.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
    if (anyErr.message) return anyErr.message;
  }
  return fallback;
}

export default function AuthModal({ onClose, initialMode = "login" }: Props) {
  const { t } = useTranslation();
  const { requestOtp, register, verifyOtp, loginPassword } = useAuth();

  const [mode, setMode] = useState<Mode>(initialMode);
  const [loginTab, setLoginTab] = useState<LoginTab>("otp");
  // signup/otp two-step flow: "form" collects details, "code" verifies the OTP.
  const [step, setStep] = useState<"form" | "code">("form");

  // shared fields
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const codeRef = useRef<HTMLInputElement>(null);

  // Reset transient state whenever the user switches mode/tab.
  function softReset() {
    setStep("form");
    setCode("");
    setError(null);
    setDevOtp(null);
    setBusy(false);
  }

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const profile = useMemo(
    () => ({
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      city: city.trim() || undefined,
    }),
    [name, email, city]
  );

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError(t("auth.fullName"));
      return;
    }
    if (!isValidPhone(phone)) {
      setError(t("auth.enterPhone"));
      return;
    }
    setBusy(true);
    try {
      const res = await register({
        phone: phone.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        password: password.trim() || undefined,
        city: city.trim() || undefined,
      });
      setDevOtp(res.debug_otp);
      setStep("code");
    } catch (err) {
      setError(errorMessage(err, t("common.error")));
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpRequest(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidPhone(phone)) {
      setError(t("auth.enterPhone"));
      return;
    }
    setBusy(true);
    try {
      const res = await requestOtp(phone.trim());
      setDevOtp(res.debug_otp);
      setStep("code");
    } catch (err) {
      setError(errorMessage(err, t("common.error")));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length !== 6) {
      setError(t("auth.enterCode"));
      return;
    }
    setBusy(true);
    try {
      // Send the collected profile on signup so the account is enriched.
      await verifyOtp(phone.trim(), code.trim(), mode === "signup" ? profile : undefined);
      onClose();
    } catch (err) {
      setError(errorMessage(err, t("common.error")));
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password.trim()) {
      setError(t("auth.emailOrPhone"));
      return;
    }
    setBusy(true);
    try {
      await loginPassword(identifier.trim(), password.trim());
      onClose();
    } catch (err) {
      setError(errorMessage(err, t("common.error")));
    } finally {
      setBusy(false);
    }
  }

  const title =
    step === "code"
      ? t("auth.enterCode")
      : mode === "signup"
        ? t("auth.createAccount")
        : t("auth.welcomeBack");

  const subtitle =
    step === "code"
      ? phone
        ? t("auth.codeSent", { phone })
        : t("auth.verifyingAccount")
      : mode === "signup"
        ? t("auth.registerSubtitle")
        : t("common.login");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="relative bg-navy px-6 pb-6 pt-7 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute end-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
          {step === "code" && (
            <button
              type="button"
              onClick={() => softReset()}
              aria-label={t("auth.back")}
              className="absolute start-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4 rtl-flip" />
            </button>
          )}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/70">
            <Landmark className="h-4 w-4" />
            {t("common.appName")}
          </div>
          <h2 className="mt-3 text-2xl font-bold leading-tight">{title}</h2>
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {devOtp && step === "code" && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {t("auth.devOtp", { otp: devOtp })}
            </div>
          )}

          {/* ---------- OTP / verification step ---------- */}
          {step === "code" ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div>
                <label className="label" htmlFor="auth-code">
                  {t("auth.enterCode")}
                </label>
                <input
                  id="auth-code"
                  ref={codeRef}
                  className="input text-center text-2xl font-bold tracking-[0.5em]"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </div>
              <button type="submit" className="btn-green w-full" disabled={busy}>
                {busy ? t("common.loading") : t("auth.verify")}
              </button>
            </form>
          ) : mode === "signup" ? (
            /* ---------- SIGN UP form ---------- */
            <form onSubmit={handleSignupSubmit} className="space-y-4">
              <Field
                id="su-name"
                label={t("auth.fullName")}
                icon={<UserIcon className="h-4 w-4" />}
                value={name}
                onChange={setName}
                autoComplete="name"
                required
              />
              <Field
                id="su-phone"
                label={t("common.phone")}
                icon={<Phone className="h-4 w-4" />}
                value={phone}
                onChange={setPhone}
                type="tel"
                autoComplete="tel"
                placeholder="+216 ..."
                required
              />
              <Field
                id="su-email"
                label={t("auth.emailOptional")}
                icon={<Mail className="h-4 w-4" />}
                value={email}
                onChange={setEmail}
                type="email"
                autoComplete="email"
              />
              <Field
                id="su-city"
                label={`${t("auth.city")} (${t("common.optional")})`}
                icon={<MapPin className="h-4 w-4" />}
                value={city}
                onChange={setCity}
                autoComplete="address-level2"
              />
              <Field
                id="su-password"
                label={`${t("auth.password")} (${t("common.optional")})`}
                icon={<Lock className="h-4 w-4" />}
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="new-password"
                hint={t("auth.passwordHint")}
              />
              <button type="submit" className="btn-green w-full" disabled={busy}>
                {busy ? t("common.loading") : t("auth.createAccountCta")}
              </button>
              <p className="text-center text-sm text-slate-500">
                {t("auth.haveAccount")}{" "}
                <button
                  type="button"
                  className="font-semibold text-navy hover:underline"
                  onClick={() => {
                    setMode("login");
                    softReset();
                  }}
                >
                  {t("auth.switchToLogin")}
                </button>
              </p>
            </form>
          ) : (
            /* ---------- LOG IN ---------- */
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("otp");
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    loginTab === "otp"
                      ? "bg-white text-navy shadow-sm"
                      : "text-slate-500 hover:text-navy"
                  }`}
                >
                  {t("auth.tabOtp")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginTab("password");
                    setError(null);
                  }}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    loginTab === "password"
                      ? "bg-white text-navy shadow-sm"
                      : "text-slate-500 hover:text-navy"
                  }`}
                >
                  {t("auth.tabPassword")}
                </button>
              </div>

              {loginTab === "otp" ? (
                <form onSubmit={handleOtpRequest} className="space-y-4">
                  <Field
                    id="li-phone"
                    label={t("common.phone")}
                    icon={<Phone className="h-4 w-4" />}
                    value={phone}
                    onChange={setPhone}
                    type="tel"
                    autoComplete="tel"
                    placeholder="+216 ..."
                    required
                  />
                  <button type="submit" className="btn-primary w-full" disabled={busy}>
                    {busy ? t("common.loading") : t("auth.sendCode")}
                  </button>
                </form>
              ) : (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <Field
                    id="li-id"
                    label={t("auth.emailOrPhone")}
                    icon={<UserIcon className="h-4 w-4" />}
                    value={identifier}
                    onChange={setIdentifier}
                    autoComplete="username"
                    required
                  />
                  <Field
                    id="li-pw"
                    label={t("auth.password")}
                    icon={<Lock className="h-4 w-4" />}
                    value={password}
                    onChange={setPassword}
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                  <button type="submit" className="btn-primary w-full" disabled={busy}>
                    {busy ? t("common.loading") : t("auth.signInPassword")}
                  </button>
                </form>
              )}

              <p className="text-center text-sm text-slate-500">
                {t("auth.noAccount")}{" "}
                <button
                  type="button"
                  className="font-semibold text-civic-green hover:underline"
                  onClick={() => {
                    setMode("signup");
                    softReset();
                  }}
                >
                  {t("auth.switchToRegister")}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  icon,
  type = "text",
  placeholder,
  autoComplete,
  required,
  hint,
}: FieldProps) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-slate-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`input ${icon ? "ps-9" : ""}`}
        />
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
