// 使用TensorFlow.js和MediaPipe的高质量AI背景去除
// 增强版本：结合传统算法优化人像处理效果
import * as tf from "@tensorflow/tfjs";
import * as bodySegmentation from "@tensorflow-models/body-segmentation";

let segmenter = null;

// 初始化AI模型
export const initializeModel = async () => {
  if (segmenter) return segmenter;

  try {
    console.log("正在加载AI模型...");

    // 设置TensorFlow.js后端
    await tf.ready();

    // 加载MediaPipe SelfieSegmentation模型
    const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
    const segmenterConfig = {
      runtime: "mediapipe",
      solutionPath:
        "https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation",
      modelType: "general", // 恢复为原来的general模型
    };

    segmenter = await bodySegmentation.createSegmenter(model, segmenterConfig);
    console.log("AI模型加载成功!");

    return segmenter;
  } catch (error) {
    console.error("模型加载失败:", error);
    throw new Error("AI模型加载失败，请刷新页面重试");
  }
};

// 使用AI模型进行背景去除 - 简化增强版
export const removeBackgroundAI = async (imageDataUrl, options = {}) => {
  const {
    threshold = 0.65, // 适中的阈值
    edgeBlur = 2, // 保持适度的边缘模糊
    foregroundThreshold = 0.55, // 适中的前景阈值
    enableEnhancement = false, // 默认禁用增强处理
    qualityMode = "balanced", // 默认平衡模式
    aggressiveMode = false, // 激进模式
  } = options;

  try {
    // 确保模型已加载
    if (!segmenter) {
      await initializeModel();
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

          // 绘制原始图像
          ctx.drawImage(img, 0, 0);

          // 进行人体分割
          console.log("正在进行AI分析...");
          console.log("图片尺寸:", img.width, "x", img.height);

          const segmentation = await segmenter.segmentPeople(img, {
            multiSegmentation: false,
            segmentBodyParts: false,
            flipHorizontal: false,
          });

          console.log("分割结果:", segmentation.length, "个人体");

          if (segmentation.length === 0) {
            throw new Error("未检测到人体，尝试调整图片角度或确保人物清晰可见");
          }

          // 获取分割蒙版
          const mask = segmentation[0].mask;
          console.log("蒙版数据类型:", typeof mask);
          console.log("蒙版数据长度:", mask.length);
          console.log("蒙版数据构造函数:", mask.constructor.name);
          console.log("蒙版数据键:", Object.keys(mask));
          console.log("蒙版数据属性:", Object.getOwnPropertyNames(mask));

          // 尝试不同的数据访问方式
          let actualMaskData = null;
          if (mask.mask) {
            // 蒙版对象有mask属性，这是实际数据
            actualMaskData = mask.mask;
            console.log(
              "找到mask.mask属性",
              typeof actualMaskData,
              actualMaskData.length || "length undefined"
            );
          } else if (mask.data) {
            actualMaskData = mask.data;
            console.log("找到mask.data属性", actualMaskData.length);
          } else if (mask.values) {
            actualMaskData = mask.values;
            console.log("找到mask.values属性", actualMaskData.length);
          } else if (mask.pixels) {
            actualMaskData = mask.pixels;
            console.log("找到mask.pixels属性", actualMaskData.length);
          } else {
            // 尝试直接迭代对象
            try {
              actualMaskData = Array.from(mask);
              console.log("成功将蒙版转换为数组", actualMaskData.length);
            } catch (err) {
              console.error("无法访问蒙版数据:", err);
              throw new Error("无法解析蒙版数据格式");
            }
          }

          // 检查实际蒙版数据的统计信息
          if (actualMaskData) {
            console.log("实际蒙版数据类型:", typeof actualMaskData);
            console.log(
              "实际蒙版数据构造函数:",
              actualMaskData.constructor.name
            );
            console.log("实际蒙版数据长度:", actualMaskData.length);

            // 如果是ImageBitmap，需要特殊处理
            if (actualMaskData.constructor.name === "ImageBitmap") {
              console.log(
                "ImageBitmap尺寸:",
                actualMaskData.width,
                "x",
                actualMaskData.height
              );

              // 将ImageBitmap转换为像素数据
              const tempCanvas = document.createElement("canvas");
              const tempCtx = tempCanvas.getContext("2d", {
                willReadFrequently: true,
              });
              tempCanvas.width = actualMaskData.width;
              tempCanvas.height = actualMaskData.height;

              // 绘制ImageBitmap到canvas
              tempCtx.drawImage(actualMaskData, 0, 0);

              // 获取像素数据
              const maskImageData = tempCtx.getImageData(
                0,
                0,
                actualMaskData.width,
                actualMaskData.height
              );

              // 提取蒙版数据 - 检查所有通道找到有效数据
              const maskArray = new Float32Array(
                actualMaskData.width * actualMaskData.height
              );

              // 先检查alpha通道（最常见的蒙版数据）
              let hasValidData = false;
              let channelToUse = 0; // 默认使用红色通道

              // 检查alpha通道
              for (let i = 0; i < maskArray.length; i++) {
                const alphaValue = maskImageData.data[i * 4 + 3];
                if (alphaValue > 0 && alphaValue < 255) {
                  hasValidData = true;
                  channelToUse = 3; // 使用alpha通道
                  break;
                }
              }

              // 如果alpha通道没有有效数据，检查红色通道
              if (!hasValidData) {
                for (let i = 0; i < maskArray.length; i++) {
                  const redValue = maskImageData.data[i * 4];
                  if (redValue > 0 && redValue < 255) {
                    hasValidData = true;
                    channelToUse = 0; // 使用红色通道
                    break;
                  }
                }
              }

              // 如果还是没有，检查绿色通道
              if (!hasValidData) {
                for (let i = 0; i < maskArray.length; i++) {
                  const greenValue = maskImageData.data[i * 4 + 1];
                  if (greenValue > 0 && greenValue < 255) {
                    hasValidData = true;
                    channelToUse = 1; // 使用绿色通道
                    break;
                  }
                }
              }

              console.log(
                `ImageBitmap数据检测: 使用通道${channelToUse}, 有效数据: ${hasValidData}`
              );

              // 提取选定通道的数据
              for (let i = 0; i < maskArray.length; i++) {
                maskArray[i] = maskImageData.data[i * 4 + channelToUse] / 255; // 归一化到0-1
              }

              // 如果仍然没有有效数据，尝试使用亮度值
              if (!hasValidData) {
                console.log("所有通道无效，使用亮度值");
                for (let i = 0; i < maskArray.length; i++) {
                  const r = maskImageData.data[i * 4];
                  const g = maskImageData.data[i * 4 + 1];
                  const b = maskImageData.data[i * 4 + 2];
                  const brightness = (r + g + b) / 3;
                  maskArray[i] = brightness / 255;
                }
              }

              // 更新actualMaskData
              actualMaskData = maskArray;

              // 检查蒙版是否需要反转（MediaPipe可能返回反转的蒙版）
              const checkSampleSize = Math.min(1000, maskArray.length);
              const checkSample = Array.from(maskArray).slice(
                0,
                checkSampleSize
              );
              const avgValue =
                checkSample.reduce((a, b) => a + b, 0) / checkSample.length;

              // 如果平均值很高（>0.7），可能需要反转
              if (avgValue > 0.7) {
                console.log(
                  `检测到高平均值(${avgValue.toFixed(3)})，可能需要反转蒙版`
                );
                for (let i = 0; i < maskArray.length; i++) {
                  maskArray[i] = 1.0 - maskArray[i]; // 反转蒙版
                }
                actualMaskData = maskArray;
              }

              // 计算统计信息
              const sampleSize = Math.min(1000, maskArray.length);
              const sample = Array.from(maskArray).slice(0, sampleSize);
              const maskStats = {
                min: Math.min(...sample),
                max: Math.max(...sample),
                avg: sample.reduce((a, b) => a + b, 0) / sample.length,
                length: maskArray.length,
              };
              console.log("转换后ImageBitmap蒙版统计:", maskStats);
            }
            // 如果是TypedArray或数组，计算统计信息
            else if (actualMaskData.length > 0) {
              const sampleSize = Math.min(1000, actualMaskData.length);
              const sample = Array.from(actualMaskData).slice(0, sampleSize);
              const maskStats = {
                min: Math.min(...sample),
                max: Math.max(...sample),
                avg: sample.reduce((a, b) => a + b, 0) / sample.length,
                length: actualMaskData.length,
              };
              console.log("实际蒙版统计:", maskStats);
            } else {
              console.error("蒙版数据长度为0，可能需要不同的访问方式");
              // 如果数据长度是0，尝试直接使用原始蒙版对象
              actualMaskData = mask;
              console.log("回退到使用原始蒙版对象");
            }
          } else {
            console.error("未找到有效的蒙版数据");
            throw new Error("无法获取蒙版数据");
          }

          // 应用高质量蒙版处理
          const processedImageData = await applyAdvancedMask(
            canvas,
            actualMaskData, // 使用实际的蒙版数据
            threshold,
            edgeBlur,
            foregroundThreshold,
            enableEnhancement,
            qualityMode,
            aggressiveMode
          );

          const processedCanvas = document.createElement("canvas");
          const processedCtx = processedCanvas.getContext("2d");
          processedCanvas.width = canvas.width;
          processedCanvas.height = canvas.height;

          processedCtx.putImageData(processedImageData, 0, 0);

          const result = processedCanvas.toDataURL("image/png");
          console.log("AI背景去除完成!");
          resolve(result);
        } catch (error) {
          console.error("AI处理失败:", error);
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error("图片加载失败"));
      };

      img.src = imageDataUrl;
    });
  } catch (error) {
    console.error("背景去除失败:", error);
    throw error;
  }
};

