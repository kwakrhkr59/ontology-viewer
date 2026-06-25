import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { getDisplayName } from '../utils/ttlParser'

const XSD_TYPES = [
  { uri: 'http://www.w3.org/2001/XMLSchema#string',   label: 'xsd:string' },
  { uri: 'http://www.w3.org/2001/XMLSchema#integer',  label: 'xsd:integer' },
  { uri: 'http://www.w3.org/2001/XMLSchema#decimal',  label: 'xsd:decimal' },
  { uri: 'http://www.w3.org/2001/XMLSchema#float',    label: 'xsd:float' },
  { uri: 'http://www.w3.org/2001/XMLSchema#double',   label: 'xsd:double' },
  { uri: 'http://www.w3.org/2001/XMLSchema#boolean',  label: 'xsd:boolean' },
  { uri: 'http://www.w3.org/2001/XMLSchema#dateTime', label: 'xsd:dateTime' },
  { uri: 'http://www.w3.org/2001/XMLSchema#date',     label: 'xsd:date' },
  { uri: 'http://www.w3.org/2001/XMLSchema#time',     label: 'xsd:time' },
  { uri: 'http://www.w3.org/2001/XMLSchema#anyURI',   label: 'xsd:anyURI' },
]

const CHARACTERISTICS = [
  'Functional', 'InverseFunctional', 'Transitive',
  'Symmetric', 'Asymmetric', 'Reflexive', 'Irreflexive',
]

const STD_PREFIXES = new Set(['rdf', 'rdfs', 'owl', 'xsd'])

function useFixedDropdown(containerRef) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const update = useCallback(() => {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: r.width })
  }, [containerRef])
  return { pos, update }
}

