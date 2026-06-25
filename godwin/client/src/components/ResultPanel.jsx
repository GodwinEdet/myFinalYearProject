import { useState } from "react";

const METRIC_LABELS = {
  accuracy: "Accuracy",
  precision: "Precision",
  recall: "Recall",
  f1_score: "F1 Score",
  specificity: "Specificity",
};

export default function ResultPanel({ result, originalPreview }) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const isParasitized = result.label === "Parasitized";
  const confidence = (result.confidence * 100).toFixed(1);

  return (
    <div className="result-panel">
      {/* Verdict */}
      <div className={`verdict-card ${isParasitized ? "positive" : "negative"}`}>
        <div className="verdict-icon">{isParasitized ? "⚠" : "✓"}</div>
        <div className="verdict-text">
          <span className="verdict-label">
            {isParasitized ? "Parasitized" : "Uninfected"}
          </span>
          <span className="verdict-sub">
            {isParasitized
              ? "Malaria parasite detected"
              : "No parasite detected"}
          </span>
        </div>
        <div className="confidence-ring">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <circle
              cx="32" cy="32" r="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${(result.confidence * 163.4).toFixed(1)} 163.4`}
              strokeDashoffset="40.85"
              strokeLinecap="round"
            />
          </svg>
          <span className="conf-pct">{confidence}%</span>
        </div>
      </div>

      {/* Image comparison */}
      {result.heatmap && (
        <div className="image-compare">
          <div className="compare-header">
            <span className="section-label">Grad-CAM Visualization</span>
            <div className="toggle-group">
              <button
                className={`toggle-btn ${!showHeatmap ? "active" : ""}`}
                onClick={() => setShowHeatmap(false)}
              >
                Original
              </button>
              <button
                className={`toggle-btn ${showHeatmap ? "active" : ""}`}
                onClick={() => setShowHeatmap(true)}
              >
                Heatmap
              </button>
            </div>
          </div>

          <div className="compare-display">
            <img
              src={originalPreview}
              alt="Original blood smear"
              className={`compare-img ${!showHeatmap ? "visible" : "hidden"}`}
            />
            <img
              src={`data:image/png;base64,${result.heatmap}`}
              alt="Grad-CAM heatmap"
              className={`compare-img ${showHeatmap ? "visible" : "hidden"}`}
            />
            <div className="heatmap-legend">
              <span className="legend-label">Low</span>
              <div className="legend-bar" />
              <span className="legend-label">High activation</span>
            </div>
          </div>

          <p className="gradcam-note">
            Highlighted regions show where the model detected parasite-related features.
          </p>
        </div>
      )}

      {/* Metrics table */}
      {result.metrics && (
        <div className="metrics-section">
          <span className="section-label">Model performance metrics</span>
          <div className="metrics-grid">
            {Object.entries(result.metrics).map(([key, val]) => (
              <div key={key} className="metric-item">
                <span className="metric-name">{METRIC_LABELS[key] || key}</span>
                <div className="metric-bar-wrap">
                  <div
                    className="metric-bar"
                    style={{ width: `${(val * 100).toFixed(0)}%` }}
                  />
                </div>
                <span className="metric-val">{(val * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

  );
}
