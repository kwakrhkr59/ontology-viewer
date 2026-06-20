import { useState, useCallback, useRef } from 'react'
import { parseTTLText } from './utils/ttlParser'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import DetailPanel from './components/DetailPanel'
import GraphView from './components/GraphView'

export default function App() {
  const [ontology, setOntology]       = useState(null)
  const [fileName, setFileName]       = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [parseError, setParseError]   = useState(null)
  const [toast, setToast]             = useState({ msg: '', visible: false })
  const toastTimer = useRef(null)

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, visible: true })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000)
  }, [])

  const handleFileLoad = useCallback((name, text) => {
    try {
      const parsed = parseTTLText(text)
      setOntology(parsed)
      setFileName(name)
      setSelectedItem(null)
      setParseError(null)
      const classCount = Object.keys(parsed.classes).length
      showToast(`파싱 완료 — 클래스 ${classCount}개`)
    } catch (err) {
      console.error('[OntologyViewer] parse error:', err)
      setParseError(err.message)
      setOntology(null)
    }
  }, [showToast])

  const handleSelectClass = useCallback((uri) => {
    setSelectedItem({ type: 'class', uri })
  }, [])

  const handleSelectProperty = useCallback((uri, type) => {
    setSelectedItem({ type, uri })
  }, [])

  return (
    <>
      <Header
        ontology={ontology}
        fileName={fileName}
        onFileLoad={handleFileLoad}
      />

      {/* 3열 CSS Grid: Sidebar | DetailPanel | GraphView
          각 cell 높이 = 뷰포트 - header(48px) → overflow-y: auto 확실히 동작 */}
      <div className="layout">
        <Sidebar
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          onSelectProperty={handleSelectProperty}
        />
        <DetailPanel
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          onSelectProperty={handleSelectProperty}
          showToast={showToast}
        />
        <GraphView
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          showToast={showToast}
        />
      </div>

      {parseError && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#3a1020', border: '1px solid #8b2040', color: '#ff8fa8',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, zIndex: 9999,
          maxWidth: '80vw', wordBreak: 'break-all',
        }}>
          ⚠️ {parseError}
        </div>
      )}

      <div className={`toast${toast.visible ? ' visible' : ''}`}>{toast.msg}</div>
    </>
  )
}
