import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

/** Role-aware export button. `build` must only use rows already returned by the backend under the user's access rules. */
export function ExportMenu({
  build,
  payroll = false,
  className,
  label,
}: {
  build: () => ExportPayload | Promise<ExportPayload>;
  payroll?: boolean;
  className?: string;
  label?: string;
}) {
  const { role, loading } = useCurrentUser();
  const [busy, setBusy] = useState(false);
  const formats = allowedFormats(role, { payroll });
  if (loading || formats.length === 0) return null;

  async function go(format: ExportFormat) {
    if (busy) return;
    setBusy(true);
    try {
      await runExport(format, await build());
    } catch {
      toast.error(tr("تعذر إنشاء الملف. حاول مرة أخرى."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={busy} className={cn("h-10 gap-2 rounded-xl px-3 text-sm", className)}>
          <Download className="h-4 w-4" aria-hidden />
          {label ?? tr("تصدير")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {formats.map((f) => (
          <DropdownMenuItem key={f} onSelect={() => void go(f)}>
            {LABELS[f]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
