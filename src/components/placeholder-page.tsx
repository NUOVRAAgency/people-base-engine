import { AppShell } from "@/components/app-shell";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <AppShell title={title}>
      <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-10 text-center shadow-card">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <p className="mt-6 text-xs font-medium text-primary">قيد التجهيز</p>
      </div>
    </AppShell>
  );
}
