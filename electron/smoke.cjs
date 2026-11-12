// 冒烟测试：设置环境变量 AUDIO_SMOKE_TEST=<音频文件路径> 启动客户端，
// 自动导入该文件并导出 FLAC，结果打印到标准输出后退出（退出码 0 = 通过）。
const fs = require('node:fs');
const path = require('node:path');

async function runSmoke(win, file) {
  const log = (...a) => process.stdout.write(`[smoke] ${a.join(' ')}\n`);
  try {
    await new Promise((r) => win.webContents.once('did-finish-load', r));
    const b64 = fs.readFileSync(file).toString('base64');
    const name = path.basename(file);
    const result = await win.webContents.executeJavaScript(`(async () => {
      const bin = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bin], ${JSON.stringify(name)}));
      document.querySelector('.drop').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
      const wait = async (pred, ms) => { const t = Date.now(); while (!pred()) { if (Date.now() - t > ms) return false; await new Promise((r) => setTimeout(r, 200)); } return true; };
      if (!(await wait(() => document.querySelector('.clip') || document.querySelector('.jobs .error'), 120000))) return { ok: false, step: 'import-timeout' };
      if (document.querySelector('.jobs .error')) return { ok: false, step: 'import', error: document.querySelector('.jobs .error').innerText };
      await new Promise((r) => setTimeout(r, 1500));
      document.querySelector('.export .btn.primary').click();
      if (!(await wait(() => document.querySelector('.result') || document.querySelector('.export .error'), 120000))) return { ok: false, step: 'export-timeout' };
      if (document.querySelector('.export .error')) return { ok: false, step: 'export', error: document.querySelector('.export .error').innerText };
      return { ok: true, clip: document.querySelector('.clip-meta').innerText.replace(/\\n/g, ' '), result: document.querySelector('.result .muted').innerText };
    })()`);
    log(JSON.stringify(result));
    return result.ok ? 0 : 1;
  } catch (e) {
    log('异常', e && e.stack ? e.stack : String(e));
    return 1;
  }
}

module.exports = { runSmoke };
