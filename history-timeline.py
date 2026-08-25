# -*- coding: utf-8 -*-
"""
通用型多轨横向历史演变图（甘特图 / Matplotlib）

怎么运行：
    python history-timeline.py
    → 生成 history-timeline.png（可直接放进网站素材）并自动用系统看图器打开

════════════════════════ 如何填入我自己的数据 ════════════════════════
① 所有要改的东西都在文件最上面的两个区域：【CONFIG 外观配置】和【DATA 数据列表】。
   绘图代码一个数字都不用碰——标题、坐标轴、时间刻度步长、颜色盘全由 CONFIG 控制。

② 加/改一条事件（政权、王朝、技术时期、人生阶段……什么都行），在 DATA 里加一行：
       {"name": "名字", "start_year": 开始年, "end_year": 结束年,
        "track_level": 轨道号（可省略）, "color": "#aabbcc"（可省略）}
   - 公元前用负数（公元前 221 年 → -221），公元后直接写正数。
   - track_level 省略或写 None → 代码自动找一条不与别的条重叠的轨道，保证永远不叠。
     想手动指定也行：两个同时间段并存的东西分别写 track_level 0 和 1 就各占一行。
   - color 省略 → 按 CONFIG 里的 palette 颜色盘自动轮流取色。

③ 换图的所有文字：改 CONFIG 里的 title / subtitle / x_label。
④ 改时间刻度密度：改 CONFIG 里的 "x_tick_step"（现在是每 200 年一格）。
⑤ 改完保存，重新运行本文件即可。

例子：DATA 里已经放了中国主要朝代 + 一组世界帝国做多轨演示——
      三国（魏/蜀/吴）会自动分成三条轨道，罗马帝国与汉朝并存时也会自动错开。
════════════════════════════════════════════════════════════════════
"""

import sys
import os
import matplotlib
matplotlib.use('Agg')  # 只画图不开窗口，预览靠结尾的自动打开
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

# Windows 控制台默认编码可能打不了中文，统一转 UTF-8
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# 中文字体（Windows 自带微软雅黑；别的系统会按顺序自动找后面的字体）
matplotlib.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'Noto Sans CJK SC', 'sans-serif']
matplotlib.rcParams['axes.unicode_minus'] = False

# ─────────────────────────────────────────────────────────────────────
# ── 【CONFIG 外观配置区】标题、坐标轴、刻度、颜色……全在这里改 ──
# ─────────────────────────────────────────────────────────────────────
CONFIG = {
    "title": "中国朝代与世界帝国 · 多轨历史演变图",
    "subtitle": "数据来自文件下方 DATA 列表 · 同时间段并列者自动错开轨道",
    "x_label": "年份（公元前为负数）",
    "figure_width": 16,          # 图片宽度（英寸）
    "height_per_track": 1.05,    # 每条轨道占的高度（轨道多图会自动变高）
    "dpi": 200,                  # 清晰度，PNG 像素 = 英寸 × dpi
    "output_file": "docs/assets/image/history-timeline.png",  # 直接输出进网站素材库：FluidCanvas 时间线卡「历史标图」读的就是这张

    "x_tick_step": 200,          # 横轴每隔多少年画一格刻度
    "x_tick_label_neg": "公元前{year}年",   # 负年份的刻度文字模板
    "x_tick_label_pos": "公元{year}年",     # 正年份的刻度文字模板
    "x_tick_label_zero": "公元元年",
    "track_label_format": "轨道 {n}",       # 左侧每条轨道的名字模板（n 从 1 数起）
    "show_zero_line": True,      # 是否画公元分界虚线

    "palette": [                 # 自动配色盘：数据里没写 color 的条目按顺序轮流取
        "#7a6a53", "#a03c1e", "#5b7a8c", "#b8860b",
        "#4a7c59", "#3a5a78", "#7a5a8c", "#9c6b3f",
    ],
    "bg_color": "#faf3e7",       # 羊皮纸底
    "grid_color": "#d9c9a8",
    "axis_line_color": "#b08d57",
    "text_color": "#4a3b28",
    "zero_line_color": "#b08d57",
    "bar_edge_color": "#fff7ec", # 色块描边
    "font_size_tick": 7.5,       # 横轴刻度字号
    "font_size_track": 10,       # 轨道名字号
    "font_size_bar_normal": 8.5, # 色块内名字字号（长条）
    "font_size_bar_small": 6.0,  # 色块内名字字号（短条自动缩小）
}

