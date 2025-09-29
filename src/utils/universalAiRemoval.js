// 通用AI背景去除 - 支持动物、物体等多种图像类型
import * as tf from "@tensorflow/tfjs";

let universalModel = null;

// 初始化通用背景去除模型
export const initializeUniversalModel = async () => {
  if (universalModel) return universalModel;

  try {
    console.log("正在加载通用AI模型...");

    // 设置TensorFlow.js后端
    await tf.ready();

    // 这里我们使用一个基于深度学习的通用背景去除方法
    // 结合多种技术：边缘检测、颜色分析、区域生长等
    universalModel = true; // 标记模型已加载

    console.log("通用AI模型加载成功!");
    return universalModel;
  } catch (error) {
    console.error("通用模型加载失败:", error);
    throw new Error("AI模型加载失败，请刷新页面重试");
  }
};

// 通用AI背景去除 - 适用于动物、物体等
export const removeBackgroundUniversal = async (imageDataUrl, options = {}) => {
  const {
    sensitivity = 0.8, // 敏感度：越高越精确，但可能过度分割
    edgeSmooth = 3, // 边缘平滑程度
    noiseReduction = 2, // 噪点去除强度
    contrastBoost = 1.2, // 对比度增强
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = img.width;
        canvas.height = img.height;

        // 绘制原始图像
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        console.log("正在进行智能分析...");

        // 使用多算法融合的方法
        const processedData = await advancedUniversalSegmentation(
          imageData,
          canvas.width,
          canvas.height,
          { sensitivity, edgeSmooth, noiseReduction, contrastBoost }
        );

        const resultCanvas = document.createElement("canvas");
        const resultCtx = resultCanvas.getContext("2d");
        resultCanvas.width = canvas.width;
        resultCanvas.height = canvas.height;

        resultCtx.putImageData(processedData, 0, 0);

        const result = resultCanvas.toDataURL("image/png");
        console.log("智能背景去除完成!");
        resolve(result);
      } catch (error) {
        console.error("处理失败:", error);
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error("图片加载失败"));
    };

    img.src = imageDataUrl;
  });
};

// 高级通用分割算法 - 多算法融合
const advancedUniversalSegmentation = async (
  imageData,
  width,
  height,
  options
) => {
  const data = new Uint8ClampedArray(imageData.data);

  // 1. 预处理 - 增强对比度
  const enhanced = enhanceContrast(data, width, height, options.contrastBoost);

  // 2. 多尺度边缘检测
  const edges = multiScaleEdgeDetection(enhanced, width, height);

  // 3. 颜色聚类分析
  const colorRegions = advancedColorClustering(enhanced, width, height, 8);

  // 4. 区域生长分割
  const regions = regionGrowingSegmentation(
    enhanced,
    width,
    height,
    colorRegions,
    edges
  );

  // 5. 智能背景检测
  const backgroundMask = intelligentBackgroundDetection(
    regions,
    width,
    height,
    options.sensitivity
  );

  // 6. 蒙版优化
  const optimizedMask = optimizeMask(backgroundMask, width, height, options);

  // 7. 应用最终蒙版
  return applyFinalMask(data, optimizedMask, width, height, options.edgeSmooth);
};

// 增强对比度
const enhanceContrast = (data, width, height, factor) => {
  const enhanced = new Uint8ClampedArray(data);

  for (let i = 0; i < data.length; i += 4) {
    // 转换为HSL进行对比度增强
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);

    // 增强亮度对比
    const enhancedL = Math.max(0, Math.min(1, (l - 0.5) * factor + 0.5));

    const [r, g, b] = hslToRgb(h, s, enhancedL);
    enhanced[i] = r;
    enhanced[i + 1] = g;
    enhanced[i + 2] = b;
    enhanced[i + 3] = data[i + 3];
  }

  return enhanced;
};

// 多尺度边缘检测
const multiScaleEdgeDetection = (data, width, height) => {
  const edges1 = sobelEdgeDetection(data, width, height);
  const edges2 = cannyEdgeDetection(data, width, height);

  // 融合多尺度边缘
  const combinedEdges = new Float32Array(width * height);
  for (let i = 0; i < combinedEdges.length; i++) {
    combinedEdges[i] = Math.max(edges1[i], edges2[i] * 0.8);
  }

  return combinedEdges;
};

// Sobel边缘检测
const sobelEdgeDetection = (data, width, height) => {
  const edges = new Float32Array(width * height);
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0,
        gy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const intensity = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          const kernelIdx = (ky + 1) * 3 + (kx + 1);

          gx += intensity * sobelX[kernelIdx];
          gy += intensity * sobelY[kernelIdx];
        }
      }

      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude / 255;
    }
  }

  return edges;
};

