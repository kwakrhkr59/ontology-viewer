import { useRef, useEffect, useCallback } from 'react'
import cytoscape from 'cytoscape'
import { getDisplayName, shorten } from '../utils/ttlParser'

const LAYOUTS = ['cose', 'breadthfirst', 'circle', 'grid']

const CY_STYLE = [
  {
    selector: 'node',
    style: {
      'background-color': '#3dd68c',
      'label': 'data(label)',
      'color': '#e2e4f0',
      'text-valign': 'bottom',
      'text-margin-y': 6,
      'font-size': 11,
      'width': 34,
      'height': 34,
      'border-width': 2,
      'border-color': '#2e3247',
      'text-wrap': 'wrap',
      'text-max-width': 80,
    },
  },
  {
    selector: 'node.focus',
    style: {
      'background-color': '#6c8ef5',
      'border-color': '#a0b4ff',
      'border-width': 3,
      'width': 42,
      'height': 42,
    },
  },
  {
    selector: 'edge',
    style: {
      'width': 2,
      'line-color': '#f0883e',
      'target-arrow-color': '#f0883e',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'label': 'data(label)',
      'font-size': 10,
      'color': '#f0b860',
      'text-background-color': '#0f1117',
      'text-background-opacity': 0.85,
      'text-background-padding': '2px',
      'text-rotation': 'autorotate',
    },
  },
  {
    selector: 'edge.subclass',
    style: {
      'line-color': '#4a4f6a',
      'target-arrow-color': '#4a4f6a',
      'line-style': 'dashed',
      'label': 'subClassOf',
      'color': '#4a4f6a',
      'font-size': 9,
    },
  },
]

