import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { parseTTLText, getAvailableLangs } from './utils/ttlParser'
import { serializeToTTL } from './utils/ttlSerializer'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import DetailPanel from './components/DetailPanel'
import GraphView from './components/GraphView'
import EditModal from './components/EditModal'

const ACCEPTED_EXTS = ['ttl', 'owl', 'n3']

function cloneOntology(ont) {
  return JSON.parse(JSON.stringify(ont))
}

export default function App() {
  const [ontology, setOntology]         = useState(null)
  const [fileName, setFileName]         = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [parseError, setParseError]     = useState(null)
  const [lang, setLang]                 = useState('en')
  const [toast, setToast]               = useState({ msg: '', visible: false })
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [detailOpen, setDetailOpen]     = useState(true)
  const [isDragging, setIsDragging]     = useState(false)
  const [editModal, setEditModal]       = useState(null) // 'class' | 'objectProperty' | 'dataProperty' | null
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [detailWidth, setDetailWidth]   = useState(340)
  const [isResizing, setIsResizing]     = useState(false)
  const sidebarWidthRef = useRef(260)
  const detailWidthRef  = useRef(340)
  const toastTimer   = useRef(null)
  const dragCounter  = useRef(0)

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current)
    setToast({ msg, visible: true })
    toastTimer.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2000)
  }, [])

  useEffect(() => { sidebarWidthRef.current = sidebarWidth }, [sidebarWidth])
  useEffect(() => { detailWidthRef.current  = detailWidth  }, [detailWidth])

  const startResize = useCallback((which, e) => {
    e.preventDefault()
    const startX   = e.clientX
    const startW   = which === 'sidebar' ? sidebarWidthRef.current : detailWidthRef.current
    const [MIN, MAX] = which === 'sidebar' ? [180, 520] : [220, 600]
    const DEFAULT_W  = which === 'sidebar' ? 260 : 340
    setIsResizing(true)
    let lastW = startW
    const onMove = ev => {
      const w = Math.max(MIN, Math.min(MAX, startW + ev.clientX - startX))
      lastW = w
      which === 'sidebar' ? setSidebarWidth(w) : setDetailWidth(w)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setIsResizing(false)
      if (lastW <= MIN) {
        if (which === 'sidebar') { setSidebarOpen(false); setSidebarWidth(DEFAULT_W) }
        else                     { setDetailOpen(false);  setDetailWidth(DEFAULT_W)  }
      }
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const handleFileLoad = useCallback((name, text) => {
    try {
      const parsed = parseTTLText(text)
      setOntology(parsed)
      setFileName(name)
      setSelectedItem(null)
      setParseError(null)
      // Auto-select language: prefer 'en', then first available, then keep current
      const langs = getAvailableLangs(parsed)
      setLang(langs.has('en') ? 'en' : langs.has('ko') ? 'ko' : [...langs][0] || 'en')
      showToast(`파싱 완료 — 클래스 ${Object.keys(parsed.classes).length}개`)
    } catch (err) {
      console.error('[OntologyViewer] parse error:', err)
      setParseError(err.message)
      setOntology(null)
    }
  }, [showToast])

  const loadFile = useCallback((file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!ACCEPTED_EXTS.includes(ext)) {
      showToast('TTL / OWL / N3 파일만 지원합니다')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => handleFileLoad(file.name, ev.target.result)
    reader.readAsText(file)
  }, [handleFileLoad, showToast])

  // ── Drag & Drop ───────────────────────────────────────────
  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver  = useCallback((e) => { e.preventDefault() }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    loadFile(e.dataTransfer.files[0])
  }, [loadFile])

  // ── Selection ─────────────────────────────────────────────
  const handleSelectClass    = useCallback((uri) => setSelectedItem({ type: 'class', uri }), [])
  const handleSelectProperty = useCallback((uri, type) => setSelectedItem({ type, uri }), [])

  // ── Mutations ─────────────────────────────────────────────
  const addClass = useCallback((data) => {
    setOntology(prev => {
      const next = cloneOntology(prev)
      next.classes[data.uri] = {
        uri: data.uri,
        labels: data.labels,
        comments: data.comments,
        superClasses: data.superClasses,
        subClasses: [],
        outObjProps: [],
        inObjProps: [],
        dataProps: [],
      }
      data.superClasses.forEach(supUri => {
        if (next.classes[supUri]) next.classes[supUri].subClasses.push(data.uri)
      })
      return next
    })
    setEditModal(null)
    showToast('클래스 추가됨')
  }, [showToast])

  const addObjectProperty = useCallback((data) => {
    setOntology(prev => {
      const next = cloneOntology(prev)
      next.objectProperties[data.uri] = {
        uri: data.uri,
        labels: data.labels,
        comments: data.comments,
        domains: data.domains,
        ranges: data.ranges,
        inverseOf: data.inverseOf,
        characteristics: data.characteristics,
      }
      data.domains.forEach(d => { if (next.classes[d]) next.classes[d].outObjProps.push(data.uri) })
      data.ranges.forEach(r  => { if (next.classes[r]) next.classes[r].inObjProps.push(data.uri) })
      return next
    })
    setEditModal(null)
    showToast('Object Property 추가됨')
  }, [showToast])

  const addDataProperty = useCallback((data) => {
    setOntology(prev => {
      const next = cloneOntology(prev)
      next.dataProperties[data.uri] = {
        uri: data.uri,
        labels: data.labels,
        comments: data.comments,
        domains: data.domains,
        ranges: data.ranges,
      }
      data.domains.forEach(d => { if (next.classes[d]) next.classes[d].dataProps.push(data.uri) })
      return next
    })
    setEditModal(null)
    showToast('Data Property 추가됨')
  }, [showToast])

  const deleteItem = useCallback((uri, type) => {
    setOntology(prev => {
      const next = cloneOntology(prev)

      if (type === 'class') {
        // Clean up class hierarchy
        Object.values(next.classes).forEach(cls => {
          cls.superClasses = cls.superClasses.filter(u => u !== uri)
          cls.subClasses   = cls.subClasses.filter(u => u !== uri)
        })
        // Clean up property domains/ranges
        Object.values(next.objectProperties).forEach(p => {
          p.domains = p.domains.filter(u => u !== uri)
          p.ranges  = p.ranges.filter(u => u !== uri)
        })
        Object.values(next.dataProperties).forEach(p => {
          p.domains = p.domains.filter(u => u !== uri)
        })
        delete next.classes[uri]

      } else if (type === 'objectProperty') {
        const prop = next.objectProperties[uri]
        if (prop) {
          prop.domains.forEach(d => {
            if (next.classes[d]) next.classes[d].outObjProps = next.classes[d].outObjProps.filter(u => u !== uri)
          })
          prop.ranges.forEach(r => {
            if (next.classes[r]) next.classes[r].inObjProps = next.classes[r].inObjProps.filter(u => u !== uri)
          })
        }
        delete next.objectProperties[uri]

      } else if (type === 'dataProperty') {
        const prop = next.dataProperties[uri]
        if (prop) {
          prop.domains.forEach(d => {
            if (next.classes[d]) next.classes[d].dataProps = next.classes[d].dataProps.filter(u => u !== uri)
          })
        }
        delete next.dataProperties[uri]
      }

      return next
    })
    setSelectedItem(null)
    showToast('삭제됨')
  }, [showToast])

  const handleAdd = useCallback((type) => {
    setEditModal(type)
  }, [])

  const handleModalSubmit = useCallback((data) => {
    if (editModal === 'class')          addClass(data)
    else if (editModal === 'objectProperty') addObjectProperty(data)
    else if (editModal === 'dataProperty')   addDataProperty(data)
  }, [editModal, addClass, addObjectProperty, addDataProperty])

  // ── Export ────────────────────────────────────────────────
  const exportTTL = useCallback(() => {
    if (!ontology) return
    const text = serializeToTTL(ontology)
    const blob = new Blob([text], { type: 'text/turtle;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = fileName
      ? fileName.replace(/\.(ttl|owl|n3)$/i, '_edited.ttl')
      : 'ontology_edited.ttl'
    a.click()
    URL.revokeObjectURL(url)
    showToast('TTL 내보내기 완료')
  }, [ontology, fileName, showToast])

  const availableLangs = useMemo(
    () => ontology ? getAvailableLangs(ontology) : new Set(),
    [ontology]
  )

  const layoutClassName = [
    'layout',
    !sidebarOpen && 'sidebar-collapsed',
    !detailOpen  && 'detail-collapsed',
    isResizing   && 'layout--resizing',
  ].filter(Boolean).join(' ')

  const layoutStyle = useMemo(() => ({
    gridTemplateColumns: [
      sidebarOpen ? `${sidebarWidth}px` : '0px',
      '5px',
      detailOpen ? `${detailWidth}px` : '0px',
      '5px',
      '1fr',
    ].join(' '),
    transition: isResizing
      ? 'none'
      : 'grid-template-columns 0.26s cubic-bezier(0.4,0,0.2,1)',
  }), [sidebarOpen, sidebarWidth, detailOpen, detailWidth, isResizing])

  return (
    <div
      className="app-root"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Header
        ontology={ontology}
        fileName={fileName}
        onFileLoad={handleFileLoad}
        lang={lang}
        onLangChange={setLang}
        availableLangs={availableLangs}
        onExport={exportTTL}
      />

      <div className={layoutClassName} style={layoutStyle}>
        <Sidebar
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          onSelectProperty={handleSelectProperty}
          lang={lang}
          onAdd={handleAdd}
        />

        <div
          className="panel-sep panel-sep--sidebar"
          onMouseDown={sidebarOpen ? e => startResize('sidebar', e) : undefined}
        >
          <button
            className="panel-toggle-btn"
            onClick={() => setSidebarOpen(v => !v)}
            onMouseDown={e => e.stopPropagation()}
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
          lang={lang}
          onDelete={deleteItem}
        />

        <div
          className="panel-sep panel-sep--detail"
          onMouseDown={detailOpen ? e => startResize('detail', e) : undefined}
        >
          <button
            className="panel-toggle-btn"
            onClick={() => setDetailOpen(v => !v)}
            onMouseDown={e => e.stopPropagation()}
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
          lang={lang}
        />
      </div>

      {editModal && ontology && (
        <EditModal
          type={editModal}
          ontology={ontology}
          lang={lang}
          onSubmit={handleModalSubmit}
          onClose={() => setEditModal(null)}
        />
      )}

      {isDragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-inner">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <path d="M24 8v24M14 22l10-14 10 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 36h32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".5"/>
              <path d="M8 42h32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".25"/>
            </svg>
            <p>파일을 놓아주세요</p>
            <span>.ttl · .owl · .n3</span>
          </div>
        </div>
      )}

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
    </div>
  )
}
