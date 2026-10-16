// الدخول، إنشاء حساب، استعادة كلمة المرور، وتأكيد البريد
import {
  auth, db, doc, setDoc, serverTimestamp, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, updateProfile, signOut,
} from '../js/core/firebase.js';
import { html, raw } from '../js/core/utils.js';
import { icon } from '../js/core/icons.js';
import { toast, withLoading, friendlyError } from '../js/core/ui.js';
import { api } from '../js/core/api.js';
import { codeInputHtml, bindCodeInput, startCountdown } from '../js/components/code-input.js';

const view = document.getElementById('authView');
const params = new URLSearchParams(location.search);
// الرجوع لنفس الصفحة بعد الدخول (hash داخل المتجر فقط)
const nextHash = /^#\/[\w\/?=&%-]*$/.test(params.get('next') || '') ? params.get('next') : '#/';
const storeUrl = new URL('../', location.href).href;
const goNext = () => location.replace(storeUrl + nextHash);

const ERR = {
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'البريد أو كلمة المرور غير صحيحة',
  'auth/user-not-found': 'البريد أو كلمة المرور غير صحيحة',
  'auth/invalid-email': 'صيغة البريد غير صحيحة',
  'auth/email-already-in-use': 'البريد هذا عنده حساب. سجل دخولك أو استرجع كلمة المرور',
  'auth/weak-password': 'كلمة المرور ضعيفة، خليها 8 أحرف فيها حروف وأرقام',
  'auth/too-many-requests': 'محاولات كثيرة. استنى شوية وجرب مرة أخرى',
  'auth/user-disabled': 'الحساب هذا موقوف. تواصل مع الدعم',
  'auth/network-request-failed': 'تأكد من الإنترنت وجرب مرة أخرى',
};
const errMsg = (e) => ERR[e.code] || friendlyError(e);
const showErr = (form, msg) => { const h = form.querySelector('.hint.err'); h.textContent = msg; h.hidden = false; };

const pwField = (id, label, auto) => html`<div class="field"><label for="${id}">${label}</label>
  <div class="input-wrap">${icon('lock')}<input id="${id}" class="input ltr" dir="ltr" type="password" autocomplete="${auto}" required minlength="8">
  <button type="button" class="icon-btn trail" data-eye="${id}" aria-label="إظهار كلمة المرور">${icon('eye', 'sm')}</button></div></div>`;
const mailField = (val = '') => html`<div class="field"><label for="em">البريد الإلكتروني</label>
  <div class="input-wrap">${icon('mail')}<input id="em" class="input ltr" dir="ltr" type="email" autocomplete="email" required value="${val}"></div></div>`;

