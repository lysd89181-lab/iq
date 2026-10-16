// إرسال البريد عبر Resend + قالب ميثاق
import { fail } from './util.js';

function codeEmail(env, { title, intro, code, note }) {
  const site = env.SITE_URL || '';
  const digits = code.split('').map((d) => `<span style="display:inline-block;width:42px;height:54px;line-height:54px;margin:0 3px;border-radius:10px;background:#1B1B21;border:1px solid #2A2A32;font-size:28px;font-weight:700;color:#F5F3F0;font-family:Arial,sans-serif">${d}</span>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0C0C0F">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0F;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#131317;border:1px solid #2A2A32;border-radius:20px;overflow:hidden">
<tr><td style="height:4px;background:#E3123F"></td></tr>
<tr><td align="center" style="padding:32px 28px 8px">${site ? `<img src="${site}/assets/logo.png" width="96" alt="ميثاق" style="display:block;width:96px;height:auto;border:0">` : '<b style="color:#F5F3F0;font-size:24px">ميثاق</b>'}</td></tr>
<tr><td dir="rtl" style="padding:16px 28px 0;font-family:Tahoma,Arial,sans-serif;text-align:center">
<h1 style="margin:0 0 10px;font-size:22px;color:#F5F3F0">${title}</h1>
<p style="margin:0;font-size:15px;line-height:1.8;color:#9C9AA6">${intro}</p></td></tr>
<tr><td align="center" dir="ltr" style="padding:24px 12px">${digits}</td></tr>
<tr><td dir="rtl" style="padding:0 28px 28px;font-family:Tahoma,Arial,sans-serif;text-align:center">
<p style="margin:0;font-size:13px;line-height:1.8;color:#6D6B77">${note}</p></td></tr>
<tr><td dir="rtl" style="padding:16px 28px;border-top:1px solid #202027;font-family:Tahoma,Arial,sans-serif;text-align:center;font-size:12px;color:#6D6B77">ميثاق — لجميع الخدمات والاشتراكات الرقمية</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendCodeEmail(env, to, kind, code) {
  if (!env.RESEND_API_KEY) fail(500, 'خدمة البريد غير مُعدة بعد', 'config');
  const t = kind === 'reset'
    ? { subject: `${code} كود استرجاع كلمة المرور | ميثاق`, title: 'استرجاع كلمة المرور', intro: 'استعمل الكود هذا باش تغيّر كلمة المرور متاعك.' }
    : { subject: `${code} كود تأكيد بريدك | ميثاق`, title: 'أكّد بريدك الإلكتروني', intro: 'اكتب الكود هذا في الموقع باش يتأكد حسابك.' };
  const note = 'الكود صالح لمدة 10 دقائق. لو ما طلبتش الكود، تجاهل الرسالة هذي ومحدش يقدر يدخل حسابك.';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'ميثاق <noreply@iqstore.com.ly>',
      to: [to],
      subject: t.subject,
      html: codeEmail(env, { ...t, code, note }),
      text: `${t.title}\n\nالكود: ${code}\n\n${note}`,
    }),
  });
  if (!res.ok) {
    const out = await res.json().catch(() => ({}));
    console.log('mail failed', res.status, JSON.stringify(out));
    fail(502, 'تعذر إرسال البريد حالياً، حاول بعد شوية');
  }
}
