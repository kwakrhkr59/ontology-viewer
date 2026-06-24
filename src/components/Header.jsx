import { useRef } from 'react'

function GraphIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="4"   r="2.5" fill="white" />
      <circle cx="3.5" cy="16" r="2.5" fill="white" opacity="0.8" />
      <circle cx="16.5" cy="16" r="2.5" fill="white" opacity="0.8" />
      <circle cx="10"  cy="11" r="2"   fill="white" opacity="0.55" />
      <line x1="10" y1="6.5"  x2="10"  y2="9"    stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8.5" y1="12.5" x2="5.5" y2="14.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="11.5" y1="12.5" x2="14.5" y2="14.2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const KNOWN_LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ko', label: 'KO' },
]

export default function Header({ ontology, fileName, onFileLoad, lang, onLangChange, availableLangs, onExport }) {
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
        { num: Object.keys(ontology.classes).length,              lbl: 'Classes' },
        { num: Object.keys(ontology.objectProperties).length,     lbl: 'Obj Props' },
        { num: Object.keys(ontology.dataProperties).length,       lbl: 'Data Props' },
        { num: Object.keys(ontology.annotationProperties).length, lbl: 'Ann Props' },
      ]
    : null

  return (
    <header className="header">
      <div className="header-logo">
        <span className="header-logo-icon"><GraphIcon /></span>
        <span className="header-logo-text">
          Ontology<strong>Viewer</strong>
        </span>
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

      {availableLangs && availableLangs.size > 1 && (
        <div className="lang-toggle" title="언어 전환">
          {KNOWN_LANGS.filter(l => availableLangs.has(l.code)).map(l => (
            <button
              key={l.code}
              className={`lang-btn${lang === l.code ? ' lang-btn--active' : ''}`}
              onClick={() => onLangChange(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {ontology && (
        <button className="export-btn" onClick={onExport} title="편집된 온톨로지를 TTL로 내보내기">
          Export TTL
        </button>
      )}

      {stats && (
        <div className="stats">
          {stats.map(({ num, lbl }) => (
            <div key={lbl} className="stat-pill">
              <span className="stat-pill-num">{num}</span>
              <span className="stat-pill-lbl">{lbl}</span>
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
