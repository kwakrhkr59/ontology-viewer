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
      showToast('온톨로지 파싱 완료!')
    } catch (err) {
      setParseError(err.message)
      showToast('파싱 오류: ' + err.message)
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

      <div className="layout">
        <Sidebar
          ontology={ontology}
          selectedItem={selectedItem}
          onSelectClass={handleSelectClass}
          onSelectProperty={handleSelectProperty}
        />

        <div className="main">
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
      </div>

      <div className={`toast${toast.visible ? ' visible' : ''}`}>{toast.msg}</div>
    </>
  )
}
