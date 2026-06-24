export default function Header() {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="brand-icon">🔬</span>
          <div>
            <h1 className="brand-name">MalariaDetect</h1>
            <p className="brand-sub">CNN + Grad-CAM Blood Smear Analysis</p>
          </div>
        </div>
        <div className="header-badges">
          <span className="badge-pill">NIH Dataset</span>
          <span className="badge-pill accent">96.8% Accuracy</span>
        </div>
      </div>
    </header>
  );
}
