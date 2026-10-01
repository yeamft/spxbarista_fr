import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Card, PageHeader } from "@/components/ui-kit";
import { useAuth } from "@/lib/auth-context";
import {
  apiCreateStation,
  apiDeleteStation,
  apiListStations,
  apiUpdateStation,
  isExpressApiConfigured,
  type ApiStation,
} from "@/lib/api/express-client";
import { useT } from "@/lib/i18n";
import { showError, showSuccess } from "@/lib/toast";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/app/stations")({ component: StationsRoute });

function StationsRoute() {
  const t = useT();
  const { user } = useAuth();
  const store = useStore();
  const canManage =
    user?.role === "Administrator" ||
    user?.role === "Branch Manager" ||
    user?.role === "Supervisor";

  const [remoteStations, setRemoteStations] = useState<ApiStation[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const localStations = store.menuStations;
  const stations = useMemo(() => {
    if (remoteStations.length) {
      return remoteStations.map((row) => ({ id: row.id, name: row.name, remote: true as const }));
    }
    return localStations.map((station) => ({ id: station, name: station, remote: false as const }));
  }, [localStations, remoteStations]);

  async function refreshRemote() {
    if (!isExpressApiConfigured()) return;
    try {
      const result = await apiListStations();
      setRemoteStations(result.stations);
      for (const station of result.stations) {
        store.addMenuStation(station.name);
      }
    } catch (error) {
      console.warn("Failed to load stations from API", error);
    }
  }

  useEffect(() => {
    void refreshRemote();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (!value || !canManage) return;
    setBusy(true);
    try {
      if (isExpressApiConfigured()) {
        await apiCreateStation(value);
        await refreshRemote();
      } else {
        store.addMenuStation(value);
      }
      setName("");
      showSuccess(t("Station added", "ጣቢያ ተጨመረ"));
    } catch (error) {
      showError(error instanceof Error ? error.message : t("Could not add station", "ጣቢያ ማከል አልተቻለም"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string, currentName: string) {
    const next = editName.trim();
    if (!next || !canManage) return;
    setBusy(true);
    try {
      if (isExpressApiConfigured() && remoteStations.some((row) => row.id === id)) {
        await apiUpdateStation(id, { name: next });
        await refreshRemote();
      } else {
        store.renameMenuStation(currentName, next);
      }
      setEditingId(null);
      showSuccess(t("Station renamed", "ጣቢያ ተሰይሟል"));
    } catch (error) {
      showError(error instanceof Error ? error.message : t("Could not rename station", "ጣቢያ መሰየም አልተቻለም"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string, currentName: string) {
    if (!canManage) return;
    if (!window.confirm(t(`Remove ${currentName}?`, `${currentName} ይወገድ?`))) return;
    setBusy(true);
    try {
      if (isExpressApiConfigured() && remoteStations.some((row) => row.id === id)) {
        await apiDeleteStation(id);
        await refreshRemote();
      } else {
        store.removeMenuStation(currentName);
      }
      showSuccess(t("Station removed", "ጣቢያ ተወገደ"));
    } catch (error) {
      showError(error instanceof Error ? error.message : t("Could not remove station", "ጣቢያ ማስወገድ አልተቻለም"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("Station Management", "የጣቢያ አስተዳደር")}
        subtitle={t(
          "Manage serving locations used on tickets and Service Desk",
          "በቲኬቶችና በሰርቪስ ዴስክ ጥቅም ላይ የሚውሉ የአገልግሎት ቦታዎችን ያስተዳድሩ",
        )}
      />

      {canManage ? (
        <Card className="p-4">
          <form onSubmit={handleAdd} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("New station name", "አዲስ የጣቢያ ስም")}
              className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-ember px-4 text-sm font-semibold text-ember-foreground disabled:opacity-50"
            >
              <Icons.Plus className="size-4" />
              {t("Add station", "ጣቢያ ጨምር")}
            </button>
          </form>
        </Card>
      ) : null}

      <Card className="!p-0 overflow-hidden">
        <div className="divide-y divide-border">
          {stations.map((station) => (
            <div key={station.id} className="flex items-center gap-3 px-4 py-3">
              <div className="grid size-9 place-items-center rounded-lg bg-surface-2 text-ember">
                <Icons.MapPin className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                {editingId === station.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-card px-2 text-sm"
                    autoFocus
                  />
                ) : (
                  <div className="truncate text-sm font-semibold">{station.name}</div>
                )}
              </div>
              {canManage ? (
                <div className="flex items-center gap-1">
                  {editingId === station.id ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRename(station.id, station.name)}
                        className="rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-surface-2"
                      >
                        {t("Save", "አስቀምጥ")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-surface-2"
                      >
                        {t("Cancel", "ሰርዝ")}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(station.id);
                          setEditName(station.name);
                        }}
                        className="rounded-lg border border-border p-2 hover:bg-surface-2"
                        aria-label={t("Rename", "እንደገና ሰይም")}
                      >
                        <Icons.Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || stations.length <= 1}
                        onClick={() => void handleRemove(station.id, station.name)}
                        className="rounded-lg border border-border p-2 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                        aria-label={t("Remove", "አስወግድ")}
                      >
                        <Icons.Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {!stations.length ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t("No stations yet.", "ገና ጣቢያ የለም።")}
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
