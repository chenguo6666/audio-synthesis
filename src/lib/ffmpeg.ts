import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg';
// 由 Vite 作为静态资源打包，离线可用（Electron / 安卓不依赖 CDN）
import coreURL from '@ffmpeg/core?url';
import wasmURL from '@ffmpeg/core/wasm?url';

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
/** ffmpeg.wasm 同一时间只能执行一个任务，用 Promise 链串行化 */
let queue: Promise<unknown> = Promise.resolve();

type LogListener = (line: string) => void;
const logListeners = new Set<LogListener>();

export function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      const ff = new FFmpeg();
      ff.on('log', ({ message }) => {
        for (const l of logListeners) l(message);
      });
      await ff.load({ coreURL, wasmURL });
      instance = ff;
      return ff;
    })().catch((err) => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

export function isFFmpegLoaded(): boolean {
  return instance !== null;
}

/** 独占执行一段 ffmpeg 操作；onLog 仅在本任务期间接收日志 */
export function withFFmpeg<T>(task: (ff: FFmpeg) => Promise<T>, onLog?: LogListener): Promise<T> {
  const run = async () => {
    const ff = await getFFmpeg();
    if (onLog) logListeners.add(onLog);
    try {
      return await task(ff);
    } finally {
      if (onLog) logListeners.delete(onLog);
    }
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** 以 WORKERFS 只读挂载用户文件，避免把大视频整份复制进 wasm 内存 */
export async function mountFile(ff: FFmpeg, file: File, dir: string): Promise<string> {
  await ff.createDir(dir);
  await ff.mount(FFFSType.WORKERFS, { files: [file] }, dir);
  return `${dir}/${file.name}`;
}

export async function unmountDir(ff: FFmpeg, dir: string): Promise<void> {
  try {
    await ff.unmount(dir);
  } catch {
    /* 忽略 */
  }
  try {
    await ff.deleteDir(dir);
  } catch {
    /* 忽略 */
  }
}

export async function safeDelete(ff: FFmpeg, path: string): Promise<void> {
  try {
    await ff.deleteFile(path);
  } catch {
    /* 忽略 */
  }
}
