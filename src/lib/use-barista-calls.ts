import { useCallback, useEffect } from "react";
import {
  BARISTA_CALLS_MODULE_KEY,
  type BaristaCall,
} from "@/lib/barista-call";
import {
  apiCreateBaristaCall,
  apiListBaristaCalls,
  apiUpdateBaristaCall,
  getApiToken,
  getSocketUrl,
  isExpressApiConfigured,
} from "@/lib/api/express-client";
import { EMPTY_MODULE_RECORDS, useModuleRecords } from "@/lib/module-records";

type CallSocketPayload = {
  type?: string;
  call?: BaristaCall;
};

/**
 * Barista assistance calls — local module records + Express/Socket when API is up.
 */
export function useBaristaCalls() {
  const { records: calls, setRecords: setCalls } = useModuleRecords<BaristaCall>(
    BARISTA_CALLS_MODULE_KEY,
    EMPTY_MODULE_RECORDS,
  );

  const upsertCall = useCallback(
    (call: BaristaCall) => {
      setCalls((prev) => {
        const without = prev.filter((row) => row.id !== call.id);
        return [call, ...without].slice(0, 100);
      });
    },
    [setCalls],
  );

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      if (!isExpressApiConfigured()) return;
      try {
        const result = await apiListBaristaCalls();
        if (cancelled || !Array.isArray(result.calls)) return;
        setCalls(result.calls);
      } catch {
        // Offline — keep local.
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [setCalls]);

  useEffect(() => {
    if (!isExpressApiConfigured()) return;
    let alive = true;
    let socket: { on: Function; off: Function; disconnect: Function } | null = null;
    const onCall = (payload: CallSocketPayload) => {
      if (payload?.call) upsertCall(payload.call);
    };
    void (async () => {
      try {
        const mod = await import("socket.io-client");
        if (!alive) return;
        const token = getApiToken();
        socket = mod.io(getSocketUrl(), {
          transports: ["websocket", "polling"],
          auth: token ? { token } : undefined,
          reconnection: true,
        });
        socket.on("barista:call", onCall);
      } catch {
        // optional
      }
    })();
    return () => {
      alive = false;
      try {
        socket?.off("barista:call", onCall);
        socket?.disconnect();
      } catch {
        // ignore
      }
    };
  }, [upsertCall]);

  const createRemoteCall = useCallback(
    async (call: BaristaCall) => {
      upsertCall(call);
      if (!isExpressApiConfigured() || !getApiToken()) return call;
      try {
        const result = await apiCreateBaristaCall({
          id: call.id,
          requestedBy: call.requestedBy,
          requestedByRole: call.requestedByRole,
          baristaName: call.baristaName,
          location: call.location,
          note: call.note,
        });
        upsertCall(result.call);
        return result.call;
      } catch {
        return call;
      }
    },
    [upsertCall],
  );

  const acknowledgeRemoteCall = useCallback(
    async (call: BaristaCall, acknowledgedBy: string) => {
      const next: BaristaCall = {
        ...call,
        status: "acknowledged",
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy,
      };
      upsertCall(next);
      if (!isExpressApiConfigured() || !getApiToken()) return next;
      try {
        const result = await apiUpdateBaristaCall(call.id, {
          status: "acknowledged",
          acknowledgedBy,
        });
        upsertCall(result.call);
        return result.call;
      } catch {
        return next;
      }
    },
    [upsertCall],
  );

  return { calls, setCalls, createRemoteCall, acknowledgeRemoteCall, upsertCall };
}
