import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { findUserByPin, isValidStaffPin, loadUsers, STAFF_PIN_LENGTH } from "@/lib/users";
import { loadRestaurantProfile } from "@/lib/brand";
import { SEATING_AREAS } from "@/lib/demo-data";
import { useLang, useSetLang } from "@/lib/lang-context";

export const Route = createFileRoute("/login")({ component: LoginPage });

const EMPTY_POS_SEARCH = {
  table: undefined,
  area: undefined,
  waiter: undefined,
  orderId: undefined,
  mode: undefined,
} as const;

type Panel = "login" | "guest" | "register";
type RegisterStep = "pin" | "confirm" | "name" | "welcome";

function LoginPage() {
  const { login, users, loading, addUser, signInWithPasswordOnly } = useAuth();
  const navigate = useNavigate();
  const [restaurantProfile, setRestaurantProfile] = useState(() => loadRestaurantProfile());
  const lang = useLang();
  const setLang = useSetLang();
  const [dark, setDark] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [panel, setPanel] = useState<Panel>("login");
  const [pin, setPin] = useState("");
  const [registerPin, setRegisterPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("pin");
  const [registerName, setRegisterName] = useState("");
  const [welcomeName, setWelcomeName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);

  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const identifiedUser = useMemo(
    () => (panel === "login" && isValidStaffPin(pin) ? findUserByPin(pin, users) : null),
    [panel, pin, users],
  );

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const nextDark =
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    setPreferencesReady(true);
    requestAnimationFrame(() => setMounted(true));
  }, []);

  useEffect(() => {
    setRestaurantProfile(loadRestaurantProfile());
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark, preferencesReady]);

  useEffect(() => {
    if (panel !== "login" || !isValidStaffPin(pin)) return;
    let cancelled = false;
    setLoginBusy(true);
    void (async () => {
      const result = await signInWithPasswordOnly(pin);
      if (cancelled) return;
      if (result.ok) {
        navigate({ to: "/app" });
        return;
      }
      triggerError(result.error || t("Wrong PIN.", "የተሳሳተ PIN።"));
      setPin("");
      setLoginBusy(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-auth when PIN digits complete
  }, [navigate, panel, pin, signInWithPasswordOnly]);

  useEffect(() => {
    if (panel !== "register" || registerStep !== "pin" || !isValidStaffPin(registerPin)) return;
    if (findUserByPin(registerPin, users) || findUserByPin(registerPin, loadUsers())) {
      triggerError(t("That PIN is already taken.", "ያ PIN አስቀድሞ ተይዟል።"));
      setRegisterPin("");
      return;
    }
    setError("");
    setConfirmPin("");
    setRegisterStep("confirm");
  }, [panel, registerPin, registerStep, users]);

  useEffect(() => {
    if (panel !== "register" || registerStep !== "confirm" || !isValidStaffPin(confirmPin)) return;
    if (confirmPin !== registerPin) {
      triggerError(t("PINs do not match. Try again.", "PIN አይዛመድም። እንደገና ይሞክሩ።"));
      setConfirmPin("");
      return;
    }
    if (findUserByPin(registerPin, users) || findUserByPin(registerPin, loadUsers())) {
      triggerError(t("That PIN is already taken.", "ያ PIN አስቀድሞ ተይዟል።"));
      setRegisterPin("");
      setConfirmPin("");
      setRegisterStep("pin");
      return;
    }
    setError("");
    setRegisterStep("name");
  }, [confirmPin, panel, registerPin, registerStep, users]);

  useEffect(() => {
    if (panel !== "register" || registerStep !== "welcome") return;
    const timer = window.setTimeout(() => {
      navigate({ to: "/app/pos", search: EMPTY_POS_SEARCH });
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [navigate, panel, registerStep]);

  function triggerError(msg: string) {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  function resetRegister() {
    setRegisterPin("");
    setConfirmPin("");
    setRegisterName("");
    setRegisterStep("pin");
    setError("");
  }

  function openRegister() {
    resetRegister();
    setPanel("register");
    setPin("");
  }

  function backToLogin() {
    setPanel("login");
    resetRegister();
    setPin("");
    setError("");
  }

  function updatePinValue(raw: string) {
    setError("");
    const next = raw.replace(/\D/g, "").slice(0, STAFF_PIN_LENGTH);
    if (panel === "register" && registerStep === "confirm") {
      setConfirmPin(next);
      return;
    }
    if (panel === "register" && registerStep === "pin") {
      setRegisterPin(next);
      return;
    }
    setPin(next);
  }

  async function finishRegister(e: React.FormEvent) {
    e.preventDefault();
    const name = registerName.trim();
    if (!name) {
      triggerError(t("Enter your name.", "ስምዎን ያስገቡ።"));
      return;
    }
    if (!isValidStaffPin(registerPin)) {
      triggerError(t("Choose a valid PIN first.", "መጀመሪያ ትክክለኛ PIN ይምረጡ።"));
      setRegisterStep("pin");
      return;
    }
    if (findUserByPin(registerPin, users) || findUserByPin(registerPin, loadUsers())) {
      triggerError(t("That PIN is already taken.", "ያ PIN አስቀድሞ ተይዟል።"));
      setRegisterPin("");
      setConfirmPin("");
      setRegisterStep("pin");
      return;
    }
    setBusy(true);
    try {
      const result = await addUser({
        name,
        role: "User",
        branch: "Main Office",
        password: registerPin,
      });
      if (!result.ok) {
        const pinConflict = /already in use|already taken/i.test(result.error);
        triggerError(
          pinConflict
            ? t("That PIN is already taken.", "ያ PIN አስቀድሞ ተይዟል።")
            : result.error,
        );
        if (pinConflict) {
          setRegisterPin("");
          setConfirmPin("");
          setRegisterStep("pin");
        }
        return;
      }
      login(result.user);
      setWelcomeName(result.user.name);
      setRegisterStep("welcome");
    } finally {
      setBusy(false);
    }
  }

  function startGuest(area: string) {
    navigate({ to: "/guest", search: { area } });
  }

  const subtitle =
    panel === "guest"
      ? t("Choose your location", "ቦታዎን ይምረጡ")
      : panel === "register" && registerStep === "pin"
        ? t("Pick a 2-digit PIN", "የ2 አሃዝ PIN ይምረጡ")
        : panel === "register" && registerStep === "confirm"
          ? t("Confirm your PIN", "PINዎን ያረጋግጡ")
          : panel === "register" && registerStep === "name"
            ? t("What should we call you?", "ምን እንበልዎት?")
            : panel === "register" && registerStep === "welcome"
              ? t("You're all set", "ሁሉም ዝግጁ ነው")
              : t("Enter your 2-digit staff PIN", "የ2 አሃዝ የሰራተኛ PIN ያስገቡ");

  return (
    <div className="relative flex min-h-dvh min-h-screen flex-col items-center justify-center overflow-hidden px-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,oklch(0.62_0.19_35/0.16)_0%,transparent_55%),radial-gradient(ellipse_at_80%_80%,oklch(0.45_0.12_150/0.12)_0%,transparent_55%)]" />
      <div className="absolute inset-0" style={{ background: "var(--color-background)", opacity: 0.72 }} />

      <div
        className="absolute top-3 right-3 z-10 flex items-center gap-1.5"
        style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.4s" }}
      >
        <div className="flex rounded-lg border border-border/60 bg-card/80 p-0.5 text-[11px] backdrop-blur-sm">
          {(["en", "am"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`min-w-8 h-7 rounded-md px-2 font-medium ${
                lang === l ? "bg-ember text-ember-foreground" : "text-muted-foreground"
              }`}
            >
              {l === "en" ? "EN" : "አማ"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="size-8 grid place-items-center rounded-lg border border-border/60 bg-card/80 text-muted-foreground"
          aria-label={dark ? t("Light mode", "ብርሃን ሁነታ") : t("Dark mode", "ጨለማ ሁነታ")}
        >
          {dark ? <Icons.Sun className="size-3.5" /> : <Icons.Moon className="size-3.5" />}
        </button>
      </div>

      <div
        className={`relative z-10 w-full max-w-[400px] ${shake ? "animate-[loginShake_0.5s_ease-in-out]" : ""}`}
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0) scale(1)" : "translateY(24px) scale(0.97)",
          transition: "opacity 0.6s 0.15s cubic-bezier(0.22,1,0.36,1), transform 0.6s 0.15s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="rounded-2xl border border-border/60 bg-card/90 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8">
          <div className="mb-6 text-center">
            {panel === "register" && registerStep === "welcome" ? (
              <div
                className="mx-auto mb-3 size-16 grid place-items-center rounded-full bg-teff/15 text-teff animate-[welcomePop_0.45s_cubic-bezier(0.22,1,0.36,1)]"
                aria-hidden
              >
                <svg viewBox="0 0 52 52" className="size-10" fill="none">
                  <circle
                    className="success-circle"
                    cx="26"
                    cy="26"
                    r="22"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <path
                    className="success-check"
                    d="M16 27.5 L23 34.5 L37 18.5"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : (
              <img
                src={restaurantProfile.logoUrl}
                alt=""
                className="mx-auto mb-3 size-14 rounded-2xl border border-border object-cover"
              />
            )}
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              {restaurantProfile.name || "spx Service Desk"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            {panel === "register" && registerStep !== "welcome" ? (
              <div className="mt-3 flex justify-center gap-1.5">
                {(["pin", "confirm", "name"] as const).map((step, index) => {
                  const current =
                    registerStep === "pin" ? 0 : registerStep === "confirm" ? 1 : 2;
                  return (
                    <span
                      key={step}
                      className={`h-1.5 w-8 rounded-full transition-colors ${
                        index <= current ? "bg-ember" : "bg-border"
                      }`}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>

          {panel === "guest" ? (
            <div className="space-y-3">
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {SEATING_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => startGuest(area)}
                    className="flex h-11 w-full items-center justify-between rounded-xl border border-border bg-background/80 px-3 text-left text-sm font-medium hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Icons.MapPin className="size-4 shrink-0 text-ember" />
                      {area}
                    </span>
                    <Icons.ChevronRight className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={backToLogin}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-surface-2"
              >
                <Icons.ArrowLeft className="size-4" />
                {t("Staff login", "የሰራተኛ መግቢያ")}
              </button>
            </div>
          ) : panel === "register" && registerStep === "welcome" ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center animate-[welcomeIn_0.7s_ease-out]">
              <div className="font-display text-xl font-semibold">
                {t("Welcome", "እንኳን ደህና መጡ")}, {welcomeName.split(" ")[0]}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("Opening Service Desk…", "ሰርቪስ ዴስክ በመከፈት ላይ…")}
              </p>
            </div>
          ) : panel === "register" && registerStep === "name" ? (
            <form onSubmit={(e) => void finishRegister(e)} className="space-y-4">
              <input
                autoFocus
                value={registerName}
                onChange={(e) => {
                  setRegisterName(e.target.value);
                  setError("");
                }}
                placeholder={t("Your full name", "ሙሉ ስምዎ")}
                className="h-12 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none focus:ring-2 focus:ring-ember/40"
              />
              {error ? (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <Icons.AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={busy || !registerName.trim()}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember text-sm font-semibold text-ember-foreground disabled:opacity-40"
              >
                {busy ? (
                  <Icons.Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icons.Check className="size-4" />
                )}
                {t("Create account", "መለያ ፍጠር")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmPin("");
                  setRegisterStep("confirm");
                  setError("");
                }}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-surface-2"
              >
                <Icons.ArrowLeft className="size-4" />
                {t("Back", "ተመለስ")}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <input
                key={`${panel}-${registerStep}`}
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={STAFF_PIN_LENGTH}
                value={
                  panel === "register" && registerStep === "confirm"
                    ? confirmPin
                    : panel === "register"
                      ? registerPin
                      : pin
                }
                onChange={(e) => updatePinValue(e.target.value)}
                placeholder={t("Enter PIN", "PIN ያስገቡ")}
                className="h-12 w-full rounded-xl border border-border bg-background/80 px-3 text-center font-mono text-lg tracking-[0.45em] outline-none focus:ring-2 focus:ring-ember/40"
              />

              {error ? (
                <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <Icons.AlertCircle className="size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {panel === "login" && identifiedUser ? (
                <div className="flex items-center gap-3 rounded-xl border border-teff/30 bg-teff/5 px-3.5 py-2.5">
                  <div className="size-9 rounded-full bg-ember/15 text-ember grid place-items-center text-xs font-bold shrink-0">
                    {identifiedUser.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{identifiedUser.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{identifiedUser.role}</div>
                  </div>
                  <Icons.CheckCircle2 className="size-4 shrink-0 text-teff" />
                </div>
              ) : null}

              {panel === "login" ? (
                <>
                  <button
                    type="button"
                    disabled={loading || loginBusy || !isValidStaffPin(pin)}
                    onClick={() => {
                      if (!isValidStaffPin(pin) || loginBusy) return;
                      setLoginBusy(true);
                      void signInWithPasswordOnly(pin).then((result) => {
                        if (result.ok) {
                          navigate({ to: "/app" });
                          return;
                        }
                        triggerError(result.error || t("Wrong PIN.", "የተሳሳተ PIN።"));
                        setPin("");
                        setLoginBusy(false);
                      });
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember text-sm font-semibold text-ember-foreground disabled:opacity-40"
                  >
                    {loading || loginBusy ? (
                      <Icons.Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Icons.LogIn className="size-4" />
                    )}
                    {t("Sign in", "ግባ")}
                  </button>
                  <button
                    type="button"
                    onClick={openRegister}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-ember/40 bg-ember/10 text-sm font-medium text-ember hover:bg-ember/15"
                  >
                    <Icons.UserPlus className="size-4" />
                    {t("First time? Register", "ለመጀመሪያ ጊዜ? ይመዝገቡ")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPanel("guest");
                      setError("");
                    }}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/80 text-sm font-medium hover:bg-surface-2"
                  >
                    <Icons.UserRound className="size-4" />
                    {t("Guest order", "የእንግዳ ትዕዛዝ")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (registerStep === "confirm") {
                      setRegisterPin("");
                      setConfirmPin("");
                      setRegisterStep("pin");
                      setError("");
                      return;
                    }
                    backToLogin();
                  }}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-surface-2"
                >
                  <Icons.ArrowLeft className="size-4" />
                  {registerStep === "confirm"
                    ? t("Choose another PIN", "ሌላ PIN ይምረጡ")
                    : t("Staff login", "የሰራተኛ መግቢያ")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes loginShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        @keyframes welcomeIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes welcomePop {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes successCircleDraw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes successCheckDraw {
          to { stroke-dashoffset: 0; }
        }
        .success-circle {
          stroke-dasharray: 140;
          stroke-dashoffset: 140;
          animation: successCircleDraw 0.55s ease-out forwards;
        }
        .success-check {
          stroke-dasharray: 48;
          stroke-dashoffset: 48;
          animation: successCheckDraw 0.35s 0.45s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
