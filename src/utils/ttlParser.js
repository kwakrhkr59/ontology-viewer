import { Parser, Store } from 'n3'

const R = {
  type:        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  label:       'http://www.w3.org/2000/01/rdf-schema#label',
  comment:     'http://www.w3.org/2000/01/rdf-schema#comment',
  subClassOf:  'http://www.w3.org/2000/01/rdf-schema#subClassOf',
  domain:      'http://www.w3.org/2000/01/rdf-schema#domain',
  range:       'http://www.w3.org/2000/01/rdf-schema#range',
  Class:       'http://www.w3.org/2002/07/owl#Class',
  rdfsClass:   'http://www.w3.org/2000/01/rdf-schema#Class',
  ObjProp:     'http://www.w3.org/2002/07/owl#ObjectProperty',
  DataProp:    'http://www.w3.org/2002/07/owl#DatatypeProperty',
  AnnProp:     'http://www.w3.org/2002/07/owl#AnnotationProperty',
  inverseOf:   'http://www.w3.org/2002/07/owl#inverseOf',
  Functional:  'http://www.w3.org/2002/07/owl#FunctionalProperty',
  InvFunc:     'http://www.w3.org/2002/07/owl#InverseFunctionalProperty',
  Transitive:  'http://www.w3.org/2002/07/owl#TransitiveProperty',
  Symmetric:   'http://www.w3.org/2002/07/owl#SymmetricProperty',
  Asymmetric:  'http://www.w3.org/2002/07/owl#AsymmetricProperty',
  Reflexive:   'http://www.w3.org/2002/07/owl#ReflexiveProperty',
  Irreflexive: 'http://www.w3.org/2002/07/owl#IrreflexiveProperty',
}

export function parseTTLText(text) {
  const store = new Store()
  const prefixes = {}
  let parseError = null

  const parser = new Parser()
  parser.parse(text, (err, quad, pfxs) => {
    if (err) { parseError = err; return }
    if (quad) {
      store.addQuad(quad)
    } else if (pfxs) {
      Object.entries(pfxs).forEach(([p, ns]) => {
        if (p !== null && p !== undefined && p !== '') {
          prefixes[p] = typeof ns === 'string' ? ns : ns.value
        }
      })
    }
  })

  if (parseError) throw new Error('TTL 파싱 오류: ' + parseError.message)

  const vals = (subj, pred) =>
    store.getQuads(subj, pred, null).map(q => q.object.value)

  const hasType = (subj, type) =>
    store.countQuads(subj, R.type, type) > 0

  // ── Classes ──────────────────────────────────────────────
  const classUris = new Set()
  store.getQuads(null, R.type, R.Class).forEach(q => classUris.add(q.subject.value))
  store.getQuads(null, R.type, R.rdfsClass).forEach(q => classUris.add(q.subject.value))
  store.getQuads(null, R.subClassOf, null).forEach(q => {
    if (!q.subject.value.startsWith('_:')) classUris.add(q.subject.value)
    if (!q.object.value.startsWith('_:') && q.object.termType !== 'BlankNode') classUris.add(q.object.value)
  })

  const classes = {}
  classUris.forEach(uri => {
    if (uri.startsWith('_:')) return
    classes[uri] = {
      uri,
      labels:       vals(uri, R.label),
      comments:     vals(uri, R.comment),
      superClasses: vals(uri, R.subClassOf).filter(v => !v.startsWith('_:')),
      subClasses:   [],
      outObjProps:  [],
      inObjProps:   [],
      dataProps:    [],
    }
  })

  Object.values(classes).forEach(cls => {
    cls.superClasses.forEach(sup => {
      if (classes[sup]) classes[sup].subClasses.push(cls.uri)
    })
  })

  // ── Object Properties ─────────────────────────────────────
  const objectProperties = {}
  store.getQuads(null, R.type, R.ObjProp).forEach(q => {
    const uri = q.subject.value
    if (uri.startsWith('_:')) return
    const chars = []
    if (hasType(uri, R.Functional))  chars.push('Functional')
    if (hasType(uri, R.InvFunc))     chars.push('InverseFunctional')
    if (hasType(uri, R.Transitive))  chars.push('Transitive')
    if (hasType(uri, R.Symmetric))   chars.push('Symmetric')
    if (hasType(uri, R.Asymmetric))  chars.push('Asymmetric')
    if (hasType(uri, R.Reflexive))   chars.push('Reflexive')
    if (hasType(uri, R.Irreflexive)) chars.push('Irreflexive')
    const domains = vals(uri, R.domain).filter(v => !v.startsWith('_:'))
    const ranges  = vals(uri, R.range).filter(v => !v.startsWith('_:'))
    objectProperties[uri] = {
      uri,
      labels:          vals(uri, R.label),
      comments:        vals(uri, R.comment),
      domains,
      ranges,
      inverseOf:       vals(uri, R.inverseOf),
      characteristics: chars,
    }
    domains.forEach(d => { if (classes[d]) classes[d].outObjProps.push(uri) })
    ranges.forEach(r  => { if (classes[r]) classes[r].inObjProps.push(uri) })
  })

  // ── Data Properties ───────────────────────────────────────
  const dataProperties = {}
  store.getQuads(null, R.type, R.DataProp).forEach(q => {
    const uri = q.subject.value
    if (uri.startsWith('_:')) return
    const domains = vals(uri, R.domain).filter(v => !v.startsWith('_:'))
    dataProperties[uri] = {
      uri,
      labels:   vals(uri, R.label),
      comments: vals(uri, R.comment),
      domains,
      ranges:   vals(uri, R.range),
    }
    domains.forEach(d => { if (classes[d]) classes[d].dataProps.push(uri) })
  })

  // ── Annotation Properties ─────────────────────────────────
  const annotationProperties = {}
  store.getQuads(null, R.type, R.AnnProp).forEach(q => {
    const uri = q.subject.value
    if (uri.startsWith('_:')) return
    annotationProperties[uri] = {
      uri,
      labels:   vals(uri, R.label),
      comments: vals(uri, R.comment),
      domains:  vals(uri, R.domain).filter(v => !v.startsWith('_:')),
      ranges:   vals(uri, R.range),
    }
  })

  return { prefixes, classes, objectProperties, dataProperties, annotationProperties }
}

export function localName(uri) {
  const parts = uri.split(/[#\/]/)
  return parts[parts.length - 1] || uri
}

export function shorten(uri, prefixes) {
  if (prefixes) {
    for (const [p, ns] of Object.entries(prefixes)) {
      if (uri.startsWith(ns)) return `${p}:${uri.slice(ns.length)}`
    }
  }
  return localName(uri)
}

export function getDisplayName(item) {
  return item.labels[0] || localName(item.uri)
}

export function getNsPrefix(uri, prefixes) {
  if (prefixes) {
    for (const [p, ns] of Object.entries(prefixes)) {
      if (uri.startsWith(ns)) return p
    }
  }
  const m = uri.match(/^(.+[#\/])[^#\/]+$/)
  if (m) return m[1]
  return '(default)'
}
