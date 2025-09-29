# 背景去除器 🎨✂️

一个功能强大的在线背景去除工具，支持多种算法和 AI 模型，帮助您轻松制作专业的透明背景图片。

[![React](https://img.shields.io/badge/React-19.1.1-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.1.7-646CFF.svg)](https://vitejs.dev/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-4.22.0-FF6F00.svg)](https://www.tensorflow.org/js)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🌟 功能特色

### 🤖 智能 AI 算法

- **AI 人像模式**：基于 MediaPipe SelfieSegmentation 的专业人像背景去除
- **增强 AI 模式**：实验性优化算法，提供更精细的处理效果
- **通用 AI 模型**：支持动物、物体等非人体目标的智能分割

### 🎯 传统图像处理算法

- **智能自动模式**：自动分析图片特征，选择最佳处理算法
- **精准切割模式**：基于 GrabCut 算法，适用于复杂背景图片
- **魔术棒模式**：快速处理单色或相似颜色背景
- **颜色范围模式**：针对与主体对比明显的背景进行处理

### 💎 用户体验

- 🖱️ **拖拽上传**：支持直接拖拽图片文件
- 📱 **响应式设计**：完美适配桌面和移动设备
- ⚡ **实时预览**：即时查看处理前后效果对比
- 📥 **一键下载**：高质量 PNG 格式输出
- 🎨 **流畅动画**：基于 Framer Motion 的精美交互动效

## 🚀 快速开始

### 环境要求

- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器

### 安装

```bash
# 克隆项目
git clone https://github.com/sunmoonstrand/removebg.git
cd removebg

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 构建

```bash
# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

## 📚 技术栈

### 前端框架

- **React 19.1.1** - 现代化的用户界面库
- **Vite 7.1.7** - 快速的前端构建工具

### AI/机器学习

- **TensorFlow.js 4.22.0** - 浏览器端机器学习框架
- **MediaPipe Body Segmentation** - Google 的身体分割模型

### UI/UX

- **Framer Motion 12.23.22** - 高性能动画库
- **Lucide React 0.544.0** - 现代化图标库

### 开发工具

- **ESLint** - 代码质量检查
- **Vite Plugin React** - React 开发支持

## 🎯 使用方法

### 1. 选择算法

根据图片类型选择合适的处理算法：

- **人像照片** → AI 人像模式或增强 AI 模式
- **复杂背景** → 智能自动模式或精准切割模式
- **单色背景** → 魔术棒模式
- **对比强烈** → 颜色范围模式

### 2. 上传图片

- 点击上传区域选择文件
- 或直接拖拽图片到页面中
- 支持 JPG、PNG、WebP 格式

### 3. 处理和下载

- 点击「去除背景」按钮开始处理
- 等待算法完成分析和处理
- 点击「下载图片」保存结果

## 🔧 算法详解

### AI 算法

#### MediaPipe SelfieSegmentation

- **适用场景**：人像照片处理
- **技术原理**：基于深度学习的语义分割
- **优势**：高精度人体轮廓识别
- **参数调优**：支持阈值、边缘模糊等参数自定义

### 传统算法

#### GrabCut 算法

- **适用场景**：复杂背景图片
- **技术原理**：基于图论的前景背景分割
- **优势**：对复杂纹理背景有较好效果

#### 魔术棒算法

- **适用场景**：单色或相似颜色背景
- **技术原理**：基于颜色相似度的区域选择
- **参数**：容差值可调节选择精度

#### 颜色范围算法

- **适用场景**：主体与背景对比明显的图片
- **技术原理**：智能分析颜色分布并进行分割

## 📁 项目结构

```
src/
├── utils/                      # 核心算法实现
│   ├── aiBackgroundRemoval.js      # AI背景去除 (MediaPipe)
│   ├── backgroundRemoval.js         # 基础背景去除算法
│   ├── backgroundRemovalImproved.js # 改进的背景去除算法
│   ├── enhancedPortraitRemoval.js   # 增强人像处理算法
│   ├── reliableBackgroundRemoval.js # 可靠的多算法集合
│   └── universalAiRemoval.js        # 通用AI分割算法
├── App.jsx                     # 主应用组件
├── App.css                     # 样式文件
├── index.css                   # 全局样式
└── main.jsx                    # 应用入口
```

## ⚙️ 配置选项

### AI 模型参数

```javascript
const aiOptions = {
  threshold: 0.65, // 分割阈值 (0-1)
  edgeBlur: 2, // 边缘模糊程度
  foregroundThreshold: 0.55, // 前景检测阈值
  enableEnhancement: true, // 启用增强处理
  qualityMode: "balanced", // 质量模式: "fast" | "balanced" | "quality"
  aggressiveMode: false, // 激进模式
};
```

### 传统算法参数

```javascript
const traditionalOptions = {
  tolerance: 30, // 魔术棒容差值
  iterations: 3, // GrabCut迭代次数
  edgeSmooth: 2, // 边缘平滑程度
  noiseReduction: 1, // 噪声减少强度
};
```

## 🎨 自定义样式

项目使用 CSS 自定义属性，便于主题定制：

```css
:root {
  --primary-color: #6366f1;
  --secondary-color: #8b5cf6;
  --accent-color: #06b6d4;
  --background-color: #f8fafc;
  --text-color: #1e293b;
}
```

## 🚀 性能优化

### AI 模型优化

- 模型懒加载，仅在需要时初始化
- TensorFlow.js WebGL 后端加速
- 自动内存管理和资源清理

### 图像处理优化

- Canvas 硬件加速
- Web Workers 异步处理（规划中）
- 图像尺寸自适应压缩

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发规范

- 使用 ESLint 进行代码检查
- 遵循现有的代码风格
- 为新功能添加适当的注释
- 确保代码通过所有检查

### 提交格式

```
feat: 添加新的背景去除算法
fix: 修复AI模型加载问题
docs: 更新README文档
style: 优化界面样式
```

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

## 🙏 致谢

- [TensorFlow.js](https://www.tensorflow.org/js) - 提供强大的机器学习能力
- [MediaPipe](https://mediapipe.dev/) - Google 的优秀视觉处理框架
- [React](https://reactjs.org/) - 构建用户界面的优秀库
- [Vite](https://vitejs.dev/) - 快速的前端构建工具
- [Framer Motion](https://www.framer.com/motion/) - 出色的动画库
