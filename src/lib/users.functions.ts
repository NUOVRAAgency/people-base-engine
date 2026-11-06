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
    if (error || !created.user) return { ok: false as const, error: /weak/i.test(error?.message ?? "") ? "weak_password" : "create_failed" };
    const id = created.user.id;
    await admin.from("users").upsert({ id, email: data.email, full_name: data.fullName || null, branch_id: data.role === "admin" ? null : data.branchId, must_change_password: true });
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.from("user_roles").insert({ user_id: id, role: data.role });
    return { ok: true as const };
  });

const updateInput = z.object({
  userId: z.string().uuid(),
  role: roleEnum,
  branchId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  fullName: z.string().trim().max(100).optional(),
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
      .update({ branch_id: data.role === "admin" ? null : data.branchId, is_active: data.isActive, ...(data.fullName !== undefined ? { full_name: data.fullName || null } : {}) })
      .eq("id", data.userId);
    await admin.auth.admin.updateUserById(data.userId, { ban_duration: data.isActive ? "none" : "876000h" });
    return { ok: true as const };
  });

function tempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    if (data.userId === context.userId) return { ok: false as const, error: "self_change" };
    const admins = await activeAdminIds(admin);
    if (admins.length === 1 && admins[0] === data.userId) return { ok: false as const, error: "last_admin" };
    await admin.from("user_roles").delete().eq("user_id", data.userId);
    await admin.from("users").delete().eq("id", data.userId);
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) return { ok: false as const, error: "delete_failed" };
    return { ok: true as const };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context as Ctx);
    if (data.userId === context.userId) return { ok: false as const, error: "self_reset" };
    const password = tempPassword();
    const { error } = await admin.auth.admin.updateUserById(data.userId, { password });
    if (error) return { ok: false as const, error: "reset_failed" };
    await admin.from("users").update({ must_change_password: true }).eq("id", data.userId);
    return { ok: true as const, password };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ currentPassword: z.string().min(1).max(72), newPassword: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.auth.getUser();
    const email = me?.user?.email;
    if (!email) return { ok: false as const, error: "no_user" };
    // Verify the current password with a real sign-in on an isolated, non-persisted client.
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const probe = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: signIn, error: signErr } = await probe.auth.signInWithPassword({ email, password: data.currentPassword });
    if (signErr || signIn.user?.id !== context.userId) return { ok: false as const, error: "wrong_current" };
    await probe.auth.signOut().catch(() => {});
    if (data.currentPassword === data.newPassword) return { ok: false as const, error: "same_password" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.newPassword });
    if (error) return { ok: false as const, error: /weak/i.test(error.message) ? "weak_password" : "change_failed" };
    await supabaseAdmin.from("users").update({ must_change_password: false }).eq("id", context.userId);
    return { ok: true as const };
  });
