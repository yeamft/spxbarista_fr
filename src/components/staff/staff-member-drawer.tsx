import type { ReactNode } from "react";
import * as Icons from "lucide-react";
import { Chip } from "@/components/ui-kit";
import { formatDateTime } from "@/lib/date-time";
import { useT } from "@/lib/i18n";
import { loadSystemSettings } from "@/lib/system-settings";
import {
  accountLabel,
  accountStatusTone,
  type StaffMemberView,
} from "@/lib/staff-management";

export type StaffMemberDrawerProps = {
  member: StaffMemberView;
  authMode: "demo";
  canManage: boolean;
  canManageAccounts?: boolean;
  showAudit?: boolean;
  auditEntries?: Array<{ id: string; action: string; atIso: string; performedBy: string }>;
  onClose: () => void;
  onSaveSchedule: (member: StaffMemberView) => void;
  onEditStaff?: () => void;
  onManageAccess?: () => void;
  onEditAccount?: () => void;
  onDisableAccount?: () => void;
};

export function StaffMemberDrawer({
  member,
  canManage,
  canManageAccounts,
  showAudit,
  auditEntries = [],
  onClose,
  onSaveSchedule,
  onEditStaff,
  onManageAccess,
  onEditAccount,
  onDisableAccount,
}: StaffMemberDrawerProps) {
  const t = useT();
  const prefs = loadSystemSettings().calendar;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-card border-l border-border shadow-xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-12 rounded-full bg-gradient-to-br from-ember to-teff grid place-items-center text-ember-foreground font-semibold shrink-0">
              {member.avatar}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold truncate">{member.name}</h2>
              <p className="text-sm text-muted-foreground truncate">{member.jobTitle || member.role}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <Chip tone={member.hasLoginAccount ? accountStatusTone(member.accountStatus) : "gold"}>
                  {accountLabel(member)}
                </Chip>
                <Chip tone="muted">{member.employmentStatus}</Chip>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="size-9 grid place-items-center rounded-lg hover:bg-surface-2 shrink-0">
            <Icons.X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <DrawerSection title={t("Profile", "መገለጫ")}>
            <Field label={t("Employee ID", "የሰራተኛ መለያ")} value={member.employeeId || "—"} />
            <Field label={t("Role", "ሚና")} value={member.jobTitle || member.role} />
            <Field label={t("Branch", "ቅርንጫፍ")} value={member.branch} />
            <Field label={t("Phone", "ስልክ")} value={member.phone || t("Not set", "አልተመዘገበም")} />
          </DrawerSection>

          <DrawerSection title={t("System Access", "የስርዓት መዳረሻ")}>
            <Field label={t("Login account", "የመግቢያ መለያ")} value={accountLabel(member)} />
            <Field label={t("System role", "የስርዓት ሚና")} value={member.hasLoginAccount ? member.role : t("None", "የለም")} />
            <Field
              label={t("Permissions", "ፈቃዶች")}
              value={
                member.hasLoginAccount
                  ? t("Based on system role", "በስርዓት ሚና ላይ የተመሰረተ")
                  : t("No system access", "የስርዓት መዳረሻ የለም")
              }
            />
            {member.hasLoginAccount && (
              <div className="flex flex-wrap gap-2 mt-1">
                <Chip tone={accountStatusTone(member.accountStatus)}>{member.accountStatus}</Chip>
                <Chip tone="muted">{t("Password / PIN", "በይለፍ ቃል / PIN")}</Chip>
              </div>
            )}
          </DrawerSection>

          {canManage && (
            <DrawerSection title={t("Actions", "እርምጃዎች")}>
              <div className="grid grid-cols-2 gap-2">
                {onEditStaff && (
                  <ActionButton icon={Icons.Pencil} label={t("Edit Staff", "ሰራተኛ አስተካክል")} onClick={onEditStaff} />
                )}
                {onManageAccess && (
                  <ActionButton icon={Icons.KeyRound} label={t("Manage Access", "መዳረሻ")} onClick={onManageAccess} />
                )}
                {canManageAccounts && onEditAccount && (
                  <ActionButton icon={Icons.Shield} label={t("Edit Account", "መለያ አስተካክል")} onClick={onEditAccount} />
                )}
                {canManageAccounts && onDisableAccount && (
                  <ActionButton icon={Icons.UserX} label={t("Disable Account", "መለያ አቦዝን")} onClick={onDisableAccount} danger />
                )}
              </div>
            </DrawerSection>
          )}

          {showAudit && (
            <DrawerSection title={t("Recent activity", "የቅርብ ጊዜ እንቅስቃሴ")}>
              {auditEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("No activity yet.", "እንቅስቃሴ የለም።")}</p>
              ) : (
                <ul className="space-y-2">
                  {auditEntries.slice(0, 8).map((entry) => (
                    <li key={entry.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                      <div className="font-medium">{entry.action}</div>
                      <div className="text-muted-foreground mt-0.5">
                        {entry.performedBy} · {formatDateTime(entry.atIso, prefs)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </DrawerSection>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 h-10 rounded-lg border border-border text-sm hover:bg-surface-2">
            {t("Close", "ዝጋ")}
          </button>
          {canManage && (
            <button type="button" onClick={() => onSaveSchedule(member)} className="flex-1 h-10 rounded-lg bg-ember text-ember-foreground text-sm font-semibold">
              {t("Done", "ተጠናቋል")}
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-xl border border-border p-3 space-y-2">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right break-words">{value}</span>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Icons.Pencil;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 rounded-lg border text-xs font-medium inline-flex items-center justify-center gap-1.5 px-2 ${
        danger
          ? "border-destructive/40 text-destructive hover:bg-destructive/5"
          : "border-border hover:bg-surface-2"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
