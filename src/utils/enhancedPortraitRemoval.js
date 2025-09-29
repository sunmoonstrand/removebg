// 增强的人像背景去除算法
// 结合AI模型和传统算法，专门优化人像处理效果

import * as tf from "@tensorflow/tfjs";
import * as bodySegmentation from "@tensorflow-models/body-segmentation";

let segmenter = null;

// 初始化AI模型
export const initializeEnhancedModel = async () => {
  if (segmenter) return segmenter;

  try {
    console.log("正在加载增强AI模型...");
    await tf.ready();

    // 使用更高精度的模型配置
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig = {
      runtime: "mediapipe",
      solutionPath:
        "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
      modelType: "landscape", // 使用landscape模型以获得更好的人像效果
    };

    segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
    console.log("增强AI模型加载成功!");
    return segmenter;
  } catch (error) {
    console.error("模型加载失败:", error);
    throw new Error("AI模型加载失败，请刷新页面重试");
  }
};

// 增强的人像背景去除 - 多算法融合
export const removeBackgroundEnhanced = async (imageDataUrl, options = {}) => {
  const {
    aiWeight = 0.7, // AI模型权重
    traditionalWeight = 0.3, // 传统算法权重
    edgeRefinement = true, // 边缘精细化
    hairPreservation = true, // 头发保护模式
    qualityMode = "high", // 质量模式: 'fast', 'balanced', 'high'
  } = options;

  try {
    // 确保模型已加载
    if (!segmenter) {
      await initializeEnhancedModel();
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = async () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          console.log("正在进行人像智能分析...");

          // 1. AI模型分割
          const aiMask = await getAIMask(img, qualityMode);

          // 2. 传统算法分割
          const traditionalMask = await getTraditionalMask(canvas);

          // 3. 融合两种算法的结果
          const fusedMask = fuseMasks(
            aiMask,
            traditionalMask,
            aiWeight,
            traditionalWeight
          );

          // 4. 人像特定优化
          const portraitOptimizedMask = await optimizeForPortrait(
            fusedMask,
            canvas,
            { edgeRefinement, hairPreservation, qualityMode }
          );

          // 5. 应用最终蒙版
          const result = await applyEnhancedMask(
            canvas,
            portraitOptimizedMask,
            qualityMode
          );

          console.log("增强人像背景去除完成!");
          resolve(result);
        } catch (error) {
          console.error("增强处理失败:", error);
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = imageDataUrl;
    });
  } catch (error) {
    console.error("背景去除失败:", error);
    throw error;
  }
};

// 获取AI模型蒙版
const getAIMask = async (img, qualityMode) => {
  const segmentationConfig = {
    multiSegmentation: false,
    segmentBodyParts: false,
    flipHorizontal: false,
  };

  // 根据质量模式调整配置
  if (qualityMode === "high") {
    // 高质量模式可能需要多次分割取平均
    const segmentation1 = await segmenter.segmentPeople(
      img,
      segmentationConfig
    );
    const segmentation2 = await segmenter.segmentPeople(img, {
      ...segmentationConfig,
      segmentBodyParts: true,
    });

    if (segmentation1.length === 0) {
      throw new Error("未检测到人体，请确保图片中人物清晰可见");
    }

    // 如果有两个结果，取平均值
    const mask1 = segmentation1[0].mask;
    const mask2 = segmentation2.length > 0 ? segmentation2[0].mask : mask1;

    const averagedMask = new Float32Array(mask1.length);
    for (let i = 0; i < mask1.length; i++) {
      averagedMask[i] = (mask1[i] + mask2[i]) / 2;
    }

    return averagedMask;
  } else {
    const segmentation = await segmenter.segmentPeople(img, segmentationConfig);
    if (segmentation.length === 0) {
      throw new Error("未检测到人体，请确保图片中人物清晰可见");
    }
    return segmentation[0].mask;
  }
};

// 获取传统算法蒙版
const getTraditionalMask = async (canvas) => {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 使用改进的GrabCut + 颜色聚类
  const backgroundColors = detectBackgroundColors(
    data,
    canvas.width,
    canvas.height
  );
  const edges = detectEdges(data, canvas.width, canvas.height);
  const _colorRegions = performColorClustering(data);

  // 创建传统算法蒙版
  const mask = new Float32Array(canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % canvas.width;
    const y = Math.floor(pixelIndex / canvas.width);

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 多重判断：背景色相似性 + 边缘强度 + 位置权重
    let _isBackground = false;

    // 1. 背景色相似性检查
    const bgSimilarity = getBackgroundSimilarity(r, g, b, backgroundColors);

    // 2. 边缘强度检查
    const edgeStrength = edges[pixelIndex] || 0;

    // 3. 位置权重（边缘区域更可能是背景）
    const edgeDistance = Math.min(
      x,
      y,
      canvas.width - 1 - x,
      canvas.height - 1 - y
    );
    const positionWeight = Math.max(
      0,
      1 - (edgeDistance / Math.min(canvas.width, canvas.height)) * 4
    );

    // 综合判断
    const backgroundScore =
      bgSimilarity * 0.6 +
      positionWeight * 0.3 +
      (edgeStrength < 0.1 ? 0.1 : 0);

    if (backgroundScore > 0.4) {
      mask[pixelIndex] = 0; // 背景
    } else {
      mask[pixelIndex] = 1; // 前景
    }
  }

  return mask;
};

