import { useState, useMemo, useRef, useEffect } from 'react'
import { getDisplayName } from '../utils/ttlParser'

const TABS = [
  { id: 'classes',   label: 'Classes',    addType: 'class' },
  { id: 'objProps',  label: 'Obj Props',  addType: 'objectProperty' },
  { id: 'dataProps', label: 'Data Props', addType: 'dataProperty' },
]

function getAncestorPath(cls, classes, lang) {
  const path = []
  let current = cls
  const visited = new Set([cls.uri])
  while (true) {
    const parentUri = current.superClasses.find(s => classes[s] && !visited.has(s))
    if (!parentUri) break
    visited.add(parentUri)
    const parent = classes[parentUri]
    path.unshift(getDisplayName(parent, lang))
    current = parent
  }
  return path
}

function ClassTreeNode({ cls, classes, depth, selectedUri, onSelect, expanded, onToggle, lang }) {
  if (depth > 30) return null

  const itemRef    = useRef(null)
  const childUris  = cls.subClasses.filter(uri => classes[uri])
  const hasChildren = childUris.length > 0
  const isExpanded  = expanded.has(cls.uri)
  const isSelected  = selectedUri === cls.uri

  useEffect(() => {
    if (isSelected) itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [isSelected])

  return (
    <div>
      <div
        ref={itemRef}
        className={`list-item${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: `${4 + depth * 4}px` }}
        onClick={() => onSelect(cls.uri)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(cls.uri) } }}
        tabIndex={0}
        role="treeitem"
        aria-selected={isSelected}
        title={cls.uri}
      >
        {hasChildren ? (
          <span
            className="tree-toggle"
            onClick={e => { e.stopPropagation(); onToggle(cls.uri) }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onToggle(cls.uri) } }}
            tabIndex={-1}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="tree-toggle-placeholder" />
        )}
        <span className="tree-class-dot" />
        <span className="list-item-label">{getDisplayName(cls, lang)}</span>
        {hasChildren && <span className="list-item-count">{childUris.length}</span>}
      </div>

      {isExpanded && hasChildren && (
        <div className="tree-children">
          {childUris
            .map(uri => classes[uri])
            .sort((a, b) => getDisplayName(a, lang).localeCompare(getDisplayName(b, lang)))
            .map(child => (
              <ClassTreeNode
                key={child.uri}
                cls={child}
                classes={classes}
                depth={depth + 1}
                selectedUri={selectedUri}
                onSelect={onSelect}
                expanded={expanded}
                onToggle={onToggle}
                lang={lang}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ ontology, selectedItem, onSelectClass, onSelectProperty, lang, onAdd }) {
  const [activeTab, setActiveTab] = useState('classes')
  const [query, setQuery]         = useState('')
  const [expanded, setExpanded]   = useState(new Set())
  const tabListRef = useRef(null)

  const handleTabClick = (tabId) => {
    setActiveTab(tabId)
    setQuery('')
    requestAnimationFrame(() => {
      tabListRef.current?.querySelector(`[data-tab="${tabId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' })
    })
  }

  const onToggle = (uri) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(uri) ? next.delete(uri) : next.add(uri)
      return next
    })
  }

  const q = query.toLowerCase().trim()

  const rootClasses = useMemo(() => {
    if (!ontology) return []
    return Object.values(ontology.classes)
      .filter(cls => cls.superClasses.every(sup => !ontology.classes[sup]))
      .sort((a, b) => getDisplayName(a, lang).localeCompare(getDisplayName(b, lang)))
  }, [ontology, lang])

  const flatFiltered = useMemo(() => {
    if (!ontology || !q) return null
    return Object.values(ontology.classes)
      .filter(cls => getDisplayName(cls, lang).toLowerCase().includes(q) || cls.uri.toLowerCase().includes(q))
      .sort((a, b) => getDisplayName(a, lang).localeCompare(getDisplayName(b, lang)))
  }, [ontology, q, lang])

  const filteredProps = useMemo(() => {
    if (!ontology) return []
    const src = activeTab === 'objProps'
      ? Object.values(ontology.objectProperties)
      : Object.values(ontology.dataProperties)
    return src
      .filter(p => !q || getDisplayName(p, lang).toLowerCase().includes(q) || p.uri.toLowerCase().includes(q))
      .sort((a, b) => getDisplayName(a, lang).localeCompare(getDisplayName(b, lang)))
  }, [ontology, activeTab, q, lang])

  // 선택된 클래스가 변경되면 트리에서 조상 노드를 자동 펼침
  useEffect(() => {
    if (!ontology || !selectedItem || selectedItem.type !== 'class') return
    const cls = ontology.classes[selectedItem.uri]
    if (!cls) return
    const ancestors = new Set()
    let current = cls
    const visited = new Set([cls.uri])
    while (true) {
      const parentUri = current.superClasses.find(s => ontology.classes[s] && !visited.has(s))
      if (!parentUri) break
      visited.add(parentUri)
      ancestors.add(parentUri)
      current = ontology.classes[parentUri]
    }
    if (ancestors.size > 0) {
      setExpanded(prev => {
        const next = new Set(prev)
        ancestors.forEach(uri => next.add(uri))
        return next
      })
    }
  }, [selectedItem?.uri, selectedItem?.type]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedUri  = selectedItem?.uri
  const selectedType = selectedItem?.type
  const activeTabDef = TABS.find(t => t.id === activeTab)

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <div className="sidebar-tab-list" ref={tabListRef}>
          {TABS.map(tab => (
            <div
              key={tab.id}
              data-tab={tab.id}
              className={`sidebar-tab${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.label}
            </div>
          ))}
        </div>
        <button
          className="sidebar-add-btn"
          onClick={ontology ? () => onAdd(activeTabDef.addType) : undefined}
          title={ontology ? `새 ${activeTabDef.label} 추가` : undefined}
          style={!ontology ? { opacity: 0, pointerEvents: 'none' } : undefined}
        >+</button>
      </div>

      <div className="sidebar-search">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="이름 또는 URI 검색" />
      </div>

      <div className="sidebar-list">
        {!ontology && (
          <div className="sidebar-empty">
            <div className="sidebar-empty-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="2" width="28" height="28" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity=".4"/>
                <path d="M10 16h12M16 10v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".5"/>
              </svg>
            </div>
            TTL 파일을 열면<br />목록이 표시됩니다
          </div>
        )}

        {ontology && activeTab === 'classes' && (
          q
            ? flatFiltered.length === 0
              ? <div className="sidebar-empty">검색 결과 없음</div>
              : flatFiltered.map(cls => {
                const path = getAncestorPath(cls, ontology.classes, lang)
                return (
                  <div
                    key={cls.uri}
                    className={`list-item${selectedUri === cls.uri ? ' selected' : ''}`}
                    style={{ paddingLeft: 6, alignItems: 'flex-start', paddingTop: 5, paddingBottom: 5 }}
                    onClick={() => onSelectClass(cls.uri)}
                    title={cls.uri}
                  >
                    <span className="tree-toggle-placeholder" style={{ marginTop: 2 }} />
                    <span className="tree-class-dot" style={{ flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <span className="list-item-label" style={{ display: 'block' }}>{getDisplayName(cls, lang)}</span>
                      {path.length > 0 && (
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {path.join(' › ')}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            : rootClasses.length === 0
              ? <div className="sidebar-empty">클래스 없음</div>
              : rootClasses.map(cls => (
                  <ClassTreeNode
                    key={cls.uri}
                    cls={cls}
                    classes={ontology.classes}
                    depth={0}
                    selectedUri={selectedUri}
                    onSelect={onSelectClass}
                    expanded={expanded}
                    onToggle={onToggle}
                    lang={lang}
                  />
                ))
        )}

        {ontology && activeTab === 'objProps' && (
          filteredProps.length === 0
            ? <div className="sidebar-empty">검색 결과 없음</div>
            : filteredProps.map(prop => (
                <div
                  key={prop.uri}
                  className={`list-item${selectedType === 'objectProperty' && selectedUri === prop.uri ? ' selected' : ''}`}
                  style={{ paddingLeft: 8 }}
                  onClick={() => onSelectProperty(prop.uri, 'objectProperty')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProperty(prop.uri, 'objectProperty') } }}
                  tabIndex={0}
                  title={prop.uri}
                >
                  <span className="list-item-prop-icon" style={{ color: 'var(--obj-fg)' }}>→</span>
                  <span className="list-item-label">{getDisplayName(prop, lang)}</span>
                </div>
              ))
        )}

        {ontology && activeTab === 'dataProps' && (
          filteredProps.length === 0
            ? <div className="sidebar-empty">검색 결과 없음</div>
            : filteredProps.map(prop => (
                <div
                  key={prop.uri}
                  className={`list-item${selectedType === 'dataProperty' && selectedUri === prop.uri ? ' selected' : ''}`}
                  style={{ paddingLeft: 8 }}
                  onClick={() => onSelectProperty(prop.uri, 'dataProperty')}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProperty(prop.uri, 'dataProperty') } }}
                  tabIndex={0}
                  title={prop.uri}
                >
                  <span className="list-item-prop-icon" style={{ color: 'var(--data-fg)' }}>#</span>
                  <span className="list-item-label">{getDisplayName(prop, lang)}</span>
                </div>
              ))
        )}

        <div style={{ height: 8 }} />
      </div>
    </div>
  )
}
