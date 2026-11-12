/** 秒 → "m:ss.mmm"（超过 1 小时为 "h:mm:ss.mmm"） */
export function formatTime(sec: number, digits = 3): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const factor = 10 ** digits;
  const total = Math.round(sec * factor);
  const frac = total % factor;
  const whole = (total - frac) / factor;
  const s = whole % 60;
  const m = Math.floor(whole / 60) % 60;
  const h = Math.floor(whole / 3600);
  const fracStr = digits > 0 ? '.' + String(frac).padStart(digits, '0') : '';
  const ss = String(s).padStart(2, '0') + fracStr;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * 解析用户输入的时间，支持 "83.5"、"1:23.5"、"0:01:23.5"。
 * 无法解析时返回 null。
 */
export function parseTime(input: string): number | null {
  const text = input.trim().replace('：', ':');
  if (!/^\d+(:\d+){0,2}(\.\d+)?$/.test(text) && !/^\d*\.\d+$/.test(text)) return null;
  const parts = text.split(':');
  let sec = 0;
  for (const p of parts) sec = sec * 60 + Number(p);
  return Number.isFinite(sec) ? sec : null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