export default function GraphView({ ontology, selectedItem, onSelectClass, showToast }) {
  const containerRef  = useRef(null)
  const cyRef         = useRef(null)
  const layoutIdxRef  = useRef(0)
  const onSelectRef   = useRef(onSelectClass)
  useEffect(() => { onSelectRef.current = onSelectClass }, [onSelectClass])

  // Init Cytoscape once
  useEffect(() => {
    if (!containerRef.current) return
    cyRef.current = cytoscape({
      container: containerRef.current,
      style: CY_STYLE,
      layout: { name: 'preset' },
      wheelSensitivity: 0.3,
      minZoom: 0.1,
      maxZoom: 4,
    })
    cyRef.current.on('tap', 'node', e => {
      const id = e.target.id()
      if (ontology?.classes[id]) onSelectRef.current(id)
    })
    return () => cyRef.current?.destroy()
  }, [])

  // Rebuild graph when selection changes
  useEffect(() => {
    if (!cyRef.current || !ontology || !selectedItem) return

    if (selectedItem.type === 'class') {
      renderClassGraph(selectedItem.uri)
    } else {
      renderPropertyGraph(selectedItem.uri, selectedItem.type)
    }
  }, [selectedItem, ontology])

  function renderClassGraph(uri) {
    const cy  = cyRef.current
    const cls = ontology.classes[uri]
    if (!cls) return

    const nodes = new Map()
    const edges = []

    const addNode = (u, classes = '') => {
      if (nodes.has(u)) return
      const c = ontology.classes[u]
      nodes.set(u, { data: { id: u, label: c ? getDisplayName(c) : shorten(u, ontology.prefixes) }, classes })
    }

    addNode(uri, 'focus')

    cls.superClasses.forEach(sup => {
      addNode(sup)
      edges.push({ data: { id: `sub_${uri}_${sup}`, source: uri, target: sup, label: '' }, classes: 'subclass' })
    })
    cls.subClasses.forEach(sub => {
      addNode(sub)
      edges.push({ data: { id: `sub_${sub}_${uri}`, source: sub, target: uri, label: '' }, classes: 'subclass' })
    })
    cls.outObjProps.forEach(pUri => {
      const p = ontology.objectProperties[pUri]
      if (!p) return
      p.ranges.forEach(r => {
        addNode(r)
        const eid = `op_${pUri}_${uri}_${r}`
        if (!edges.find(e => e.data.id === eid))
          edges.push({ data: { id: eid, source: uri, target: r, label: getDisplayName(p) } })
      })
    })
    cls.inObjProps.forEach(pUri => {
      const p = ontology.objectProperties[pUri]
      if (!p) return
      p.domains.forEach(d => {
        addNode(d)
        const eid = `op_${pUri}_${d}_${uri}`
        if (!edges.find(e => e.data.id === eid))
          edges.push({ data: { id: eid, source: d, target: uri, label: getDisplayName(p) } })
      })
    })

    applyGraph([...nodes.values(), ...edges])
  }

  function renderPropertyGraph(uri, type) {
    const cy   = cyRef.current
    const prop = type === 'objectProperty'
      ? ontology.objectProperties[uri]
      : ontology.dataProperties[uri]
    if (!prop || !prop.domains.length) return

    const nodes = new Map()
    const edges = []
    const label = getDisplayName(prop)

    const addNode = (u, cls = '') => {
      if (nodes.has(u)) return
      const c = ontology.classes[u]
      nodes.set(u, { data: { id: u, label: c ? getDisplayName(c) : shorten(u, ontology.prefixes) }, classes: cls })
    }

    prop.domains.forEach(d => addNode(d, 'focus'))
    prop.ranges.forEach(r => {
      if (ontology.classes[r]) addNode(r)
      else if (!nodes.has(r)) nodes.set(r, { data: { id: r, label: shorten(r, ontology.prefixes) } })
    })
    prop.domains.forEach(d =>
      prop.ranges.forEach(r =>
        edges.push({ data: { id: `${uri}_${d}_${r}`, source: d, target: r, label } })
      )
    )

    applyGraph([...nodes.values(), ...edges])
  }

  function applyGraph(elements) {
    const cy = cyRef.current
    cy.elements().remove()
    cy.add(elements)
    runLayout()
  }

  function runLayout(name) {
    const layoutName = name || LAYOUTS[layoutIdxRef.current]
    cyRef.current?.layout({
      name: layoutName,
      animate: true,
      animationDuration: 350,
      padding: 50,
      nodeDimensionsIncludeLabels: true,
      nodeRepulsion: 6000,
      idealEdgeLength: 120,
    }).run()
  }

  const handleFit = () => cyRef.current?.fit(undefined, 50)

  const handleToggleLayout = () => {
    layoutIdxRef.current = (layoutIdxRef.current + 1) % LAYOUTS.length
    runLayout()
    showToast('레이아웃: ' + LAYOUTS[layoutIdxRef.current])
  }

  const handleFullGraph = useCallback(() => {
    if (!ontology) return
    const nodes = new Map()
    const edges = []

    Object.values(ontology.classes).forEach(cls => {
      nodes.set(cls.uri, { data: { id: cls.uri, label: getDisplayName(cls) } })
      cls.superClasses.forEach(sup => {
        if (ontology.classes[sup]) {
          if (!nodes.has(sup))
            nodes.set(sup, { data: { id: sup, label: getDisplayName(ontology.classes[sup]) } })
          edges.push({ data: { id: `sub_${cls.uri}_${sup}`, source: cls.uri, target: sup, label: '' }, classes: 'subclass' })
        }
      })
    })

    Object.values(ontology.objectProperties).forEach(p => {
      p.domains.forEach(d =>
        p.ranges.forEach(r => {
          if (ontology.classes[d] && ontology.classes[r]) {
            edges.push({ data: { id: `op_${p.uri}_${d}_${r}`, source: d, target: r, label: getDisplayName(p) } })
          }
        })
      )
    })

    const cy = cyRef.current
    cy.elements().remove()
    cy.add([...nodes.values(), ...edges])
    cy.layout({
      name: 'cose',
      animate: true,
      animationDuration: 500,
      padding: 50,
      nodeRepulsion: 9000,
      idealEdgeLength: 140,
      nodeDimensionsIncludeLabels: true,
    }).run()
    showToast('전체 그래프 표시 중')
  }, [ontology])

  const hasGraph = selectedItem !== null

  return (
    <div className="graph-area">
      <div ref={containerRef} id="cy" />

      {!hasGraph && (
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
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#6c8ef5' }} />
          선택 클래스
        </div>
        <div className="legend-item">
          <div className="legend-dot" style={{ background: '#3dd68c' }} />
          연결 클래스
        </div>
        <div className="legend-item">
          <div className="legend-line" style={{ background: '#f0883e' }} />
          Object Property
        </div>
        <div className="legend-item">
          <div className="legend-dashed" style={{ borderColor: '#4a4f6a' }} />
          SubClassOf
        </div>
      </div>
    </div>
  )
}
