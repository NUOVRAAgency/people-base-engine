import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { allowedFormats, runExport, type ExportFormat, type ExportPayload } from "@/lib/export";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LABELS: Record<ExportFormat, string> = {
  xlsx: "Excel",
  pdf: "PDF",
  docx: "Word",
  csv: "CSV",
};

type Build = () => (Omit<ExportPayload, "orgName"> & { orgName?: string }) | Promise<Omit<ExportPayload, "orgName"> & { orgName?: string }>;

/** Role-aware export button. Builders must only use rows already returned by the backend under the user's access rules. */
export function ExportMenu({
  build,
  detailedBuild,
  payroll = false,
  className,
  label,
}: {
  build: Build;
  detailedBuild?: Build;
  payroll?: boolean;
  className?: string;
  label?: string;
}) {
  const { role, loading } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const formats = allowedFormats(role, { payroll });
  if (loading || formats.length === 0) return null;

  async function go(format: ExportFormat, builder: Build) {
    if (busy) return;
    setBusy(true);
    try {
      const payload = { orgName: "", ...(await builder()) } as ExportPayload;
      if (!payload.orgName) {
        const { data } = await supabase.from("app_settings").select("company_name").eq("id", "organization").maybeSingle();
        payload.orgName = data?.company_name?.trim() ?? "";
      }
      await runExport(format, payload);
    } catch {
      toast.error(tr("تعذر إنشاء الملف. حاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  }

  const groups: { title: string; builder: Build }[] = detailedBuild
    ? [
        { title: tr("تقرير تنفيذي شامل"), builder: build },
        { title: tr("كشف تفصيلي بالموظفين"), builder: detailedBuild },
      ]
    : [{ title: "", builder: build }];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={busy} className={cn("h-10 gap-2 rounded-xl px-3 text-sm", className)}>
          <Download className="h-4 w-4" aria-hidden />
          {label ?? tr("تصدير")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {groups.map((g, i) => (
          <div key={g.title || i}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            {g.title ? <DropdownMenuLabel className="text-xs text-primary">{g.title}</DropdownMenuLabel> : null}
            {formats.map((f) => (
              <DropdownMenuItem key={f} className="cursor-pointer" onSelect={() => void go(f, g.builder)}>
                {LABELS[f]}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
