import { useState, useMemo } from 'react'
import { getDisplayName, getNsPrefix, localName } from '../utils/ttlParser'

const TABS = [
  { id: 'classes',    label: '클래스' },
  { id: 'objProps',   label: 'Object Props' },
  { id: 'dataProps',  label: 'Data Props' },
]

export default function Sidebar({ ontology, selectedItem, onSelectClass, onSelectProperty }) {
  const [activeTab, setActiveTab] = useState('classes')
  const [query, setQuery] = useState('')

  const q = query.toLowerCase()

  const classGroups = useMemo(() => {
    if (!ontology) return []
    const groups = {}
    Object.values(ontology.classes).forEach(cls => {
      const name = getDisplayName(cls)
      if (q && !name.toLowerCase().includes(q) && !cls.uri.toLowerCase().includes(q)) return
      const prefix = getNsPrefix(cls.uri, ontology.prefixes)
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(cls)
    })
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([prefix, items]) => ({
        prefix,
        items: items.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))),
      }))
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

  const isSelected = (type, uri) =>
    selectedItem?.type === type && selectedItem?.uri === uri

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

        {ontology && activeTab === 'classes' && (
          classGroups.length === 0
            ? <div className="sidebar-empty">검색 결과 없음</div>
            : classGroups.map(({ prefix, items }) => (
                <div key={prefix}>
                  <div className="ns-group-header">{prefix}</div>
                  {items.map(cls => (
                    <div
                      key={cls.uri}
                      className={`list-item${isSelected('class', cls.uri) ? ' selected' : ''}`}
                      onClick={() => onSelectClass(cls.uri)}
                      title={cls.uri}
                    >
                      <span className="list-item-icon">◆</span>
                      <span className="list-item-label">{getDisplayName(cls)}</span>
                      {cls.subClasses.length > 0 && (
                        <span className="list-item-sub">{cls.subClasses.length}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))
        )}

        {ontology && (activeTab === 'objProps' || activeTab === 'dataProps') && (
          filteredProps.length === 0
            ? <div className="sidebar-empty">검색 결과 없음</div>
            : filteredProps.map(prop => (
                <div
                  key={prop.uri}
                  className={`list-item${isSelected(activeTab === 'objProps' ? 'objectProperty' : 'dataProperty', prop.uri) ? ' selected' : ''}`}
                  onClick={() =>
                    onSelectProperty(
                      prop.uri,
                      activeTab === 'objProps' ? 'objectProperty' : 'dataProperty',
                    )
                  }
                  title={prop.uri}
                >
                  <span className="list-item-icon">{activeTab === 'objProps' ? '→' : '#'}</span>
                  <span className="list-item-label">{getDisplayName(prop)}</span>
                </div>
              ))
        )}
      </div>
    </div>
  )
}
