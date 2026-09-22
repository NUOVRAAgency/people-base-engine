import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type HeaderNotification = {
  id: string;
  title: string;
  detail: string;
  to: "/attendance" | "/reports";
  kind: "attendance" | "report";
};

export function useHeaderData() {
  const [companyName, setCompanyName] = useState("");
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return;

    const [settingsResult, attendanceResult, reportsResult] = await Promise.all([
      supabase.from("app_settings").select("company_name").eq("id", "organization").maybeSingle(),
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
        title: item.status === "absent" ? "تنبيه غياب" : "تنبيه تأخر",
        detail: `${employee?.full_name ?? "موظف"} — ${item.date}${item.note ? `، ${item.note}` : ""}`,
        to: "/attendance",
        kind: "attendance",
      };
    });
    const reportItems: HeaderNotification[] = (reportsResult.data ?? []).map((item) => ({
      id: `report-${item.id}`,
      title: "تقرير إداري جديد",
      detail: item.month ? `تقرير شهر ${item.month.slice(0, 7)}` : "تم إنشاء تقرير جديد",
      to: "/reports",
      kind: "report",
    }));
    setNotifications([...attendanceItems, ...reportItems].slice(0, 5));
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("hr-header-refresh", refresh);
    return () => window.removeEventListener("hr-header-refresh", refresh);
  }, [load]);

  return { companyName, notifications, refresh: load };
}
