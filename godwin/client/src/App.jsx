import { useState, useRef, useCallback } from "react";
import UploadZone from "./components/UploadZone";
import ResultPanel from "./components/ResultPanel";
import HistoryPanel from "./components/HistoryPanel";
import Header from "./components/Header";
import "./App.css";

export default function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState("analyze");

  const handleImageSelect = useCallback((file) => {
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError(null);
  }, []);

  const handleAnalyze = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", image);

      const res = await fetch("/api/predict", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Analysis failed");
      }

      const data = await res.json();
      setResult(data);

      const entry = {
        id: Date.now(),
        filename: image.name,
        preview,
        result: data,
        timestamp: new Date().toISOString(),
      };
      setHistory((prev) => [entry, ...prev.slice(0, 9)]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImage(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleHistorySelect = (entry) => {
    setPreview(entry.preview);
    setResult(entry.result);
    setActiveTab("analyze");
  };

  return (
    <div className="app">
      <Header />

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === "analyze" ? "active" : ""}`}
          onClick={() => setActiveTab("analyze")}
        >
          <span className="tab-icon">🔬</span> Analyze
        </button>
        <button
          className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <span className="tab-icon">📋</span> History
          {history.length > 0 && (
            <span className="badge">{history.length}</span>
          )}
        </button>
      </nav>

      <main className="main-content">
        {activeTab === "analyze" ? (
          <div className="analyze-layout">
            <div className="left-panel">
              <UploadZone
                onImageSelect={handleImageSelect}
                preview={preview}
                loading={loading}
              />

              <div className="action-row">
                <button
                  className="btn-primary"
                  onClick={handleAnalyze}
                  disabled={!image || loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" /> Analyzing...
                    </>
                  ) : (
                    "Run Analysis"
                  )}
                </button>
                {(image || result) && (
                  <button className="btn-secondary" onClick={handleReset}>
                    Clear
                  </button>
                )}
              </div>

              {error && (
                <div className="error-banner">
                  <span className="error-icon">⚠</span> {error}
                </div>
              )}
            </div>

            <div className="right-panel">
              {result ? (
                <ResultPanel result={result} originalPreview={preview} />
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🩸</div>
                  <p className="empty-title">No result yet</p>
                  <p className="empty-sub">
                    Upload a blood smear image and click Run Analysis
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <HistoryPanel history={history} onSelect={handleHistorySelect} />
        )}
      </main>

      <footer className="footer">
        <p>
          Decision-support tool only. Not a substitute for clinical diagnosis.
        </p>
      </footer>
    </div>
  );
}
