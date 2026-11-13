import TerpMark from "../components/TerpMark.jsx";

export default function Splash({ leaving }) {
  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} role="status" aria-label="Loading TerpLink">
      <div className="splash-ring" aria-hidden="true" />
      <div className="splash-center">
        <TerpMark className="splash-mark" />
        <div className="splash-word">
          TERP<span>LINK</span>
        </div>
        <p>Campus life, all in one place.</p>
      </div>
      <div className="splash-bottom">
        <div className="splash-loader" aria-hidden="true">
          <i />
        </div>
        <p>UNIVERSITY OF MARYLAND</p>
      </div>
    </div>
  );
}

