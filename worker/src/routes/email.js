// أكواد البريد: تأكيد الحساب + استرجاع كلمة المرور
import { requireUser } from '../lib/context.js';
import { lookupUserByEmail, updateAuthUser } from '../lib/google.js';
import { sendCodeEmail } from '../lib/mail.js';
import { fail, num, str, readJson, randomId, sha256Hex } from '../lib/util.js';

const CODE_TTL = 10 * 60 * 1000;
const RESEND_GAP = 60 * 1000;
const PER_HOUR = 5;
const MAX_TRIES = 5;

const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
const msOf = (d) => (d instanceof Date ? d.getTime() : 0);

// ينشئ كود جديد مع حدود الإرسال، ويرجّعه للإرسال
async function issueCode(fs, path, base) {
  const now = Date.now();
  const prev = (await fs.get(path))?.data || {};
  const wait = msOf(prev.lastSentAt) + RESEND_GAP - now;
  if (wait > 0) fail(429, `استنى ${Math.ceil(wait / 1000)} ثانية قبل ما تطلب كود جديد`, 'rate_limited');
  const inWindow = now - msOf(prev.windowStart) < 3600_000;
  const count = inWindow ? num(prev.windowCount) : 0;
  if (count >= PER_HOUR) fail(429, 'طلبت أكواد كثيرة، حاول بعد ساعة', 'rate_limited');
  const code = newCode();
  const salt = randomId(16);
  await fs.commit([fs.wSet(path, {
    ...base, salt, hash: await sha256Hex(`${salt}:${code}`),
    expiresAt: new Date(now + CODE_TTL), attempts: 0, lastSentAt: new Date(now),
    windowStart: inWindow ? prev.windowStart : new Date(now), windowCount: count + 1,
  })]);
  return code;
}

// يتحقق من الكود؛ يرجّع بيانات المستند لو صحيح
async function checkCode(fs, path, code) {
  code = str(code, 10).replace(/\D/g, '');
  if (code.length !== 6) fail(400, 'الكود 6 أرقام');
  const doc = await fs.get(path);
  const d = doc?.data;
  if (!d || !d.hash) fail(400, 'اطلب كود جديد', 'code_missing');
  if (msOf(d.expiresAt) < Date.now()) fail(400, 'الكود انتهت صلاحيته، اطلب كود جديد', 'code_expired');
  if (num(d.attempts) >= MAX_TRIES) fail(429, 'محاولات كثيرة، اطلب كود جديد', 'code_locked');
  if ((await sha256Hex(`${d.salt}:${code}`)) !== d.hash) {
    await fs.commit([fs.wUpdate(path, { attempts: num(d.attempts) + 1 })]);
    const left = MAX_TRIES - num(d.attempts) - 1;
    fail(400, left > 0 ? `الكود غير صحيح، باقي ${left} محاولات` : 'الكود غير صحيح، اطلب كود جديد', 'code_wrong');
  }
  return d;
}

// حد عام لكل جهاز (IP) عشان ما حد يغرق البريد
async function ipLimit(req, fs, max = 15) {
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const path = `rate_limits/ip_${(await sha256Hex(ip)).slice(0, 32)}`;
  const d = (await fs.get(path))?.data || {};
  const now = Date.now();
  const inWindow = now - msOf(d.windowStart) < 3600_000;
  const count = inWindow ? num(d.count) : 0;
  if (count >= max) fail(429, 'محاولات كثيرة من هذا الجهاز، حاول بعد ساعة', 'rate_limited');
  await fs.commit([fs.wSet(path, { windowStart: inWindow ? d.windowStart : new Date(now), count: count + 1 })]);
}

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function sendVerifyCode(req, env, fs) {
  const user = await requireUser(req, env, fs, { verified: false });
  if (user.emailVerified) return { ok: true, already: true };
  if (!user.email) fail(400, 'الحساب بدون بريد');
  await ipLimit(req, fs, 20);
  const code = await issueCode(fs, `email_codes/${user.uid}`, { uid: user.uid, email: user.email });
  await sendCodeEmail(env, user.email, 'verify', code);
  return { ok: true, sentTo: user.email };
}

export async function verifyEmailCode(req, env, fs) {
  const user = await requireUser(req, env, fs, { verified: false });
  if (user.emailVerified) return { ok: true, already: true };
  const body = await readJson(req);
  const d = await checkCode(fs, `email_codes/${user.uid}`, body.code);
  if (d.email && d.email !== user.email) fail(400, 'اطلب كود جديد', 'code_missing');
  await updateAuthUser(env, user.uid, { emailVerified: true });
  await fs.commit([fs.wDelete(`email_codes/${user.uid}`)]);
  return { ok: true };
}

export async function sendResetCode(req, env, fs) {
  const body = await readJson(req);
  const email = str(body.email, 120).toLowerCase();
  if (!validEmail(email)) fail(400, 'صيغة البريد غير صحيحة');
  await ipLimit(req, fs, 10);
  const user = await lookupUserByEmail(env, email);
  // نفس الرد دائماً حتى لو البريد مش مسجل (ما نكشفوش الحسابات)
  if (!user || user.disabled) return { ok: true };
  const id = (await sha256Hex(email)).slice(0, 40);
  const code = await issueCode(fs, `reset_codes/${id}`, { uid: user.localId, email });
  await sendCodeEmail(env, email, 'reset', code);
  return { ok: true };
}

export async function resetPassword(req, env, fs) {
  const body = await readJson(req);
  const email = str(body.email, 120).toLowerCase();
  const password = String(body.password || '');
  if (!validEmail(email)) fail(400, 'صيغة البريد غير صحيحة');
  if (password.length < 8 || password.length > 128) fail(400, 'كلمة المرور لازم 8 أحرف على الأقل');
  const path = `reset_codes/${(await sha256Hex(email)).slice(0, 40)}`;
  const d = await checkCode(fs, path, body.code);
  // اللي استلم الكود أثبت إن البريد بريده، فنأكده كمان
  await updateAuthUser(env, d.uid, { password, emailVerified: true });
  await fs.commit([fs.wDelete(path)]);
  return { ok: true };
}