// 高质量蒙版应用 - 简化版
const applyAdvancedMask = async (
  canvas,
  mask,
  threshold,
  edgeBlur,
  foregroundThreshold,
  enableEnhancement = false,
  qualityMode = "balanced",
  aggressiveMode = false
) => {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 创建高质量蒙版
  let refinedMask = await refineMask(
    mask,
    canvas.width,
    canvas.height,
    threshold
  );

  // Mac风格的激进处理
  if (aggressiveMode || qualityMode === "mac_like") {
    console.log("启用Mac风格激进模式");
    // 更激进的阈值处理
    refinedMask = applyMacStyleProcessing(
      refinedMask,
      canvas.width,
      canvas.height,
      threshold
    );
  }

  // 根据质量模式和启用增强选项进行处理
  if (enableEnhancement) {
    // 简化处理，避免复杂计算导致卡死
    refinedMask = basicPortraitOptimization(refinedMask, canvas);

    // 只在小图片上进行额外处理
    if (qualityMode === "high" && canvas.width * canvas.height < 500000) {
      console.log("小图片检测，使用高质量模式");
      // 对于小图片，使用额外的边缘平滑
      refinedMask = applyEdgeSmoothing(
        refinedMask,
        canvas.width,
        canvas.height,
        Math.min(edgeBlur + 1, 3) // 限制最大模糊半径
      );
    }
  }

  // 创建边缘平滑蒙版
  const smoothMask = applyEdgeSmoothing(
    refinedMask,
    canvas.width,
    canvas.height,
    edgeBlur
  );

  // 应用蒙版
  let transparentPixels = 0;
  let totalPixels = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const maskValue = smoothMask[pixelIndex];

    if (maskValue < foregroundThreshold) {
      // 背景像素 - 设为透明
      data[i + 3] = 0;
      transparentPixels++;
    } else {
      // 前景像素 - 根据模式应用不同的透明度处理
      if (qualityMode === "mac_like" || aggressiveMode) {
        // Mac风格：更加决断的边缘处理
        if (maskValue < 0.3) {
          // 边缘区域使用更锐利的过渡
          const sharpOpacity = Math.pow(maskValue / 0.3, 2.2);
          data[i + 3] = Math.round(data[i + 3] * sharpOpacity);
        } else if (maskValue < 0.95) {
          // 中间区域使用非线性映射
          const edgeOpacity = 0.3 + (maskValue - 0.3) * 1.08; // 更快达到不透明
          data[i + 3] = Math.round(data[i + 3] * Math.min(1, edgeOpacity));
        }
        // maskValue >= 0.95 的像素保持完全不透明
      } else if (qualityMode === "high" && maskValue < 0.98) {
        // 高质量模式：更精细的边缘透明度控制
        const edgeOpacity = Math.pow(maskValue, 0.8); // 使用幂函数创建更自然的过渡
        data[i + 3] = Math.round(data[i + 3] * edgeOpacity);
      } else if (maskValue < 0.95) {
        // 标准边缘透明度处理
        data[i + 3] = Math.round(data[i + 3] * maskValue);
      }
    }
  }

  console.log(
    `设置透明像素: ${transparentPixels}/${totalPixels} (${(
      (transparentPixels / totalPixels) *
      100
    ).toFixed(1)}%)`
  );
  console.log(`前景阈值: ${foregroundThreshold}, 背景阈值: ${threshold}`);
  console.log(
    `质量模式: ${qualityMode}, 增强处理: ${enableEnhancement}, 激进模式: ${aggressiveMode}`
  );

  return imageData;
};