function ChipSelect({ items, value, onChange, placeholder }) {
  const containerRef = useRef(null)
  const { pos, update } = useFixedDropdown(containerRef)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = items.filter(item =>
    !value.includes(item.uri) &&
    item.label.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 12)

  const openDrop = () => { update(); setOpen(true) }

  return (
    <div className="chip-select" ref={containerRef}>
      <div className="chip-select-input" onClick={openDrop}>
        {value.map(uri => {
          const item = items.find(i => i.uri === uri)
          return (
            <span key={uri} className="chip chip-sel">
              {item ? item.label : uri}
              <button
                type="button"
                className="chip-sel-remove"
                onMouseDown={e => { e.preventDefault(); onChange(value.filter(u => u !== uri)) }}
              >×</button>
            </span>
          )
        })}
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); openDrop() }}
          onFocus={openDrop}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="chip-select-text"
        />
      </div>
      {open && filtered.length > 0 && (
        <div
          className="chip-select-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 2000 }}
        >
          {filtered.map(item => (
            <div
              key={item.uri}
              className="chip-select-option"
              onMouseDown={e => { e.preventDefault(); onChange([...value, item.uri]); setSearch('') }}
              title={item.uri}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SingleSelect({ items, value, onChange, placeholder }) {
  const containerRef = useRef(null)
  const { pos, update } = useFixedDropdown(containerRef)
  const selected = items.find(i => i.uri === value)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = items.filter(item =>
    item.label.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 12)

  const openDrop = () => { update(); setOpen(true) }

  return (
    <div className="chip-select" ref={containerRef}>
      <div className="chip-select-input" onClick={() => !selected && openDrop()}>
        {selected ? (
          <span className="chip chip-sel">
            {selected.label}
            <button
              type="button"
              className="chip-sel-remove"
              onMouseDown={e => { e.preventDefault(); onChange('') }}
            >×</button>
          </span>
        ) : (
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); openDrop() }}
            onFocus={openDrop}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="chip-select-text"
          />
        )}
      </div>
      {open && !selected && filtered.length > 0 && (
        <div
          className="chip-select-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 2000 }}
        >
          {filtered.map(item => (
            <div
              key={item.uri}
              className="chip-select-option"
              onMouseDown={e => { e.preventDefault(); onChange(item.uri); setSearch(''); setOpen(false) }}
              title={item.uri}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function EditModal({ mode = 'add', type, uri, ontology, lang, onSubmit, onClose }) {
  const isEdit = mode === 'edit'

  const customPrefixes = Object.entries(ontology.prefixes)
    .filter(([p]) => !STD_PREFIXES.has(p))

  const initialItem = isEdit
    ? (type === 'class'            ? ontology.classes[uri]
       : type === 'objectProperty' ? ontology.objectProperties[uri]
       : ontology.dataProperties[uri])
    : null

  const getLabel   = (l) => initialItem?.labels?.find(x => x.lang === l)?.value ?? ''
  const getComment = (l) => initialItem?.comments?.find(x => x.lang === l)?.value ?? ''

  const [prefix, setPrefix]         = useState(customPrefixes[0]?.[0] ?? '')
  const [localName, setLocalName]   = useState('')
  const [labelEn, setLabelEn]       = useState(getLabel('en'))
  const [labelKo, setLabelKo]       = useState(getLabel('ko'))
  const [commentEn, setCommentEn]   = useState(getComment('en'))
  const [commentKo, setCommentKo]   = useState(getComment('ko'))
  const [superClasses, setSuperClasses] = useState(
    type === 'class' ? (initialItem?.superClasses ?? []) : []
  )
  const [domains, setDomains] = useState(
    (type === 'objectProperty' || type === 'dataProperty') ? (initialItem?.domains ?? []) : []
  )
  const [objRanges, setObjRanges]   = useState(
    type === 'objectProperty' ? (initialItem?.ranges ?? []) : []
  )
  const [dataRanges, setDataRanges] = useState(
    type === 'dataProperty' ? (initialItem?.ranges ?? []) : []
  )
  const [inverseOf, setInverseOf]   = useState(
    type === 'objectProperty' ? (initialItem?.inverseOf?.[0] ?? '') : ''
  )
  const [characteristics, setCharacteristics] = useState(
    type === 'objectProperty' ? (initialItem?.characteristics ?? []) : []
  )
  const [error, setError] = useState('')

  const modalRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const trap = (e) => {
      if (e.key !== 'Tab') return
      const focusable = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)')]
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    modal.addEventListener('keydown', trap)
    return () => modal.removeEventListener('keydown', trap)
  }, [])

  const ns = ontology.prefixes[prefix] ?? ''
  const generatedUri = customPrefixes.length > 0 ? (ns + localName.trim()) : localName.trim()

  const classItems = useMemo(() =>
    Object.values(ontology.classes)
      .map(cls => ({ uri: cls.uri, label: getDisplayName(cls, lang) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [ontology, lang]
  )

  const objPropItems = useMemo(() =>
    Object.values(ontology.objectProperties)
      .map(p => ({ uri: p.uri, label: getDisplayName(p, lang) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [ontology, lang]
  )

  const toggleChar = (c) =>
    setCharacteristics(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  const handleSubmit = (e) => {
    e.preventDefault()

    const labels = []
    if (labelEn.trim()) labels.push({ value: labelEn.trim(), lang: 'en' })
    if (labelKo.trim()) labels.push({ value: labelKo.trim(), lang: 'ko' })

    const comments = []
    if (commentEn.trim()) comments.push({ value: commentEn.trim(), lang: 'en' })
    if (commentKo.trim()) comments.push({ value: commentKo.trim(), lang: 'ko' })

    if (isEdit) {
      if (type === 'class') {
        onSubmit({ labels, comments, superClasses })
      } else if (type === 'objectProperty') {
        onSubmit({ labels, comments, domains, ranges: objRanges, inverseOf: inverseOf ? [inverseOf] : [], characteristics })
      } else if (type === 'dataProperty') {
        onSubmit({ labels, comments, domains, ranges: dataRanges })
      }
      return
    }

    // Add mode validation
    if (!localName.trim()) { setError('URI를 입력하세요.'); return }
    if (customPrefixes.length > 0 && !ns) { setError('Namespace가 없습니다. 접두사를 확인하세요.'); return }
    if (ontology.classes[generatedUri] || ontology.objectProperties[generatedUri] || ontology.dataProperties[generatedUri]) {
      setError('이미 존재하는 URI입니다.'); return
    }

    if (type === 'class') {
      onSubmit({ uri: generatedUri, labels, comments, superClasses })
    } else if (type === 'objectProperty') {
      onSubmit({ uri: generatedUri, labels, comments, domains, ranges: objRanges, inverseOf: inverseOf ? [inverseOf] : [], characteristics })
    } else if (type === 'dataProperty') {
      onSubmit({ uri: generatedUri, labels, comments, domains, ranges: dataRanges })
    }
  }

  const TITLE = {
    class:          isEdit ? '클래스 편집'            : '새 클래스 추가',
    objectProperty: isEdit ? 'Object Property 편집'  : '새 Object Property 추가',
    dataProperty:   isEdit ? 'Data Property 편집'    : '새 Data Property 추가',
  }

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" ref={modalRef} onMouseDown={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{TITLE[type]}</h3>
          <button className="modal-close" onClick={onClose} type="button">×</button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>

          {/* URI */}
          <div className="form-row">
            <label className="form-label">URI</label>
            {isEdit ? (
              <div className="uri-preview" style={{ padding: '8px 10px', background: 'var(--surface3)', borderRadius: 8, fontSize: 12, color: 'var(--text2)' }}>
                {uri}
              </div>
            ) : (
              <>
                <div className="uri-builder">
                  {customPrefixes.length > 0 && (
                    <select
                      className="uri-prefix-select"
                      value={prefix}
                      onChange={e => { setPrefix(e.target.value); setError('') }}
                    >
                      {customPrefixes.map(([p]) => (
                        <option key={p} value={p}>{p ? `${p}:` : ':'}</option>
                      ))}
                    </select>
                  )}
                  <input
                    className="uri-local-input"
                    value={localName}
                    onChange={e => { setLocalName(e.target.value); setError('') }}
                    placeholder={customPrefixes.length > 0 ? 'LocalName' : 'https://example.org/MyClass'}
                    autoFocus
                  />
                </div>
                {generatedUri && (
                  <div className="uri-preview" title={generatedUri}>{generatedUri}</div>
                )}
              </>
            )}
          </div>

          {/* Labels */}
          <div className="form-row form-row--2col">
            <div className="form-field">
              <label className="form-label">Label (EN)</label>
              <input value={labelEn} onChange={e => setLabelEn(e.target.value)} placeholder="English label" />
            </div>
            <div className="form-field">
              <label className="form-label">Label (KO)</label>
              <input value={labelKo} onChange={e => setLabelKo(e.target.value)} placeholder="한국어 레이블" />
            </div>
          </div>

          {/* Comments */}
          <div className="form-row form-row--2col">
            <div className="form-field">
              <label className="form-label">Comment (EN)</label>
              <textarea value={commentEn} onChange={e => setCommentEn(e.target.value)} placeholder="English comment" rows={2} />
            </div>
            <div className="form-field">
              <label className="form-label">Comment (KO)</label>
              <textarea value={commentKo} onChange={e => setCommentKo(e.target.value)} placeholder="한국어 설명" rows={2} />
            </div>
          </div>

          {/* Class: SuperClass */}
          {type === 'class' && (
            <div className="form-row">
              <label className="form-label">SuperClass</label>
              <ChipSelect items={classItems} value={superClasses} onChange={setSuperClasses} placeholder="클래스 검색..." />
            </div>
          )}

          {/* Object Property */}
          {type === 'objectProperty' && (
            <>
              <div className="form-row form-row--2col">
                <div className="form-field">
                  <label className="form-label">Domain</label>
                  <ChipSelect items={classItems} value={domains} onChange={setDomains} placeholder="클래스 검색..." />
                </div>
                <div className="form-field">
                  <label className="form-label">Range</label>
                  <ChipSelect items={classItems} value={objRanges} onChange={setObjRanges} placeholder="클래스 검색..." />
                </div>
              </div>
              <div className="form-row">
                <label className="form-label">InverseOf</label>
                <SingleSelect items={objPropItems} value={inverseOf} onChange={setInverseOf} placeholder="Object Property 검색..." />
              </div>
              <div className="form-row">
                <label className="form-label">Characteristics</label>
                <div className="checkbox-group">
                  {CHARACTERISTICS.map(c => (
                    <label key={c} className="checkbox-label">
                      <input type="checkbox" checked={characteristics.includes(c)} onChange={() => toggleChar(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Data Property */}
          {type === 'dataProperty' && (
            <div className="form-row form-row--2col">
              <div className="form-field">
                <label className="form-label">Domain</label>
                <ChipSelect items={classItems} value={domains} onChange={setDomains} placeholder="클래스 검색..." />
              </div>
              <div className="form-field">
                <label className="form-label">Range (XSD)</label>
                <ChipSelect items={XSD_TYPES} value={dataRanges} onChange={setDataRanges} placeholder="xsd:string, ..." />
              </div>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>취소</button>
            <button type="submit" className="btn btn-primary">{isEdit ? '저장' : '추가'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
