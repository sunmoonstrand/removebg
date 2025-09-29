// 高质量背景去除工具函数
// 使用多种算法结合的方式来提供更好的背景去除效果

// 主要的背景去除函数 - 使用改进的边缘检测和颜色分析
export const removeBackground = async (imageDataUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = img.width;
      canvas.height = img.height;

      // 绘制原始图像
      ctx.drawImage(img, 0, 0);

      // 获取图像数据
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 使用改进的算法处理
      const processedData = advancedBackgroundRemoval(
        data,
        canvas.width,
        canvas.height
      );

      // 应用处理后的图像数据
      const newImageData = ctx.createImageData(canvas.width, canvas.height);
      newImageData.data.set(processedData);
      ctx.putImageData(newImageData, 0, 0);

      // 转换为dataURL
      const processedDataUrl = canvas.toDataURL("image/png");
      resolve(processedDataUrl);
    };

    img.src = imageDataUrl;
  });
};

// 改进的背景去除算法
const advancedBackgroundRemoval = (data, width, height) => {
  const newData = new Uint8ClampedArray(data);

  // 1. 边缘检测 - 找到主体边界
  const edges = detectEdges(data, width, height);

  // 2. 颜色聚类 - 识别主要颜色区域
  const colorClusters = analyzeColorClusters(data, width, height);

  // 3. 背景色检测 - 多点采样
  const backgroundColor = detectBackgroundColorAdvanced(data, width, height);

  // 4. 创建前景蒙版
  const foregroundMask = createForegroundMask(
    data,
    width,
    height,
    backgroundColor,
    edges,
    colorClusters
  );

  // 5. 应用蒙版并进行边缘平滑
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    if (foregroundMask[pixelIndex]) {
      // 前景像素 - 保持原样，但可能需要边缘平滑
      const edgeStrength = getEdgeStrength(edges, x, y, width);
      if (edgeStrength > 0.3) {
        // 边缘像素，进行抗锯齿处理
        newData[i + 3] = Math.min(
          255,
          newData[i + 3] * (1 - edgeStrength * 0.3)
        );
      }
    } else {
      // 背景像素 - 设为透明
      newData[i + 3] = 0;
    }
  }

  // 6. 后处理 - 去除孤立像素和填充小洞
  return postProcessMask(newData, width, height);
};

// 边缘检测（Sobel算子）
const detectEdges = (data, width, height) => {
  const edges = new Float32Array(width * height);

  // Sobel算子
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0,
        gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);

          gx += gray * sobelX[kernelIdx];
          gy += gray * sobelY[kernelIdx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude / 255;
    }
  }

  return edges;
};

// 颜色聚类分析
const analyzeColorClusters = (data, width, height) => {
  const colorMap = new Map();
  const edgeMargin = Math.min(width, height) * 0.1; // 边缘边距

  // 统计颜色频率（简化到16x16x16颜色空间），排除边缘区域
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    // 跳过边缘区域的像素，专注于中心区域的颜色
    if (
      x < edgeMargin ||
      x >= width - edgeMargin ||
      y < edgeMargin ||
      y >= height - edgeMargin
    ) {
      continue;
    }

    const r = Math.floor(data[i] / 16) * 16;
    const g = Math.floor(data[i + 1] / 16) * 16;
    const b = Math.floor(data[i + 2] / 16) * 16;

    const colorKey = `${r},${g},${b}`;
    colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
  }

  // 找到主要颜色
  const sortedColors = Array.from(colorMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return sortedColors.map(([color]) => {
    const [r, g, b] = color.split(",").map(Number);
    return { r, g, b };
  });
};

// 高级背景色检测
const detectBackgroundColorAdvanced = (data, width, height) => {
  const samplePoints = [
    // 四个角落
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
    // 边缘中点
    { x: Math.floor(width / 2), y: 0 },
    { x: Math.floor(width / 2), y: height - 1 },
    { x: 0, y: Math.floor(height / 2) },
    { x: width - 1, y: Math.floor(height / 2) },
  ];

  const colors = [];

  samplePoints.forEach((point) => {
    const index = (point.y * width + point.x) * 4;
    colors.push({
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
    });
  });

  // 使用k-means聚类找到最主要的背景色
  return findDominantColor(colors);
};