// 优化蒙版质量
const refineMask = async (mask, width, height, threshold) => {
  const refined = new Float32Array(mask.length);

  // 应用阈值和噪点去除
  for (let i = 0; i < mask.length; i++) {
    refined[i] = mask[i] > threshold ? 1.0 : 0.0;
  }

  // 形态学操作 - 开运算（去除小噪点）
  const opened = morphologyOpen(refined, width, height, 2);

  // 形态学操作 - 闭运算（填充小洞）
  const closed = morphologyClose(opened, width, height, 3);

  return closed;
};

// 边缘平滑处理
const applyEdgeSmoothing = (mask, width, height, blurRadius) => {
  if (blurRadius <= 0) return mask;

  const smoothed = new Float32Array(mask.length);
  const kernel = createGaussianKernel(blurRadius);
  const kernelSize = kernel.length;
  const kernelRadius = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = y * width + x;
      let sum = 0;
      let weightSum = 0;

      // 应用高斯模糊
      for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
        for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
          const nx = x + kx;
          const ny = y + ky;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIdx = ny * width + nx;
            const kernelIdx =
              (ky + kernelRadius) * kernelSize + (kx + kernelRadius);
            const weight = kernel[kernelIdx];

            sum += mask[neighborIdx] * weight;
            weightSum += weight;
          }
        }
      }

      smoothed[centerIdx] = weightSum > 0 ? sum / weightSum : mask[centerIdx];
    }
  }

  return smoothed;
};