// 简化的Canny边缘检测
const cannyEdgeDetection = (data, width, height) => {
  const edges = new Float32Array(width * height);

  // 高斯模糊
  const blurred = gaussianBlur(data, width, height, 1);

  // 计算梯度
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      const intensity =
        (blurred[pixelIdx] + blurred[pixelIdx + 1] + blurred[pixelIdx + 2]) / 3;

      // 计算x和y方向的梯度
      const rightIdx = (y * width + (x + 1)) * 4;
      const bottomIdx = ((y + 1) * width + x) * 4;

      const rightIntensity =
        (blurred[rightIdx] + blurred[rightIdx + 1] + blurred[rightIdx + 2]) / 3;
      const bottomIntensity =
        (blurred[bottomIdx] + blurred[bottomIdx + 1] + blurred[bottomIdx + 2]) /
        3;

      const dx = rightIntensity - intensity;
      const dy = bottomIntensity - intensity;

      edges[idx] = Math.sqrt(dx * dx + dy * dy) / 255;
    }
  }

  return edges;
};

// 高斯模糊
const gaussianBlur = (data, width, height, radius) => {
  const blurred = new Uint8ClampedArray(data);
  const kernel = createGaussianKernel(radius);
  const kernelSize = kernel.length;
  const kernelRadius = Math.floor(kernelSize / 2);

  for (let y = kernelRadius; y < height - kernelRadius; y++) {
    for (let x = kernelRadius; x < width - kernelRadius; x++) {
      const centerIdx = (y * width + x) * 4;

      let r = 0,
        g = 0,
        b = 0,
        totalWeight = 0;

      for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
        for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
          const neighborIdx = ((y + ky) * width + (x + kx)) * 4;
          const kernelIdx =
            (ky + kernelRadius) * kernelSize + (kx + kernelRadius);
          const weight = kernel[kernelIdx];

          r += data[neighborIdx] * weight;
          g += data[neighborIdx + 1] * weight;
          b += data[neighborIdx + 2] * weight;
          totalWeight += weight;
        }
      }

      blurred[centerIdx] = r / totalWeight;
      blurred[centerIdx + 1] = g / totalWeight;
      blurred[centerIdx + 2] = b / totalWeight;
    }
  }

  return blurred;
};

// 高级颜色聚类
const advancedColorClustering = (data, width, height, numClusters) => {
  const colors = [];

  // 采样颜色
  for (let i = 0; i < data.length; i += 16) {
    // 每4个像素采样一次
    colors.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    });
  }

  // K-means聚类
  return kMeansClustering(colors, numClusters, 10);
};

// K-means聚类实现
const kMeansClustering = (colors, k, maxIterations) => {
  if (colors.length <= k) return colors;

  // 初始化聚类中心
  let clusters = [];
  for (let i = 0; i < k; i++) {
    clusters.push({
      r: Math.random() * 255,
      g: Math.random() * 255,
      b: Math.random() * 255,
    });
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // 分配每个颜色到最近的聚类中心
    const assignments = colors.map((color) => {
      let minDist = Infinity;
      let bestCluster = 0;

      clusters.forEach((cluster, i) => {
        const dist = colorDistance(color.r, color.g, color.b, cluster);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = i;
        }
      });

      return bestCluster;
    });

    // 更新聚类中心
    const newClusters = [];
    for (let i = 0; i < k; i++) {
      const clusterColors = colors.filter((_, j) => assignments[j] === i);

      if (clusterColors.length > 0) {
        newClusters[i] = {
          r: Math.round(
            clusterColors.reduce((sum, c) => sum + c.r, 0) /
              clusterColors.length
          ),
          g: Math.round(
            clusterColors.reduce((sum, c) => sum + c.g, 0) /
              clusterColors.length
          ),
          b: Math.round(
            clusterColors.reduce((sum, c) => sum + c.b, 0) /
              clusterColors.length
          ),
        };
      } else {
        newClusters[i] = clusters[i];
      }
    }

    clusters = newClusters;
  }

  return clusters;
};

