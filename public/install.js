(() => {
  let deferredPrompt = null;
  const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const button = document.createElement('button');
  button.id = 'installApp'; button.className = 'install-app';
  button.type = 'button'; button.textContent = '📲 ติดตั้งแอพ';
  button.hidden = standalone();
  const dialog = document.createElement('dialog');
  dialog.id = 'installDialog'; dialog.className = 'install-dialog';
  dialog.innerHTML = '<button type="button" class="install-close" aria-label="ปิด">✕</button><img src="/icons/icon-192.png" alt="" width="80" height="80"><h2>พาหมาระเบิดไปเล่นทุกที่!</h2><p id="installInstructions"></p><p class="install-note">เปิดจากไอคอนบนหน้าจอได้เลย<br>ต้องเชื่อมต่ออินเทอร์เน็ตเพื่อเล่น</p><button type="button" class="install-confirm">เข้าใจแล้ว</button>';
  const close = () => dialog.close();
  dialog.querySelector('.install-close').onclick = close;
  dialog.querySelector('.install-confirm').onclick = close;
  dialog.addEventListener('click', e => { if (e.target === dialog) close(); });
  button.onclick = async () => {
    if (deferredPrompt) {
      const prompt = deferredPrompt; deferredPrompt = null;
      try {
        await prompt.prompt();
        const result = await prompt.userChoice;
        if (result.outcome === 'accepted') button.hidden = true;
      } catch { showInstructions(); }
    } else showInstructions();
  };
  function showInstructions() {
    dialog.querySelector('#installInstructions').textContent = ios
      ? 'เปิดลิงก์เกมใน Safari แตะปุ่มแชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม” จากนั้นแตะ “เพิ่ม”'
      : 'เปิดลิงก์เกมใน Chrome แตะเมนู ⋮ แล้วเลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก” หากเปิดในแชต ให้เปิดด้วยเบราว์เซอร์ก่อน';
    dialog.showModal();
  }
  document.body.append(button, dialog);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredPrompt = event;
    button.hidden = standalone();
  });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; button.hidden = true; if (dialog.open) close(); });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* normal online game remains usable */ });
  }
})();
