import { useEffect, useRef, useState, type FormEvent } from "react";
import * as Icons from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { isValidStaffPin, STAFF_PIN_LENGTH } from "@/lib/users";
import { showError, showSuccess } from "@/lib/toast";

export function ProfileHeaderMenu({
  roleLabel,
  onLogout,
}: {
  roleLabel: string;
  onLogout: () => void;
}) {
  const { user, updateUser } = useAuth();
  const lang = useLang();
  const t = (en: string, am: string) => (lang === "am" ? am : en);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [pin, setPin] = useState(user?.password ?? "");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (!user) return null;

  function openEditor() {
    setName(user!.name);
    setPin(user!.password);
    setMenuOpen(false);
    setEditorOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      showError(t("Name is required.", "ስም ያስፈልጋል።"));
      return;
    }
    if (!isValidStaffPin(pin)) {
      showError(t("PIN must be exactly 2 digits.", "PIN በትክክል 2 አሃዝ መሆን አለበት።"));
      return;
    }
    setSaving(true);
    try {
      const result = await updateUser(user!.id, {
        name: nextName,
        role: user!.role,
        branch: user!.branch,
        password: pin.trim(),
        staffSalesAll: user!.staffSalesAll,
        assignedStore: user!.assignedStore,
        assignedInventoryLocations: user!.assignedInventoryLocations,
      });
      if (!result.ok) {
        showError(result.error);
        return;
      }
      showSuccess(t("Profile updated.", "መገለጫ ተዘምኗል።"));
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title={t("Profile", "መገለጫ")}
          className="inline-flex h-8 max-w-[11rem] items-center gap-1.5 rounded-md border border-border bg-card px-1.5 hover:bg-surface-2 transition-colors"
        >
          <div className="size-5 shrink-0 rounded-full bg-gradient-to-br from-ember to-teff grid place-items-center text-ember-foreground text-[9px] font-semibold">
            {user.avatar}
          </div>
          <span className="hidden min-w-0 truncate text-left sm:block">
            <span className="block truncate text-[10px] font-medium leading-tight">{user.name}</span>
            <span className="block truncate text-[9px] text-muted-foreground leading-tight">
              {roleLabel}
            </span>
          </span>
          <Icons.ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-md"
          >
            <div className="px-2.5 py-2">
              <div className="text-sm font-semibold">{user.name}</div>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-accent"
              onClick={openEditor}
            >
              <Icons.UserRoundCog className="size-4" />
              {t("Edit profile", "መገለጫ አስተካክል")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive hover:bg-accent"
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
            >
              <Icons.LogOut className="size-4" />
              {t("Sign out", "ውጣ")}
            </button>
          </div>
        ) : null}
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm">
          <form
            onSubmit={(e) => void save(e)}
            className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-lift)]"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-lg font-semibold">
                {t("Edit profile", "መገለጫ አስተካክል")}
              </h3>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="size-9 grid place-items-center rounded-lg hover:bg-surface-2"
              >
                <Icons.X className="size-4" />
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground">{t("Full name", "ሙሉ ስም")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground">
                {t("2-digit login PIN", "የ2 አሃዝ የመግቢያ PIN")}
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={STAFF_PIN_LENGTH}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, STAFF_PIN_LENGTH))
                }
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm tracking-[0.3em]"
              />
            </div>

            <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
              {t("Role", "ሚና")}: <span className="font-medium text-foreground">{user.role}</span>
              {" · "}
              {t("Branch", "ቅርንጫፍ")}:{" "}
              <span className="font-medium text-foreground">{user.branch}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="h-10 flex-1 rounded-lg border border-border text-sm hover:bg-surface-2"
              >
                {t("Cancel", "ሰርዝ")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 flex-1 rounded-lg bg-ember text-sm font-semibold text-ember-foreground disabled:opacity-50"
              >
                {saving ? t("Saving…", "እየተቀመጠ…") : t("Save", "አስቀምጥ")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