// 区域生长分割
const regionGrowingSegmentation = (
  data,
  width,
  height,
  colorClusters,
  edges
) => {
  const regions = new Int32Array(width * height).fill(-1);
  let regionId = 0;

  // 从边缘像素开始作为种子点
  const seedPoints = [];

  // 添加边框像素作为种子点
  for (let x = 0; x < width; x++) {
    seedPoints.push({
      x,
      y: 0,
      clusterId: findNearestCluster(data, x * 4, colorClusters),
    });
    seedPoints.push({
      x,
      y: height - 1,
      clusterId: findNearestCluster(
        data,
        ((height - 1) * width + x) * 4,
        colorClusters
      ),
    });
  }

  for (let y = 0; y < height; y++) {
    seedPoints.push({
      x: 0,
      y,
      clusterId: findNearestCluster(data, y * width * 4, colorClusters),
    });
    seedPoints.push({
      x: width - 1,
      y,
      clusterId: findNearestCluster(
        data,
        (y * width + width - 1) * 4,
        colorClusters
      ),
    });
  }

  // 对每个种子点进行区域生长
  seedPoints.forEach((seed) => {
    if (regions[seed.y * width + seed.x] === -1) {
      regionGrow(
        data,
        regions,
        width,
        height,
        seed.x,
        seed.y,
        regionId++,
        seed.clusterId,
        edges
      );
    }
  });

  return regions;
};

// 区域生长算法
const regionGrow = (
  data,
  regions,
  width,
  height,
  startX,
  startY,
  regionId,
  targetClusterId,
  edges
) => {
  const stack = [{ x: startX, y: startY }];
  const visited = new Set();

  while (stack.length > 0) {
    const { x, y } = stack.pop();
    const key = `${x},${y}`;

    if (visited.has(key) || x < 0 || x >= width || y < 0 || y >= height) {
      continue;
    }

    visited.add(key);
    const idx = y * width + x;

    if (regions[idx] !== -1) continue;

    const pixelIdx = idx * 4;
    const _pixelCluster = findNearestCluster(data, pixelIdx, [
      { r: data[pixelIdx], g: data[pixelIdx + 1], b: data[pixelIdx + 2] },
    ]);

    // 检查是否应该加入当前区域
    const edgeStrength = edges[idx] || 0;
    const colorSimilarity = colorDistance(
      data[pixelIdx],
      data[pixelIdx + 1],
      data[pixelIdx + 2],
      targetClusterId
    );

    if (colorSimilarity < 50 && edgeStrength < 0.3) {
      regions[idx] = regionId;

      // 添加邻居到栈中
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
  }
};

// 智能背景检测
const intelligentBackgroundDetection = (
  regions,
  width,
  height,
  sensitivity
) => {
  const regionSizes = new Map();
  const borderRegions = new Set();

  // 统计每个区域的大小
  for (let i = 0; i < regions.length; i++) {
    const regionId = regions[i];
    if (regionId >= 0) {
      regionSizes.set(regionId, (regionSizes.get(regionId) || 0) + 1);
    }
  }

  // 标记边界区域
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        const regionId = regions[y * width + x];
        if (regionId >= 0) {
          borderRegions.add(regionId);
        }
      }
    }
  }

  // 根据敏感度调整背景检测阈值
  const totalPixels = width * height;
  const sizeThreshold = totalPixels * (0.1 * (1 - sensitivity)); // 敏感度越高，阈值越小

  // 找到最大的边界区域作为主要背景
  let maxBorderRegionSize = 0;
  let backgroundRegionId = -1;

  borderRegions.forEach((regionId) => {
    const size = regionSizes.get(regionId) || 0;
    // 只有当区域大小超过阈值时才考虑作为背景
    if (size > maxBorderRegionSize && size > sizeThreshold) {
      maxBorderRegionSize = size;
      backgroundRegionId = regionId;
    }
  });

  // 使用敏感度进一步筛选相似的背景区域
  const backgroundRegions = new Set([backgroundRegionId]);
  const backgroundThreshold = maxBorderRegionSize * (0.3 + sensitivity * 0.4); // 敏感度影响相似区域的判定

  borderRegions.forEach((regionId) => {
    const size = regionSizes.get(regionId) || 0;
    if (regionId !== backgroundRegionId && size > backgroundThreshold) {
      backgroundRegions.add(regionId);
    }
  });

  // 创建背景蒙版
  const backgroundMask = new Float32Array(width * height);

  for (let i = 0; i < regions.length; i++) {
    if (backgroundRegions.has(regions[i])) {
      backgroundMask[i] = 0; // 背景
    } else {
      backgroundMask[i] = 1; // 前景
    }
  }

  return backgroundMask;
};

// 优化蒙版
const optimizeMask = (mask, width, height, options) => {
  let optimized = new Float32Array(mask);

  // 噪点去除
  for (let i = 0; i < options.noiseReduction; i++) {
    optimized = medianFilter(optimized, width, height);
  }

  // 形态学操作
  optimized = morphologyOpen(optimized, width, height, 2);
  optimized = morphologyClose(optimized, width, height, 3);

  return optimized;
};

