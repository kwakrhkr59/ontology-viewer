import { useState } from 'react'
import { getDisplayName, getComments, shorten, localName } from '../utils/ttlParser'

function copyToClipboard(text, showToast) {
  navigator.clipboard.writeText(text).then(() => showToast('URI 복사됨'))
}

function UriRow({ uri, showToast }) {
  return (
    <div className="detail-uri">
      <span className="detail-uri-text">{uri}</span>
      <button className="copy-btn" onClick={() => copyToClipboard(uri, showToast)} title="URI 복사">
        ⧉
      </button>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="detail-section">
      <div className="detail-section-title">{title}</div>
      {children}
    </div>
  )
}

function ClassChip({ uri, ontology, onSelectClass, lang }) {
  const cls = ontology.classes[uri]
  const label = cls ? getDisplayName(cls, lang) : localName(uri)
  return (
    <span className="chip chip-class" onClick={() => onSelectClass(uri)} title={uri}>
      {label}
    </span>
  )
}

function ObjPropCard({ uri, ontology, direction, onSelectProperty, onSelectClass, prefixes, lang }) {
  const prop = ontology.objectProperties[uri]
  if (!prop) return null
  const label = getDisplayName(prop, lang)
  const relatedUris = direction === 'out' ? prop.ranges : prop.domains

  return (
    <div className="prop-card">
      <div className="prop-card-name" onClick={() => onSelectProperty(uri, 'objectProperty')}>
        {label}
      </div>
      {getComments(prop, lang)[0] && (
        <div className="prop-card-comment">{getComments(prop, lang)[0]}</div>
      )}
      <div className="prop-card-meta">
        <span className="tag tag-obj">Object</span>
        {relatedUris.map(r => (
          <span
            key={r}
            className="tag tag-range"
            style={{ cursor: ontology.classes[r] ? 'pointer' : 'default' }}
            onClick={() => ontology.classes[r] && onSelectClass(r)}
            title={r}
          >
            {direction === 'in' ? '← ' : ''}{shorten(r, prefixes)}
          </span>
        ))}
        {prop.characteristics.map(c => (
          <span key={c} className="tag tag-char">{c}</span>
        ))}
      </div>
    </div>
  )
}

function DataPropCard({ uri, ontology, onSelectProperty, prefixes, lang }) {
  const prop = ontology.dataProperties[uri]
  if (!prop) return null
  const label = getDisplayName(prop, lang)
  return (
    <div className="prop-card">
      <div className="prop-card-name" onClick={() => onSelectProperty(uri, 'dataProperty')}>
        {label}
      </div>
      {getComments(prop, lang)[0] && (
        <div className="prop-card-comment">{getComments(prop, lang)[0]}</div>
      )}
      <div className="prop-card-meta">
        <span className="tag tag-data">DataProp</span>
        {prop.ranges.map(r => (
          <span key={r} className="tag tag-range" title={r}>{shorten(r, prefixes)}</span>
        ))}
      </div>
    </div>
  )
}

function DeleteButton({ onDelete }) {
  const [confirm, setConfirm] = useState(false)

  if (confirm) {
    return (
      <div className="delete-confirm">
        <span className="delete-confirm-msg">삭제할까요?</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirm(false)}>취소</button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>삭제</button>
      </div>
    )
  }

  return (
    <button className="btn btn-danger-ghost btn-sm" onClick={() => setConfirm(true)} title="삭제">
      삭제
    </button>
  )
}

