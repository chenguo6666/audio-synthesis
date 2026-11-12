// 生成一段立体声 16bit 正弦波 WAV，供冒烟测试使用
// 用法：node scripts/make-test-wav.mjs <输出路径> [秒数=3] [频率=440]
import { writeFileSync } from 'node:fs';

const [out = 'test.wav', secArg = '3', freqArg = '440'] = process.argv.slice(2);
const rate = 44100;
const channels = 2;
const frames = Math.round(rate * Number(secArg));
const dataSize = frames * channels * 2;
const buf = Buffer.alloc(44 + dataSize);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(channels, 22);
buf.writeUInt32LE(rate, 24);
buf.writeUInt32LE(rate * channels * 2, 28);
buf.writeUInt16LE(channels * 2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(dataSize, 40);
for (let i = 0; i < frames; i++) {
  const v = Math.round(Math.sin((2 * Math.PI * Number(freqArg) * i) / rate) * 0.5 * 32767);
  for (let c = 0; c < channels; c++) buf.writeInt16LE(v, 44 + (i * channels + c) * 2);
}
writeFileSync(out, buf);
console.log(`已生成 ${out}`);
