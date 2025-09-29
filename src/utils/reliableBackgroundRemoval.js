// 实用的背景去除算法集合
// 提供多种经过验证的背景去除方法

// 方法1：GrabCut算法模拟 - 适用于大多数图片
export const grabCutRemoval = async (imageDataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 实施改进的GrabCut算法
      const processedData = processGrabCut(data, canvas.width, canvas.height);

      const newImageData = ctx.createImageData(canvas.width, canvas.height);
      newImageData.data.set(processedData);
      ctx.putImageData(newImageData, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  });
};

// 方法2：魔术棒工具模拟 - 适用于单色背景
export const magicWandRemoval = async (imageDataUrl, tolerance = 30) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 从多个角落点开始的魔术棒选择
      const processedData = processMagicWand(
        data,
        canvas.width,
        canvas.height,
        tolerance
      );

      const newImageData = ctx.createImageData(canvas.width, canvas.height);
      newImageData.data.set(processedData);
      ctx.putImageData(newImageData, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  });
};

// 方法3：颜色范围选择 - 适用于对比明显的图片
export const colorRangeRemoval = async (imageDataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 智能颜色范围选择
      const processedData = processColorRange(
        data,
        canvas.width,
        canvas.height
      );

      const newImageData = ctx.createImageData(canvas.width, canvas.height);
      newImageData.data.set(processedData);
      ctx.putImageData(newImageData, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };
    img.src = imageDataUrl;
  });
};

// GrabCut算法实现
const processGrabCut = (data, width, height) => {
  const result = new Uint8ClampedArray(data);

  // 1. 定义前景和背景区域
  const foregroundMask = new Array(width * height).fill(0);

  // 假设中心70%区域为前景，边缘30%为背景
  const centerX = width / 2;
  const centerY = height / 2;
  const foregroundWidth = width * 0.7;
  const foregroundHeight = height * 0.7;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;

      // 检查是否在前景区域内
      if (
        Math.abs(x - centerX) < foregroundWidth / 2 &&
        Math.abs(y - centerY) < foregroundHeight / 2
      ) {
        foregroundMask[idx] = 1; // 可能的前景
      } else {
        foregroundMask[idx] = 0; // 可能的背景
      }
    }
  }

  // 2. 迭代优化边界
  for (let iter = 0; iter < 3; iter++) {
    optimizeBoundary(data, foregroundMask, width, height);
  }

  // 3. 应用蒙版
  for (let i = 0; i < data.length; i += 4) {
    const pixelIdx = i / 4;
    if (foregroundMask[pixelIdx] === 0) {
      result[i + 3] = 0; // 设为透明
    }
  }

  return result;
};

// 边界优化
const optimizeBoundary = (data, mask, width, height) => {
  const newMask = [...mask];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      // 计算当前像素的特征
      const currentColor = {
        r: data[pixelIdx],
        g: data[pixelIdx + 1],
        b: data[pixelIdx + 2],
      };

      // 检查8邻域
      let foregroundNeighbors = 0;
      let backgroundNeighbors = 0;
      let avgForegroundColor = { r: 0, g: 0, b: 0 };
      let avgBackgroundColor = { r: 0, g: 0, b: 0 };

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const neighborIdx = (y + dy) * width + (x + dx);
          const neighborPixelIdx = neighborIdx * 4;

          if (mask[neighborIdx] === 1) {
            foregroundNeighbors++;
            avgForegroundColor.r += data[neighborPixelIdx];
            avgForegroundColor.g += data[neighborPixelIdx + 1];
            avgForegroundColor.b += data[neighborPixelIdx + 2];
          } else {
            backgroundNeighbors++;
            avgBackgroundColor.r += data[neighborPixelIdx];
            avgBackgroundColor.g += data[neighborPixelIdx + 1];
            avgBackgroundColor.b += data[neighborPixelIdx + 2];
          }
        }
      }

      // 计算与前景和背景的相似度
      if (foregroundNeighbors > 0 && backgroundNeighbors > 0) {
        avgForegroundColor.r /= foregroundNeighbors;
        avgForegroundColor.g /= foregroundNeighbors;
        avgForegroundColor.b /= foregroundNeighbors;

        avgBackgroundColor.r /= backgroundNeighbors;
        avgBackgroundColor.g /= backgroundNeighbors;
        avgBackgroundColor.b /= backgroundNeighbors;

        const foregroundDistance = colorDistance(
          currentColor,
          avgForegroundColor
        );
        const backgroundDistance = colorDistance(
          currentColor,
          avgBackgroundColor
        );

        // 重新分类
        newMask[idx] = foregroundDistance < backgroundDistance ? 1 : 0;
      }
    }
  }

  // 更新蒙版
  for (let i = 0; i < mask.length; i++) {
    mask[i] = newMask[i];
  }
};

