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

function extractPrefixes(text) {
  const prefixes = {}
  // matches both @prefix and PREFIX (SPARQL style)
  const re = /(?:@prefix|PREFIX)\s+(\w*)\s*:\s*<([^>]+)>/gi
  let m
  while ((m = re.exec(text)) !== null) {
    if (m[1] !== undefined) prefixes[m[1]] = m[2]
  }
  return prefixes
}

export function parseTTLText(text) {
  const prefixes = extractPrefixes(text)

  // Use the synchronous API: parse(string) → Quad[]
  const parser = new Parser()
  let quads
  try {
    quads = parser.parse(text)
  } catch (err) {
    throw new Error('TTL 파싱 오류: ' + err.message)
  }

  const store = new Store()
  store.addQuads(quads)

  const vals = (subj, pred) =>
    store.getQuads(subj, pred, null, null).map(q => q.object.value)

  const labelVals = (subj, pred) =>
    store.getQuads(subj, pred, null, null).map(q => ({
      value: q.object.value,
      lang: q.object.language || '',
    }))

  const hasType = (subj, type) =>
    store.countQuads(subj, R.type, type, null) > 0

  // ── Classes ──────────────────────────────────────────────
  const classUris = new Set()
  store.getQuads(null, R.type, R.Class, null).forEach(q => classUris.add(q.subject.value))
  store.getQuads(null, R.type, R.rdfsClass, null).forEach(q => classUris.add(q.subject.value))
  store.getQuads(null, R.subClassOf, null, null).forEach(q => {
    if (!q.subject.value.startsWith('_:')) classUris.add(q.subject.value)
    if (q.object.termType === 'NamedNode') classUris.add(q.object.value)
  })

  const classes = {}
  classUris.forEach(uri => {
    if (uri.startsWith('_:')) return
    classes[uri] = {
      uri,
      labels:       labelVals(uri, R.label),
      comments:     labelVals(uri, R.comment),
      superClasses: store.getQuads(uri, R.subClassOf, null, null)
        .filter(q => q.object.termType === 'NamedNode')
        .map(q => q.object.value),
      subClasses:  [],
      outObjProps: [],
      inObjProps:  [],
      dataProps:   [],
    }
  })

  Object.values(classes).forEach(cls => {
    cls.superClasses.forEach(sup => {
      if (classes[sup]) classes[sup].subClasses.push(cls.uri)
    })
  })

  // ── Object Properties ─────────────────────────────────────
  const objectProperties = {}
  store.getQuads(null, R.type, R.ObjProp, null).forEach(q => {
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
    const domains = store.getQuads(uri, R.domain, null, null)
      .filter(q2 => q2.object.termType === 'NamedNode')
      .map(q2 => q2.object.value)
    const ranges = store.getQuads(uri, R.range, null, null)
      .filter(q2 => q2.object.termType === 'NamedNode')
      .map(q2 => q2.object.value)
    objectProperties[uri] = {
      uri,
      labels:          labelVals(uri, R.label),
      comments:        labelVals(uri, R.comment),
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
  store.getQuads(null, R.type, R.DataProp, null).forEach(q => {
    const uri = q.subject.value
    if (uri.startsWith('_:')) return
    const domains = store.getQuads(uri, R.domain, null, null)
      .filter(q2 => q2.object.termType === 'NamedNode')
      .map(q2 => q2.object.value)
    dataProperties[uri] = {
      uri,
      labels:   labelVals(uri, R.label),
      comments: labelVals(uri, R.comment),
      domains,
      ranges:   vals(uri, R.range),
    }
    domains.forEach(d => { if (classes[d]) classes[d].dataProps.push(uri) })
  })

  // ── Annotation Properties ─────────────────────────────────
  const annotationProperties = {}
  store.getQuads(null, R.type, R.AnnProp, null).forEach(q => {
    const uri = q.subject.value
    if (uri.startsWith('_:')) return
    annotationProperties[uri] = {
      uri,
      labels:   labelVals(uri, R.label),
      comments: labelVals(uri, R.comment),
      domains:  store.getQuads(uri, R.domain, null, null)
        .filter(q2 => q2.object.termType === 'NamedNode')
        .map(q2 => q2.object.value),
      ranges:   vals(uri, R.range),
    }
  })

  console.log('[OntologyViewer] parsed:', {
    prefixes: Object.keys(prefixes).length,
    classes: Object.keys(classes).length,
    objectProperties: Object.keys(objectProperties).length,
    dataProperties: Object.keys(dataProperties).length,
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

export function getDisplayName(item, lang = '') {
  const { labels } = item
  if (!labels.length) return localName(item.uri)
  if (lang) {
    const match = labels.find(l => l.lang === lang)
    if (match) return match.value
  }
  const noLang = labels.find(l => !l.lang)
  return noLang ? noLang.value : labels[0].value
}

export function getAvailableLangs(ontology) {
  const langs = new Set()
  const allItems = [
    ...Object.values(ontology.classes),
    ...Object.values(ontology.objectProperties),
    ...Object.values(ontology.dataProperties),
    ...Object.values(ontology.annotationProperties),
  ]
  allItems.forEach(item =>
    item.labels.forEach(l => { if (l.lang) langs.add(l.lang) })
  )
  return langs
}

export function getComments(item, lang = '') {
  const { comments } = item
  if (!comments.length) return []
  if (lang) {
    const matches = comments.filter(c => c.lang === lang)
    if (matches.length) return matches.map(c => c.value)
  }
  const noLang = comments.filter(c => !c.lang)
  if (noLang.length) return noLang.map(c => c.value)
  return comments.map(c => c.value)
}

export function getNsPrefix(uri, prefixes) {
  if (prefixes) {
    for (const [p, ns] of Object.entries(prefixes)) {
      if (uri.startsWith(ns)) return p || ns
    }
  }
  const m = uri.match(/^(.+[#\/])[^#\/]+$/)
  return m ? m[1] : '(default)'
}