function bindEyes() {
  view.querySelectorAll('[data-eye]').forEach((b) => {
    b.onclick = () => { const i = document.getElementById(b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; };
  });
}

function login() {
  view.innerHTML = html`<h1>أهلاً بيك</h1><p class="lead">سجل دخولك باش تكمل</p>
    <form id="f" novalidate>
      ${mailField(params.get('email') || '')}
      ${pwField('pw', 'كلمة المرور', 'current-password')}
      <a href="#" class="link" id="toReset">نسيت كلمة المرور؟</a>
      <p class="hint err" hidden></p>
      <button class="btn btn-primary btn-block"><span class="label">تسجيل الدخول</span><span class="spin"></span></button>
    </form>
    <p class="switch-mode">ما عندكش حساب؟ <a href="#" id="toReg">أنشئ حساب جديد</a></p>`.html;
  bindEyes();
  view.querySelector('#toReg').onclick = (e) => { e.preventDefault(); register(); };
  view.querySelector('#toReset').onclick = (e) => { e.preventDefault(); reset(view.querySelector('#em').value); };
  const f = view.querySelector('#f');
  f.onsubmit = (e) => {
    e.preventDefault();
    withLoading(f.querySelector('button.btn'), async () => {
      try {
        await signInWithEmailAndPassword(auth, f.querySelector('#em').value.trim(), f.querySelector('#pw').value);
        goNext();
      } catch (err) { showErr(f, errMsg(err)); }
    });
  };
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
  return pw ? Math.max(s, 1) : 0;
}

function register() {
  view.innerHTML = html`<h1>حساب جديد</h1><p class="lead">دقيقة وحدة وتبدأ تشتري</p>
    <form id="f" novalidate>
      <div class="field"><label for="nm">الاسم</label><div class="input-wrap">${icon('user')}<input id="nm" class="input" autocomplete="name" required minlength="3" maxlength="60"></div></div>
      ${mailField()}
      <div class="field"><label for="ph">رقم الهاتف (واتساب)</label><div class="input-wrap">${icon('phone')}<input id="ph" class="input ltr" dir="ltr" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="09XXXXXXXX"></div></div>
      ${pwField('pw', 'كلمة المرور', 'new-password')}
      <div class="meter" id="meter"><i></i><i></i><i></i><i></i></div>
      <span class="hint">8 أحرف على الأقل، والأفضل فيها حروف كبيرة وأرقام.</span>
      ${pwField('pw2', 'تأكيد كلمة المرور', 'new-password')}
      <p class="hint err" hidden></p>
      <button class="btn btn-primary btn-block"><span class="label">إنشاء الحساب</span><span class="spin"></span></button>
    </form>
    <p class="switch-mode">عندك حساب؟ <a href="#" id="toLogin">سجل دخولك</a></p>`.html;
  bindEyes();
  view.querySelector('#toLogin').onclick = (e) => { e.preventDefault(); login(); };
  view.querySelector('#pw').oninput = (e) => { view.querySelector('#meter').className = `meter s${strength(e.target.value)}`; };
  const f = view.querySelector('#f');
  f.onsubmit = (e) => {
    e.preventDefault();
    const name = f.querySelector('#nm').value.trim();
    const email = f.querySelector('#em').value.trim();
    const phone = f.querySelector('#ph').value.trim();
    const pw = f.querySelector('#pw').value;
    if (name.length < 3) return showErr(f, 'اكتب اسمك (3 أحرف على الأقل)');
    if (!/^\S+@\S+\.\S+$/.test(email)) return showErr(f, 'صيغة البريد غير صحيحة');
    if (pw.length < 8) return showErr(f, 'كلمة المرور لازم 8 أحرف على الأقل');
    if (pw !== f.querySelector('#pw2').value) return showErr(f, 'كلمتا المرور مش متطابقتين');
    withLoading(f.querySelector('button.btn'), async () => {
      try {
        const { user } = await createUserWithEmailAndPassword(auth, email, pw);
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid, name, username: name.toLowerCase().replace(/\s+/g, '_'), email, phone,
          balance: 0, isActive: true, createdAt: serverTimestamp(), lastLogin: serverTimestamp(),
        });
        if (phone) localStorage.setItem('mq_phone', phone);
        sent(email);
      } catch (err) { showErr(f, errMsg(err)); }
    });
  };
}

// شاشة كود تأكيد البريد بعد التسجيل
function sent(email) {
  view.innerHTML = html`<div class="sent">
    <span class="ring">${icon('mail')}</span>
    <h1>أكّد بريدك</h1>
    <p class="muted">بعثنا كود من 6 أرقام على <b class="ltr">${email}</b>. شوف الرسائل غير المرغوبة لو ما لقيتهوش.</p>
    ${raw(codeInputHtml('code'))}
    <p class="hint err" hidden></p>
    <button class="btn btn-primary btn-block" id="done"><span class="label">تأكيد</span><span class="spin"></span></button>
    <button class="btn btn-ghost btn-block" id="again"><span class="label">إرسال كود جديد</span><span class="spin"></span></button>
    <a href="#" class="link" id="later" style="justify-self:center">أكمل التصفح، نأكد بعدين</a>
  </div>`.html;
  const box = view.querySelector('.sent');
  const done = view.querySelector('#done');
  const again = view.querySelector('#again');
  const code = bindCodeInput(view.querySelector('#code'), () => done.click());
  const send = async () => {
    try {
      const r = await api('/v1/email/send-code');
      if (r.already) return finish();
      startCountdown(again, 60);
    } catch (err) {
      showErr(box, friendlyError(err));
      if (err.code === 'rate_limited') startCountdown(again, 60);
    }
  };
  const finish = async () => {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    toast('تم تأكيد بريدك');
    goNext();
  };
  done.onclick = () => withLoading(done, async () => {
    if (code.value().length !== 6) return showErr(box, 'اكتب الكود كامل (6 أرقام)');
    try {
      await api('/v1/email/verify', { code: code.value() });
      await finish();
    } catch (err) { code.clear(); showErr(box, friendlyError(err)); }
  });
  again.onclick = () => withLoading(again, send);
  view.querySelector('#later').onclick = (e) => { e.preventDefault(); goNext(); };
  send();
}