// 魔术棒算法实现
const processMagicWand = (data, width, height, tolerance) => {
  const result = new Uint8ClampedArray(data);
  const visited = new Array(width * height).fill(false);

  // 从四个角落开始魔术棒选择
  const startPoints = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];

  startPoints.forEach((point) => {
    if (!visited[point.y * width + point.x]) {
      floodFill(
        data,
        visited,
        point.x,
        point.y,
        width,
        height,
        tolerance,
        result
      );
    }
  });

  return result;
};

// 洪水填充算法
const floodFill = (
  data,
  visited,
  startX,
  startY,
  width,
  height,
  tolerance,
  result
) => {
  const stack = [{ x: startX, y: startY }];
  const startIdx = startY * width + startX;
  const startPixelIdx = startIdx * 4;

  const targetColor = {
    r: data[startPixelIdx],
    g: data[startPixelIdx + 1],
    b: data[startPixelIdx + 2],
  };

  while (stack.length > 0) {
    const { x, y } = stack.pop();

    if (x < 0 || x >= width || y < 0 || y >= height) continue;

    const idx = y * width + x;
    if (visited[idx]) continue;

    const pixelIdx = idx * 4;
    const currentColor = {
      r: data[pixelIdx],
      g: data[pixelIdx + 1],
      b: data[pixelIdx + 2],
    };

    const distance = colorDistance(currentColor, targetColor);

    if (distance <= tolerance) {
      visited[idx] = true;
      result[pixelIdx + 3] = 0; // 设为透明

      // 添加四个方向的邻居
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
  }
};

// 颜色范围选择实现
const processColorRange = (data, width, height) => {
  const result = new Uint8ClampedArray(data);

  // 1. 分析图片的主要颜色
  const colorHistogram = analyzeColors(data);

  // 2. 找到最可能的背景色（通常是边缘最常见的颜色）
  const backgroundColors = findBackgroundColors(
    data,
    width,
    height,
    colorHistogram
  );

  // 3. 根据颜色范围去除背景
  for (let i = 0; i < data.length; i += 4) {
    const currentColor = {
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    };

    // 检查是否与任何背景色匹配
    const isBackground = backgroundColors.some((bgColor) => {
      return colorDistance(currentColor, bgColor) < 40;
    });

    if (isBackground) {
      result[i + 3] = 0; // 设为透明
    }
  }

  return result;
};

// 分析图片颜色
const analyzeColors = (data) => {
  const colorMap = new Map();

  for (let i = 0; i < data.length; i += 16) {
    // 每4个像素采样一次
    const r = Math.floor(data[i] / 8) * 8; // 降低颜色精度
    const g = Math.floor(data[i + 1] / 8) * 8;
    const b = Math.floor(data[i + 2] / 8) * 8;

    const colorKey = `${r},${g},${b}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
  }

  return Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([colorStr]) => {
      const [r, g, b] = colorStr.split(",").map(Number);
      return { r, g, b };
    });
};

// 找到背景色
const findBackgroundColors = (data, width, height, colorHistogram) => {
  const edgeColors = new Map();

  // 采样边缘像素
  for (let x = 0; x < width; x++) {
    // 上边缘
    addEdgeColor(data, x, 0, width, edgeColors);
    // 下边缘
    addEdgeColor(data, x, height - 1, width, edgeColors);
  }

  for (let y = 0; y < height; y++) {
    // 左边缘
    addEdgeColor(data, 0, y, width, edgeColors);
    // 右边缘
    addEdgeColor(data, width - 1, y, width, edgeColors);
  }

  // 找到边缘最常见的颜色
  const sortedEdgeColors = Array.from(edgeColors.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([colorStr]) => {
      const [r, g, b] = colorStr.split(",").map(Number);
      return { r, g, b };
    });

  // 结合整体颜色直方图来验证背景色
  // 优先选择既在边缘常见又在整体直方图中排名靠前的颜色
  const combinedColors = sortedEdgeColors.filter((edgeColor) => {
    return colorHistogram.some((histColor) => {
      return colorDistance(edgeColor, histColor) < 20;
    });
  });

  // 如果没有找到匹配的颜色，退回到边缘颜色
  return combinedColors.length > 0 ? combinedColors : sortedEdgeColors;
};

// 添加边缘颜色
const addEdgeColor = (data, x, y, width, edgeColors) => {
  const idx = (y * width + x) * 4;
  const r = Math.floor(data[idx] / 8) * 8;
  const g = Math.floor(data[idx + 1] / 8) * 8;
  const b = Math.floor(data[idx + 2] / 8) * 8;

  const colorKey = `${r},${g},${b}`;
  edgeColors.set(colorKey, (edgeColors.get(colorKey) || 0) + 1);
};

// 颜色距离计算
const colorDistance = (color1, color2) => {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
};

// 自动选择最佳算法
export const autoRemoveBackground = async (imageDataUrl) => {
  console.log("正在自动分析图片特征...");

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 分析图片特征
      const features = analyzeImageFeatures(data, canvas.width, canvas.height);

      let result;

      if (features.hasUniformBackground) {
        console.log("检测到单色背景，使用魔术棒算法");
        result = await magicWandRemoval(imageDataUrl, 25);
      } else if (features.hasHighContrast) {
        console.log("检测到高对比度，使用颜色范围算法");
        result = await colorRangeRemoval(imageDataUrl);
      } else {
        console.log("使用GrabCut算法处理复杂背景");
        result = await grabCutRemoval(imageDataUrl);
      }

      resolve(result);
    };

    img.src = imageDataUrl;
  });
};

// 分析图片特征
const analyzeImageFeatures = (data, width, height) => {
  const edgeColors = [];
  const centerColors = [];

  // 采样边缘和中心区域
  for (let i = 0; i < 100; i++) {
    // 边缘采样
    const edgeX =
      Math.random() < 0.5
        ? Math.random() < 0.5
          ? 0
          : width - 1
        : Math.floor(Math.random() * width);
    const edgeY =
      Math.random() < 0.5
        ? Math.random() < 0.5
          ? 0
          : height - 1
        : Math.floor(Math.random() * height);
    const edgeIdx = (edgeY * width + edgeX) * 4;

    edgeColors.push({
      r: data[edgeIdx],
      g: data[edgeIdx + 1],
      b: data[edgeIdx + 2],
    });

    // 中心区域采样
    const centerX = Math.floor(width * 0.3 + Math.random() * width * 0.4);
    const centerY = Math.floor(height * 0.3 + Math.random() * height * 0.4);
    const centerIdx = (centerY * width + centerX) * 4;

    centerColors.push({
      r: data[centerIdx],
      g: data[centerIdx + 1],
      b: data[centerIdx + 2],
    });
  }

  // 计算边缘颜色的一致性
  const edgeVariance = calculateColorVariance(edgeColors);
  const centerVariance = calculateColorVariance(centerColors);

  // 计算边缘和中心的对比度
  const contrast = calculateContrast(edgeColors, centerColors);

  return {
    hasUniformBackground: edgeVariance < 30,
    hasHighContrast: contrast > 80,
    edgeVariance,
    centerVariance,
    contrast,
  };
};

// 计算颜色方差
const calculateColorVariance = (colors) => {
  if (colors.length === 0) return 0;

  const avg = colors.reduce(
    (acc, color) => ({
      r: acc.r + color.r / colors.length,
      g: acc.g + color.g / colors.length,
      b: acc.b + color.b / colors.length,
    }),
    { r: 0, g: 0, b: 0 }
  );

  const variance =
    colors.reduce((acc, color) => {
      return acc + Math.pow(colorDistance(color, avg), 2);
    }, 0) / colors.length;

  return Math.sqrt(variance);
};

// 计算对比度
const calculateContrast = (edgeColors, centerColors) => {
  if (edgeColors.length === 0 || centerColors.length === 0) return 0;

  const avgEdge = edgeColors.reduce(
    (acc, color) => ({
      r: acc.r + color.r / edgeColors.length,
      g: acc.g + color.g / edgeColors.length,
      b: acc.b + color.b / edgeColors.length,
    }),
    { r: 0, g: 0, b: 0 }
  );

  const avgCenter = centerColors.reduce(
    (acc, color) => ({
      r: acc.r + color.r / centerColors.length,
      g: acc.g + color.g / centerColors.length,
      b: acc.b + color.b / centerColors.length,
    }),
    { r: 0, g: 0, b: 0 }
  );

  return colorDistance(avgEdge, avgCenter);
};
