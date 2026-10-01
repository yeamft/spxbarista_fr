import { useMemo, useState, type FormEvent } from "react";
import * as Icons from "lucide-react";
import { useT } from "@/lib/i18n";
import { activeBranchNames, loadCachedBranches } from "@/lib/branches";
import { isValidStaffPin, STAFF_PIN_LENGTH, USER_ROLES } from "@/lib/users";
import type { AuthUser, AuthUserInput, UserRole } from "@/lib/auth-context";

export type StaffUserModalProps = {
  branch: string;
  authMode: "demo";
  user?: AuthUser;
  onClose: () => void;
  onSave: (input: AuthUserInput) => Promise<string | null>;
};

export function StaffUserModal({ branch, authMode: _authMode, user, onClose, onSave }: StaffUserModalProps) {
  const t = useT();
  const branchOptions = useMemo(() => {
    const configured = activeBranchNames(loadCachedBranches());
    const current = (user?.branch ?? branch).trim();
    if (current && !configured.includes(current)) return [...configured, current].sort((a, b) => a.localeCompare(b));
    return configured;
  }, [branch, user?.branch]);
  const [form, setForm] = useState<AuthUserInput>({
    email: user?.email ?? "",
    name: user?.name ?? "",
    role: (user?.role as UserRole) ?? "User",
    branch: user?.branch ?? branch,
    staffSalesAll:
      user?.role === "Administrator" ||
      user?.role === "Manager" ||
      Boolean(user?.role?.toLowerCase().includes("manager")),
    password: user?.password ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError(t("Name is required.", "ስም ያስፈልጋል።"));
      return;
    }
    if (!isValidStaffPin(form.password)) {
      setError(t("Login PIN must be exactly 2 digits.", "የመግቢያ PIN በትክክል 2 አሃዝ መሆን አለበት።"));
      return;
    }
    const payload: AuthUserInput = {
      ...form,
      name: form.name.trim(),
      password: form.password.trim(),
      staffSalesAll: form.role === "Administrator" || form.role === "Manager",
      assignedStore: undefined,
      assignedInventoryLocations: undefined,
    };
    setSaving(true);
    try {
      const err = await onSave(payload);
      if (err) setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm grid place-items-center p-4">
      <div className="surface-card max-w-md w-full !p-5 sm:!p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display text-xl font-semibold">
            {user
              ? t("Edit login account", "መለያ አስተካክል")
              : t("Create login account", "መለያ ይፍጠሩ")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="size-9 grid place-items-center rounded-lg hover:bg-surface-2"
          >
            <Icons.X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground">{t("Full name", "ሙሉ ስም")}</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">{t("System role", "የስርዓት ሚና")}</label>
              <select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as UserRole;
                  setForm({
                    ...form,
                    role,
                    staffSalesAll: role === "Administrator" || role === "Manager",
                  });
                }}
                className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role === "Administrator"
                      ? t("System Admin", "የስርዓት አስተዳዳሪ")
                      : role === "Manager"
                        ? t("Manager", "አስተዳዳሪ")
                        : role === "Barista"
                          ? t("Barista", "ባሪስታ")
                          : t("User", "ተጠቃሚ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t("Branch", "ቅርንጫፍ")}</label>
              {branchOptions.length > 0 ? (
                <select
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                >
                  {branchOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                  className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">
              {t("2-digit login PIN", "የ2 አሃዝ የመግቢያ PIN")}
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{2}"
              maxLength={STAFF_PIN_LENGTH}
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value.replace(/\D/g, "").slice(0, STAFF_PIN_LENGTH),
                })
              }
              placeholder="••"
              className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm font-mono tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("Used only for sign-in. Must be unique.", "ለመግባት ብቻ ነው። ልዩ መሆን አለበት።")}
            </p>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-10 rounded-lg border border-border bg-card text-sm hover:bg-surface-2"
            >
              {t("Cancel", "ሰርዝ")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-10 rounded-lg bg-ember text-ember-foreground text-sm font-semibold"
            >
              {saving
                ? t("Saving", "እየተቀመጠ")
                : user
                  ? t("Save changes", "ለውጦችን አስቀምጥ")
                  : t("Create", "ፍጠር")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
