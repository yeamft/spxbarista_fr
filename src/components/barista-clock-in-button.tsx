import { useState } from "react";
import * as Icons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  clockInBarista,
  clockOutBarista,
  isBaristaClockedIn,
  upsertBaristaShift,
  type BaristaShift,
} from "@/lib/barista-availability";
import { getSocketUrl, isExpressApiConfigured } from "@/lib/api/express-client";
import { useLang } from "@/lib/lang-context";
import { useBaristaAvailability } from "@/lib/use-barista-availability";
import { emitOrdersSocketEvent } from "@/lib/orders-realtime";
import { showError, showSuccess } from "@/lib/toast";

type BaristaClockInButtonProps = {
  className?: string;
  compact?: boolean;
};

async function broadcastDuty(shift: BaristaShift, type: "clock_in" | "clock_out") {
  if (!isExpressApiConfigured()) return;
  try {
    const mod = await import("socket.io-client");
    const socket = mod.io(getSocketUrl(), {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socket.emit("barista:availability", {
      type,
      shift,
      available: type === "clock_in" ? [shift] : [],
      anyOnDuty: type === "clock_in",
    });
    window.setTimeout(() => socket.disconnect(), 1500);
  } catch {
    // optional
  }
}

export function BaristaClockInButton({
  className = "",
  compact = false,
}: BaristaClockInButtonProps) {
  const { user } = useAuth();
  const lang = useLang();
  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const { shifts, setShifts } = useBaristaAvailability();
  const [busy, setBusy] = useState(false);

  if (!user || user.role !== "Barista") return null;

  const onDuty = isBaristaClockedIn(shifts, user.id);

  async function toggle() {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (onDuty) {
        const existing = shifts.find((s) => s.id === user.id || s.baristaId === user.id);
        const next = clockOutBarista(
          existing ?? clockInBarista({ baristaId: user.id, baristaName: user.name }),
        );
        setShifts((prev) => upsertBaristaShift(prev, next));
        if (isExpressApiConfigured()) {
          try {
            const { apiBaristaClockOut } = await import("@/lib/api/express-client");
            await apiBaristaClockOut(user.id);
          } catch {
            await broadcastDuty(next, "clock_out");
          }
        }
        emitOrdersSocketEvent(
          {
            type: "sync",
            message: t(
              `${user.name} clocked out — Service Desk may pause.`,
              `${user.name} ወጣ — ሰርቪስ ዴስክ ሊቆም ይችላል።`,
            ),
            actor: user.name,
          },
          { toast: false },
        );
        showSuccess(t("You are clocked out.", "ወጥተዋል።"));
      } else {
        const next = clockInBarista({ baristaId: user.id, baristaName: user.name });
        setShifts((prev) => upsertBaristaShift(prev, next));
        if (isExpressApiConfigured()) {
          try {
            const { apiBaristaClockIn } = await import("@/lib/api/express-client");
            await apiBaristaClockIn(user.id, user.name);
          } catch {
            await broadcastDuty(next, "clock_in");
          }
        }
        emitOrdersSocketEvent(
          {
            type: "sync",
            message: t(
              `${user.name} is on duty — Service Desk is open.`,
              `${user.name} ተገኝቷል — ሰርቪስ ዴስክ ክፍት ነው።`,
            ),
            actor: user.name,
          },
          { toast: true },
        );
        showSuccess(
          t("You are clocked in. Staff can place orders.", "ገብተዋል። ሰራተኞች ትዕዛዝ ማስገባት ይችላሉ።"),
        );
      }
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : t("Could not update duty status", "የስራ ሁኔታ ማዘመን አልተቻለም"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      className={
        className ||
        (onDuty
          ? compact
            ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-teff/40 bg-teff/10 px-2.5 text-xs font-semibold text-teff hover:bg-teff/15 disabled:opacity-50 sm:px-3 sm:text-sm"
            : "inline-flex h-9 items-center gap-1.5 rounded-lg bg-teff px-3 text-sm font-medium text-teff-foreground disabled:opacity-50"
          : compact
            ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-ember/40 bg-ember/10 px-2.5 text-xs font-semibold text-ember hover:bg-ember/15 disabled:opacity-50 sm:px-3 sm:text-sm"
            : "inline-flex h-9 items-center gap-1.5 rounded-lg bg-ember px-3 text-sm font-medium text-ember-foreground shadow-[var(--shadow-glow)] disabled:opacity-50")
      }
    >
      {onDuty ? (
        <Icons.LogOut className="size-3.5" />
      ) : (
        <Icons.LogIn className="size-3.5" />
      )}
      <span>
        {onDuty
          ? t("Clock out", "ውጣ")
          : t("Clock in available", "ግባ ተገኝቻለሁ")}
      </span>
    </button>
  );
}
