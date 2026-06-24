import { useCallback, useRef, useState } from "react";

export default function UploadZone({ onImageSelect, preview, loading }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      const valid = ["image/jpeg", "image/png", "image/tiff", "image/bmp"];
      if (!valid.includes(file.type)) {
        alert("Please upload a JPEG, PNG, TIFF, or BMP image.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("File must be under 10MB.");
        return;
      }
      onImageSelect(file);
    },
    [onImageSelect]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  const onDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const onDragLeave = () => setDragging(false);

  return (
    <div className="upload-section">
      <label className="section-label">Blood smear image</label>
      <div
        className={`upload-zone ${dragging ? "dragging" : ""} ${preview ? "has-image" : ""} ${loading ? "loading" : ""}`}
        onClick={() => !preview && inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/tiff,image/bmp"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {preview ? (
          <div className="preview-wrapper">
            <img src={preview} alt="Blood smear preview" className="preview-img" />
            {loading && (
              <div className="preview-overlay">
                <div className="scan-line" />
                <span className="overlay-text">Analyzing cells...</span>
              </div>
            )}
            {!loading && (
              <button
                className="change-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Change image
              </button>
            )}
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
                <path d="M20 13v14M13 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <p className="upload-title">
              {dragging ? "Drop image here" : "Upload blood smear"}
            </p>
            <p className="upload-hint">
              Drag & drop or click · JPEG, PNG, TIFF · max 10MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
