# 音频剪辑合成（audio-synthesis）

一个**纯本地**的小工具：从音频或视频中提取声音，裁剪每段需要的部分，按顺序拼接，再无损导出。

- 🔒 所有处理都在你自己的设备上完成，文件不会上传到任何服务器
- 🎬 支持音频（MP3 / FLAC / WAV / OGG / M4A / AAC / OPUS …）和视频（MP4 / MKV / MOV / WEBM …，自动提取音轨）
- ✂️ 波形可视化，拖动选区或输入时间来裁剪，可试听保留部分和结尾
- 🔗 多段按列表顺序硬接拼合，采样级精确
- 💾 导出 FLAC / WAV（无损），或 MP3 / OGG / M4A（有损、体积小）

## 使用方式

### 1. 在线使用（免安装）

打开 <https://chenguo6666.github.io/audio-synthesis/>。处理同样只在本机浏览器中进行。

### 2. 一行命令本地运行

需要 [Node.js](https://nodejs.org/) 20.19 或更高版本：

```bash
git clone https://github.com/chenguo6666/audio-synthesis.git && cd audio-synthesis && npm ci && npm start
```

浏览器会自动打开 `http://localhost:4173`。

### 3. Windows 客户端 / 安卓应用

在 [Releases](https://github.com/chenguo6666/audio-synthesis/releases) 页面下载：

- `audio-synthesis-x.y.z-win-x64-setup.exe`：Windows 10/11 安装程序（未做代码签名，首次运行时 SmartScreen 可能拦截，点「更多信息 → 仍要运行」）
- `audio-synthesis-x.y.z-android*.apk`：Android 7.0 及以上，导出文件保存在「文档/音频剪辑合成」目录

每次推送到 main 的构建也可以在 [Actions](https://github.com/chenguo6666/audio-synthesis/actions) 页面的 Artifacts 中下载测试版。

## 关于「无损」

- 导出为 **FLAC / WAV** 时，对解码后的音频**不再做任何有损压缩**。
- 如果源文件本身是有损格式（MP3、OGG、AAC 等），它在制作时损失的音质无法找回；本工具保证的是**不再多损失一次**。
- 位深选「自动」时：源文件有 24bit 无损音频则导出 24bit，否则导出 16bit。
- 多段的采样率或声道不同时，统一取最高规格（不降采样），单声道片段会被扩展为立体声。

## 不支持的文件

酷狗（KGM / VPR）、网易云（NCM）、QQ 音乐（QMC / MFLAC / MGG）等平台的**加密下载文件**不是普通音频，工具会识别并提示。请在对应客户端中导出为普通格式后再导入。

## 开发

```bash
npm ci          # 安装依赖
npm run dev     # 开发服务器 http://localhost:5173
npm test        # 单元测试
npm run build   # 生产构建，产物在 dist/

npm run app       # 以 Electron 客户端方式运行
npm run dist:win  # 打包 Windows 安装程序到 release/
npm run android:sync   # 构建并同步到 android/ 工程（之后可用 Android Studio 打开 android/）
```

> 若本机 npm 禁用了安装脚本（`ignore-scripts=true`），上述 Electron 命令会通过 `npm run electron:setup` 显式下载 Electron 运行时。国内网络可设置环境变量 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` 加速。

### 发布新版本

修改 `package.json` 中的 `version`，提交后打标签推送即可，CI 会自动构建并发布到 Releases：

```bash
git tag v0.1.0 && git push origin v0.1.0
```

安卓正式签名（可选）：在仓库 Settings → Secrets 中配置 `ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`；未配置时产出 debug 签名的 APK。

技术栈：Vite + React + TypeScript，[ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)（浏览器内的 ffmpeg）负责解码、提取和编码，[wavesurfer.js](https://wavesurfer.xyz/) 负责波形与播放。

处理流程：导入的文件统一转为无损 FLAC 中间文件 → 在界面上设定每段的保留区间 → 导出时由 ffmpeg 按 `atrim + concat` 一次性裁剪、拼接、编码。

## 许可

[MIT](LICENSE)
