import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
export const Route = createFileRoute("/auth")({ ssr: false, head: () => ({ meta: [{ title: "تسجيل الدخول | نظام الموارد البشرية" }, { name: "description", content: "الدخول الآمن إلى مساحة عمل الموارد البشرية" }, { property: "og:title", content: "تسجيل الدخول | نظام الموارد البشرية" }, { property: "og:description", content: "الدخول الآمن إلى مساحة عمل الموارد البشرية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: AuthPage });
function AuthPage() { const navigate=useNavigate(); const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{if(data.session) navigate({to:"/dashboard",replace:true});});},[navigate]);
 async function onSubmit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setMessage("تعذر تسجيل الدخول، تحقق من البيانات");else navigate({to:"/dashboard",replace:true});setBusy(false);}
 return <main className="min-h-dvh bg-white" dir="rtl"><form onSubmit={onSubmit}><input aria-label="اسم المستخدم" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/><input aria-label="كلمة المرور" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/>{message?<p role="alert">{message}</p>:null}<button disabled={busy}>{busy?"جارٍ الدخول...":"دخول"}</button></form></main>;
}