// استرجاع كلمة المرور: البريد ← الكود + كلمة مرور جديدة
function reset(prefill = '') {
  view.innerHTML = html`<h1>استرجاع كلمة المرور</h1><p class="lead">نبعثولك كود على بريدك تغيّر بيه كلمة المرور</p>
    <form id="f" novalidate>${mailField(prefill)}<p class="hint err" hidden></p>
      <button class="btn btn-primary btn-block"><span class="label">إرسال الكود</span><span class="spin"></span></button></form>
    <p class="switch-mode"><a href="#" id="toLogin">رجوع لتسجيل الدخول</a></p>`.html;
  view.querySelector('#toLogin').onclick = (e) => { e.preventDefault(); login(); };
  const f = view.querySelector('#f');
  f.onsubmit = (e) => {
    e.preventDefault();
    const email = f.querySelector('#em').value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return showErr(f, 'صيغة البريد غير صحيحة');
    withLoading(f.querySelector('button.btn'), async () => {
      try {
        await api('/v1/password/send-code', { email }, { public: true });
        resetCode(email);
      } catch (err) { showErr(f, friendlyError(err)); }
    });
  };
}

function resetCode(email) {
  view.innerHTML = html`<h1>كلمة مرور جديدة</h1>
    <p class="lead">لو البريد <b class="ltr">${email}</b> مسجل عندنا، بيوصله كود من 6 أرقام خلال دقيقة.</p>
    <form id="f" novalidate>
      ${raw(codeInputHtml('code'))}
      ${pwField('pw', 'كلمة المرور الجديدة', 'new-password')}
      ${pwField('pw2', 'تأكيد كلمة المرور', 'new-password')}
      <p class="hint err" hidden></p>
      <button class="btn btn-primary btn-block"><span class="label">حفظ والدخول</span><span class="spin"></span></button>
      <button type="button" class="btn btn-ghost btn-block" id="again"><span class="label">إرسال كود جديد</span><span class="spin"></span></button>
    </form>
    <p class="switch-mode"><a href="#" id="toLogin">رجوع لتسجيل الدخول</a></p>`.html;
  bindEyes();
  const f = view.querySelector('#f');
  const again = view.querySelector('#again');
  const code = bindCodeInput(view.querySelector('#code'), () => f.querySelector('#pw').focus());
  startCountdown(again, 60);
  view.querySelector('#toLogin').onclick = (e) => { e.preventDefault(); login(); };
  again.onclick = () => withLoading(again, async () => {
    try { await api('/v1/password/send-code', { email }, { public: true }); toast('بعثنا كود جديد'); startCountdown(again, 60); } catch (err) { showErr(f, friendlyError(err)); }
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    const pw = f.querySelector('#pw').value;
    if (code.value().length !== 6) return showErr(f, 'اكتب الكود كامل (6 أرقام)');
    if (pw.length < 8) return showErr(f, 'كلمة المرور لازم 8 أحرف على الأقل');
    if (pw !== f.querySelector('#pw2').value) return showErr(f, 'كلمتا المرور مش متطابقتين');
    withLoading(f.querySelector('button.btn-primary'), async () => {
      try {
        await api('/v1/password/reset', { email, code: code.value(), password: pw }, { public: true });
        await signInWithEmailAndPassword(auth, email, pw);
        toast('تم تغيير كلمة المرور');
        goNext();
      } catch (err) {
        if (err.code === 'code_wrong') code.clear();
        showErr(f, err.code ? friendlyError(err) : errMsg(err));
      }
    });
  };
}

// لو داخل من قبل: نرجعوه للمتجر، إلا لو حسابه غير مؤكد نوريه شاشة التأكيد
let first = true;
onAuthStateChanged(auth, (user) => {
  if (!first) return;
  first = false;
  if (user && params.get('mode') !== 'register') goNext();
  else if (params.get('mode') === 'register') { if (user) signOut(auth); register(); } else login();
});
