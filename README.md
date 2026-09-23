# HR Foundation

ابنِ لي الأساس الكامل لنظام إدارة موارد بشرية (HR System)، مع التركيز الكامل على الخلفية وقاعدة البيانات، وليس التصميم المرئي بعد.



1. الواجهة (مؤقتًا فقط):

- صفحة بيضاء صافية تمامًا، بدون أي ألوان أو نصوص أو تصميم

- فقط هيكل React أساسي فارغ، جاهز لاستقبال التصميم في برومبتات لاحقة



2. قاعدة البيانات (Supabase) — أنشئ الجداول التالية بالكامل مع العلاقات بينها:



- employees: id (uuid), full_name (text), position (text), department (text), hire_date (date), base_salary (numeric), phone (text), status (text: active/inactive)

- attendance: id (uuid), employee_id (foreign key → employees), date (date), status (text: present/late/absent), note (text, اختياري)

- payroll: id (uuid), employee_id (foreign key → employees), month (date), base_salary (numeric), bonuses (numeric), deductions (numeric), net_salary (numeric)

- reports: id (uuid), generated_at (timestamp), content (text), month (date)

- users: id (uuid، مرتبط بـ Supabase Auth)، email (text), role (text: admin/viewer)



فعّل Row-Level Security بحيث لا يستطيع أي مستخدم الوصول للبيانات إلا بعد تسجيل الدخول.



3. الخلفية (Backend Logic) — أنشئ الوظائف التالية:

- دالة لحساب صافي الراتب تلقائيًا: صافي الراتب = الراتب الأساسي + البدلات - (عدد أيام الغياب × (الراتب الأساسي ÷ 30)) - الخصومات اليدوية

- دالة لحساب نسبة الحضور الشهرية لكل موظف

- ربط جاهز (Edge Function) لاستدعاء Gemini API لاحقًا لتوليد التقارير الذكية (بدون تفعيل فعلي الآن، فقط الهيكلة الجاهزة لإضافة المفتاح لاحقًا)



4. المصادقة (Authentication):

- نظام تسجيل دخول عبر Supabase Auth (بريد إلكتروني + كلمة مرور)

- صلاحيتين: admin (كل الصلاحيات) و viewer (عرض فقط بدون تعديل)



5. PWA:

- فعّل إعدادات PWA الأساسية (manifest.json + service worker)

- فعّل تخزين الشكل العام للتطبيق (App Shell Caching) بحيث يفتح التطبيق ويظهر واجهته حتى بدون اتصال بالإنترنت، لكن أي عملية حفظ أو تعديل بيانات يجب أن تتطلب اتصال بالإنترنت فعليًا



لا تضف أي تصميم مرئي أو ألوان الآن — فقط الأساس التقني الكامل (القاعدة، الخلفية، المصادقة، PWA). سأعطيك تفاصيل التصميم في برومبتات لاحقة منفصلة.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2f962f5f-76cf-4160-9f0b-0ffddbf3da3d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