# ─────────────────────────────────────────────────────────────────────
# ── 【DATA 数据区】所有内容都在这里。格式：
# ── {"name": 名称, "start_year": 开始年, "end_year": 结束年,
# ──  "track_level": 轨道号(可省略=自动避让), "color": 色值(可省略=自动配色)}
# ─────────────────────────────────────────────────────────────────────
DATA = [
    # ── 中国主要朝代 ──
    {"name": "夏朝", "start_year": -2070, "end_year": -1600, "color": "#7a6a53"},
    {"name": "商朝", "start_year": -1600, "end_year": -1046, "color": "#7a6a53"},
    {"name": "西周", "start_year": -1046, "end_year": -771, "color": "#7a6a53"},
    {"name": "春秋", "start_year": -770, "end_year": -476, "color": "#7a6a53"},
    {"name": "战国", "start_year": -475, "end_year": -221, "color": "#7a6a53"},
    {"name": "秦朝", "start_year": -221, "end_year": -206, "color": "#a03c1e"},
    {"name": "西汉", "start_year": -202, "end_year": 9, "color": "#a03c1e"},
    {"name": "新朝", "start_year": 9, "end_year": 23, "color": "#a03c1e"},
    {"name": "东汉", "start_year": 25, "end_year": 220, "color": "#a03c1e"},
    # 三国：三条并存，自动各占一条轨道（手动指定 track_level 也行，这里故意省略演示自动避让）
    {"name": "魏", "start_year": 220, "end_year": 265, "color": "#5b7a8c"},
    {"name": "蜀汉", "start_year": 221, "end_year": 263, "color": "#5b7a8c"},
    {"name": "吴", "start_year": 229, "end_year": 280, "color": "#5b7a8c"},
    {"name": "西晋", "start_year": 265, "end_year": 316, "color": "#5b7a8c"},
    {"name": "东晋", "start_year": 317, "end_year": 420, "color": "#5b7a8c"},
    {"name": "南北朝", "start_year": 420, "end_year": 589, "color": "#5b7a8c"},
    {"name": "隋朝", "start_year": 581, "end_year": 618, "color": "#b8860b"},
    {"name": "唐朝", "start_year": 618, "end_year": 907, "color": "#b8860b"},
    {"name": "五代十国", "start_year": 907, "end_year": 960, "color": "#4a7c59"},
    {"name": "北宋", "start_year": 960, "end_year": 1127, "color": "#4a7c59"},
    {"name": "南宋", "start_year": 1127, "end_year": 1279, "color": "#4a7c59"},
    {"name": "元朝", "start_year": 1271, "end_year": 1368, "color": "#3a5a78"},
    {"name": "明朝", "start_year": 1368, "end_year": 1644, "color": "#3a5a78"},
    {"name": "清朝", "start_year": 1636, "end_year": 1912, "color": "#3a5a78"},
    # ── 世界帝国（多轨并行演示：与上面的朝代同期并存时自动错开轨道）──
    {"name": "罗马帝国", "start_year": -27, "end_year": 476, "color": "#7a5a8c"},
    {"name": "安息帝国", "start_year": -247, "end_year": 224, "color": "#7a5a8c"},
    {"name": "波斯萨珊王朝", "start_year": 224, "end_year": 651, "color": "#7a5a8c"},
    {"name": "拜占庭帝国", "start_year": 330, "end_year": 1453, "color": "#7a5a8c"},
    {"name": "阿拉伯帝国", "start_year": 632, "end_year": 1258, "color": "#7a5a8c"},
    {"name": "蒙古帝国", "start_year": 1206, "end_year": 1368, "color": "#7a5a8c"},
]
# ── 【DATA 数据区结束】───────────────────────────────────────────────


def overlaps(a, b):
    """两条记录的时间段是否重叠（首尾相接不算重叠）"""
    return a["start_year"] < b["end_year"] and a["end_year"] > b["start_year"]


def assign_tracks(items):
    """
    轨道分配（核心逻辑）：
    - 写了 track_level 的条目尊重用户指定；
    - 没写的从 0 号轨道往上找第一个「和已占位条目全都不重叠」的轨道。
    算法：按开始时间排序，贪心放入最低可用轨道 → 同轨道内永不重叠。
    """
    occupied = {}  # track -> 已占条目列表
    for it in sorted(items, key=lambda d: (d["start_year"], d["end_year"])):
        if it.get("track_level") is not None:
            t = int(it["track_level"])
        else:
            t = 0
            while any(overlaps(it, other) for other in occupied.get(t, [])):
                t += 1
        occupied.setdefault(t, []).append(it)
        it["_track"] = t
    return max(occupied.keys()) + 1  # 总轨道数


