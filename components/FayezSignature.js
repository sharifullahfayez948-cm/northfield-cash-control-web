export default function FayezSignature({compact=false}) {
  return (
    <div className={`fayezSignature ${compact?"compact":""}`} aria-label="Crafted by Fayez">
      <span className="fayezMark" aria-hidden="true">F</span>
      <span className="fayezWords">
        <small>CRAFTED BY</small>
        <strong>FAYEZ</strong>
      </span>
    </div>
  );
}
