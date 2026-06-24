export default function HistoryPanel({ history, onSelect }) {
  if (history.length === 0) {
    return (
      <div className="history-empty">
        <div className="empty-icon">📋</div>
        <p className="empty-title">No history yet</p>
        <p className="empty-sub">
          Analysed images will appear here during this session.
        </p>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <h2 className="history-title">Session history</h2>
      <div className="history-list">
        {history.map((entry) => {
          const isParasitized = entry.result.label === "Parasitized";
          const confidence = (entry.result.confidence * 100).toFixed(1);
          const time = new Date(entry.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <button
              key={entry.id}
              className="history-item"
              onClick={() => onSelect(entry)}
            >
              <img
                src={entry.preview}
                alt={entry.filename}
                className="history-thumb"
              />
              <div className="history-info">
                <span className="history-filename">{entry.filename}</span>
                <span
                  className={`history-label ${
                    isParasitized ? "label-positive" : "label-negative"
                  }`}
                >
                  {isParasitized ? "⚠ Parasitized" : "✓ Uninfected"}
                </span>
                <span className="history-conf">{confidence}% confidence</span>
              </div>
              <span className="history-time">{time}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