def bar_text_color(hex_color):
    """按色块深浅自动选黑字或白字，保证名字在色块上永远看得清"""
    r, g, b = (int(hex_color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return "#ffffff" if luminance < 150 else "#3a2f22"


def tick_label(x, pos):
    """横轴年份刻度文字：按 CONFIG 里的模板套 {year}"""
    x = int(round(x))
    if x < 0:
        return CONFIG["x_tick_label_neg"].format(year=abs(x))
    if x == 0:
        return CONFIG["x_tick_label_zero"]
    return CONFIG["x_tick_label_pos"].format(year=x)


def build():
    """全部绘图逻辑——只读 CONFIG 和 DATA，不出现任何具体数据数值"""
    items = [dict(d) for d in DATA]  # 复制一份，避免改动原始数据
    n_tracks = assign_tracks(items)

    fig_w = CONFIG["figure_width"]
    fig_h = n_tracks * CONFIG["height_per_track"] + 2.2
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), dpi=CONFIG["dpi"])
    fig.patch.set_facecolor(CONFIG["bg_color"])
    ax.set_facecolor(CONFIG["bg_color"])

    # 横轴范围 = 数据极值向外各让出一点
    lo = min(d["start_year"] for d in items)
    hi = max(d["end_year"] for d in items)
    step = CONFIG["x_tick_step"]
    lo = (lo // step - 1) * step
    hi = (hi // step + 1) * step
    ax.set_xlim(lo, hi)
    ax.set_ylim(-0.9, n_tracks - 0.1)

    # 横轴刻度
    ticks = list(range(lo, hi + 1, step))
    ax.set_xticks(ticks)
    ax.xaxis.set_major_formatter(FuncFormatter(tick_label))
    ax.tick_params(axis="x", labelsize=CONFIG["font_size_tick"], colors=CONFIG["text_color"])

    # 纵轴 = 轨道号（模板可改）
    ax.set_yticks(range(n_tracks))
    ax.set_yticklabels([CONFIG["track_label_format"].format(n=t + 1) for t in range(n_tracks)],
                       fontsize=CONFIG["font_size_track"])
    ax.tick_params(axis="y", length=0, colors=CONFIG["text_color"])

    # 画色块 + 中间标名称
    for i, it in enumerate(items):
        t = it["_track"]
        y_center = t
        color = it.get("color") or CONFIG["palette"][i % len(CONFIG["palette"])]
        duration = it["end_year"] - it["start_year"]
        bar = plt.Rectangle((it["start_year"], y_center - 0.32), duration, 0.64,
                            facecolor=color, alpha=0.92,
                            edgecolor=CONFIG["bar_edge_color"], linewidth=0.6, zorder=4)
        ax.add_patch(bar)
        # 短条自动用小一号字，长条用正常字
        fs = CONFIG["font_size_bar_small"] if duration < step * 0.5 else CONFIG["font_size_bar_normal"]
        ax.text((it["start_year"] + it["end_year"]) / 2, y_center, it["name"],
                ha="center", va="center", fontsize=fs,
                color=bar_text_color(color), zorder=5)

    # 公元分界线
    if CONFIG["show_zero_line"]:
        ax.axvline(0, color=CONFIG["zero_line_color"], lw=1, ls="--", alpha=0.7, zorder=1)

    # 浅网格与边框
    ax.grid(axis="x", color=CONFIG["grid_color"], lw=0.5, alpha=0.55, zorder=0)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(CONFIG["axis_line_color"])

    # 标题与坐标轴标签（全部来自 CONFIG）
    ax.set_title(CONFIG["title"], fontsize=17, fontweight="bold",
                 color=CONFIG["text_color"], pad=14)
    if CONFIG["subtitle"]:
        ax.text(0.5, 1.012, CONFIG["subtitle"], transform=ax.transAxes,
                ha="center", va="bottom", fontsize=8, color="#8a6f4d")
    if CONFIG["x_label"]:
        ax.set_xlabel(CONFIG["x_label"], fontsize=9, color=CONFIG["text_color"])

    fig.tight_layout()
    return fig


if __name__ == "__main__":
    fig = build()
    # 相对路径按「脚本所在目录」算，保证在哪个目录运行都写到正确位置
    out = CONFIG["output_file"]
    if not os.path.isabs(out):
        out = os.path.join(os.path.dirname(os.path.abspath(__file__)), out)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    fig.savefig(out)
    print("已保存", out, "（共", len(DATA), "条数据）")
    # Windows 上自动用系统看图器打开，方便立刻检查
    if os.name == "nt":
        try:
            os.startfile(out)
        except Exception:
            pass
