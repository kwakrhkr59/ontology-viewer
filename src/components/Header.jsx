import { useRef } from 'react'

export default function Header({ ontology, fileName, onFileLoad }) {
  const inputRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => onFileLoad(file.name, ev.target.result)
    reader.readAsText(file)
    e.target.value = ''
  }

  const stats = ontology
    ? [
        { num: Object.keys(ontology.classes).length,             lbl: 'Classes' },
        { num: Object.keys(ontology.objectProperties).length,    lbl: 'Obj' },
        { num: Object.keys(ontology.dataProperties).length,      lbl: 'Data' },
        { num: Object.keys(ontology.annotationProperties).length,lbl: 'Ann' },
      ]
    : null

  return (
    <header className="header">
      <div className="header-logo">
        <span className="header-logo-icon">🔬</span>
        Ontology Viewer
      </div>

      <div className="header-divider" />

      <button className="upload-btn" onClick={() => inputRef.current.click()}>
        Open TTL
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".ttl,.owl,.n3"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      {fileName && <span className="file-name">{fileName}</span>}

      {stats && (
        <div className="stats">
          {stats.map(({ num, lbl }) => (
            <div key={lbl} className="stat-pill">
              <span className="stat-pill-num">{num}</span>
              <span>{lbl}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