// 创建高斯核
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

  // 归一化
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= sum;
  }

  return kernel;
};

// 形态学开运算
const morphologyOpen = (mask, width, height, radius) => {
  const eroded = morphologyErode(mask, width, height, radius);
  return morphologyDilate(eroded, width, height, radius);
};

// 形态学闭运算
const morphologyClose = (mask, width, height, radius) => {
  const dilated = morphologyDilate(mask, width, height, radius);
  return morphologyErode(dilated, width, height, radius);
};

// 腐蚀操作
const morphologyErode = (mask, width, height, radius) => {
  const result = new Float32Array(mask.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = y * width + x;
      let minValue = 1.0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIdx = ny * width + nx;
            minValue = Math.min(minValue, mask[neighborIdx]);
          }
        }
      }

      result[centerIdx] = minValue;
    }
  }

  return result;
};

// 膨胀操作
const morphologyDilate = (mask, width, height, radius) => {
  const result = new Float32Array(mask.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = y * width + x;
      let maxValue = 0.0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const neighborIdx = ny * width + nx;
            maxValue = Math.max(maxValue, mask[neighborIdx]);
          }
        }
      }

      result[centerIdx] = maxValue;
    }
  }

  return result;
};

// 简化的人像优化 - 性能优化版
const basicPortraitOptimization = (mask, canvas) => {
  const width = canvas.width;
  const height = canvas.height;

  // 只做最基础的形态学操作，避免复杂计算
  let processed = morphologyErode(mask, width, height, 1);
  processed = morphologyDilate(processed, width, height, 2);

  // 对于大图片，跳过复杂的边缘处理
  if (width * height > 1000000) {
    console.log("大图片检测，使用简化处理模式");
    return processed;
  }

  // 小图片才进行额外优化
  processed = fastEdgeSmoothing(processed, width, height);

  return processed;
};

// 预热模型（可选，提高首次使用速度）
export const warmupModel = async () => {
  try {
    await initializeModel();

    // 创建一个小的测试图像来预热模型
    const testCanvas = document.createElement("canvas");
    testCanvas.width = 100;
    testCanvas.height = 100;
    const ctx = testCanvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 100, 100);

    const testImg = new Image();
    testImg.src = testCanvas.toDataURL();

    testImg.onload = async () => {
      try {
        await segmenter.segmentPeople(testImg);
        console.log("AI模型预热完成");
      } catch {
        console.log("模型预热失败，但不影响正常使用");
      }
    };
  } catch (error) {
    console.log("模型预热失败:", error);
  }
};

// 人像特定优化
const _optimizeForPortrait = async (mask, canvas, qualityMode) => {
  const width = canvas.width;
  const height = canvas.height;

  let optimizedMask = new Float32Array(mask);

  // 1. 头发区域保护
  optimizedMask = preserveHairRegion(optimizedMask, canvas);

  // 2. 边缘精细化
  if (qualityMode !== "fast") {
    optimizedMask = refineEdges(optimizedMask, canvas, qualityMode);
  }

  // 3. 形态学优化
  optimizedMask = applyMorphologyOperations(optimizedMask, width, height);

  // 4. 噪点去除
  optimizedMask = removeNoise(optimizedMask, width, height);

  return optimizedMask;
};

