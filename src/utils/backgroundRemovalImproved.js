// 改进的背景去除算法
// 专注于更好的边缘检测和颜色分析

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

      // 使用改进的背景去除算法
      const processedData = smartBackgroundRemoval(
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

// 智能背景去除算法
const smartBackgroundRemoval = (data, width, height) => {
  const newData = new Uint8ClampedArray(data);

  // 1. 多点背景色检测
  const backgroundColors = detectMultipleBackgroundColors(data, width, height);

  // 2. 边缘检测
  const edges = simpleEdgeDetection(data, width, height);

  // 3. 创建初始蒙版
  const mask = createInitialMask(data, width, height, backgroundColors, edges);

  // 4. 改善蒙版质量
  const improvedMask = improveMask(mask, width, height, 3);

  // 5. 应用蒙版和边缘平滑
  applyMaskWithSmoothing(newData, improvedMask, edges, width, height);

  return newData;
};

// 检测多个背景色
const detectMultipleBackgroundColors = (data, width, height) => {
  const edgePoints = [
    // 四个角落 + 边缘中点
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
    { x: Math.floor(width / 2), y: 0 },
    { x: Math.floor(width / 2), y: height - 1 },
    { x: 0, y: Math.floor(height / 2) },
    { x: width - 1, y: Math.floor(height / 2) },
    // 添加更多边缘采样点
    { x: Math.floor(width * 0.25), y: 0 },
    { x: Math.floor(width * 0.75), y: 0 },
    { x: Math.floor(width * 0.25), y: height - 1 },
    { x: Math.floor(width * 0.75), y: height - 1 },
  ];

  const colors = edgePoints.map((point) => {
    const index = (point.y * width + point.x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
    };
  });

  // 使用简单的聚类找到主要背景色
  return clusterColors(colors, 3);
};

// 颜色聚类
const clusterColors = (colors, k) => {
  if (colors.length <= k) return colors;

  // 简单的k-means聚类
  let clusters = colors.slice(0, k);

  for (let iter = 0; iter < 5; iter++) {
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

// 简单边缘检测
const simpleEdgeDetection = (data, width, height) => {
  const edges = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * 4;

      // 计算当前像素的灰度值
      const gray =
        (data[pixelIdx] + data[pixelIdx + 1] + data[pixelIdx + 2]) / 3;

      // 计算周围像素的平均灰度值
      let surroundingGray = 0;
      let count = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;

          const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
          const neighborGray =
            (data[neighborIdx] +
              data[neighborIdx + 1] +
              data[neighborIdx + 2]) /
            3;
          surroundingGray += neighborGray;
          count++;
        }
      }

      surroundingGray /= count;

      // 计算差异作为边缘强度
      edges[idx] = Math.abs(gray - surroundingGray) / 255;
    }
  }

  return edges;
};

// 创建初始蒙版
const createInitialMask = (data, width, height, backgroundColors, edges) => {
  const mask = new Array(width * height);

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const _x = pixelIndex % width;
    const _y = Math.floor(pixelIndex / width);

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 检查是否与任何背景色相似
    let isBackground = false;
    const threshold = 45; // 相似度阈值

    for (const bgColor of backgroundColors) {
      if (colorDistance(r, g, b, bgColor) < threshold) {
        isBackground = true;
        break;
      }
    }

    // 如果在边缘附近且颜色相似，更可能是背景
    const edgeStrength = edges[pixelIndex] || 0;
    if (isBackground && edgeStrength < 0.15) {
      mask[pixelIndex] = 0; // 背景
    } else {
      mask[pixelIndex] = 1; // 前景
    }
  }

  return mask;
};

// 改善蒙版质量
const improveMask = (mask, width, height, iterations) => {
  let currentMask = [...mask];

  for (let iter = 0; iter < iterations; iter++) {
    const newMask = [...currentMask];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        // 统计3x3邻域的前景和背景像素
        let foregroundCount = 0;
        let backgroundCount = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const neighborIdx = (y + dy) * width + (x + dx);
            if (currentMask[neighborIdx] === 1) {
              foregroundCount++;
            } else {
              backgroundCount++;
            }
          }
        }

        // 根据邻域投票决定像素类型
        if (foregroundCount > backgroundCount) {
          newMask[idx] = 1;
        } else {
          newMask[idx] = 0;
        }
      }
    }

    currentMask = newMask;
  }

  return currentMask;
};

// 应用蒙版和边缘平滑
const applyMaskWithSmoothing = (data, mask, edges, width, height) => {
  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);

    if (mask[pixelIndex] === 0) {
      // 背景像素 - 设为透明
      data[i + 3] = 0;
    } else {
      // 前景像素 - 检查是否需要边缘平滑
      const edgeStrength = edges[pixelIndex] || 0;

      if (edgeStrength > 0.2) {
        // 边缘像素，进行透明度调整
        let transparentNeighbors = 0;
        let totalNeighbors = 0;

        // 检查周围的透明像素
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIdx = ny * width + nx;
              totalNeighbors++;

              if (mask[neighborIdx] === 0) {
                transparentNeighbors++;
              }
            }
          }
        }

        if (transparentNeighbors > 0 && totalNeighbors > 0) {
          const transparencyRatio = transparentNeighbors / totalNeighbors;
          data[i + 3] = Math.round(data[i + 3] * (1 - transparencyRatio * 0.5));
        }
      }
    }
  }
};

// 颜色距离计算
const colorDistance = (r1, g1, b1, color2) => {
  return Math.sqrt(
    Math.pow(r1 - color2.r, 2) +
      Math.pow(g1 - color2.g, 2) +
      Math.pow(b1 - color2.b, 2)
  );
};

// 导出简单版本的背景去除（用于对比）
export const removeBackgroundSimple = async (imageDataUrl) => {
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

      // 简单的四角背景色检测
      const corners = [
        { x: 0, y: 0 },
        { x: canvas.width - 1, y: 0 },
        { x: 0, y: canvas.height - 1 },
        { x: canvas.width - 1, y: canvas.height - 1 },
      ];

      let totalR = 0,
        totalG = 0,
        totalB = 0;
      corners.forEach((corner) => {
        const index = (corner.y * canvas.width + corner.x) * 4;
        totalR += data[index];
        totalG += data[index + 1];
        totalB += data[index + 2];
      });

      const backgroundColor = {
        r: Math.round(totalR / corners.length),
        g: Math.round(totalG / corners.length),
        b: Math.round(totalB / corners.length),
      };

      // 简单的颜色相似性去背景
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const distance = colorDistance(r, g, b, backgroundColor);
        if (distance < 40) {
          data[i + 3] = 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const processedDataUrl = canvas.toDataURL("image/png");
      resolve(processedDataUrl);
    };

    img.src = imageDataUrl;
  });
};
