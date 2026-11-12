// 安卓（Capacitor）端的文件保存：WebView 不支持 <a download>，改为原生写文件
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { setSaveHandler } from '../lib/save';

const FOLDER = '音频剪辑合成';
/** 分块写入，避免一次性把大文件转成超长 base64 字符串（3 的倍数，保证每块可独立解码） */
const CHUNK = 3 * 1024 * 1024;

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exists(path: string, directory: Directory): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory });
    return true;
  } catch {
    return false;
  }
}

/** 同名文件存在时追加 (2)、(3)…，不覆盖用户已有文件 */
async function uniquePath(dir: string, filename: string, directory: Directory): Promise<string> {
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  let candidate = `${dir}/${filename}`;
  for (let i = 2; await exists(candidate, directory); i++) candidate = `${dir}/${base} (${i})${ext}`;
  return candidate;
}

async function writeChunked(path: string, directory: Directory, blob: Blob): Promise<void> {
  let offset = 0;
  do {
    const data = await toBase64(blob.slice(offset, offset + CHUNK));
    if (offset === 0) await Filesystem.writeFile({ path, data, directory, recursive: true });
    else await Filesystem.appendFile({ path, data, directory });
    offset += CHUNK;
  } while (offset < blob.size);
}

export function installNativePlatform(): void {
  setSaveHandler(async (blob, filename) => {
    try {
      const path = await uniquePath(FOLDER, filename, Directory.Documents);
      await writeChunked(path, Directory.Documents, blob);
      return `文档/${path}`;
    } catch {
      // 部分机型无法写公共目录：写入应用缓存后交给系统分享面板，由用户选择保存位置
      const path = await uniquePath('export', filename, Directory.Cache);
      await writeChunked(path, Directory.Cache, blob);
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await Share.share({ title: filename, files: [uri] });
      return '已打开系统分享面板，请选择保存位置';
    }
  });
}