// 传统算法辅助修正
const _getTraditionalMaskAssist = async (canvas) => {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 简化版的传统算法辅助
  const backgroundColors = detectBackgroundColors(
    data,
    canvas.width,
    canvas.height
  );
  const mask = new Float32Array(canvas.width * canvas.height);

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 简单的背景相似性检查
    const bgSimilarity = getBackgroundSimilarity(r, g, b, backgroundColors);

    if (bgSimilarity > 0.6) {
      mask[pixelIndex] = 0; // 背景
    } else {
      mask[pixelIndex] = 1; // 前景
    }
  }

  return mask;
};

// 融合两种算法的蒙版
const _fuseMasks = (aiMask, traditionalMask, aiWeight, traditionalWeight) => {
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

// 辅助函数
const detectBackgroundColors = (data, width, height) => {
  const edgeColors = [];
  const samplePoints = Math.min(50, Math.floor((width + height) / 4));

  for (let i = 0; i < samplePoints; i++) {
    const side = i % 4;
    let x, y;

    switch (side) {
      case 0:
        x = Math.floor((((i / 4) * width) / samplePoints) * 4);
        y = 0;
        break;
      case 1:
        x = width - 1;
        y = Math.floor((((i / 4) * height) / samplePoints) * 4);
        break;
      case 2:
        x = Math.floor((((i / 4) * width) / samplePoints) * 4);
        y = height - 1;
        break;
      case 3:
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

  return clusterColors(edgeColors, 3);
};

const clusterColors = (colors, k) => {
  if (colors.length <= k) return colors;

  let clusters = colors.slice(0, k);

  for (let iter = 0; iter < 5; iter++) {
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

const getBackgroundSimilarity = (r, g, b, backgroundColors) => {
  let maxSimilarity = 0;

  backgroundColors.forEach((bgColor) => {
    const similarity = 1 - colorDistance({ r, g, b }, bgColor) / 442;
    maxSimilarity = Math.max(maxSimilarity, similarity);
  });

  return maxSimilarity;
};

const applyMorphologyOperations = (mask, width, height) => {
  let processed = morphologyErode(mask, width, height, 1);
  processed = morphologyDilate(processed, width, height, 1);
  processed = morphologyDilate(processed, width, height, 2);
  processed = morphologyErode(processed, width, height, 2);
  return processed;
};

const removeNoise = (mask, width, height) => {
  const denoised = new Float32Array(mask);

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
      denoised[idx] = neighborhood[4];
    }
  }

  return denoised;
};

const calculateColorSimilarity = (color1, color2) => {
  const distance = colorDistance(color1, color2);
  return Math.max(0, 1 - distance / 442);
};

const colorDistance = (color1, color2) => {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
};

// 高级边缘平滑处理 - 保留但不使用
const _advancedEdgeSmoothing = (mask, width, height) => {
  const smoothed = new Float32Array(mask.length);

  // 双边缘滤波器 - 保持边缘同时平滑噪声
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      let sum = 0;
      let weightSum = 0;

      // 5x5 高斯核
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const neighborIdx = ny * width + nx;

          // 高斯权重
          const distance = Math.sqrt(dx * dx + dy * dy);
          const weight = Math.exp(-(distance * distance) / (2 * 1.5 * 1.5));

          sum += mask[neighborIdx] * weight;
          weightSum += weight;
        }
      }

      smoothed[idx] = sum / weightSum;
    }
  }

  // 边缘区域复制原值
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (y < 2 || y >= height - 2 || x < 2 || x >= width - 2) {
        smoothed[idx] = mask[idx];
      }
    }
  }

  return smoothed;
};

// 头发区域增强处理 - 保留但不使用
const _enhanceHairRegion = (mask, canvas) => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  const enhanced = new Float32Array(mask);

  // 上半部分作为头部区域
  const headHeight = Math.floor(height * 0.6);

  for (let y = 0; y < headHeight; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const brightness = (r + g + b) / 3;
      const saturation = Math.abs(Math.max(r, g, b) - Math.min(r, g, b));

      // 检测可能的头发像素（暗色且低饱和度）
      if (brightness < 100 && saturation < 50 && mask[idx] > 0.1) {
        // 检查周围的人像像素密度
        let portraitNeighbors = 0;
        let totalNeighbors = 0;

        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIdx = ny * width + nx;
              totalNeighbors++;
              if (mask[neighborIdx] > 0.6) {
                portraitNeighbors++;
              }
            }
          }
        }

        const portraitRatio = portraitNeighbors / totalNeighbors;
        if (portraitRatio > 0.3) {
          // 增强头发区域的蒙版值
          enhanced[idx] = Math.max(enhanced[idx], 0.7 + portraitRatio * 0.2);
        }
      }
    }
  }

  return enhanced;
};

