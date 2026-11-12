"""生成应用图标（与 public/icon.svg 同款图案）。

用法：python scripts/make-icons.py
输出：
  build/icon.png、build/icon.ico            —— Electron 客户端
  android/app/src/main/res/mipmap-*/...     —— 安卓（存在 android 目录时）
依赖：Pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BLUE = (37, 99, 235, 255)
WHITE = (255, 255, 255, 255)
# 与 SVG 一致的 64 单位坐标：(x, y, 宽, 高)
BARS = [(12, 26, 5, 12), (21, 18, 5, 28), (30, 12, 5, 40), (39, 20, 5, 24), (48, 27, 5, 10)]
SS = 4  # 超采样倍数，抗锯齿


def draw_bars(d: ImageDraw.ImageDraw, size: int, scale: float, offset: float) -> None:
    u = size / 64 * scale
    for x, y, w, h in BARS:
        box = [offset + x * u, offset + y * u, offset + (x + w) * u, offset + (y + h) * u]
        d.rounded_rectangle(box, radius=w * u / 2, fill=WHITE)


def full_icon(size: int, round_shape: bool = False) -> Image.Image:
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if round_shape:
        d.ellipse([0, 0, big - 1, big - 1], fill=BLUE)
        draw_bars(d, big, 0.8, big * 0.1)
    else:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 14 / 64, fill=BLUE)
        draw_bars(d, big, 1, 0)
    return img.resize((size, size), Image.LANCZOS)


def foreground(size: int) -> Image.Image:
    """安卓自适应图标前景：图案位于中间 66% 安全区内，背景透明"""
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw_bars(ImageDraw.Draw(img), big, 0.6, big * 0.2)
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    build = ROOT / "build"
    build.mkdir(exist_ok=True)
    full_icon(512).save(build / "icon.png")
    full_icon(256).save(build / "icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("已生成 build/icon.png、build/icon.ico")

    res = ROOT / "android" / "app" / "src" / "main" / "res"
    if not res.exists():
        return
    densities = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, k in densities.items():
        out = res / f"mipmap-{name}"
        out.mkdir(parents=True, exist_ok=True)
        full_icon(int(48 * k)).save(out / "ic_launcher.png")
        full_icon(int(48 * k), round_shape=True).save(out / "ic_launcher_round.png")
        foreground(int(108 * k)).save(out / "ic_launcher_foreground.png")
    # 启动图：浅色背景 + 居中图标，替换 Capacitor 默认 logo
    for splash in res.glob("drawable*/splash.png"):
        w, h = Image.open(splash).size
        canvas = Image.new("RGBA", (w, h), (245, 247, 251, 255))
        icon = full_icon(int(min(w, h) * 0.28))
        canvas.alpha_composite(icon, ((w - icon.width) // 2, (h - icon.height) // 2))
        canvas.convert("RGB").save(splash)
    values = res / "values"
    values.mkdir(parents=True, exist_ok=True)
    (values / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#2563EB</color>\n</resources>\n',
        encoding="utf-8",
    )
    print("已生成安卓 mipmap 图标")


if __name__ == "__main__":
    main()
