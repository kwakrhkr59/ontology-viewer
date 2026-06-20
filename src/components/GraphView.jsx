import { useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import cytoscape from 'cytoscape'
import { getDisplayName, shorten } from '../utils/ttlParser'

const LAYOUTS = ['cose', 'breadthfirst', 'circle', 'grid']

const CY_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': '#FFFFFF',
      'border-width': 2,
      'border-color': '#10B981',
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

export default function GraphView({ ontology, selectedItem, onSelectClass, showToast }) {
  const containerRef = useRef(null)
  const cyRef        = useRef(null)
  const layoutIdx    = useRef(0)
  const ontologyRef  = useRef(ontology)
  useEffect(() => { ontologyRef.current = ontology }, [ontology])

  // Cytoscape 초기화 (useLayoutEffect: DOM 크기 확정 후 실행)
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

    // 컨테이너 리사이즈 감지
    const ro = new ResizeObserver(() => {
      cy.resize()
      cy.fit(undefined, 40)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      cy.destroy()
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 항목 변경 시 그래프 업데이트
  useEffect(() => {
    const cy  = cyRef.current
    const ont = ontologyRef.current
    if (!cy || !ont || !selectedItem) return

    if (selectedItem.type === 'class') {
      buildClassGraph(cy, ont, selectedItem.uri)
    } else {
      buildPropGraph(cy, ont, selectedItem.uri, selectedItem.type)
    }
  }, [selectedItem])

  // ontology 교체 시 그래프 초기화
  useEffect(() => {
    cyRef.current?.elements().remove()
  }, [ontology])

  function buildClassGraph(cy, ont, uri) {
    const cls = ont.classes[uri]
    if (!cls) return

    const nodes = new Map()
    const edges = []
    const addedEdges = new Set()

    const addNode = (u, cls2 = '') => {
      if (nodes.has(u)) return
      const c = ont.classes[u]
      nodes.set(u, {
        data: { id: u, label: c ? getDisplayName(c) : shorten(u, ont.prefixes) },
        classes: cls2,
      })
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
      if (!nodes.has(d)) {
        const c = ont.classes[d]
        nodes.set(d, { data: { id: d, label: c ? getDisplayName(c) : shorten(d, ont.prefixes) }, classes: 'focus' })
      }
    })
    prop.ranges.forEach(r => {
      if (!nodes.has(r)) {
        const c = ont.classes[r]
        nodes.set(r, { data: { id: r, label: c ? getDisplayName(c) : shorten(r, ont.prefixes) } })
      }
    })
    prop.domains.forEach(d =>
      prop.ranges.forEach(r =>
        edges.push({ data: { id: `${uri}_${d}_${r}`, source: d, target: r, label } })
      )
    )

    applyGraph(cy, [...nodes.values(), ...edges])
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

    const nodes = new Map()
    const edges = []
    const addedEdges = new Set()

    Object.values(ont.classes).forEach(cls => {
      if (!nodes.has(cls.uri))
        nodes.set(cls.uri, { data: { id: cls.uri, label: getDisplayName(cls) } })

      cls.superClasses.forEach(sup => {
        if (!ont.classes[sup]) return
        if (!nodes.has(sup))
          nodes.set(sup, { data: { id: sup, label: getDisplayName(ont.classes[sup]) } })
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

    showToast('전체 그래프 표시 중')
  }, [showToast])

  return (
    <div className="graph-area">
      {/* absolute inset:0 으로 Cytoscape가 부모 크기를 정확히 인식 */}
      <div ref={containerRef} className="cy-container" />

      {!selectedItem && (
        <div className="graph-placeholder">
          <div className="graph-placeholder-icon">🕸️</div>
          <p>클래스를 선택하면 관계 그래프가 표시됩니다</p>
        </div>
      )}

      <div className="graph-controls">
        <button className="graph-btn" onClick={handleFit}>전체 보기</button>
        <button className="graph-btn" onClick={handleToggleLayout}>레이아웃 변경</button>
        {ontology && (
          <button className="graph-btn" onClick={handleFullGraph}>전체 그래프</button>
        )}
      </div>

      <div className="graph-legend">
        <div className="legend-item"><div className="legend-dot" style={{ background: '#6366F1', border: '2px solid #6366F1' }} />선택 클래스</div>
        <div className="legend-item"><div className="legend-dot" style={{ background: '#fff', border: '2px solid #10B981' }} />연결 클래스</div>
        <div className="legend-item"><div className="legend-line" style={{ background: '#F59E0B' }} />Object Property</div>
        <div className="legend-item"><div className="legend-dashed" style={{ borderColor: '#CDD4ED' }} />SubClassOf</div>
      </div>
    </div>
  )
}