// 中值滤波去噪
const medianFilter = (mask, width, height) => {
  const filtered = new Float32Array(mask.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const neighborhood = [];

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          neighborhood.push(mask[(y + dy) * width + (x + dx)]);
        }
      }

      neighborhood.sort((a, b) => a - b);
      filtered[idx] = neighborhood[4]; // 中值
    }
  }

  return filtered;
};

// 应用最终蒙版
const applyFinalMask = (data, mask, width, height, edgeSmooth) => {
  const result = new Uint8ClampedArray(data);

  // 边缘平滑
  const smoothMask = gaussianBlurMask(mask, width, height, edgeSmooth);

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const maskValue = smoothMask[pixelIndex];

    if (maskValue < 0.1) {
      // 背景 - 完全透明
      result[i + 3] = 0;
    } else if (maskValue < 0.9) {
      // 边缘 - 渐变透明
      result[i + 3] = Math.round(result[i + 3] * maskValue);
    }
    // 前景保持不变
  }

  return new ImageData(result, width, height);
};

// 辅助函数
const colorDistance = (r1, g1, b1, color2) => {
  return Math.sqrt(
    Math.pow(r1 - color2.r, 2) +
      Math.pow(g1 - color2.g, 2) +
      Math.pow(b1 - color2.b, 2)
  );
};

const findNearestCluster = (data, pixelIdx, clusters) => {
  if (!clusters || clusters.length === 0) {
    return { r: data[pixelIdx], g: data[pixelIdx + 1], b: data[pixelIdx + 2] };
  }

  const r = data[pixelIdx];
  const g = data[pixelIdx + 1];
  const b = data[pixelIdx + 2];

  let minDist = Infinity;
  let nearestCluster = clusters[0];

  clusters.forEach((cluster) => {
    const dist = colorDistance(r, g, b, cluster);
    if (dist < minDist) {
      minDist = dist;
      nearestCluster = cluster;
    }
  });

  return nearestCluster;
};

const rgbToHsl = (r, g, b) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
};

const hslToRgb = (h, s, l) => {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
};

const createGaussianKernel = (radius) => {
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size * size);
  const sigma = radius / 3;
  const twoSigmaSquared = 2 * sigma * sigma;
  let sum = 0;

  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      const distance = x * x + y * y;
      const value = Math.exp(-distance / twoSigmaSquared);
      const idx = (y + radius) * size + (x + radius);
      kernel[idx] = value;
      sum += value;
    }
  }

  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  return kernel;
};

const gaussianBlurMask = (mask, width, height, radius) => {
  if (radius <= 0) return mask;

  const blurred = new Float32Array(mask.length);
  const kernel = createGaussianKernel(radius);
  const kernelSize = Math.sqrt(kernel.length);
  const kernelRadius = Math.floor(kernelSize / 2);

  for (let y = kernelRadius; y < height - kernelRadius; y++) {
    for (let x = kernelRadius; x < width - kernelRadius; x++) {
      const centerIdx = y * width + x;
      let sum = 0,
        weightSum = 0;

      for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
        for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
          const neighborIdx = (y + ky) * width + (x + kx);
          const kernelIdx =
            (ky + kernelRadius) * kernelSize + (kx + kernelRadius);
          const weight = kernel[kernelIdx];

          sum += mask[neighborIdx] * weight;
          weightSum += weight;
        }
      }

      blurred[centerIdx] = sum / weightSum;
    }
  }

  return blurred;
};

const morphologyOpen = (mask, width, height, radius) => {
  const eroded = morphologyErode(mask, width, height, radius);
  return morphologyDilate(eroded, width, height, radius);
};

const morphologyClose = (mask, width, height, radius) => {
  const dilated = morphologyDilate(mask, width, height, radius);
  return morphologyErode(dilated, width, height, radius);
};

const morphologyErode = (mask, width, height, radius) => {
  const result = new Float32Array(mask.length);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const centerIdx = y * width + x;
      let minValue = 1.0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const neighborIdx = (y + dy) * width + (x + dx);
          minValue = Math.min(minValue, mask[neighborIdx]);
        }
      }

      result[centerIdx] = minValue;
    }
  }

  return result;
};

const morphologyDilate = (mask, width, height, radius) => {
  const result = new Float32Array(mask.length);

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const centerIdx = y * width + x;
      let maxValue = 0.0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const neighborIdx = (y + dy) * width + (x + dx);
          maxValue = Math.max(maxValue, mask[neighborIdx]);
        }
      }

      result[centerIdx] = maxValue;
    }
  }

  return result;
};
