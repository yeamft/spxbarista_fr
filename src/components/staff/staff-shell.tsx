import { useEffect, useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { StaffFiltersPanel } from "@/components/staff/staff-filters";
import { StaffMemberDrawer } from "@/components/staff/staff-member-drawer";
import {
  buildPaginationSteps,
  downloadTextFile,
  readInitialStaffTab,
  staffInitials,
} from "@/components/staff/staff-shared";
import { StaffUserModal } from "@/components/staff/staff-user-modal";
import { Card, Chip, PageHeader } from "@/components/ui-kit";
import type { AuthUser, AuthUserInput } from "@/lib/auth-context";
import { useT } from "@/lib/i18n";
import { showError, showSuccess } from "@/lib/toast";
import { activeBranchNames, loadCachedBranches } from "@/lib/branches";
import {
  STAFF_TABS,
  WEEKDAY_KEYS,
  appendStaffAudit,
  accountLabel,
  accountStatusTone,
  buildStaffDirectory,
  defaultStaffFilters,
  defaultStaffSchedule,
  exportStaffCsv,
  filterStaffMembers,
  loadJobTitles,
  loadShiftTemplates,
  loadStaffAudit,
  normalizeStaffTab,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type ShiftTemplate,
  type StaffFiltersState,
  type StaffMemberOnly,
  type StaffMemberView,
  type StaffScheduleRecord,
  type StaffTabId,
  type WeekdayKey,
} from "@/lib/staff-management";
import { USER_ROLES } from "@/lib/users";
import type { BackendRealtimeStatus } from "@/lib/backend/pos-backend";

const PAGE_SIZE = 12;

type StaffShellProps = {
  initialTab?: StaffTabId;
  branch: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  users: AuthUser[];
  authMode: "demo";
  realtimeStatus: BackendRealtimeStatus;
  lastSyncAt: string;
  scheduleMetadata: StaffScheduleRecord[];
  staffOnly: StaffMemberOnly[];
  onSaveScheduleMetadata: (records: StaffScheduleRecord[]) => void;
  onSaveStaffOnly: (records: StaffMemberOnly[]) => void;
  addUser: (input: AuthUserInput) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>;
  updateUser: (id: string, input: AuthUserInput) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>;
  removeUser: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

function useStaffPermissions(role: string) {
  const canManage =
    role === "Administrator" ||
    role === "Manager" ||
    role === "Branch Manager" ||
    role === "Department Manager" ||
    role === "Supervisor";
  const canManageAccounts = role === "Administrator" || role === "Manager" || role === "Branch Manager";
  const canManageRoles = role === "Administrator";
  return { canManage, canManageAccounts, canManageRoles };
}

export function StaffShell(props: StaffShellProps) {
  const t = useT();
  const permissions = useStaffPermissions(props.currentUserRole);

  const [tab, setTab] = useState<StaffTabId>(() => normalizeStaffTab(props.initialTab ?? readInitialStaffTab()));
  const [filters, setFilters] = useState<StaffFiltersState>(() => defaultStaffFilters());
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<StaffMemberView | null>(null);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AuthUser | null>(null);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [accessSection, setAccessSection] = useState<"accounts" | "roles">("accounts");
  const [auditTick, setAuditTick] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const shiftTemplates = useMemo(() => loadShiftTemplates(), []);

  const staff = useMemo(
    () => buildStaffDirectory(props.users, props.scheduleMetadata, props.staffOnly),
    [props.users, props.scheduleMetadata, props.staffOnly],
  );

  const filtered = useMemo(() => filterStaffMembers(staff, filters), [staff, filters]);
  const auditLog = useMemo(() => loadStaffAudit(), [auditTick, tab]);

  const branches = useMemo(() => ["All", ...new Set(staff.map((row) => row.branch))], [staff]);
  const stations = useMemo(() => ["All", ...new Set(staff.map((row) => row.station).filter(Boolean))], [staff]);
  const jobTitles = useMemo(() => ["All", ...new Set(staff.map((row) => row.jobTitle))], [staff]);
  const shifts = useMemo(() => ["All"], []);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);
  const pageSteps = useMemo(() => buildPaginationSteps(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => setPage(1), [filters, tab]);
  useEffect(() => setPage((p) => Math.min(Math.max(1, p), totalPages)), [totalPages]);
  useEffect(() => {
    if (props.initialTab) setTab(normalizeStaffTab(props.initialTab));
  }, [props.initialTab]);
  useEffect(() => {
    if (!selected) return;
    const fresh = staff.find((row) => row.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [staff]); // eslint-disable-line react-hooks/exhaustive-deps -- refresh drawer from rebuilt directory

  function upsertSchedule(record: StaffScheduleRecord) {
    const next = props.scheduleMetadata.some((row) => row.id === record.id)
      ? props.scheduleMetadata.map((row) => (row.id === record.id ? record : row))
      : [...props.scheduleMetadata, record];
    props.onSaveScheduleMetadata(next);
  }

  function syncUserAssignedStore(user: AuthUser, input: AuthUserInput) {
    const locations = input.assignedInventoryLocations ?? (input.assignedStore ? [input.assignedStore] : []);
    if (!locations.length) return;
    const existing = props.scheduleMetadata.find((row) => row.id === user.id);
    upsertSchedule({
      ...(existing ?? defaultStaffSchedule(user)),
      id: user.id,
      inventoryLocation: locations.map((loc) => (loc === "Butcher" ? "Butcher House" : loc)).join(", "),
    });
  }

  function handleExport() {
    const csv = exportStaffCsv(filtered);
    downloadTextFile(`staff-directory-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
    showSuccess(t("Staff directory exported.", "የሰራተኞች ዝርዝር ተላከ።"));
    setShowMoreActions(false);
  }

  async function handleDisableAccount(id: string) {
    setRemovingId(id);
    try {
      const result = await props.removeUser(id);
      if (!result.ok) showError(result.error);
      else {
        showSuccess(t("Account access revoked (deactivated). Historical records preserved.", "የመለያ መዳረሻ ተሰርዟል። ታሪካዊ መዝገቦች ተጠብቀዋል።"));
        setAuditTick((value) => value + 1);
        appendStaffAudit({
          action: "Account Disabled",
          staffId: id,
          staffName: staff.find((row) => row.id === id)?.name ?? id,
          performedBy: props.currentUserName,
          performedByRole: props.currentUserRole,
          branch: props.branch,
        });
        if (selected?.id === id) setSelected(null);
      }
    } finally {
      setRemovingId(null);
    }
  }

  const selectedAudit = useMemo(
    () => (selected ? auditLog.filter((entry) => entry.staffId === selected.id) : []),
    [auditLog, selected],
  );

  return (
    <div>
      <PageHeader
        title={t("Staff Management", "የሰራተኞች አስተዳደር")}
        action={
          <div className="flex flex-wrap items-center gap-2 relative">
            {permissions.canManage && (
              <button
                type="button"
                onClick={() => setShowAddStaff(true)}
                className="h-10 px-4 rounded-lg bg-ember text-ember-foreground text-sm font-semibold inline-flex items-center gap-1.5"
              >
                <Icons.Plus className="size-4" /> {t("Add Staff", "ሰራተኛ ጨምር")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowMoreActions((open) => !open)}
              className="h-10 px-3 rounded-lg border border-border bg-card text-sm hover:bg-surface-2 inline-flex items-center gap-1.5"
            >
              <Icons.MoreHorizontal className="size-4" />
              {t("More", "ተጨማሪ")}
            </button>
            {showMoreActions && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowMoreActions(false)} aria-hidden="true" />
                <div className="absolute right-0 top-11 z-40 w-56 rounded-xl border border-border bg-card shadow-lg py-1 text-sm">
                  {permissions.canManageAccounts && (
                    <MoreAction
                      icon={Icons.KeyRound}
                      label={t("Create login account", "መለያ ፍጠር")}
                      onClick={() => {
                        setShowAddAccount(true);
                        setTab("access");
                        setAccessSection("accounts");
                        setShowMoreActions(false);
                      }}
                    />
                  )}
                  <MoreAction icon={Icons.Download} label={t("Export staff", "ሰራተኞችን ላክ")} onClick={handleExport} />
                  {permissions.canManageRoles && (
                    <MoreAction
                      icon={Icons.Shield}
                      label={t("Manage roles", "ሚናዎችን አስተዳድር")}
                      onClick={() => {
                        setTab("access");
                        setAccessSection("roles");
                        setShowMoreActions(false);
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        }
      />

      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 border-b border-border scrollbar-thin">
        {STAFF_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === item.id ? "bg-ember text-ember-foreground" : "text-muted-foreground hover:bg-surface-2"
            }`}
          >
            {t(item.labelEn, item.labelAm)}
          </button>
        ))}
      </div>

      {tab === "staff" && (
        <StaffFiltersPanel
          filters={filters}
          onChange={setFilters}
          branches={branches}
          jobTitles={jobTitles}
          shifts={shifts}
          stations={stations}
          expanded={filtersExpanded}
          onToggleExpanded={() => setFiltersExpanded((v) => !v)}
        />
      )}

      {tab === "staff" && (
        <StaffDirectoryTable
          rows={pageRows}
          onOpen={(row) => setSelected(row)}
          pagination={{
            currentPage,
            totalPages,
            pageSteps,
            start: filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1,
            end: Math.min(currentPage * PAGE_SIZE, filtered.length),
            total: filtered.length,
            onPage: setPage,
          }}
        />
      )}

      {tab === "access" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-0.5 bg-card w-fit">
            <SectionTab active={accessSection === "accounts"} onClick={() => setAccessSection("accounts")}>
              {t("System accounts", "የስርዓት መለያዎች")}
            </SectionTab>
            <SectionTab active={accessSection === "roles"} onClick={() => setAccessSection("roles")}>
              {t("Roles & permissions", "ሚናዎች እና ፈቃዶች")}
            </SectionTab>
          </div>

          {accessSection === "accounts" ? (
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">{t("User", "ተጠቃሚ")}</th>
                      <th className="text-left px-4 py-3">{t("System role", "ሚና")}</th>
                      <th className="text-left px-4 py-3">{t("Branch", "ቅርንጫፍ")}</th>
                      <th className="text-left px-4 py-3">{t("Account status", "ሁኔታ")}</th>
                      <th className="text-left px-4 py-3">{t("Sign-in", "መግቢያ")}</th>
                      <th className="text-right px-4 py-3">{t("Actions", "እርምጃ")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.users.map((u) => {
                      const view = staff.find((row) => row.id === u.id);
                      return (
                        <tr key={u.id} className="border-t border-border">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="size-8 rounded-full bg-gradient-to-br from-ember to-teff grid place-items-center text-ember-foreground text-[10px] font-semibold">{u.avatar}</div>
                              <div>
                                <div className="font-medium">{u.name}</div>
                                {u.id === props.currentUserId && <div className="text-[10px] text-muted-foreground">{t("You", "እርስዎ")}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><Chip tone={u.role === "Branch Manager" ? "ember" : "muted"}>{u.role}</Chip></td>
                          <td className="px-4 py-3 text-muted-foreground">{u.branch}</td>
                          <td className="px-4 py-3"><Chip tone={accountStatusTone(view?.accountStatus ?? "Active")}>{view?.accountStatus ?? "Active"}</Chip></td>
                          <td className="px-4 py-3 font-mono text-xs">
                            {"••••••"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {permissions.canManageAccounts && (
                                <button type="button" onClick={() => setEditingAccount(u)} className="h-8 px-3 rounded-lg text-xs border border-border hover:bg-surface-2">
                                  {t("Edit", "አስተካክል")}
                                </button>
                              )}
                              {permissions.canManageAccounts && u.id !== props.currentUserId && (
                                <button
                                  type="button"
                                  onClick={() => handleDisableAccount(u.id)}
                                  disabled={removingId === u.id}
                                  className="h-8 px-3 rounded-lg text-xs border border-destructive/30 text-destructive hover:bg-destructive/5"
                                >
                                  {removingId === u.id ? t("Disabling", "እየተሰናከለ") : t("Disable", "አሰናክል")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {props.users.length === 0 && <EmptyState message={t("No system accounts yet.", "እስካሁን የስርዓት መለያ የለም።")} />}
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <h3 className="font-display font-semibold mb-2">{t("System roles", "የስርዓት ሚናዎች")}</h3>
                <div className="flex flex-wrap gap-2">
                  {USER_ROLES.map((role) => (
                    <Chip key={role} tone={role.includes("Manager") || role === "Administrator" ? "ember" : "muted"}>{role}</Chip>
                  ))}
                </div>
              </Card>
              <Card className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead className="bg-surface-2 uppercase text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2 sticky left-0 bg-surface-2">{t("Module", "ሞዱል")}</th>
                        {PERMISSION_ACTIONS.slice(0, 6).map((action) => (
                          <th key={action} className="px-2 py-2 text-center">{action}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_MODULES.slice(0, 12).map((module) => (
                        <tr key={module} className="border-t border-border">
                          <td className="px-3 py-2 font-medium sticky left-0 bg-card">{module}</td>
                          {PERMISSION_ACTIONS.slice(0, 6).map((action) => (
                            <td key={action} className="px-2 py-2 text-center text-muted-foreground">
                              {module === "Staff" || module === "Settings" ? (action === "View" || action === "Edit" ? "✓" : "—") : action === "View" ? "✓" : "—"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {selected && (
        <StaffMemberDrawer
          member={selected}
          authMode={props.authMode}
          canManage={permissions.canManage}
          canManageAccounts={permissions.canManageAccounts}
          showAudit={permissions.canManageRoles}
          auditEntries={selectedAudit}
          onClose={() => setSelected(null)}
          onSaveSchedule={() => setSelected(null)}
          onEditStaff={() => {
            setSelected(null);
            setShowAddStaff(true);
          }}
          onManageAccess={() => {
            if (selected.hasLoginAccount) {
              const user = props.users.find((u) => u.id === selected.id);
              if (user) setEditingAccount(user);
            } else {
              setShowAddAccount(true);
              setTab("access");
              setAccessSection("accounts");
            }
          }}
          onEditAccount={selected.hasLoginAccount ? () => {
            const user = props.users.find((u) => u.id === selected.id);
            if (user) setEditingAccount(user);
          } : undefined}
          onDisableAccount={
            permissions.canManageAccounts && selected.hasLoginAccount && selected.id !== props.currentUserId
              ? () => handleDisableAccount(selected.id)
              : undefined
          }
        />
      )}

      {showAddAccount && (
        <StaffUserModal
          branch={props.branch}
          authMode={props.authMode}
          onClose={() => setShowAddAccount(false)}
          onSave={async (input) => {
            const result = await props.addUser(input);
            if (!result.ok) { showError(result.error); return result.error; }
            syncUserAssignedStore(result.user, input);
            appendStaffAudit({
              action: "Account Created",
              staffId: result.user.id,
              staffName: result.user.name,
              performedBy: props.currentUserName,
              performedByRole: props.currentUserRole,
              branch: result.user.branch,
            });
            showSuccess(`${result.user.name} ${t("account created.", "መለያ ተፈጥሯል።")}`);
            setAuditTick((value) => value + 1);
            setShowAddAccount(false);
            return null;
          }}
        />
      )}

      {editingAccount && (
        <StaffUserModal
          branch={props.branch}
          authMode={props.authMode}
          user={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSave={async (input) => {
            const result = await props.updateUser(editingAccount.id, input);
            if (!result.ok) { showError(result.error); return result.error; }
            syncUserAssignedStore(result.user, input);
            appendStaffAudit({
              action: "Account Updated",
              staffId: result.user.id,
              staffName: result.user.name,
              performedBy: props.currentUserName,
              performedByRole: props.currentUserRole,
              branch: result.user.branch,
            });
            showSuccess(`${result.user.name} ${t("updated.", "ተሻሽሏል።")}`);
            setAuditTick((value) => value + 1);
            setEditingAccount(null);
            return null;
          }}
        />
      )}

      {showAddStaff && (
        <AddStaffWizard
          branch={props.branch}
          authMode={props.authMode}
          jobTitles={loadJobTitles()}
          shifts={shiftTemplates}
          onClose={() => setShowAddStaff(false)}
          onCreateStaffOnly={(member, schedule) => {
            props.onSaveStaffOnly([...props.staffOnly, member]);
            upsertSchedule(schedule);
            appendStaffAudit({
              action: "Staff Created",
              staffId: member.id,
              staffName: member.name,
              performedBy: props.currentUserName,
              performedByRole: props.currentUserRole,
              branch: member.branch,
            });
            showSuccess(t("Staff member added.", "ሰራተኛ ተጨምሯል።"));
            setAuditTick((value) => value + 1);
            setShowAddStaff(false);
            setTab("staff");
          }}
          onCreateWithAccount={async (member, schedule, accountInput) => {
            const result = await props.addUser(accountInput);
            if (!result.ok) { showError(result.error); return; }
            props.onSaveStaffOnly([...props.staffOnly, { ...member, linkedUserId: result.user.id }]);
            upsertSchedule({
              ...schedule,
              id: result.user.id,
              inventoryLocation: accountInput.assignedStore ?? defaultStaffSchedule(result.user).inventoryLocation,
            });
            appendStaffAudit({
              action: "Staff Created",
              staffId: result.user.id,
              staffName: result.user.name,
              performedBy: props.currentUserName,
              performedByRole: props.currentUserRole,
              branch: result.user.branch,
            });
            showSuccess(t("Staff member and login account created.", "ሰራተኛ እና መለያ ተፈጥረዋል።"));
            setAuditTick((value) => value + 1);
            setShowAddStaff(false);
            setTab("staff");
          }}
        />
      )}

    </div>
  );
}

function SectionTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-md text-xs font-medium ${active ? "bg-ember text-ember-foreground" : "text-muted-foreground hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}

function MoreAction({ icon: Icon, label, onClick }: { icon: typeof Icons.Download; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full px-3 py-2.5 text-left hover:bg-surface-2 inline-flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{message}</div>;
}

function StaffDirectoryTable({
  rows,
  onOpen,
  pagination,
}: {
  rows: StaffMemberView[];
  onOpen: (row: StaffMemberView) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    pageSteps: Array<number | "ellipsis">;
    start: number;
    end: number;
    total: number;
    onPage: (page: number) => void;
  };
}) {
  const t = useT();

  return (
    <div className="space-y-3">
      <Card className="!p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">{t("Staff", "ሰራተኛ")}</th>
                <th className="text-left px-4 py-3">{t("Role", "ሚና")}</th>
                <th className="text-left px-4 py-3">{t("Branch", "ቅርንጫፍ")}</th>
                <th className="text-left px-4 py-3">{t("Account", "መለያ")}</th>
                <th className="text-right px-4 py-3">{t("Actions", "እርምጃ")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.id} className="border-t border-border hover:bg-surface-2/60 cursor-pointer" onClick={() => onOpen(member)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-gradient-to-br from-ember to-teff grid place-items-center text-ember-foreground text-xs font-semibold shrink-0">
                        {member.avatar || staffInitials(member.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{member.name}</div>
                        <div className="text-[10px] text-muted-foreground">{member.employmentStatus}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{member.jobTitle || member.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.branch}</td>
                  <td className="px-4 py-3">
                    <Chip tone={member.hasLoginAccount ? accountStatusTone(member.accountStatus) : "gold"}>
                      {accountLabel(member)}
                    </Chip>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => onOpen(member)} className="h-8 px-3 rounded-lg text-xs border border-border hover:bg-surface-2">
                      {t("Open", "ክፈት")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <EmptyState message={t("No staff found", "ሰራተኞች የሉም")} />}
        {pagination && pagination.totalPages > 1 && (
          <PaginationBar pagination={pagination} ofLabel={t("of", "ከ")} />
        )}
      </Card>

      <div className="md:hidden space-y-2">
        {rows.map((member) => (
          <Card key={member.id} className="!p-3">
            <button type="button" onClick={() => onOpen(member)} className="w-full text-left space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{member.name}</div>
                  <div className="text-xs text-muted-foreground">{member.jobTitle || member.role}</div>
                </div>
                <Chip tone={member.hasLoginAccount ? accountStatusTone(member.accountStatus) : "gold"}>
                  {accountLabel(member)}
                </Chip>
              </div>
              <div className="text-xs text-muted-foreground">{member.branch}</div>
            </button>
          </Card>
        ))}
        {rows.length === 0 && <EmptyState message={t("No staff found", "ሰራተኞች የሉም")} />}
        {pagination && pagination.totalPages > 1 && (
          <Card className="!p-3">
            <PaginationBar pagination={pagination} ofLabel={t("of", "ከ")} />
          </Card>
        )}
      </div>
    </div>
  );
}

function PaginationBar({
  pagination,
  ofLabel,
}: {
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSteps: Array<number | "ellipsis">;
    start: number;
    end: number;
    total: number;
    onPage: (page: number) => void;
  };
  ofLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
      <span className="text-xs text-muted-foreground">{pagination.start}–{pagination.end} {ofLabel} {pagination.total}</span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={pagination.currentPage === 1} onClick={() => pagination.onPage(pagination.currentPage - 1)} className="size-8 grid place-items-center rounded-lg border border-border disabled:opacity-40">
          <Icons.ChevronLeft className="size-4" />
        </button>
        {pagination.pageSteps.map((step, index) =>
          step === "ellipsis" ? (
            <span key={`e-${index}`} className="px-1 text-muted-foreground">…</span>
          ) : (
            <button key={step} type="button" onClick={() => pagination.onPage(step)} className={`size-8 rounded-lg text-xs border ${step === pagination.currentPage ? "bg-ember text-ember-foreground border-ember" : "border-border"}`}>
              {step}
            </button>
          ),
        )}
        <button type="button" disabled={pagination.currentPage === pagination.totalPages} onClick={() => pagination.onPage(pagination.currentPage + 1)} className="size-8 grid place-items-center rounded-lg border border-border disabled:opacity-40">
          <Icons.ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

function AddStaffWizard({
  branch,
  authMode,
  jobTitles,
  shifts,
  onClose,
  onCreateStaffOnly,
  onCreateWithAccount,
}: {
  branch: string;
  authMode: "demo";
  jobTitles: ReturnType<typeof loadJobTitles>;
  shifts: ShiftTemplate[];
  onClose: () => void;
  onCreateStaffOnly: (member: StaffMemberOnly, schedule: StaffScheduleRecord) => void;
  onCreateWithAccount: (member: StaffMemberOnly, schedule: StaffScheduleRecord, account: AuthUserInput) => Promise<void>;
}) {
  const t = useT();
  const [step, setStep] = useState(1);
  const [needsAccess, setNeedsAccess] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const branchOptions = useMemo(() => {
    const configured = activeBranchNames(loadCachedBranches());
    if (branch.trim() && !configured.includes(branch.trim())) {
      return [...configured, branch.trim()].sort((a, b) => a.localeCompare(b));
    }
    return configured;
  }, [branch]);
  const firstJob = jobTitles[0];
  const firstShift = shifts[0];
  const [form, setForm] = useState({
    name: "",
    phone: "",
    jobTitle: firstJob?.name ?? "Barista",
    branch,
    employmentStatus: "Active" as StaffMemberOnly["employmentStatus"],
    station: firstJob?.defaultStation ?? "Service Desk",
    department: firstJob?.department ?? "Coffee",
    shiftId: firstShift?.id ?? "morning",
    workingDays: [...WEEKDAY_KEYS] as WeekdayKey[],
    email: "",
    username: "",
    role: "User" as AuthUserInput["role"],
    password: "",
    accountStatus: "Active",
  });

  const selectedShift = shifts.find((s) => s.id === form.shiftId) ?? firstShift;

  function buildPayload() {
    const id = `staff-${Date.now()}`;
    const member: StaffMemberOnly = {
      id,
      name: form.name.trim(),
      phone: form.phone,
      branch: form.branch,
      jobTitle: form.jobTitle,
      department: form.department,
      employmentStatus: form.employmentStatus,
    };
    const schedule: StaffScheduleRecord = {
      id,
      phone: form.phone,
      shift: selectedShift?.name.includes("Evening") ? "Evening" : selectedShift?.name.includes("Morning") ? "Morning" : "All day",
      startTime: selectedShift?.startTime ?? "07:00",
      endTime: selectedShift?.endTime ?? "15:00",
      daysWorked: 0,
      status: "Off",
      jobTitle: form.jobTitle,
      department: form.department,
      station: form.station,
      employeeId: id.slice(0, 8).toUpperCase(),
      username: form.username || form.name.trim().split(/\s+/)[0]?.toLowerCase() || id,
      employmentStatus: form.employmentStatus,
      accountStatus: needsAccess ? "Active" : "Pending Activation",
      workingDays: form.workingDays,
    };
    return { member, schedule };
  }

  async function submit() {
    if (!form.name.trim()) return;
    if (needsAccess && !/^\d{2}$/.test(form.password.trim())) {
      window.alert(t("Login PIN must be exactly 2 digits.", "የመግቢያ PIN በትክክል 2 አሃዝ መሆን አለበት።"));
      return;
    }
    setSaving(true);
    const { member, schedule } = buildPayload();
    try {
      if (needsAccess) {
        await onCreateWithAccount(member, schedule, {
          name: form.name.trim(),
          role: form.role,
          branch: form.branch,
          email: form.email || undefined,
          password: form.password.trim(),
        });
      } else {
        onCreateStaffOnly(member, schedule);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm grid place-items-center p-4">
      <div className="surface-card max-w-lg w-full !p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl font-semibold">{t("Add Staff", "ሰራተኛ ጨምር")}</h3>
            <p className="text-xs text-muted-foreground">{t("Step", "ደረጃ")} {step} / 2</p>
          </div>
          <button type="button" onClick={onClose} className="size-9 grid place-items-center rounded-lg hover:bg-surface-2"><Icons.X className="size-4" /></button>
        </div>

        <div className="flex gap-1 mb-5">
          {[1, 2].map((n) => (
            <div key={n} className={`h-1.5 flex-1 rounded-full ${step >= n ? "bg-ember" : "bg-border"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("Staff information", "የሰራተኛ መረጃ")}</p>
            <WizardField label={t("Full name", "ሙሉ ስም")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <WizardField label={t("Phone", "ስልክ")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <WizardSelect
              label={t("Role", "ሚና")}
              value={form.jobTitle}
              options={jobTitles.map((j) => j.name)}
              onChange={(v) => {
                const job = jobTitles.find((j) => j.name === v);
                setForm({
                  ...form,
                  jobTitle: v,
                  department: job?.department ?? form.department,
                  station: job?.defaultStation && job.defaultStation !== "—" ? job.defaultStation : form.station,
                  role: (USER_ROLES.includes(v as AuthUserInput["role"]) ? v : form.role) as AuthUserInput["role"],
                });
              }}
            />
            {branchOptions.length > 0 ? (
              <WizardSelect
                label={t("Branch", "ቅርንጫፍ")}
                value={form.branch}
                options={branchOptions}
                onChange={(v) => setForm({ ...form, branch: v })}
              />
            ) : (
              <WizardField label={t("Branch", "ቅርንጫፍ")} value={form.branch} onChange={(v) => setForm({ ...form, branch: v })} />
            )}
            <WizardSelect
              label={t("Employment status", "የቅጥር ሁኔታ")}
              value={form.employmentStatus}
              options={["Active", "Probation", "On Leave", "Suspended"]}
              onChange={(v) => setForm({ ...form, employmentStatus: v as StaffMemberOnly["employmentStatus"] })}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{t("Does this staff member need access to the system?", "ይህ ሰራተኛ የስርዓት መዳረሻ ያስፈልገዋል?")}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNeedsAccess(false)}
                className={`h-11 rounded-lg border text-sm font-medium ${needsAccess === false ? "border-ember bg-ember/10 text-ember" : "border-border"}`}
              >
                {t("No — staff only", "አይ — ሰራተኛ ብቻ")}
              </button>
              <button
                type="button"
                onClick={() => setNeedsAccess(true)}
                className={`h-11 rounded-lg border text-sm font-medium ${needsAccess === true ? "border-ember bg-ember/10 text-ember" : "border-border"}`}
              >
                {t("Yes — create login", "አዎ — መለያ ፍጠር")}
              </button>
            </div>
            {needsAccess && (
              <div className="space-y-3 pt-2">
                <WizardField
                  label={t("Username / email", "ተጠቃሚ ስም / ኢሜይል")}
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v, username: v.split("@")[0] ?? v })}
                />
                <WizardSelect label={t("System role", "ሚና")} value={form.role} options={USER_ROLES} onChange={(v) => setForm({ ...form, role: v as AuthUserInput["role"] })} />
                <WizardField
                  label={t("2-digit login PIN", "የ2 አሃዝ PIN")}
                  value={form.password}
                  onChange={(v) => setForm({ ...form, password: v.replace(/\D/g, "").slice(0, 2) })}
                  type="password"
                />
                <p className="text-xs text-muted-foreground">
                  {t("Permissions follow the selected system role.", "ፈቃዶች ከተመረጠው የስርዓት ሚና ይከተላሉ።")}
                </p>
              </div>
            )}
            {needsAccess === false && (
              <p className="text-xs text-muted-foreground rounded-lg border border-border bg-surface-2 px-3 py-2">
                {t(
                  "They will appear in the staff directory without an app login.",
                  "ያለ መተግበሪያ መግቢያ በሰራተኞች ዝርዝር ይታያሉ።",
                )}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-6">
          {step > 1 && (
            <button type="button" onClick={() => setStep((s) => s - 1)} className="flex-1 h-10 rounded-lg border border-border">
              {t("Back", "ተመለስ")}
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !form.name.trim()}
              className="flex-1 h-10 rounded-lg bg-ember text-ember-foreground font-semibold disabled:opacity-50"
            >
              {t("Next", "ቀጣይ")}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={saving || needsAccess === null || (needsAccess && !form.email.trim())}
              className="flex-1 h-10 rounded-lg bg-ember text-ember-foreground font-semibold disabled:opacity-50"
            >
              {saving ? t("Creating", "እየተፈጠረ") : t("Complete setup", "ማዋቀር ጨርስ")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
    </div>
  );
}

function WizardSelect({
  label,
  value,
  options,
  optionLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  optionLabels?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-1 h-10 px-3 rounded-lg border border-border bg-card text-sm">
        {options.map((option) => (
          <option key={option} value={option}>{optionLabels?.[option] ?? option}</option>
        ))}
      </select>
    </div>
  );
}
