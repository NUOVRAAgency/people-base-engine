import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ROLE_LABELS, useCurrentUser, type AppRole } from "@/hooks/use-current-user";
import { createUser, listUsers, updateUser } from "@/lib/users.functions";
import { getLocale, tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: tr("المستخدمون والصلاحيات | نظام الموارد البشرية") },
      { name: "description", content: tr("إدارة حسابات المستخدمين وأدوارهم وفروعهم") },
      { property: "og:title", content: tr("المستخدمون والصلاحيات | نظام الموارد البشرية") },
      { property: "og:description", content: tr("إدارة حسابات المستخدمين وأدوارهم وفروعهم") },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UsersPage,
});

type Row = { id: string; email: string; fullName: string; branchId: string | null; isActive: boolean; createdAt: string; role: AppRole };
type Branch = { id: string; name: string };

const ERRORS: Record<string, string> = {
  last_admin: "لا يمكن تنزيل أو تعطيل آخر مدير نظام",
  self_change: "لا يمكنك تعديل دورك أو تعطيل حسابك",
  branch_required: "الفرع إلزامي للمشغّل والمشاهد",
  create_failed: "تعذر إنشاء المستخدم، قد يكون البريد مستخدماً",
};

function UsersPage() {
  const { isAdmin, loading: roleLoading } = useCurrentUser();
  const list = useServerFn(listUsers);
  const [rows, setRows] = useState<Row[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selfId, setSelfId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await list();
      setRows(res.users as Row[]);
      setBranches(res.branches);
      setSelfId(res.selfId);
    } catch (e) {
      console.error('listUsers', e);
      setRows([]);
    }
    setLoading(false);
  }, [list]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (roleLoading) return <p className="py-10 text-center text-sm text-muted-foreground">{tr("جاري التحميل")}</p>;
  if (!isAdmin) return <p className="rounded-2xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground">{tr("هذه الصفحة متاحة لمدير النظام فقط")}</p>;

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name ?? "—";
  const dateFmt = new Intl.DateTimeFormat(getLocale(), { year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{tr("إدارة حسابات المستخدمين وأدوارهم وفروعهم")}</p>
        <Button className="h-10 rounded-xl" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" aria-hidden /> {tr("إضافة مستخدم")}
        </Button>
      </div>

      {loading ? (
        <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />{tr("جاري التحميل")}</p>
      ) : !rows.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{tr("لا توجد بيانات")}</p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-glass">
          {rows.map((u, i) => (
            <li key={u.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3", i > 0 && "border-t border-border/40")}>
              <div className="min-w-0 flex-1">
                <p dir="auto" className="truncate text-sm font-medium">{u.fullName || u.email}</p>
                <p dir="ltr" className="truncate text-start text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] text-primary">{ROLE_LABELS[u.role]}</span>
              <span className="text-xs text-muted-foreground">{branchName(u.branchId)}</span>
              <span className={cn("rounded-full px-2.5 py-1 text-[11px]", u.isActive ? "bg-success/12 text-success" : "bg-muted text-muted-foreground")}>{u.isActive ? tr("نشط") : tr("معطّل")}</span>
              <span className="text-xs text-muted-foreground">{dateFmt.format(new Date(u.createdAt))}</span>
              <Button variant="ghost" size="icon" aria-label={tr("تعديل")} className="size-9 rounded-full" onClick={() => setEditing(u)}>
                <Pencil className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <UserDialog
        target={editing}
        branches={branches}
        selfId={selfId}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); void load(); }}
      />
    </div>
  );
}

function UserDialog({ target, branches, selfId, onClose, onSaved }: { target: Row | "new" | null; branches: Branch[]; selfId: string; onClose: () => void; onSaved: () => void }) {
  const create = useServerFn(createUser);
  const update = useServerFn(updateUser);
  const isNew = target === "new";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("viewer");
  const [branchId, setBranchId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    setError("");
    if (target === "new") {
      setEmail(""); setPassword(""); setFullName(""); setRole("viewer"); setBranchId(""); setIsActive(true);
    } else {
      setRole(target.role); setBranchId(target.branchId ?? ""); setIsActive(target.isActive);
    }
  }, [target]);

  const isSelf = target !== null && target !== "new" && target.id === selfId;

  async function save() {
    setError("");
    if (role !== "admin" && !branchId) return setError(tr("الفرع إلزامي للمشغّل والمشاهد"));
    setSaving(true);
    try {
      const res = isNew
        ? await create({ data: { email, password, fullName: fullName || undefined, role, branchId: branchId || null } })
        : await update({ data: { userId: (target as Row).id, role, branchId: branchId || null, isActive } });
      if (!res.ok) setError(tr(ERRORS[res.error] ?? "تعذر حفظ التغييرات"));
      else onSaved();
    } catch {
      setError(tr(isNew ? "تحقق من البريد وكلمة المرور (8 أحرف على الأقل)" : "تعذر حفظ التغييرات"));
    }
    setSaving(false);
  }

  const selectCls = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader className="text-start">
          <DialogTitle className="text-base font-semibold">{isNew ? tr("إضافة مستخدم") : tr("تعديل المستخدم")}</DialogTitle>
          <DialogDescription className="text-xs">{isNew ? tr("كلمة مرور مؤقتة يسلمها المدير للمستخدم") : (target as Row | null)?.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5">
          {isNew ? (
            <>
              <Input dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr("البريد الإلكتروني")} className="h-11 rounded-xl" />
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={tr("الاسم (اختياري)")} className="h-11 rounded-xl" />
              <Input dir="ltr" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={tr("كلمة مرور مؤقتة")} className="h-11 rounded-xl" />
            </>
          ) : null}
          <label className="block text-xs text-muted-foreground">{tr("الدور")}
            <select disabled={isSelf} value={role} onChange={(e) => setRole(e.target.value as AppRole)} className={cn(selectCls, "mt-1")}>
              {(["admin", "operator", "viewer"] as const).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>
          {role !== "admin" ? (
            <label className="block text-xs text-muted-foreground">{tr("الفرع")}
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={cn(selectCls, "mt-1")}>
                <option value="">{tr("اختر الفرع")}</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
          ) : null}
          {!isNew ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled={isSelf} checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {tr("الحساب نشط")}
            </label>
          ) : null}
          {error ? <p className="rounded-xl border border-destructive/25 bg-destructive/5 p-2.5 text-center text-xs text-destructive">{error}</p> : null}
          <Button className="h-11 w-full rounded-xl" disabled={saving} onClick={() => void save()}>
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {tr("حفظ")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
