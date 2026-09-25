import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { tr, trf } from "@/lib/i18n";
export type HeaderNotification = {
  id: string;
  title: string;
  detail: string;
  to: "/attendance" | "/reports" | "/leaves";
  kind: "attendance" | "report" | "leave";
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: tr("إجازة سنوية"),
  sick: tr("إجازة مرضية"),
  emergency: tr("إجازة طارئة"),
  unpaid: tr("إجازة بدون راتب"),
};

export function useHeaderData() {
  const [companyName, setCompanyName] = useState("");
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return;

    const [settingsResult, leavesResult, attendanceResult, reportsResult] = await Promise.all([
      supabase.from("app_settings").select("company_name").eq("id", "organization").maybeSingle(),
      supabase
        .from("leave_requests")
        .select("id,leave_type,start_date,end_date,employees(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("attendance")
        .select("id,status,date,note,employees(full_name)")
        .in("status", ["absent", "late"])
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("reports").select("id,generated_at,month").order("generated_at", { ascending: false }).limit(2),
    ]);

    setCompanyName(settingsResult.data?.company_name?.trim() ?? "");

    const attendanceItems: HeaderNotification[] = (attendanceResult.data ?? []).map((item) => {
      const employee = Array.isArray(item.employees) ? item.employees[0] : item.employees;
      return {
        id: `attendance-${item.id}`,
        title: item.status === "absent" ? tr("تنبيه غياب") : tr("تنبيه تأخر"),
        detail: `${employee?.full_name ?? tr("موظف")} — ${item.date}${item.note ? trf("، {0}", item.note) : ""}`,
        to: "/attendance",
        kind: "attendance",
      };
    });
    const reportItems: HeaderNotification[] = (reportsResult.data ?? []).map((item) => ({
      id: `report-${item.id}`,
      title: tr("تقرير إداري جديد"),
      detail: item.month ? trf("تقرير شهر {0}", item.month.slice(0, 7)) : tr("تم إنشاء تقرير جديد"),
      to: "/reports",
      kind: "report",
    }));
    const leaveItems: HeaderNotification[] = (leavesResult.data ?? []).map((item) => {
      const employee = Array.isArray(item.employees) ? item.employees[0] : item.employees;
      return {
        id: `leave-${item.id}`,
        title: tr("طلب إجازة بانتظار الاعتماد"),
        detail: `${employee?.full_name ?? tr("موظف")} — ${LEAVE_TYPE_LABELS[item.leave_type] ?? item.leave_type} (${item.start_date} → ${item.end_date})`,
        to: "/leaves",
        kind: "leave",
      };
    });
    setNotifications([...leaveItems, ...attendanceItems, ...reportItems].slice(0, 6));
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("hr-header-refresh", refresh);
    return () => window.removeEventListener("hr-header-refresh", refresh);
  }, [load]);

  return { companyName, notifications, refresh: load };
}
