import { useState, useMemo } from 'react'
import { getDisplayName, localName } from '../utils/ttlParser'

const TABS = [
  { id: 'classes',   label: '클래스' },
  { id: 'objProps',  label: 'Object Props' },
  { id: 'dataProps', label: 'Data Props' },
]

// 재귀 트리 노드
function ClassTreeNode({ cls, classes, depth, selectedUri, onSelect, expanded, onToggle }) {
  if (depth > 30) return null  // 순환 참조 방어

  const childUris = cls.subClasses.filter(uri => classes[uri])
  const hasChildren = childUris.length > 0
  const isExpanded = expanded.has(cls.uri)
  const isSelected = selectedUri === cls.uri
  const label = getDisplayName(cls)

  return (
    <div>
      <div
        className={`list-item${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: `${4 + depth * 16}px` }}
        onClick={() => onSelect(cls.uri)}
        title={cls.uri}
      >
        {hasChildren ? (
          <span
            className="tree-toggle"
            onClick={e => { e.stopPropagation(); onToggle(cls.uri) }}
          >
            {isExpanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="tree-toggle-placeholder" />
        )}
        <span className="list-item-icon">◆</span>
        <span className="list-item-label">{label}</span>
        {hasChildren && (
          <span className="list-item-sub">{childUris.length}</span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {childUris
            .map(uri => classes[uri])
            .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
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
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ ontology, selectedItem, onSelectClass, onSelectProperty }) {
  const [activeTab, setActiveTab] = useState('classes')
  const [query, setQuery]         = useState('')
  const [expanded, setExpanded]   = useState(new Set())

  const onToggle = (uri) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(uri) ? next.delete(uri) : next.add(uri)
      return next
    })
  }

  const q = query.toLowerCase().trim()

  // 루트 클래스: 상위 클래스가 없거나 상위 클래스가 ontology에 없는 것
  const rootClasses = useMemo(() => {
    if (!ontology) return []
    return Object.values(ontology.classes)
      .filter(cls => cls.superClasses.every(sup => !ontology.classes[sup]))
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  }, [ontology])

  // 검색 시 플랫 리스트
  const flatFiltered = useMemo(() => {
    if (!ontology || !q) return null
    return Object.values(ontology.classes)
      .filter(cls => {
        const label = getDisplayName(cls)
        return label.toLowerCase().includes(q) || cls.uri.toLowerCase().includes(q)
      })
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  }, [ontology, q])

  const filteredProps = useMemo(() => {
    if (!ontology) return []
    const src = activeTab === 'objProps'
      ? Object.values(ontology.objectProperties)
      : Object.values(ontology.dataProperties)
    return src
      .filter(p => {
        if (!q) return true
        const name = getDisplayName(p)
        return name.toLowerCase().includes(q) || p.uri.toLowerCase().includes(q)
      })
      .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
  }, [ontology, activeTab, q])

  const selectedUri  = selectedItem?.uri
  const selectedType = selectedItem?.type

  const isSelectedProp = (type, uri) =>
    selectedType === type && selectedUri === uri

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        {TABS.map(tab => (
          <div
            key={tab.id}
            className={`sidebar-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div className="sidebar-search">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="검색..."
        />
      </div>

      <div className="sidebar-list">
        {!ontology && (
          <div className="sidebar-empty">TTL 파일을 업로드하면<br />목록이 표시됩니다</div>
        )}

        {/* ── 클래스 탭 ── */}
        {ontology && activeTab === 'classes' && (
          q ? (
            // 검색 중: 플랫 리스트
            flatFiltered.length === 0
              ? <div className="sidebar-empty">검색 결과 없음</div>
              : flatFiltered.map(cls => (
                  <div
                    key={cls.uri}
                    className={`list-item${selectedUri === cls.uri ? ' selected' : ''}`}
                    style={{ paddingLeft: 10 }}
                    onClick={() => onSelectClass(cls.uri)}
                    title={cls.uri}
                  >
                    <span className="tree-toggle-placeholder" />
                    <span className="list-item-icon">◆</span>
                    <span className="list-item-label">{getDisplayName(cls)}</span>
                  </div>
                ))
          ) : (
            // 일반: 계층 트리
            rootClasses.length === 0
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
                  />
                ))
          )
        )}

        {/* ── Object Props 탭 ── */}
        {ontology && activeTab === 'objProps' && (
          filteredProps.length === 0
            ? <div className="sidebar-empty">검색 결과 없음</div>
            : filteredProps.map(prop => (
                <div
                  key={prop.uri}
                  className={`list-item${isSelectedProp('objectProperty', prop.uri) ? ' selected' : ''}`}
                  style={{ paddingLeft: 10 }}
                  onClick={() => onSelectProperty(prop.uri, 'objectProperty')}
                  title={prop.uri}
                >
                  <span className="list-item-prop-icon" style={{ color: 'var(--tag-obj-fg)' }}>→</span>
                  <span className="list-item-label">{getDisplayName(prop)}</span>
                </div>
              ))
        )}

        {/* ── Data Props 탭 ── */}
        {ontology && activeTab === 'dataProps' && (
          filteredProps.length === 0
            ? <div className="sidebar-empty">검색 결과 없음</div>
            : filteredProps.map(prop => (
                <div
                  key={prop.uri}
                  className={`list-item${isSelectedProp('dataProperty', prop.uri) ? ' selected' : ''}`}
                  style={{ paddingLeft: 10 }}
                  onClick={() => onSelectProperty(prop.uri, 'dataProperty')}
                  title={prop.uri}
                >
                  <span className="list-item-prop-icon" style={{ color: 'var(--tag-data-fg)' }}>#</span>
                  <span className="list-item-label">{getDisplayName(prop)}</span>
                </div>
              ))
        )}
      </div>
    </div>
  )
}