// 融合两种算法的蒙版
const fuseMasks = (aiMask, traditionalMask, aiWeight, traditionalWeight) => {
  const fusedMask = new Float32Array(aiMask.length);

  for (let i = 0; i < aiMask.length; i++) {
    // 加权平均
    fusedMask[i] =
      aiMask[i] * aiWeight + traditionalMask[i] * traditionalWeight;

    // 如果两个算法结果差异很大，增加传统算法的权重（AI可能出错）
    const difference = Math.abs(aiMask[i] - traditionalMask[i]);
    if (difference > 0.5) {
      fusedMask[i] = aiMask[i] * 0.5 + traditionalMask[i] * 0.5;
    }
  }

  return fusedMask;
};

// 人像特定优化
const optimizeForPortrait = async (mask, canvas, options) => {
  const { edgeRefinement, hairPreservation, qualityMode } = options;
  const width = canvas.width;
  const height = canvas.height;

  let optimizedMask = new Float32Array(mask);

  // 1. 头发区域保护
  if (hairPreservation) {
    optimizedMask = preserveHairRegion(optimizedMask, canvas);
  }

  // 2. 边缘精细化
  if (edgeRefinement) {
    optimizedMask = refineEdges(optimizedMask, canvas, qualityMode);
  }

  // 3. 形态学优化
  optimizedMask = applyMorphologyOperations(optimizedMask, width, height);

  // 4. 噪点去除
  optimizedMask = removeNoise(optimizedMask, width, height);

  return optimizedMask;
};

// 头发区域保护算法
const preserveHairRegion = (mask, canvas) => {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  const preservedMask = new Float32Array(mask);

  // 检测头部区域（上半部分）
  const headRegionHeight = Math.floor(height * 0.4);

  for (let y = 0; y < headRegionHeight; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      // 检测暗色像素（可能是头发）
      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const brightness = (r + g + b) / 3;

      // 如果是相对较暗的像素且在人像区域边缘
      if (brightness < 80 && mask[idx] > 0.3) {
        // 检查周围是否有明确的前景像素
        let foregroundNeighbors = 0;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIdx = ny * width + nx;
              if (mask[neighborIdx] > 0.7) {
                foregroundNeighbors++;
              }
            }
          }
        }

        // 如果周围有足够的前景像素，保护这个像素
        if (foregroundNeighbors >= 8) {
          preservedMask[idx] = Math.max(preservedMask[idx], 0.8);
        }
      }
    }
  }

  return preservedMask;
};

// 边缘精细化
const refineEdges = (mask, canvas, qualityMode) => {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;

  const refinedMask = new Float32Array(mask);
  const radius = qualityMode === "high" ? 3 : 2;

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = y * width + x;
      const currentMask = mask[idx];

      // 只处理边缘区域（蒙版值在0.2-0.8之间）
      if (currentMask > 0.2 && currentMask < 0.8) {
        const pixelIdx = idx * 4;
        const currentColor = {
          r: data[pixelIdx],
          g: data[pixelIdx + 1],
          b: data[pixelIdx + 2],
        };

        // 分析周围像素的颜色相似性
        let similarForegroundPixels = 0;
        let similarBackgroundPixels = 0;
        let totalForegroundPixels = 0;
        let totalBackgroundPixels = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIdx = ny * width + nx;
              const neighborPixelIdx = neighborIdx * 4;
              const neighborMask = mask[neighborIdx];

              const neighborColor = {
                r: data[neighborPixelIdx],
                g: data[neighborPixelIdx + 1],
                b: data[neighborPixelIdx + 2],
              };

              const colorSimilarity = calculateColorSimilarity(
                currentColor,
                neighborColor
              );

              if (neighborMask > 0.7) {
                totalForegroundPixels++;
                if (colorSimilarity > 0.7) {
                  similarForegroundPixels++;
                }
              } else if (neighborMask < 0.3) {
                totalBackgroundPixels++;
                if (colorSimilarity > 0.7) {
                  similarBackgroundPixels++;
                }
              }
            }
          }
        }

        // 根据颜色相似性调整蒙版值
        if (totalForegroundPixels > 0 && totalBackgroundPixels > 0) {
          const foregroundSimilarityRatio =
            similarForegroundPixels / totalForegroundPixels;
          const backgroundSimilarityRatio =
            similarBackgroundPixels / totalBackgroundPixels;

          if (foregroundSimilarityRatio > backgroundSimilarityRatio) {
            refinedMask[idx] = Math.min(1, currentMask + 0.2);
          } else if (backgroundSimilarityRatio > foregroundSimilarityRatio) {
            refinedMask[idx] = Math.max(0, currentMask - 0.2);
          }
        }
      }
    }
  }

  return refinedMask;
};

