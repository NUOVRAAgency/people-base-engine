import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, Fingerprint, LineChart, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "نظام الموارد البشرية الذكي" }, { name: "description", content: "أدر فريقك بذكاء من مكان واحد" }, { property: "og:title", content: "نظام الموارد البشرية الذكي" }, { property: "og:description", content: "أدر فريقك بذكاء من مكان واحد" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});
function Index() {
  const services = [{ icon: Activity, label: "تتبّع الحضور", className: "right-5 top-7" }, { icon: WalletCards, label: "الرواتب", className: "left-8 top-19" }, { icon: LineChart, label: "الأداء", className: "right-14 top-31" }, { icon: BarChart3, label: "التحليلات", className: "left-5 top-44" }];
  return <main className="min-h-dvh bg-page" dir="rtl"><div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
    <section className="relative h-[48vh] min-h-[340px] overflow-hidden rounded-xl bg-card shadow-card">
      <div className="absolute -right-16 -top-16 size-60 rounded-full border-[22px] border-primary/10"/><div className="absolute -left-22 top-23 size-68 rounded-full border-[18px] border-primary/8"/>
      {services.map(({ icon: Icon, label, className }) => <div key={label} className={`absolute ${className} flex items-center gap-2 rounded-full bg-card px-4 py-3 text-xs font-semibold shadow-card`}><span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-4"/></span>{label}</div>)}
      <span className="absolute bottom-5 right-5 inline-flex items-center gap-2 rounded-full bg-foreground px-3 py-2 text-[10px] font-bold text-background"><Fingerprint className="size-4 text-primary"/> مدعوم بالذكاء</span>
    </section>
    <section className="mt-auto pt-7"><p className="text-xs font-bold text-primary">إدارة موارد بشرية حديثة</p><h1 className="mt-3 text-[38px] font-bold leading-[1.18]">أدر فريقك<br/><span className="text-primary">بذكاء أكبر</span></h1><p className="mt-4 max-w-sm text-sm leading-7 text-muted-foreground">الحضور والموظفون والرواتب والتقارير في مساحة عمل واحدة سهلة وآمنة.</p>
    <div className="mt-7 grid gap-3"><Button asChild size="lg" className="h-13 rounded-xl text-base"><Link to="/auth">ابدأ الآن</Link></Button><Button asChild size="lg" variant="outline" className="h-13 rounded-xl bg-card text-base shadow-sm"><Link to="/auth">تسجيل الدخول</Link></Button></div></section>
  </div></main>;
}
