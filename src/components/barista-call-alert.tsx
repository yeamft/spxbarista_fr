import { useEffect, useMemo } from "react";
import * as Icons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  openCallsForBarista,
  type BaristaCall,
} from "@/lib/barista-call";
import { getBaristaCallRing } from "@/lib/barista-call-ring";
import { useLang } from "@/lib/lang-context";
import { useBaristaCalls } from "@/lib/use-barista-calls";
import { showSuccess } from "@/lib/toast";

function canReceiveCalls(role: string | undefined) {
  return (
    role === "Barista" ||
    role === "Administrator" ||
    role === "Manager" ||
    role === "Branch Manager" ||
    role === "Supervisor" ||
    role === "Coffee House Staff"
  );
}

/**
 * Full-screen-style call banner + repeating ring until the barista accepts.
 */
export function BaristaCallAlert() {
  const { user } = useAuth();
  const lang = useLang();
  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const { calls, acknowledgeRemoteCall } = useBaristaCalls();

  const openCalls = useMemo(() => {
    if (!user || !canReceiveCalls(user.role)) return [];
    if (user.role === "Barista") return openCallsForBarista(calls, user.name);
    return openCallsForBarista(calls, "");
  }, [calls, user]);

  const primary = openCalls[0] ?? null;
  const ringing = openCalls.length > 0;

  useEffect(() => {
    const ring = getBaristaCallRing();
    if (!ringing) {
      ring.stop();
      return;
    }
    const unlock = () => ring.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    ring.start();
    return () => {
      window.removeEventListener("pointerdown", unlock);
      ring.stop();
    };
  }, [ringing]);

  async function accept(call: BaristaCall) {
    if (!user) return;
    await acknowledgeRemoteCall(call, user.name);
    getBaristaCallRing().stop();
    showSuccess(t("Call accepted — on the way.", "ጥሪ ተቀባይነት አግኝቷል — በመንገድ ላይ።"));
  }

  if (!primary || !user) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[80] p-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[380px] sm:p-0"
      role="alertdialog"
      aria-live="assertive"
      aria-label={t("Incoming barista call", "የባሪስታ ጥሪ")}
    >
      <div className="overflow-hidden rounded-2xl border border-ember/40 bg-card shadow-[var(--shadow-lift)] ring-2 ring-ember/30">
        <div className="flex items-center gap-3 bg-ember px-4 py-3 text-ember-foreground">
          <div className="relative grid size-10 place-items-center rounded-full bg-white/15">
            <Icons.PhoneIncoming className="size-5 animate-pulse" />
            <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-wide opacity-90">
              {t("Incoming call", "ገቢ ጥሪ")}
              {openCalls.length > 1 ? ` · ${openCalls.length}` : ""}
            </div>
            <div className="truncate font-display text-base font-bold">
              {primary.requestedBy}
            </div>
          </div>
          <Icons.BellRing className="size-5 shrink-0 animate-bounce" />
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="text-sm">
            <div className="font-medium">
              {primary.location || t("Service Desk", "ሰርቪስ ዴስክ")}
            </div>
            {primary.note ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{primary.note}</div>
            ) : null}
          </div>

          {openCalls.length > 1 ? (
            <div className="space-y-1.5 border-t border-border pt-2">
              {openCalls.slice(1, 4).map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span className="truncate">
                    {call.requestedBy} · {call.location}
                  </span>
                  <button
                    type="button"
                    onClick={() => accept(call)}
                    className="shrink-0 font-semibold text-ember hover:underline"
                  >
                    {t("Accept", "ተቀበል")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => accept(primary)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember text-sm font-semibold text-ember-foreground hover:opacity-95"
          >
            <Icons.Phone className="size-4" />
            {t("Accept call", "ጥሪ ተቀበል")}
          </button>
        </div>
      </div>
    </div>
  );
}
