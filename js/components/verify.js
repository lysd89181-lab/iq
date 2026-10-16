// نافذة تأكيد البريد بكود من 6 أرقام (تستعمل في السلة وحسابي)
import { auth } from '../core/firebase.js';
import { api } from '../core/api.js';
import { html, raw } from '../core/utils.js';
import { icon } from '../core/icons.js';
import { sheet, toast, toastErr, withLoading } from '../core/ui.js';
import { codeInputHtml, bindCodeInput, startCountdown } from './code-input.js';

// يرجّع true لو تأكد البريد
export function openVerifySheet() {
  return new Promise((resolve) => {
    let done = false;
    const email = auth.currentUser?.email || '';
    const s = sheet('تأكيد البريد الإلكتروني', html`<div class="stack-lg" style="text-align:center">
      <p class="muted">بعثنا كود من 6 أرقام على <b class="ltr" style="color:var(--paper)">${email}</b>. شوف الرسائل غير المرغوبة لو ما لقيتهوش.</p>
      ${raw(codeInputHtml('vCode'))}
      <button class="btn btn-primary btn-block" id="vOk"><span class="label">تأكيد</span><span class="spin"></span></button>
      <button class="btn btn-ghost btn-block" id="vAgain">${icon('refresh', 'sm')}<span class="label">إرسال كود جديد</span></button>
    </div>`.html, { onClose: () => { if (!done) resolve(false); } });
    const again = s.el.querySelector('#vAgain');
    const ok = s.el.querySelector('#vOk');
    const code = bindCodeInput(s.el.querySelector('#vCode'), () => ok.click());

    const send = async () => {
      try {
        const r = await api('/v1/email/send-code');
        if (r.already) { await finish(); return; }
        toast('بعثنا الكود لبريدك');
        startCountdown(again, 60);
      } catch (err) {
        toastErr(err);
        if (err.code === 'rate_limited') startCountdown(again, 60);
      }
    };
    const finish = async () => {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      done = true;
      toast('تم تأكيد بريدك');
      s.close();
      resolve(true);
    };
    ok.onclick = () => withLoading(ok, async () => {
      const v = code.value();
      if (v.length !== 6) return toast('اكتب الكود كامل (6 أرقام)', 'err');
      try {
        await api('/v1/email/verify', { code: v });
        await finish();
      } catch (err) { code.clear(); toastErr(err); }
    });
    again.onclick = () => withLoading(again, send);
    send();
  });
}
