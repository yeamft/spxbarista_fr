import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  createBaristaCall,
  openBaristaCalls,
} from "@/lib/barista-call";
import { getBaristaCallRing } from "@/lib/barista-call-ring";
import { isAnyBaristaOnDuty, onDutyBaristas } from "@/lib/barista-availability";
import { useLang } from "@/lib/lang-context";
import { useBaristaAvailability } from "@/lib/use-barista-availability";
import { useBaristaCalls } from "@/lib/use-barista-calls";
import { showError, showSuccess } from "@/lib/toast";

type CallBaristaButtonProps = {
  location?: string;
  className?: string;
  compact?: boolean;
};

export function CallBaristaButton({
  location = "Service Desk",
  className = "",
  compact = false,
}: CallBaristaButtonProps) {
  const { user, users } = useAuth();
  const lang = useLang();
  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const { calls, createRemoteCall } = useBaristaCalls();
  const { shifts } = useBaristaAvailability();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const baristas = useMemo(() => {
    const onDuty = onDutyBaristas(shifts).map((shift) => shift.baristaName);
    if (onDuty.length > 0) {
      return [...new Set(onDuty)].sort((a, b) => a.localeCompare(b));
    }
    return users
      .filter((staff) => staff.role === "Barista")
      .map((staff) => staff.name)
      .sort((a, b) => a.localeCompare(b));
  }, [shifts, users]);

  const anyOnDuty = isAnyBaristaOnDuty(shifts);

  const myOpenCall = useMemo(() => {
    if (!user) return null;
    return (
      openBaristaCalls(calls).find(
        (call) => call.requestedBy.trim().toLowerCase() === user.name.trim().toLowerCase(),
      ) ?? null
    );
  }, [calls, user]);

  async function placeCall(baristaName: string) {
    if (!user) {
      showError(t("Sign in to call a barista.", "ባሪስታ ለመጥራት ይግቡ።"));
      return;
    }
    if (!anyOnDuty) {
      showError(
        t(
          "No barista is clocked in yet.",
          "እስካሁን ባሪስታ አልገባም።",
        ),
      );
      return;
    }
    if (baristas.length === 0) {
      showError(t("No baristas are set up yet.", "እስካሁን ባሪስታ አልተመዘገበም።"));
      return;
    }
    if (myOpenCall) {
      showError(
        t(
          "Your call is still ringing. Wait for a barista to accept.",
          "ጥሪዎ አሁንም እየደወለ ነው። ባሪስታ እስኪቀበል ይጠብቁ።",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      getBaristaCallRing().unlock();
      const call = createBaristaCall({
        requestedBy: user.name,
        requestedByRole: user.role,
        baristaName,
        location,
        note: t("Assistance requested (no order).", "እገዛ ተጠይቋል (ያለ ትዕዛዝ)።"),
      });
      await createRemoteCall(call);
      showSuccess(
        baristaName
          ? t(`Calling ${baristaName}…`, `${baristaName} እየተደወለ…`)
          : t("Calling available barista…", "የሚገኝ ባሪስታ እየተደወለ…"),
      );
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function onClick() {
    if (myOpenCall) return;
    if (baristas.length <= 1) {
      placeCall(baristas[0] ?? "");
      return;
    }
    setOpen((value) => !value);
  }

  if (myOpenCall) {
    return (
      <div
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-3 text-xs font-semibold text-ember sm:text-sm ${className}`}
        title={t("Waiting for barista to accept", "ባሪስታ እስኪቀበል በመጠባበቅ")}
      >
        <Icons.PhoneCall className="size-3.5 animate-pulse" />
        <span className={compact ? "hidden min-[400px]:inline" : undefined}>
          {t("Calling…", "እየደወለ…")}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        disabled={busy || !anyOnDuty}
        onClick={onClick}
        title={
          anyOnDuty
            ? undefined
            : t("No barista clocked in", "ባሪስታ አልገባም")
        }
        className={
          compact
            ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2.5 text-xs font-semibold text-ember hover:bg-ember/15 disabled:opacity-50 sm:px-3 sm:text-sm"
            : "inline-flex h-9 items-center gap-1.5 rounded-lg bg-ember px-3 text-sm font-medium text-ember-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
        }
      >
        <Icons.BellRing className="size-3.5" />
        <span className={compact ? "hidden min-[400px]:inline" : undefined}>
          {t("Call Barista", "ባሪስታ ጥራ")}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-lift)]">
          <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("Available baristas", "የሚገኙ ባሪስታዎች")}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => placeCall("")}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-surface-2"
          >
            <Icons.Users className="size-3.5 text-muted-foreground" />
            {t("Any available", "ማንኛውም የሚገኝ")}
          </button>
          {baristas.map((name) => (
            <button
              key={name}
              type="button"
              disabled={busy}
              onClick={() => placeCall(name)}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm hover:bg-surface-2"
            >
              <Icons.Coffee className="size-3.5 text-muted-foreground" />
              {name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
