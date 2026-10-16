// حقل كود التحقق (6 خانات) + عدّاد إعادة الإرسال
export function codeInputHtml(id) {
  return `<div class="otp" id="${id}" dir="ltr">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="الرقم ${i + 1}" ${i === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off"'}>`).join('')}</div>`;
}

export function bindCodeInput(box, onComplete) {
  const inputs = [...box.querySelectorAll('input')];
  const value = () => inputs.map((i) => i.value).join('');
  const fill = (digits, from = 0) => {
    digits.split('').forEach((d, k) => { if (inputs[from + k]) inputs[from + k].value = d; });
    const next = inputs[Math.min(from + digits.length, 5)];
    next.focus();
    if (value().length === 6) onComplete && onComplete();
  };
  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const d = inp.value.replace(/\D/g, '');
      inp.value = '';
      if (d) fill(d.slice(0, 6 - i), i);
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && i > 0) { inputs[i - 1].value = ''; inputs[i - 1].focus(); e.preventDefault(); }
      if (e.key === 'ArrowLeft' && i < 5) inputs[i + 1].focus();
      if (e.key === 'ArrowRight' && i > 0) inputs[i - 1].focus();
    });
    inp.addEventListener('paste', (e) => {
      const d = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (d) { e.preventDefault(); inputs.forEach((x) => { x.value = ''; }); fill(d, 0); }
    });
  });
  setTimeout(() => inputs[0].focus(), 80);
  return { value, clear: () => { inputs.forEach((x) => { x.value = ''; }); inputs[0].focus(); } };
}

// يقفل الزر ويعرض عداد تنازلي
export function startCountdown(btn, seconds) {
  const label = btn.querySelector('.label') || btn;
  const original = label.dataset.orig || label.textContent;
  label.dataset.orig = original;
  let left = seconds;
  const tick = () => {
    if (!btn.isConnected) return;
    if (left <= 0) { btn.disabled = false; label.textContent = original; return; }
    btn.disabled = true;
    label.textContent = `إرسال كود جديد (${left})`;
    left -= 1;
    setTimeout(tick, 1000);
  };
  // بعد ما يخلص أي تحميل على الزر
  setTimeout(tick, 0);
}