// 应用增强蒙版
const applyEnhancedMask = async (canvas, mask, qualityMode) => {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 根据质量模式选择边缘平滑参数
  const blurRadius =
    qualityMode === "high" ? 2 : qualityMode === "balanced" ? 1 : 0;
  const smoothMask =
    blurRadius > 0
      ? gaussianBlurMask(mask, canvas.width, canvas.height, blurRadius)
      : mask;

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const maskValue = smoothMask[pixelIndex];

    if (maskValue < 0.05) {
      // 完全透明
      data[i + 3] = 0;
    } else if (maskValue < 0.95) {
      // 半透明边缘
      data[i + 3] = Math.round(data[i + 3] * maskValue);
    }
    // 完全不透明的像素保持不变
  }

  const resultCanvas = document.createElement("canvas");
  const resultCtx = resultCanvas.getContext("2d");
  resultCanvas.width = canvas.width;
  resultCanvas.height = canvas.height;

  resultCtx.putImageData(
    new ImageData(data, canvas.width, canvas.height),
    0,
    0
  );
  return resultCanvas.toDataURL("image/png");
};

// 辅助函数
const detectBackgroundColors = (data, width, height) => {
  const edgeColors = [];
  const samplePoints = Math.min(50, Math.floor((width + height) / 4));

  // 从边缘采样更多点
  for (let i = 0; i < samplePoints; i++) {
    const side = i % 4;
    let x, y;

    switch (side) {
      case 0: // 上边
        x = Math.floor((((i / 4) * width) / samplePoints) * 4);
        y = 0;
        break;
      case 1: // 右边
        x = width - 1;
        y = Math.floor((((i / 4) * height) / samplePoints) * 4);
        break;
      case 2: // 下边
        x = Math.floor((((i / 4) * width) / samplePoints) * 4);
        y = height - 1;
        break;
      case 3: // 左边
        x = 0;
        y = Math.floor((((i / 4) * height) / samplePoints) * 4);
        break;
    }

    if (x < width && y < height) {
      const idx = (y * width + x) * 4;
      edgeColors.push({
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
      });
    }
  }

  // 简单聚类得到主要背景色
  return clusterColors(edgeColors, 3);
};

const clusterColors = (colors, k) => {
  if (colors.length <= k) return colors;

  let clusters = colors.slice(0, k);

  for (let iter = 0; iter < 10; iter++) {
    const assignments = colors.map((color) => {
      let minDist = Infinity;
      let bestCluster = 0;

      clusters.forEach((cluster, i) => {
        const dist = colorDistance(color, cluster);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = i;
        }
      });

      return bestCluster;
    });

    for (let i = 0; i < k; i++) {
      const clusterColors = colors.filter((_, j) => assignments[j] === i);
      if (clusterColors.length > 0) {
        clusters[i] = {
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
      }
    }
  }

  return clusters;
};

const detectEdges = (data, width, height) => {
  const edges = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // Sobel边缘检测
      let gx = 0,
        gy = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
          const intensity =
            (data[neighborIdx] +
              data[neighborIdx + 1] +
              data[neighborIdx + 2]) /
            3;

          // Sobel kernels
          const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
          const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
          const kernelIdx = (dy + 1) * 3 + (dx + 1);

          gx += intensity * sobelX[kernelIdx];
          gy += intensity * sobelY[kernelIdx];
        }
      }

      edges[idx] = Math.sqrt(gx * gx + gy * gy) / 255;
    }
  }

  return edges;
};

const performColorClustering = (data) => {
  // 简化版本的颜色聚类
  const colors = [];

  for (let i = 0; i < data.length; i += 64) {
    // 降采样
    colors.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    });
  }

  return clusterColors(colors, 8);
};

const getBackgroundSimilarity = (r, g, b, backgroundColors) => {
  let maxSimilarity = 0;

  backgroundColors.forEach((bgColor) => {
    const similarity = 1 - colorDistance({ r, g, b }, bgColor) / 442; // 442 is max possible distance
    maxSimilarity = Math.max(maxSimilarity, similarity);
  });

  return maxSimilarity;
};

const applyMorphologyOperations = (mask, width, height) => {
  // 开运算：先腐蚀后膨胀，去除小噪点
  let processed = morphologyErode(mask, width, height, 1);
  processed = morphologyDilate(processed, width, height, 1);

  // 闭运算：先膨胀后腐蚀，填补小洞
  processed = morphologyDilate(processed, width, height, 2);
  processed = morphologyErode(processed, width, height, 2);

  return processed;
};

const removeNoise = (mask, width, height) => {
  const denoised = new Float32Array(mask);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;

      // 3x3中值滤波
      const neighborhood = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          neighborhood.push(mask[(y + dy) * width + (x + dx)]);
        }
      }

      neighborhood.sort((a, b) => a - b);
      denoised[idx] = neighborhood[4]; // 中值
    }
  }

  return denoised;
};

const calculateColorSimilarity = (color1, color2) => {
  const distance = colorDistance(color1, color2);
  return Math.max(0, 1 - distance / 442); // 归一化到0-1
};

const colorDistance = (color1, color2) => {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
};

const gaussianBlurMask = (mask, width, height, radius) => {
  if (radius <= 0) return mask;

  const blurred = new Float32Array(mask);
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