export default function DetailPanel({ ontology, selectedItem, onSelectClass, onSelectProperty, showToast, lang, onDelete }) {
  if (!ontology || !selectedItem) {
    return (
      <div className="detail-panel">
        <div className="detail-placeholder">
          <div className="detail-placeholder-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
              <circle cx="8"  cy="30" r="4" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
              <circle cx="32" cy="30" r="4" stroke="currentColor" strokeWidth="1.5" opacity=".4"/>
              <circle cx="20" cy="21" r="3" stroke="currentColor" strokeWidth="1.5" opacity=".25"/>
              <line x1="20" y1="14" x2="20" y2="18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
              <line x1="17.5" y1="23.5" x2="11" y2="27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
              <line x1="22.5" y1="23.5" x2="29" y2="27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
            </svg>
          </div>
          <p>좌측에서 클래스나<br />속성을 선택하세요</p>
        </div>
      </div>
    )
  }

  const { type, uri } = selectedItem
  const pfx = ontology.prefixes

  if (type === 'class') {
    const cls = ontology.classes[uri]
    if (!cls) return null
    const label = getDisplayName(cls, lang)
    const clsComments = getComments(cls, lang)
    return (
      <div className="detail-panel">
        <div className="detail-content">
          <div className="detail-header">
            <div className="detail-header-main">
              <h2>{label}</h2>
              <UriRow uri={uri} showToast={showToast} />
            </div>
            <DeleteButton onDelete={() => onDelete(uri, 'class')} />
          </div>

          {clsComments.length > 0 && (
            <Section title="설명">
              {clsComments.map((c, i) => (
                <p key={i} className="detail-comment">{c}</p>
              ))}
            </Section>
          )}

          {cls.superClasses.length > 0 && (
            <Section title="상위 클래스 (SuperClass)">
              <div className="chip-list">
                {cls.superClasses.map(u => (
                  <ClassChip key={u} uri={u} ontology={ontology} onSelectClass={onSelectClass} lang={lang} />
                ))}
              </div>
            </Section>
          )}

          {cls.subClasses.length > 0 && (
            <Section title={`하위 클래스 (SubClass) · ${cls.subClasses.length}개`}>
              <div className="chip-list">
                {cls.subClasses.map(u => (
                  <ClassChip key={u} uri={u} ontology={ontology} onSelectClass={onSelectClass} lang={lang} />
                ))}
              </div>
            </Section>
          )}

          {cls.outObjProps.length > 0 && (
            <Section title={`아웃바운드 Object Properties · ${cls.outObjProps.length}개`}>
              {cls.outObjProps.map(u => (
                <ObjPropCard
                  key={u}
                  uri={u}
                  direction="out"
                  ontology={ontology}
                  onSelectProperty={onSelectProperty}
                  onSelectClass={onSelectClass}
                  prefixes={pfx}
                  lang={lang}
                />
              ))}
            </Section>
          )}

          {cls.inObjProps.length > 0 && (
            <Section title={`인바운드 Object Properties · ${cls.inObjProps.length}개`}>
              {cls.inObjProps.map(u => (
                <ObjPropCard
                  key={u}
                  uri={u}
                  direction="in"
                  ontology={ontology}
                  onSelectProperty={onSelectProperty}
                  onSelectClass={onSelectClass}
                  prefixes={pfx}
                  lang={lang}
                />
              ))}
            </Section>
          )}

          {cls.dataProps.length > 0 && (
            <Section title={`Data Properties · ${cls.dataProps.length}개`}>
              {cls.dataProps.map(u => (
                <DataPropCard
                  key={u}
                  uri={u}
                  ontology={ontology}
                  onSelectProperty={onSelectProperty}
                  prefixes={pfx}
                  lang={lang}
                />
              ))}
            </Section>
          )}

          {!cls.superClasses.length && !cls.subClasses.length &&
           !cls.outObjProps.length && !cls.inObjProps.length && !cls.dataProps.length && (
            <p className="detail-comment">연결된 관계나 속성이 없습니다.</p>
          )}
        </div>
      </div>
    )
  }

  // Property detail
  const isObj  = type === 'objectProperty'
  const prop   = isObj ? ontology.objectProperties[uri] : ontology.dataProperties[uri]
  if (!prop) return null
  const label  = getDisplayName(prop, lang)
  const propComments = getComments(prop, lang)

  return (
    <div className="detail-panel">
      <div className="detail-content">
        <div className="detail-header">
          <div className="detail-header-main">
            <h2>{label}</h2>
            <UriRow uri={uri} showToast={showToast} />
          </div>
          <DeleteButton onDelete={() => onDelete(uri, type)} />
        </div>

        <div>
          <span className={`tag ${isObj ? 'tag-obj' : 'tag-data'}`} style={{ fontSize: 13 }}>
            {isObj ? 'Object Property' : 'Data Property'}
          </span>
        </div>

        {propComments.length > 0 && (
          <Section title="설명">
            {propComments.map((c, i) => (
              <p key={i} className="detail-comment">{c}</p>
            ))}
          </Section>
        )}

        {prop.domains.length > 0 && (
          <Section title="Domain">
            <div className="chip-list">
              {prop.domains.map(u => (
                <ClassChip key={u} uri={u} ontology={ontology} onSelectClass={onSelectClass} lang={lang} />
              ))}
            </div>
          </Section>
        )}

        {prop.ranges.length > 0 && (
          <Section title="Range">
            <div className="chip-list">
              {prop.ranges.map(u => (
                ontology.classes[u]
                  ? <ClassChip key={u} uri={u} ontology={ontology} onSelectClass={onSelectClass} lang={lang} />
                  : <span key={u} className="chip chip-range" title={u}>{shorten(u, pfx)}</span>
              ))}
            </div>
          </Section>
        )}

        {isObj && prop.characteristics.length > 0 && (
          <Section title="특성 (Characteristics)">
            <div className="chip-list">
              {prop.characteristics.map(c => (
                <span key={c} className="tag tag-char" style={{ padding: '4px 12px', borderRadius: 12 }}>{c}</span>
              ))}
            </div>
          </Section>
        )}

        {isObj && prop.inverseOf.length > 0 && (
          <Section title="InverseOf">
            <div className="chip-list">
              {prop.inverseOf.map(u => (
                <span key={u} className="chip chip-range" title={u}>{shorten(u, pfx)}</span>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
