import { useRef, useEffect, useLayoutEffect, useCallback, useState, useMemo } from 'react'
import cytoscape from 'cytoscape'
import { getDisplayName, shorten } from '../utils/ttlParser'

const LAYOUTS = ['cose', 'breadthfirst', 'circle', 'grid']

const PALETTE = [
  { bg: '#EEF2FF', border: '#6366F1' },
  { bg: '#ECFDF5', border: '#059669' },
  { bg: '#FFFBEB', border: '#D97706' },
  { bg: '#FEF2F2', border: '#DC2626' },
  { bg: '#F5F3FF', border: '#7C3AED' },
  { bg: '#ECFEFF', border: '#0891B2' },
  { bg: '#FDF4FF', border: '#C026D3' },
  { bg: '#FFF7ED', border: '#EA580C' },
  { bg: '#F7FEE7', border: '#65A30D' },
  { bg: '#F0F9FF', border: '#0284C7' },
]

const COLOR_MODES = ['none', 'root', 'tree']
const COLOR_MODE_LABELS = { none: '색상 없음', root: '루트 강조', tree: '트리 색상' }
const DEFAULT_STYLE = { bg: '#FFFFFF', border: '#10B981' }

const CY_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': 'data(bgColor)',
      'border-width': 2,
      'border-color': 'data(borderColor)',
      'label': 'data(label)',
      'color': '#566080',
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'font-size': 10,
      'font-family': 'Segoe UI, system-ui, sans-serif',
      'width': 34,
      'height': 34,
      'text-wrap': 'wrap',
      'text-max-width': 85,
    },
  },
  {
    selector: 'node.focus',
    style: {
      'background-color': '#EEF0FE',
      'border-color': '#6366F1',
      'border-width': 3,
      'color': '#19213A',
      'font-weight': 'bold',
      'width': 44,
      'height': 44,
    },
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#F59E0B',
      'target-arrow-color': '#F59E0B',
      'target-arrow-shape': 'triangle',
      'target-arrow-size': 8,
      'curve-style': 'bezier',
      'label': 'data(label)',
      'font-size': 9,
      'font-family': 'Segoe UI, system-ui, sans-serif',
      'color': '#B45309',
      'text-background-color': '#EDF1FA',
      'text-background-opacity': 0.9,
      'text-background-padding': '3px',
      'text-rotation': 'autorotate',
    },
  },
  {
    selector: 'edge.subclass',
    style: {
      'line-color': '#CDD4ED',
      'target-arrow-color': '#CDD4ED',
      'target-arrow-size': 7,
      'line-style': 'dashed',
      'line-dash-pattern': [4, 3],
      'label': 'subClassOf',
      'color': '#99A3BE',
      'font-size': 9,
    },
  },
]

function findRoots(ont) {
  return Object.values(ont.classes).filter(cls =>
    cls.superClasses.length === 0 ||
    cls.superClasses.every(sup => !ont.classes[sup])
  )
}

function buildColorMap(ont, mode) {
  if (!ont || mode === 'none') return { map: new Map(), roots: [] }

  const roots = findRoots(ont)

  if (mode === 'root') {
    const map = new Map()
    roots.forEach((root, i) => map.set(root.uri, PALETTE[i % PALETTE.length]))
    return { map, roots }
  }

  // tree: BFS from each root, first assignment wins (multi-inheritance → first root)
  const map = new Map()
  roots.forEach((root, i) => {
    const color = PALETTE[i % PALETTE.length]
    const queue = [root.uri]
    const visited = new Set()
    while (queue.length) {
      const uri = queue.shift()
      if (visited.has(uri)) continue
      visited.add(uri)
      if (!map.has(uri)) map.set(uri, color)
      const cls = ont.classes[uri]
      if (cls) cls.subClasses.forEach(sub => queue.push(sub))
    }
  })
  return { map, roots }
}

