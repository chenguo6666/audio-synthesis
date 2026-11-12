/** 保存导出结果。网页与 Electron 走浏览器下载；安卓端在打包阶段替换为原生保存。 */
export type SaveHandler = (blob: Blob, filename: string) => Promise<string | void>;

let handler: SaveHandler = async (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export function setSaveHandler(h: SaveHandler): void {
  handler = h;
}

export function saveBlob(blob: Blob, filename: string): Promise<string | void> {
  return handler(blob, filename);
}

/** 去掉文件名中各平台不允许的字符 */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return cleaned || '合成音频';
}