// 找到主导颜色
const findDominantColor = (colors) => {
  if (colors.length === 0) return { r: 255, g: 255, b: 255 };

  let totalR = 0,
    totalG = 0,
    totalB = 0;

  colors.forEach((color) => {
    totalR += color.r;
    totalG += color.g;
    totalB += color.b;
  });

  return {
    r: Math.round(totalR / colors.length),
    g: Math.round(totalG / colors.length),
    b: Math.round(totalB / colors.length),
  };
};

// 创建前景蒙版
const createForegroundMask = (
  data,
  width,
  height,
  backgroundColor,
  edges,
  colorClusters
) => {
  const mask = new Array(width * height).fill(false);

  // 基于颜色相似性的初始分割
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 检查是否与背景色相似
    const bgSimilarity = colorDistance(r, g, b, backgroundColor);

    // 检查是否与主要颜色簇相似（前景色检测）
    let isForegroundColor = false;
    for (const cluster of colorClusters) {
      const clusterSimilarity = colorDistance(r, g, b, cluster);
      if (clusterSimilarity < 40) {
        // 如果与主要颜色簇相似
        isForegroundColor = true;
        break;
      }
    }

    // 检查是否在边缘附近
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    const edgeStrength = getEdgeStrength(edges, x, y, width);

    // 综合判断：结合背景色、前景色簇和边缘信息
    if (bgSimilarity > 60 && edgeStrength < 0.2 && !isForegroundColor) {
      mask[pixelIndex] = false; // 背景
    } else {
      mask[pixelIndex] = true; // 前景
    }
  }

  // 使用形态学操作改善蒙版
  return morphologyProcess(mask, width, height);
};

// 颜色距离计算
const colorDistance = (r1, g1, b1, color2) => {
  return Math.sqrt(
    Math.pow(r1 - color2.r, 2) +
      Math.pow(g1 - color2.g, 2) +
      Math.pow(b1 - color2.b, 2)
  );
};

// 获取边缘强度
const getEdgeStrength = (edges, x, y, width) => {
  if (x < 0 || x >= width || y < 0 || y >= Math.floor(edges.length / width)) {
    return 0;
  }
  return edges[y * width + x] || 0;
};

// 形态学处理
const morphologyProcess = (mask, width, height) => {
  const processed = [...mask];

  // 开运算：先腐蚀后膨胀，去除小的噪点
  const eroded = erode(processed, width, height);
  const opened = dilate(eroded, width, height);

  // 闭运算：先膨胀后腐蚀，填补小洞
  const dilated = dilate(opened, width, height);
  const closed = erode(dilated, width, height);

  return closed;
};

// 腐蚀操作
const erode = (mask, width, height) => {
  const result = new Array(mask.length).fill(false);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // 检查3x3邻域
      let allForeground = true;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighborIdx = (y + dy) * width + (x + dx);
          if (!mask[neighborIdx]) {
            allForeground = false;
            break;
          }
        }
        if (!allForeground) break;
      }

      result[idx] = allForeground;
    }
  }

  return result;
};

// 膨胀操作
const dilate = (mask, width, height) => {
  const result = [...mask];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // 检查3x3邻域
      let hasForeground = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighborIdx = (y + dy) * width + (x + dx);
          if (mask[neighborIdx]) {
            hasForeground = true;
            break;
          }
        }
        if (hasForeground) break;
      }

      if (hasForeground) {
        result[idx] = true;
      }
    }
  }

  return result;
};

// 后处理 - 平滑边缘和去除噪点
const postProcessMask = (data, width, height) => {
  const processed = new Uint8ClampedArray(data);

  // 对边缘进行抗锯齿处理
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      if (processed[idx + 3] > 0) {
        // 如果是前景像素
        let transparentNeighbors = 0;
        let totalNeighbors = 0;

        // 检查8邻域
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
            totalNeighbors++;

            if (processed[neighborIdx + 3] === 0) {
              transparentNeighbors++;
            }
          }
        }

        // 如果周围有透明像素，进行边缘柔化
        if (transparentNeighbors > 0) {
          const edgeRatio = transparentNeighbors / totalNeighbors;
          processed[idx + 3] = Math.round(
            processed[idx + 3] * (1 - edgeRatio * 0.3)
          );
        }
      }
    }
  }

  return processed;
};
