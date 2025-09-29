import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion as Motion } from "framer-motion";
import {
  Upload,
  Download,
  Scissors,
  ImageIcon,
  Loader2,
  X,
  Settings,
  Zap,
  Brain,
} from "lucide-react";
import { removeBackground } from "./utils/backgroundRemovalImproved";
import {
  removeBackgroundAI,
  initializeModel,
} from "./utils/aiBackgroundRemoval";
import {
  removeBackgroundUniversal,
  initializeUniversalModel,
} from "./utils/universalAiRemoval";
import {
  autoRemoveBackground,
  grabCutRemoval,
  magicWandRemoval,
  colorRangeRemoval,
} from "./utils/reliableBackgroundRemoval";
import "./App.css";

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [algorithm, setAlgorithm] = useState("auto"); // 恢复为默认的auto模式
  const [_modelLoaded, setModelLoaded] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // 在组件加载时初始化AI模型
  useEffect(() => {
    const loadModel = async () => {
      try {
        setProcessingStep("正在加载AI模型...");
        await initializeModel();
        setModelLoaded(true);
        setProcessingStep("");
      } catch (err) {
        console.error("模型加载失败:", err);
        setError("AI模型加载失败，将使用基础算法");
        setAlgorithm("basic");
        setProcessingStep("");
      }
    };

    if (algorithm === "ai" || algorithm === "enhanced-ai") {
      loadModel();
    }
  }, [algorithm]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (file) => {
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target.result);
        setProcessedImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const processImage = async () => {
    if (!selectedImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      let processedImageUrl;

      if (algorithm === "auto") {
        setProcessingStep("智能分析图片特征自动选择算法...");
        processedImageUrl = await autoRemoveBackground(selectedImage);
      } else if (algorithm === "grabcut") {
        setProcessingStep("使用GrabCut算法处理...");
        processedImageUrl = await grabCutRemoval(selectedImage);
      } else if (algorithm === "magic") {
        setProcessingStep("使用魔术棒算法处理...");
        processedImageUrl = await magicWandRemoval(selectedImage, 30);
      } else if (algorithm === "color") {
        setProcessingStep("使用颜色范围算法处理...");
        processedImageUrl = await colorRangeRemoval(selectedImage);
      } else if (algorithm === "universal") {
        setProcessingStep("使用通用AI模型处理动物/物体...");
        await initializeUniversalModel();
        processedImageUrl = await removeBackgroundUniversal(selectedImage, {
          sensitivity: 0.8,
          edgeSmooth: 3,
          noiseReduction: 2,
          contrastBoost: 1.2,
        });
      } else if (algorithm === "enhanced-ai") {
        setProcessingStep("使用优化AI模型处理...");
        processedImageUrl = await removeBackgroundAI(selectedImage, {
          threshold: 0.65, // 适中的阈值
          edgeBlur: 2, // 保持适度的边缘模糊
          foregroundThreshold: 0.55, // 适中的前景阈值
          enableEnhancement: true, // 启用简化增强
          qualityMode: "balanced",
        });
      } else if (algorithm === "ai") {
        setProcessingStep("使用基础AI模型分析图片...");
        processedImageUrl = await removeBackgroundAI(selectedImage, {
          threshold: 0.25, // 更激进的阈值，类似Mac效果
          edgeBlur: 2, // 适度边缘平滑
          foregroundThreshold: 0.08, // 非常低的前景阈值，彻底去除背景
          enableEnhancement: true, // 启用高级增强
          qualityMode: "mac_like", // Mac风格模式
          aggressiveMode: true, // 激进模式
        });
      } else {
        setProcessingStep("使用基础算法处理...");
        processedImageUrl = await removeBackground(selectedImage);
      }

      setProcessedImage(processedImageUrl);
      setProcessingStep("处理完成!");
    } catch (error) {
      console.error("背景去除失败:", error);
      setError(`处理失败: ${error.message || "未知错误"}`);

      // 如果AI失败，尝试使用基础算法
      if (algorithm === "ai") {
        try {
          setProcessingStep("尝试使用基础算法...");
          const fallbackResult = await removeBackground(selectedImage);
          setProcessedImage(fallbackResult);
          setError("AI处理失败，已使用基础算法");
        } catch {
          setProcessedImage(selectedImage);
          setError("处理失败，显示原图");
        }
      } else {
        setProcessedImage(selectedImage);
      }
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProcessingStep("");
        setError(null);
      }, 3000);
    }
  };

  const downloadImage = () => {
    if (processedImage) {
      const link = document.createElement("a");
      link.download = "removed-background.png";
      link.href = processedImage;
      link.click();
    }
  };

  const resetAll = () => {
    setSelectedImage(null);
    setProcessedImage(null);
    setIsProcessing(false);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Scissors className="logo-icon" />
            <h1>背景去除器</h1>
          </div>
          <p className="subtitle">轻松去除图片背景，制作专业透明图片</p>

          <div className="algorithm-selector">
            <label>选择背景去除算法：</label>
            <div className="algorithm-buttons">
              <button
                className={`algorithm-btn ${
                  algorithm === "ai" ? "active" : ""
                }`}
                onClick={() => setAlgorithm("ai")}
                disabled={isProcessing}
                title="原版AI模型处理人像"
              >
                <Brain size={16} />
                AI人像
              </button>
              <button
                className={`algorithm-btn ${
                  algorithm === "enhanced-ai" ? "active" : ""
                }`}
                onClick={() => setAlgorithm("enhanced-ai")}
                disabled={isProcessing}
                title="专为人像优化的增强AI算法（实验版）"
              >
                <Settings size={16} />
                增强AI
              </button>
              <button
                className={`algorithm-btn ${
                  algorithm === "auto" ? "active" : ""
                }`}
                onClick={() => setAlgorithm("auto")}
                disabled={isProcessing}
                title="自动分析图片特征选择最佳算法"
              >
                <Settings size={16} />
                智能自动
              </button>
              <button
                className={`algorithm-btn ${
                  algorithm === "grabcut" ? "active" : ""
                }`}
                onClick={() => setAlgorithm("grabcut")}
                disabled={isProcessing}
                title="适用于复杂背景的精准切割"
              >
                <Scissors size={16} />
                精准切割
              </button>
              <button
                className={`algorithm-btn ${
                  algorithm === "magic" ? "active" : ""
                }`}
                onClick={() => setAlgorithm("magic")}
                disabled={isProcessing}
                title="适用于单色或相似颜色背景"
              >
                <Zap size={16} />
                魔术棒
              </button>
              <button
                className={`algorithm-btn ${
                  algorithm === "color" ? "active" : ""
                }`}
                onClick={() => setAlgorithm("color")}
                disabled={isProcessing}
                title="适用于与主体对比明显的背景"
              >
                <ImageIcon size={16} />
                颜色范围
              </button>
            </div>

            {/* 算法说明 */}
            <div className="algorithm-description">
              {algorithm === "ai" && (
                <p>🤖 AI人像：使用经典AI模型处理人像背景去除</p>
              )}
              {algorithm === "enhanced-ai" && (
                <p>⚙️ 增强AI：实验性增强算法，可能有更好效果但不稳定</p>
              )}
              {algorithm === "auto" && (
                <p>🤖 推荐选项：自动分析图片特征并选择最适合的算法</p>
              )}
              {algorithm === "grabcut" && (
                <p>✂️ 精准模式：适用于复杂背景，如景物、人物等</p>
              )}
              {algorithm === "magic" && (
                <p>⚡ 魔术棒：适用于纯色或相似颜色背景，如白幕、绿幕等</p>
              )}
              {algorithm === "color" && (
                <p>🎨 颜色范围：适用于与主体颜色对比强烈的图片</p>
              )}
            </div>
          </div>

          {/* 状态提示 */}
          {processingStep && (
            <div className="status-message info">
              <Loader2 size={16} className="spinning" />
              {processingStep}
            </div>
          )}

          {error && (
            <div className="status-message error">
              <X size={16} />
              {error}
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="container">
          {!selectedImage ? (
            <Motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`upload-area ${dragActive ? "drag-active" : ""}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-content">
                <div className="upload-icon">
                  <Upload size={48} />
                </div>
                <h3>拖拽图片到这里或点击上传</h3>
                <p>支持 JPG、PNG、WebP 格式</p>
                <button className="upload-button">
                  <ImageIcon size={20} />
                  选择图片
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: "none" }}
              />
            </Motion.div>
          ) : (
            <div className="image-processing">
              <div className="images-container">
                <div className="image-section">
                  <h3>原图</h3>
                  <div className="image-wrapper">
                    <img
                      src={selectedImage}
                      alt="原图"
                      className="preview-image"
                    />
                  </div>
                </div>

                <div className="arrow-section">
                  {isProcessing ? (
                    <Motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="processing-icon"
                    >
                      <Loader2 size={32} />
                    </Motion.div>
                  ) : (
                    <div className="arrow">→</div>
                  )}
                </div>

                <div className="image-section">
                  <h3>处理后</h3>
                  <div className="image-wrapper">
                    {processedImage ? (
                      <img
                        src={processedImage}
                        alt="处理后"
                        className="preview-image"
                      />
                    ) : (
                      <div className="placeholder">
                        <ImageIcon size={48} color="#ccc" />
                        <p>等待处理</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="controls">
                {!processedImage && !isProcessing && (
                  <Motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="process-button"
                    onClick={processImage}
                  >
                    <Scissors size={20} />
                    去除背景
                  </Motion.button>
                )}

                {processedImage && (
                  <Motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="download-button"
                    onClick={downloadImage}
                  >
                    <Download size={20} />
                    下载图片
                  </Motion.button>
                )}

                <button className="reset-button" onClick={resetAll}>
                  <X size={20} />
                  重新开始
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>© 2024 背景去除器 - 简单快捷的图片处理工具</p>
      </footer>
    </div>
  );
}

export default App;
