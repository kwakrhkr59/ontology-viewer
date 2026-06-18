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
        { num: Object.keys(ontology.objectProperties).length,    lbl: 'Obj Props' },
        { num: Object.keys(ontology.dataProperties).length,      lbl: 'Data Props' },
        { num: Object.keys(ontology.annotationProperties).length,lbl: 'Ann Props' },
      ]
    : null

  return (
    <header className="header">
      <span className="header-title">🔷 Ontology Viewer</span>

      <button className="upload-btn" onClick={() => inputRef.current.click()}>
        TTL 파일 열기
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".ttl,.owl,.n3"
        style={{ display: 'none' }}
        onChange={handleFile}
      />

      <span className="file-name">{fileName || '파일을 업로드하세요'}</span>

      {stats && (
        <div className="stats">
          {stats.map(({ num, lbl }) => (
            <div key={lbl} className="stat">
              <div className="stat-num">{num}</div>
              <div className="stat-lbl">{lbl}</div>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
