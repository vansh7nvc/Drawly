import React, { useState, useRef, useEffect } from 'react';

const SAMPLE = `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B`;

const MermaidPanel = ({ canvas, onClose }) => {
  const [code, setCode] = useState(SAMPLE);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState('');
  const hiddenRef = useRef(null);

  useEffect(() => {
    // Ensure the hidden container exists in DOM
    if (!document.getElementById('mermaid-hidden-render')) {
      const div = document.createElement('div');
      div.id = 'mermaid-hidden-render';
      div.style.cssText = 'position:fixed;left:-99999px;top:0;opacity:0;pointer-events:none;';
      document.body.appendChild(div);
    }
    hiddenRef.current = document.getElementById('mermaid-hidden-render');
  }, []);

  const handleRender = async () => {
    if (!canvas || !code.trim()) return;
    setIsRendering(true);
    setError('');

    try {
      // Dynamic import to avoid bundling issues
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
      });

      const id = `mermaid-${Date.now()}`;
      hiddenRef.current.innerHTML = '';

      const { svg } = await mermaid.render(id, code.trim());



      // Load SVG onto Fabric canvas
      const fabric = await import('fabric');
      const { objects, options } = await fabric.loadSVGFromString(svg);
      const group = fabric.util.groupSVGElements(objects, options);

      // Scale down large diagrams to fit nicely
      const maxW = Math.min(canvas.width * 0.7, 700);
      if (group.width > maxW) {
        const scale = maxW / group.width;
        group.scale(scale);
      }

      // Center on canvas
      group.set({
        left: (canvas.width - group.getScaledWidth()) / 2,
        top: (canvas.height - group.getScaledHeight()) / 2,
      });

      canvas.add(group);
        canvas.setActiveObject(group);
        canvas.renderAll();
        onClose();
    } catch (err) {
      console.error('Mermaid render error:', err);
      setError(err?.message || 'Invalid Mermaid syntax. Check your code and try again.');
      setIsRendering(false);
      return;
    }

    setIsRendering(false);
  };

  return (
    <div className="mermaid-panel-overlay" onClick={onClose}>
      <div className="mermaid-panel" onClick={e => e.stopPropagation()}>
        <div className="mermaid-panel-header">
          <div className="mermaid-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>Mermaid Diagram</span>
          </div>
          <button className="mermaid-close-btn" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="mermaid-body">
          <div className="mermaid-label">
            Paste your <strong>Mermaid</strong> code below
            <a href="https://mermaid.js.org/syntax/flowchart.html" target="_blank" rel="noreferrer" className="mermaid-docs-link">
              Syntax docs ↗
            </a>
          </div>
          <textarea
            className="mermaid-textarea"
            value={code}
            onChange={e => { setCode(e.target.value); setError(''); }}
            placeholder="flowchart TD&#10;    A --> B"
            spellCheck={false}
          />

          <div className="mermaid-examples">
            <span className="mermaid-examples-label">Quick templates:</span>
            <button className="mermaid-chip" onClick={() => setCode(`flowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Action]\n    B -->|No| D[End]`)}>Flowchart</button>
            <button className="mermaid-chip" onClick={() => setCode(`sequenceDiagram\n    Alice->>Bob: Hello!\n    Bob-->>Alice: Hi there!\n    Alice->>Bob: How are you?`)}>Sequence</button>
            <button className="mermaid-chip" onClick={() => setCode(`erDiagram\n    USER ||--o{ ORDER : places\n    ORDER ||--|{ ITEM : contains`)}>ER Diagram</button>
            <button className="mermaid-chip" onClick={() => setCode(`pie title Project Tasks\n    "Done" : 45\n    "In Progress" : 30\n    "Todo" : 25`)}>Pie Chart</button>
            <button className="mermaid-chip" onClick={() => setCode(`mindmap\n  root((Project))\n    Frontend\n      React\n      CSS\n    Backend\n      Node\n      MongoDB`)}>Mind Map</button>
          </div>

          {error && <div className="mermaid-error">⚠ {error}</div>}
        </div>

        <div className="mermaid-footer">
          <button className="mermaid-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="mermaid-render-btn"
            onClick={handleRender}
            disabled={isRendering || !code.trim()}
          >
            {isRendering ? (
              <><span className="mermaid-spinner" /> Rendering...</>
            ) : (
              <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> Add to Canvas</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MermaidPanel;
