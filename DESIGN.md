---
name: 秋招速投
description: 面向个人求职者的任务优先投递工作台
colors:
  cobalt-action: "#155eef"
  cobalt-soft: "#edf3ff"
  orange-reminder: "#f97316"
  green-success: "#16a56a"
  cool-canvas: "#f6f8fb"
  paper: "#ffffff"
  graphite: "#172033"
  secondary-text: "#647084"
  quiet-border: "#dde3ec"
typography:
  headline:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
  title:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.cobalt-action}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  panel:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.xl}"
    padding: "16px"
---

# Design System: 秋招速投

## Overview

**Creative North Star: “清醒的求职作战台”**

秋招速投采用冷静、克制、信息密度适中的工作台语言。界面首先回答“这个岗位下一步做什么”，再提供证据、内容和设置；视觉层级服务于任务推进，而不是营销展示。

选定视觉稿中的紧凑侧栏、阶段轨道、纸张预览与审阅面板构成核心世界。全站避免装饰性渐变、无任务价值的 Hero 和重复指标。

**Key Characteristics:**

- 冷白画布上的白色任务表面
- 钴蓝只标记当前状态与主动作
- 橙色提醒、绿色完成，各司其职
- 细边框、弱阴影、紧凑侧栏和可扫描列表

## Colors

冷白与石墨建立稳定底色，钴蓝承担唯一主操作声部，橙与绿只表达语义状态。

### Primary

- **行动钴蓝**：当前阶段、主按钮、选中导航和键盘焦点。

### Secondary

- **提醒橙**：只用于截止日期、缺失信息和需要立即处理的提醒。
- **完成绿**：只用于完成、保存成功和可用状态。

### Neutral

- **冷静画布**：全站底色，让任务表面保持可分辨但不漂浮。
- **纸张白**：面板、字段、侧栏与简历纸面。
- **石墨正文**：标题与正文的高对比信息色。
- **次要文字**：说明、元数据和未激活状态。
- **安静边框**：结构分隔，不承担装饰。

**The One Blue Voice Rule.** 单个区域最多保留一个主蓝色动作；同层级次要操作使用描边或文字样式。

## Typography

**Display Font:** Noto Sans SC（回退至 PingFang SC / Microsoft YaHei）  
**Body Font:** Noto Sans SC（同一系统回退栈）

**Character:** 中文优先、紧凑而清晰。标题依赖字重而不是夸张字号，正文保持可连续阅读的行高。

### Hierarchy

- **Headline**（600，20px，1.4）：页面标题和当前任务标题。
- **Title**（600，16px，1.5）：面板标题与关键对象名称。
- **Body**（400，15px，1.7）：业务内容，长文本限制在约 80ch。
- **Label**（500，14px，1.5）：字段、状态与辅助导航，不使用英文全大写。

**The Task Before Drama Rule.** 字号差异保持克制，用信息顺序、间距和字重表达层级。

## Layout

桌面端使用 216px 固定侧栏与开放工作区，主要内容最大宽度约 1280px。岗位工作台由元数据栏、五阶段轨道和当前任务区构成；微调阶段在宽屏形成简历预览与建议审阅双栏。

间距以 8px 为基础节拍，常用组合为 8、16、24px。移动端隐藏侧栏并使用五项底部导航，页面保留底部安全空间；集合改为纵向列表，岗位阶段在 390px 内完整展示，简历预览进入全屏层。

## Elevation & Depth

系统以边框和色阶分层，静态面板只使用 `0 1px 2px rgb(23 32 51 / 4%)` 的环境阴影。较强阴影仅用于浮层、粘性操作条或明确的交互层级。

**The Flat-by-Default Rule.** 静态内容不靠悬浮感争夺注意力；任务层级优先通过分隔、留白和背景色建立。

## Shapes

字段与按钮使用 8px 圆角，主面板使用 12px 圆角，提示框介于两者。圆角保持功能性，不使用胶囊形容器包裹普通正文或大面积内容。

## Components

### Buttons

- **Shape:** 紧凑矩形，8px 圆角，移动端核心操作高度不低于 44px。
- **Primary:** 钴蓝底、白字；每个区域最多一个。
- **Hover / Focus:** 150ms 颜色过渡与可见焦点环；按下仅位移 1px。
- **Secondary / Ghost:** 白底描边或纯文字，用于导航与可逆操作。

### Chips

- **Style:** 低对比浅底色；状态点与文字共同编码，不依赖颜色单独传意。
- **State:** 选中筛选器使用钴蓝文字和柔和蓝底。

### Cards / Containers

- **Corner Style:** 12px 主面板圆角。
- **Background:** 纸张白；空状态可使用冷白或虚线边框。
- **Shadow Strategy:** 静态面板只用环境弱阴影。
- **Border:** 1px 安静边框，列表内部使用分隔线。
- **Internal Padding:** 16–24px，按任务密度选择。

### Inputs / Fields

- **Style:** 白底、8px 圆角、1px 输入边框，高度 44px。
- **Focus:** 钴蓝边框与半透明焦点环。
- **Error / Disabled:** 错误使用红色语义提示；禁用状态降低对比但保留可读性。

### Navigation

桌面导航以图标、文字和柔和蓝色当前态组成；移动端固定为“工作台、岗位、简历、投递、更多”五项，个人档案和设置收进“更多”。

### Stage Rail

岗位工作台使用五阶段轨道串联 `JD → 匹配 → 简历微调 → 填写材料 → 导出`。当前阶段为蓝色，完成阶段为绿色，未开始阶段保持中性。

## Do's and Don'ts

### Do:

- **Do** 让每屏首先暴露当前最重要的下一步。
- **Do** 对加载、空白、错误、保存和回滚提供明确反馈。
- **Do** 在真实业务数据较少时使用诚实空状态，不制造指标。
- **Do** 为移动端保留至少 44px 的核心触控目标并遵守 reduced-motion。

### Don't:

- **Don't** 使用装饰性渐变、英文全大写眉题或无任务价值的 Hero。
- **Don't** 把每条列表项包装成独立悬浮卡片。
- **Don't** 自动导入工作区里的个人文件，也不要在 AI 文案中编造成果。
- **Don't** 让固定导航或保存操作遮住正文与最后一个字段。
