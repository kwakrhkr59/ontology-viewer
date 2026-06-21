import { useState, useCallback, useRef } from 'react'
import { parseTTLText } from './utils/ttlParser'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import DetailPanel from './components/DetailPanel'
import GraphView from './components/GraphView'

export default function App() {
  const [ontology, setOntology]         = useState(null)
  const [fileName, setFileName]         = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [parseError, setParseError]     = useState(null)
  const [toast, setToast]               = useState({ msg: '', visible: false })
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [detailOpen, setDetailOpen]     = useState(true)
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

  const layoutClass = [
    'layout',
    !sidebarOpen && 'sidebar-collapsed',
    !detailOpen  && 'detail-collapsed',
  ].filter(Boolean).join(' ')

  return (
    <>
      <Header
        ontology={ontology}
        fileName={fileName}
        onFileLoad={handleFileLoad}
      />

      <div className={layoutClass}>
        <Sidebar
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          onSelectProperty={handleSelectProperty}
        />

        <div className="panel-sep panel-sep--sidebar">
          <button
            className="panel-toggle-btn"
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? '목록 패널 접기' : '목록 패널 펼치기'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        <DetailPanel
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          onSelectProperty={handleSelectProperty}
          showToast={showToast}
        />

        <div className="panel-sep panel-sep--detail">
          <button
            className="panel-toggle-btn"
            onClick={() => setDetailOpen(v => !v)}
            title={detailOpen ? '상세 패널 접기' : '상세 패널 펼치기'}
          >
            {detailOpen ? '‹' : '›'}
          </button>
        </div>

        <GraphView
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          showToast={showToast}
        />
      </div>

      {parseError && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626',
          padding: '10px 20px', borderRadius: 12, fontSize: 13, zIndex: 9999,
          maxWidth: '80vw', wordBreak: 'break-all',
          boxShadow: '0 4px 20px rgba(220, 38, 38, 0.15)',
          fontWeight: 500,
        }}>
          ⚠️ {parseError}
        </div>
      )}

      <div className={`toast${toast.visible ? ' visible' : ''}`}>{toast.msg}</div>
    </>
  )
}
