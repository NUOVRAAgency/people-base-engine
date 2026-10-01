import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId).eq("role", "admin");
  if (error || !data?.length) throw new Error("forbidden");
  // A disabled admin whose old session is still alive must not manage users.
  const { data: me } = await ctx.supabase.from("users").select("is_active").eq("id", ctx.userId).maybeSingle();
  if (!me?.is_active) throw new Error("forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function activeAdminIds(admin: any): Promise<string[]> {
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
  if (!ids.length) return [];
  const { data: users } = await admin.from("users").select("id,is_active").in("id", ids);
  return (users ?? []).filter((u: { is_active: boolean }) => u.is_active).map((u: { id: string }) => u.id);
}

const roleEnum = z.enum(["admin", "operator", "viewer"]);

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context as Ctx);
    const [{ data: users }, { data: roles }, { data: branches }] = await Promise.all([
      admin.from("users").select("id,email,full_name,branch_id,is_active,created_at").order("created_at"),
      admin.from("user_roles").select("user_id,role"),
      admin.from("branches").select("id,name").order("name"),
    ]);
    const roleOf = new Map<string, string>();
    for (const r of roles ?? []) {
      if (r.role === "admin" || !roleOf.has(r.user_id)) roleOf.set(r.user_id, r.role);
    }
    return {
      users: (users ?? []).map((u: any) => ({
        id: u.id as string,
        email: u.email as string,
        fullName: (u.full_name ?? "") as string,
        branchId: (u.branch_id ?? null) as string | null,
        isActive: u.is_active as boolean,
        createdAt: u.created_at as string,
        role: (roleOf.get(u.id) ?? "viewer") as "admin" | "operator" | "viewer",
      })),
      branches: (branches ?? []) as { id: string; name: string }[],
      selfId: context.userId,
    };
  });

const createInput = z
  .object({
    email: z.string().trim().email().max(255),
    password: z.string().min(8).max(72),
    fullName: z.string().trim().max(100).optional(),
    role: roleEnum,
    branchId: z.string().uuid().nullable(),
  })
  .refine((v) => v.role === "admin" || !!v.branchId, { message: "branch_required" });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.fullName ? { full_name: data.fullName } : {},
    });
    if (error || !created.user) return { ok: false as const, error: "create_failed" };
    const id = created.user.id;
    await admin.from("users").upsert({ id, email: data.email, full_name: data.fullName || null, branch_id: data.role === "admin" ? null : data.branchId });
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.from("user_roles").insert({ user_id: id, role: data.role });
    return { ok: true as const };
  });

const updateInput = z.object({
  userId: z.string().uuid(),
  role: roleEnum,
  branchId: z.string().uuid().nullable(),
  isActive: z.boolean(),
});

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateInput.parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    if (data.role !== "admin" && !data.branchId) return { ok: false as const, error: "branch_required" };
    const { data: currentRoles } = await admin.from("user_roles").select("role").eq("user_id", data.userId);
    const { data: current } = await admin.from("users").select("is_active").eq("id", data.userId).maybeSingle();
    const wasAdmin = (currentRoles ?? []).some((r: { role: string }) => r.role === "admin");
    const roleChanges = !(currentRoles ?? []).some((r: { role: string }) => r.role === data.role) || (currentRoles ?? []).length !== 1;

    if (data.userId === context.userId && (roleChanges || !data.isActive)) {
      return { ok: false as const, error: "self_change" };
    }
    if (wasAdmin && current?.is_active && (data.role !== "admin" || !data.isActive)) {
      const admins = await activeAdminIds(admin);
      if (admins.length <= 1) return { ok: false as const, error: "last_admin" };
    }

    if (roleChanges) {
      await admin.from("user_roles").delete().eq("user_id", data.userId);
      await admin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    }
    await admin
      .from("users")
      .update({ branch_id: data.role === "admin" ? null : data.branchId, is_active: data.isActive })
      .eq("id", data.userId);
    await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.isActive ? "none" : "876000h" });
    return { ok: true as const };
  });
