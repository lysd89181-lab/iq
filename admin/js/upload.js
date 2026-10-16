// رفع الصور من الهاتف: تصغير + ضغط في المتصفح، ثم رفع عبر السيرفر
import { html, raw, imgUrl } from '../../js/core/utils.js';
import { icon } from '../../js/core/icons.js';
import { api } from '../../js/core/api.js';
import { toast, toastErr } from '../../js/core/ui.js';

const MAX_SIDE = { products: 1000, categories: 600, banners: 1800 };

async function compress(file, maxSide) {
  if (!/^image\//.test(file.type)) throw new Error('اختار ملف صورة');
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('تعذر قراءة الصورة، جرّب صورة ثانية');
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();
  const toBlob = (type, q) => new Promise((r) => canvas.toBlob(r, type, q));
  let blob = await toBlob('image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', 0.85);
  for (let q = 0.7; blob.size > 1_200_000 && q > 0.3; q -= 0.15) blob = await toBlob(blob.type, q);
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  return { dataUrl, size: blob.size };
}

// حقل صورة: معاينة + زر رفع + حقل رابط (اختياري)
export function imageField(name, value, folder, label = 'الصورة', attrs = '') {
  return html`<div class="field img-field" data-folder="${folder}">
    ${label ? html`<label>${label}</label>` : ''}
    <div class="img-row">
      <div class="img-prev">${value ? html`<img src="${imgUrl(value)}" alt="">` : icon('image')}</div>
      <div class="stack" style="flex:1;gap:8px">
        <label class="btn btn-ghost btn-sm img-pick">${icon('download', 'sm')}<span class="label">رفع صورة من الجهاز</span><span class="spin"></span>
          <input type="file" accept="image/*" hidden></label>
        <input ${raw(name ? `name="${name}"` : '')} ${raw(attrs)} class="input ltr img-url" dir="ltr" value="${value || ''}" placeholder="أو الصق رابط صورة">
      </div>
    </div></div>`;
}

export function bindImageFields(root) {
  root.querySelectorAll('.img-field').forEach((f) => {
    const file = f.querySelector('input[type=file]');
    const pick = f.querySelector('.img-pick');
    const urlIn = f.querySelector('.img-url');
    const prev = f.querySelector('.img-prev');
    const show = (src) => { prev.innerHTML = src ? `<img src="${src}" alt="">` : ''; };
    urlIn.addEventListener('change', () => show(urlIn.value.trim() ? imgUrl(urlIn.value.trim()) : ''));
    file.addEventListener('change', async () => {
      const fl = file.files[0];
      file.value = '';
      if (!fl) return;
      pick.classList.add('loading');
      pick.style.pointerEvents = 'none';
      try {
        const folder = f.dataset.folder;
        const { dataUrl } = await compress(fl, MAX_SIDE[folder] || 1000);
        show(dataUrl);
        const r = await api('/v1/admin/upload', { data: dataUrl, folder });
        urlIn.value = r.path;
        urlIn.dispatchEvent(new Event('input', { bubbles: true }));
        toast('تم رفع الصورة. احفظ باش تتسجل، وتظهر للزبائن خلال دقيقة');
      } catch (err) {
        show(urlIn.value.trim() ? imgUrl(urlIn.value.trim()) : '');
        toastErr(err);
      } finally {
        pick.classList.remove('loading');
        pick.style.pointerEvents = '';
      }
    });
  });
}

export const imageFieldRaw = (...a) => raw(imageField(...a).html);