// 生成渐变边缘 - 保留但不使用
const _generateGradientEdges = (mask, width, height) => {
  const gradient = new Float32Array(mask.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const currentValue = mask[idx];

      // 计算在边缘区域的梯度
      if (currentValue > 0.1 && currentValue < 0.9) {
        let minNeighbor = 1.0;
        let maxNeighbor = 0.0;

        // 检查 3x3 领域
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;
            const neighborIdx = ny * width + nx;
            const neighborValue = mask[neighborIdx];

            minNeighbor = Math.min(minNeighbor, neighborValue);
            maxNeighbor = Math.max(maxNeighbor, neighborValue);
          }
        }

        const gradientStrength = maxNeighbor - minNeighbor;

        if (gradientStrength > 0.3) {
          // 在边缘区域应用平滑渐变
          const distance = Math.min(currentValue, 1 - currentValue) * 2;
          const smoothFactor = Math.exp(-distance * distance * 4);
          gradient[idx] =
            currentValue * (1 - smoothFactor) +
            ((minNeighbor + maxNeighbor) / 2) * smoothFactor;
        } else {
          gradient[idx] = currentValue;
        }
      } else {
        gradient[idx] = currentValue;
      }
    }
  }

  // 边界区域保持原值
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        gradient[idx] = mask[idx];
      }
    }
  }

  return gradient;
};

// 快速边缘平滑处理 - 性能优化版
const fastEdgeSmoothing = (mask, width, height) => {
  const smoothed = new Float32Array(mask.length);

  // 使用简单的 3x3 平均滤波器，避免复杂的高斯核计算
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      let sum = 0;
      let count = 0;

      // 3x3 领域平均
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const neighborIdx = ny * width + nx;
          sum += mask[neighborIdx];
          count++;
        }
      }

      smoothed[idx] = sum / count;
    }
  }

  // 边界区域保持原值
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        smoothed[idx] = mask[idx];
      }
    }
  }

  return smoothed;
};

// Mac风格激进处理 - 模仯Mac系统的去背效果
const applyMacStyleProcessing = (mask, width, height, originalThreshold) => {
  const processed = new Float32Array(mask.length);

  // 第一步：更激进的二值化处理
  const aggressiveThreshold = Math.max(0.15, originalThreshold * 0.6);

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < aggressiveThreshold) {
      processed[i] = 0.0; // 彻底透明
    } else if (mask[i] > 0.8) {
      processed[i] = 1.0; // 明确的前景
    } else {
      // 边缘区域使用非线性映射，更锐利的过渡
      const normalizedValue =
        (mask[i] - aggressiveThreshold) / (0.8 - aggressiveThreshold);
      processed[i] = Math.pow(normalizedValue, 1.8); // 使用幂函数创建更锐利的边缘
    }
  }

  // 第二步：边缘细化处理
  const refined = new Float32Array(processed.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const currentValue = processed[idx];

      if (currentValue > 0.1 && currentValue < 0.9) {
        // 对边缘像素进行更精细的处理
        let backgroundNeighbors = 0;
        let foregroundNeighbors = 0;

        // 检查 3x3 领域
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIdx = ny * width + nx;
              const neighborValue = processed[neighborIdx];

              if (neighborValue < 0.2) {
                backgroundNeighbors++;
              } else if (neighborValue > 0.8) {
                foregroundNeighbors++;
              }
            }
          }
        }

        // Mac风格的决策逻辑：倾向于更干净的切割
        if (backgroundNeighbors > foregroundNeighbors) {
          refined[idx] = Math.max(0, currentValue - 0.3); // 倾向于背景
        } else if (foregroundNeighbors > backgroundNeighbors) {
          refined[idx] = Math.min(1, currentValue + 0.2); // 倾向于前景
        } else {
          refined[idx] = currentValue;
        }
      } else {
        refined[idx] = currentValue;
      }
    }
  }

  // 边界像素保持原值
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
        refined[idx] = processed[idx];
      }
    }
  }

  return refined;
};
