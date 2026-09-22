import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/_authenticated/attendance")({head:()=>({meta:[{title:"الحضور والجدولة | نظام الموارد البشرية"},{name:"description",content:"تقويم الدوام وسجلات الحضور"},{property:"og:title",content:"الحضور والجدولة | نظام الموارد البشرية"},{property:"og:description",content:"تقويم الدوام وسجلات الحضور"},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:AttendancePage});
function AttendancePage(){return <main className="min-h-dvh bg-white"/>}
