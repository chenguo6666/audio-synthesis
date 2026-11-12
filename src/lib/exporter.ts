import { buildExportPlan, parseProgressTime, type ExportPlan } from './exportPlan';
import { safeDelete, withFFmpeg } from './ffmpeg';
import { FORMAT_INFO, type Clip, type ExportOptions } from './types';

export interface ExportResult {
  blob: Blob;
  plan: ExportPlan;
}

/** 按片段顺序裁剪并拼接，编码为目标格式 */
export async function exportClips(
  clips: Clip[],
  opts: ExportOptions,
  onProgress?: (ratio: number) => void,
): Promise<ExportResult> {
  const plan = buildExportPlan(clips, opts);
  return withFFmpeg(
    async (ff) => {
      try {
        for (const [i, clip] of clips.entries()) {
          await ff.writeFile(plan.inputNames[i], new Uint8Array(await clip.blob.arrayBuffer()));
        }
        const code = await ff.exec(plan.args);
        if (code !== 0) throw new Error(`导出失败（ffmpeg 退出码 ${code}）`);
        const data = (await ff.readFile(plan.outputName)) as Uint8Array;
        onProgress?.(1);
        return {
          blob: new Blob([data as BlobPart], { type: FORMAT_INFO[opts.format].mime }),
          plan,
        };
      } finally {
        for (const n of plan.inputNames) await safeDelete(ff, n);
        await safeDelete(ff, plan.outputName);
      }
    },
    (line) => {
      const t = parseProgressTime(line);
      if (t !== null && plan.duration > 0) onProgress?.(Math.min(0.99, t / plan.duration));
    },
  );
}
