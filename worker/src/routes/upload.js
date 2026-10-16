// رفع صور لوحة التحكم إلى مستودع الموقع (تنفتح من نفس الدومين)
import { requireStaff } from '../lib/context.js';
import { fail, str, readJson, randomId } from '../lib/util.js';

const MAX_BYTES = 1.5 * 1024 * 1024;
const FOLDERS = ['products', 'categories', 'banners'];

function sniff(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'webp';
  return null;
}

export async function uploadImage(req, env, fs) {
  const body = await readJson(req, 3_000_000);
  const dir = FOLDERS.includes(body.folder) ? body.folder : 'products';
  await requireStaff(req, env, fs, dir === 'banners' ? 'settings' : 'products');
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) fail(500, 'رفع الصور غير مُعد بعد', 'config');

  const b64 = str(body.data, 3_000_000).replace(/^data:image\/\w+;base64,/, '');
  let bytes;
  try {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    fail(400, 'الصورة غير صالحة');
  }
  if (bytes.length > MAX_BYTES) fail(413, 'الصورة كبيرة، الحد 1.5 ميجا');
  const ext = sniff(bytes);
  if (!ext) fail(400, 'نوع الصورة غير مدعوم (JPG، PNG، WebP فقط)');

  const d = new Date();
  const path = `uploads/${dir}/${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}/${randomId(12)}.${ext}`;
  const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mithaq-api',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: `صورة جديدة: ${path}`, content: b64, branch: env.GITHUB_BRANCH || 'main' }),
  });
  if (!res.ok) {
    console.log('upload failed', res.status, (await res.text()).slice(0, 300));
    fail(502, 'تعذر رفع الصورة حالياً، حاول بعد شوية');
  }
  return { ok: true, path };
}
