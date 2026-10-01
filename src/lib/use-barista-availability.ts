import { useCallback, useEffect } from "react";
import {
  BARISTA_AVAILABILITY_MODULE_KEY,
  type BaristaShift,
  upsertBaristaShift,
} from "@/lib/barista-availability";
import { getApiToken, getSocketUrl, isExpressApiConfigured } from "@/lib/api/express-client";
import { EMPTY_MODULE_RECORDS, useModuleRecords } from "@/lib/module-records";

type AvailabilitySocketPayload = {
  type?: string;
  shift?: BaristaShift;
  available?: BaristaShift[];
  anyOnDuty?: boolean;
};

type AvailabilitySocket = {
  on: (event: string, handler: (payload: AvailabilitySocketPayload) => void) => void;
  off: (event: string, handler?: (payload: AvailabilitySocketPayload) => void) => void;
  disconnect: () => void;
};

/**
 * Shared barista duty board (local module records + Express/Socket when API is up).
 */
export function useBaristaAvailability() {
  const { records: shifts, setRecords: setShifts } = useModuleRecords<BaristaShift>(
    BARISTA_AVAILABILITY_MODULE_KEY,
    EMPTY_MODULE_RECORDS,
  );

  const mergeRemoteShifts = useCallback(
    (remote: BaristaShift[]) => {
      if (!remote.length) return;
      setShifts((prev) => {
        let next = [...prev];
        for (const shift of remote) {
          next = upsertBaristaShift(next, shift);
        }
        return next;
      });
    },
    [setShifts],
  );

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!isExpressApiConfigured()) return;
      try {
        const { apiGetBaristaAvailability } = await import("@/lib/api/express-client");
        const result = await apiGetBaristaAvailability();
        if (cancelled) return;
        if (Array.isArray(result.shifts) && result.shifts.length > 0) {
          setShifts(result.shifts);
        } else if (Array.isArray(result.available)) {
          mergeRemoteShifts(result.available);
        }
      } catch {
        // Offline / API down — keep local module records.
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [mergeRemoteShifts, setShifts]);

  useEffect(() => {
    if (!isExpressApiConfigured()) return;
    let socket: AvailabilitySocket | null = null;
    let alive = true;
    const onAvailability = (payload: AvailabilitySocketPayload) => {
      if (payload?.shift) {
        setShifts((prev) => upsertBaristaShift(prev, payload.shift as BaristaShift));
      } else if (Array.isArray(payload?.available)) {
        mergeRemoteShifts(payload.available);
      }
    };

    void (async () => {
      try {
        const mod = await import("socket.io-client");
        if (!alive) return;
        socket = mod.io(getSocketUrl(), {
          transports: ["websocket", "polling"],
          autoConnect: true,
          auth: (() => {
            const token = getApiToken();
            return token ? { token } : undefined;
          })(),
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 800,
          reconnectionDelayMax: 8_000,
        }) as AvailabilitySocket;
        socket.on("barista:availability", onAvailability);
      } catch {
        // Socket optional.
      }
    })();

    return () => {
      alive = false;
      if (socket) {
        try {
          socket.off("barista:availability", onAvailability);
          socket.disconnect();
        } catch {
          // ignore
        }
      }
    };
  }, [mergeRemoteShifts, setShifts]);

  return { shifts, setShifts };
}