export default function GraphView({ ontology, selectedItem, onSelectClass, showToast }) {
  const containerRef  = useRef(null)
  const cyRef         = useRef(null)
  const layoutIdx     = useRef(0)
  const ontologyRef   = useRef(ontology)
  const currentView   = useRef(null) // { type: 'class'|'prop'|'full', uri?, propType? }

  const [colorMode, setColorMode] = useState('none')

  useEffect(() => { ontologyRef.current = ontology }, [ontology])

  const { map: colorMap, roots } = useMemo(
    () => buildColorMap(ontology, colorMode),
    [ontology, colorMode]
  )
  const colorMapRef = useRef(colorMap)
  useEffect(() => { colorMapRef.current = colorMap }, [colorMap])

  // ── Cytoscape 초기화 ──────────────────────────────────────
  useLayoutEffect(() => {
    if (!containerRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: CY_STYLE,
      layout: { name: 'preset' },
      wheelSensitivity: 0.3,
      minZoom: 0.05,
      maxZoom: 5,
    })
    cyRef.current = cy

    cy.on('tap', 'node', e => {
      const id = e.target.id()
      if (ontologyRef.current?.classes[id]) onSelectClass(id)
    })

    const ro = new ResizeObserver(() => { cy.resize(); cy.fit(undefined, 40) })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); cy.destroy() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── colorMode 변경 시 현재 뷰 재빌드 ──────────────────────
  useEffect(() => {
    const cy  = cyRef.current
    const ont = ontologyRef.current
    const view = currentView.current
    if (!cy || !ont || !view) return

    if      (view.type === 'class') buildClassGraph(cy, ont, view.uri)
    else if (view.type === 'prop')  buildPropGraph(cy, ont, view.uri, view.propType)
    else if (view.type === 'full')  buildFullGraph(cy, ont)
  }, [colorMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 선택 항목 변경 ─────────────────────────────────────────
  useEffect(() => {
    const cy  = cyRef.current
    const ont = ontologyRef.current
    if (!cy || !ont || !selectedItem) return

    if (selectedItem.type === 'class') {
      currentView.current = { type: 'class', uri: selectedItem.uri }
      buildClassGraph(cy, ont, selectedItem.uri)
    } else {
      currentView.current = { type: 'prop', uri: selectedItem.uri, propType: selectedItem.type }
      buildPropGraph(cy, ont, selectedItem.uri, selectedItem.type)
    }
  }, [selectedItem])

  // ── ontology 교체 시 초기화 ────────────────────────────────
  useEffect(() => {
    cyRef.current?.elements().remove()
    currentView.current = null
  }, [ontology])

  // ── 노드 데이터 생성 (colorMap 반영) ──────────────────────
  function makeNodeData(u, ont) {
    const c     = ont.classes[u]
    const color = colorMapRef.current.get(u) ?? DEFAULT_STYLE
    return {
      id:          u,
      label:       c ? getDisplayName(c) : shorten(u, ont.prefixes),
      bgColor:     color.bg,
      borderColor: color.border,
    }
  }

  // ── 그래프 빌더 ───────────────────────────────────────────
  function buildClassGraph(cy, ont, uri) {
    const cls = ont.classes[uri]
    if (!cls) return

    const nodes      = new Map()
    const edges      = []
    const addedEdges = new Set()

    const addNode = (u, cls2 = '') => {
      if (nodes.has(u)) return
      nodes.set(u, { data: makeNodeData(u, ont), classes: cls2 })
    }

    addNode(uri, 'focus')

    cls.superClasses.forEach(sup => {
      addNode(sup)
      const eid = `sc_${uri}_${sup}`
      if (!addedEdges.has(eid)) {
        addedEdges.add(eid)
        edges.push({ data: { id: eid, source: uri, target: sup, label: '' }, classes: 'subclass' })
      }
    })

    cls.subClasses.forEach(sub => {
      addNode(sub)
      const eid = `sc_${sub}_${uri}`
      if (!addedEdges.has(eid)) {
        addedEdges.add(eid)
        edges.push({ data: { id: eid, source: sub, target: uri, label: '' }, classes: 'subclass' })
      }
    })

    cls.outObjProps.forEach(pUri => {
      const p = ont.objectProperties[pUri]
      if (!p) return
      const label = getDisplayName(p)
      p.ranges.forEach(r => {
        addNode(r)
        const eid = `op_${pUri}_${uri}_${r}`
        if (!addedEdges.has(eid)) {
          addedEdges.add(eid)
          edges.push({ data: { id: eid, source: uri, target: r, label } })
        }
      })
    })

    cls.inObjProps.forEach(pUri => {
      const p = ont.objectProperties[pUri]
      if (!p) return
      const label = getDisplayName(p)
      p.domains.forEach(d => {
        addNode(d)
        const eid = `op_${pUri}_${d}_${uri}`
        if (!addedEdges.has(eid)) {
          addedEdges.add(eid)
          edges.push({ data: { id: eid, source: d, target: uri, label } })
        }
      })
    })

    applyGraph(cy, [...nodes.values(), ...edges])
  }

  function buildPropGraph(cy, ont, uri, type) {
    const prop = type === 'objectProperty'
      ? ont.objectProperties[uri]
      : ont.dataProperties[uri]
    if (!prop || !prop.domains.length) return

    const label = getDisplayName(prop)
    const nodes = new Map()
    const edges = []

    prop.domains.forEach(d => {
      if (!nodes.has(d))
        nodes.set(d, { data: makeNodeData(d, ont), classes: 'focus' })
    })
    prop.ranges.forEach(r => {
      if (!nodes.has(r))
        nodes.set(r, { data: makeNodeData(r, ont) })
    })
    prop.domains.forEach(d =>
      prop.ranges.forEach(r =>
        edges.push({ data: { id: `${uri}_${d}_${r}`, source: d, target: r, label } })
      )
    )

    applyGraph(cy, [...nodes.values(), ...edges])
  }

  function buildFullGraph(cy, ont) {
    const nodes      = new Map()
    const edges      = []
    const addedEdges = new Set()

    Object.values(ont.classes).forEach(cls => {
      if (!nodes.has(cls.uri))
        nodes.set(cls.uri, { data: makeNodeData(cls.uri, ont) })

      cls.superClasses.forEach(sup => {
        if (!ont.classes[sup]) return
        if (!nodes.has(sup))
          nodes.set(sup, { data: makeNodeData(sup, ont) })
        const eid = `sc_${cls.uri}_${sup}`
        if (!addedEdges.has(eid)) {
          addedEdges.add(eid)
          edges.push({ data: { id: eid, source: cls.uri, target: sup, label: '' }, classes: 'subclass' })
        }
      })
    })

    Object.values(ont.objectProperties).forEach(p => {
      p.domains.forEach(d => p.ranges.forEach(r => {
        if (!ont.classes[d] || !ont.classes[r]) return
        const eid = `op_${p.uri}_${d}_${r}`
        if (!addedEdges.has(eid)) {
          addedEdges.add(eid)
          edges.push({ data: { id: eid, source: d, target: r, label: getDisplayName(p) } })
        }
      }))
    })

    cy.elements().remove()
    cy.add([...nodes.values(), ...edges])
    cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 500,
      padding: 50,
      nodeRepulsion: 10000,
      idealEdgeLength: 150,
      nodeDimensionsIncludeLabels: true,
    }).run()
  }

  function applyGraph(cy, elements) {
    cy.elements().remove()
    cy.add(elements)
    runLayout(cy)
  }

  function runLayout(cy, name) {
    const layoutName = name || LAYOUTS[layoutIdx.current]
    cy.layout({
      name: layoutName,
      animate: true,
      animationDuration: 350,
      padding: 50,
      nodeDimensionsIncludeLabels: true,
      nodeRepulsion: 6000,
      idealEdgeLength: 130,
    }).run()
  }

  const handleFit = () => { cyRef.current?.fit(undefined, 40) }

  const handleToggleLayout = () => {
    layoutIdx.current = (layoutIdx.current + 1) % LAYOUTS.length
    if (cyRef.current?.elements().length) runLayout(cyRef.current)
    showToast('레이아웃: ' + LAYOUTS[layoutIdx.current])
  }

  const handleFullGraph = useCallback(() => {
    const cy  = cyRef.current
    const ont = ontologyRef.current
    if (!cy || !ont) return
    currentView.current = { type: 'full' }
    buildFullGraph(cy, ont)
    showToast('전체 그래프 표시 중')
  }, [showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleColorModeToggle = () => {
    setColorMode(prev => {
      const next = COLOR_MODES[(COLOR_MODES.indexOf(prev) + 1) % COLOR_MODES.length]
      showToast(COLOR_MODE_LABELS[next])
      return next
    })
  }

  // 범례: root/tree 모드일 때 루트별 색상 표시 (최대 6개)
  const treeLegend = colorMode !== 'none' && roots.length > 0
    ? roots.slice(0, 6).map((root, i) => ({
        label: getDisplayName(root),
        color: PALETTE[i % PALETTE.length],
      }))
    : null

  return (
    <div className="graph-area">
      <div ref={containerRef} className="cy-container" />

      {!selectedItem && (
        <div className="graph-placeholder">
          <div className="graph-placeholder-icon">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="10" r="5"  stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
              <circle cx="9"  cy="38" r="5"  stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
              <circle cx="43" cy="38" r="5"  stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
              <circle cx="26" cy="26" r="3.5" stroke="currentColor" strokeWidth="1.5" opacity=".18"/>
              <line x1="26" y1="15" x2="26"  y2="22.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".25"/>
              <line x1="23"  y1="29" x2="13"  y2="34"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".25"/>
              <line x1="29"  y1="29" x2="39"  y2="34"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".25"/>
            </svg>
          </div>
          <p>클래스를 선택하면 관계 그래프가 표시됩니다</p>
        </div>
      )}

      <div className="graph-controls">
        <button className="graph-btn" onClick={handleFit}>전체 보기</button>
        <button className="graph-btn" onClick={handleToggleLayout}>레이아웃 변경</button>
        {ontology && (
          <button className="graph-btn" onClick={handleFullGraph}>전체 그래프</button>
        )}
        {ontology && (
          <button
            className={`graph-btn${colorMode !== 'none' ? ' graph-btn--active' : ''}`}
            onClick={handleColorModeToggle}
          >
            {COLOR_MODE_LABELS[colorMode]}
          </button>
        )}
      </div>

      <div className="graph-legend">
        {treeLegend ? (
          <>
            {treeLegend.map(({ label, color }) => (
              <div className="legend-item" key={label}>
                <div className="legend-dot" style={{ background: color.bg, border: `2px solid ${color.border}` }} />
                {label}
              </div>
            ))}
            {roots.length > 6 && (
              <div className="legend-item" style={{ color: '#99A3BE' }}>+{roots.length - 6}개 루트</div>
            )}
          </>
        ) : (
          <>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#6366F1', border: '2px solid #6366F1' }} />선택 클래스</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#fff', border: '2px solid #10B981' }} />연결 클래스</div>
            <div className="legend-item"><div className="legend-line" style={{ background: '#F59E0B' }} />Object Property</div>
            <div className="legend-item"><div className="legend-dashed" style={{ borderColor: '#CDD4ED' }} />SubClassOf</div>
          </>
        )}
      </div>
    </div>
  )
}
