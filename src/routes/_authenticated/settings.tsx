import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/_authenticated/settings")({head:()=>({meta:[{title:"التحليلات والتقارير | نظام الموارد البشرية"},{name:"description",content:"مؤشرات الموظفين والحضور والفروع"},{property:"og:title",content:"التحليلات والتقارير | نظام الموارد البشرية"},{property:"og:description",content:"مؤشرات الموظفين والحضور والفروع"},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}]}),component:AnalyticsPage});
function AnalyticsPage(){return <main className="min-h-dvh bg-white"/>}
