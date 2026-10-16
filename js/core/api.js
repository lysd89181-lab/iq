// الاتصال بالسيرفر — كل العمليات المالية والحساسة تمر من هنا
import { API_BASE } from './config.js';
import { auth } from './firebase.js';

export class ApiError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

// opts.public: طلب بدون تسجيل دخول (مثل استرجاع كلمة المرور)
export async function api(path, body = {}, opts = {}) {
  const user = auth.currentUser;
  if (!opts.public && !user) throw new ApiError('سجل دخولك أولاً', 'unauthenticated', 401);
  const send = async (force) => {
    const headers = { 'Content-Type': 'application/json' };
    if (user && !opts.public) headers.Authorization = `Bearer ${await user.getIdToken(force)}`;
    return fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  };
  let res;
  try {
    res = await send(false);
    // لو الجلسة قديمة (مثلاً بعد تأكيد البريد) نجددها ونعيد مرة وحدة
    if (!opts.public && (res.status === 401 || res.status === 403)) {
      const peek = await res.clone().json().catch(() => ({}));
      if (peek.code === 'unauthenticated' || peek.code === 'email_not_verified') res = await send(true);
    }
  } catch {
    throw new ApiError('تعذر الاتصال، تأكد من الإنترنت وحاول مرة أخرى', 'network');
  }
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new ApiError(out.error || 'صار خطأ، حاول مرة أخرى', out.code, res.status);
  return out;
}
