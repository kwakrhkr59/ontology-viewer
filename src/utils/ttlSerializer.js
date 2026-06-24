const STD = {
  rdf:  'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl:  'http://www.w3.org/2002/07/owl#',
  xsd:  'http://www.w3.org/2001/XMLSchema#',
}

const CHAR_TYPES = {
  Functional:        'owl:FunctionalProperty',
  InverseFunctional: 'owl:InverseFunctionalProperty',
  Transitive:        'owl:TransitiveProperty',
  Symmetric:         'owl:SymmetricProperty',
  Asymmetric:        'owl:AsymmetricProperty',
  Reflexive:         'owl:ReflexiveProperty',
  Irreflexive:       'owl:IrreflexiveProperty',
}

function shorten(uri, allPfx) {
  for (const [p, ns] of Object.entries(allPfx)) {
    if (uri.startsWith(ns)) {
      const local = uri.slice(ns.length)
      return p === '' ? `:${local}` : `${p}:${local}`
    }
  }
  return `<${uri}>`
}

function lit(value, lang) {
  const e = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '')
  return lang ? `"${e}"@${lang}` : `"${e}"`
}

function block(out, subj, pairs) {
  if (!pairs.length) return
  out.push(subj)
  pairs.forEach(([pred, obj], i) => {
    out.push(`    ${pred} ${obj}${i < pairs.length - 1 ? ' ;' : ' .'}`)
  })
  out.push('')
}

export function serializeToTTL({ prefixes, classes, objectProperties, dataProperties, annotationProperties }) {
  const allPfx = { ...STD, ...prefixes }
  const s = (uri) => shorten(uri, allPfx)
  const out = []

  // Standard prefix declarations
  for (const [p, ns] of Object.entries(STD)) {
    out.push(`@prefix ${p}: <${ns}> .`)
  }
  // Custom prefix declarations
  for (const [p, ns] of Object.entries(prefixes)) {
    if (!STD[p]) out.push(`@prefix ${p || ''}: <${ns}> .`)
  }
  out.push('')

  // Classes
  for (const cls of Object.values(classes)) {
    const pairs = [['a', 'owl:Class']]
    cls.labels.forEach(l => pairs.push(['rdfs:label', lit(l.value, l.lang)]))
    cls.comments.forEach(c => pairs.push(['rdfs:comment', lit(c.value, c.lang)]))
    cls.superClasses.forEach(sup => pairs.push(['rdfs:subClassOf', s(sup)]))
    block(out, s(cls.uri), pairs)
  }

  // Object Properties
  for (const prop of Object.values(objectProperties)) {
    const types = ['owl:ObjectProperty', ...prop.characteristics.map(c => CHAR_TYPES[c]).filter(Boolean)]
    const pairs = types.map(t => ['a', t])
    prop.labels.forEach(l => pairs.push(['rdfs:label', lit(l.value, l.lang)]))
    prop.comments.forEach(c => pairs.push(['rdfs:comment', lit(c.value, c.lang)]))
    prop.domains.forEach(d => pairs.push(['rdfs:domain', s(d)]))
    prop.ranges.forEach(r => pairs.push(['rdfs:range', s(r)]))
    prop.inverseOf.forEach(inv => pairs.push(['owl:inverseOf', s(inv)]))
    block(out, s(prop.uri), pairs)
  }

  // Data Properties
  for (const prop of Object.values(dataProperties)) {
    const pairs = [['a', 'owl:DatatypeProperty']]
    prop.labels.forEach(l => pairs.push(['rdfs:label', lit(l.value, l.lang)]))
    prop.comments.forEach(c => pairs.push(['rdfs:comment', lit(c.value, c.lang)]))
    prop.domains.forEach(d => pairs.push(['rdfs:domain', s(d)]))
    prop.ranges.forEach(r => pairs.push(['rdfs:range', s(r)]))
    block(out, s(prop.uri), pairs)
  }

  // Annotation Properties
  for (const prop of Object.values(annotationProperties)) {
    const pairs = [['a', 'owl:AnnotationProperty']]
    prop.labels.forEach(l => pairs.push(['rdfs:label', lit(l.value, l.lang)]))
    prop.comments.forEach(c => pairs.push(['rdfs:comment', lit(c.value, c.lang)]))
    prop.domains.forEach(d => pairs.push(['rdfs:domain', s(d)]))
    prop.ranges.forEach(r => pairs.push(['rdfs:range', s(r)]))
    block(out, s(prop.uri), pairs)
  }

  return out.join('\n')
}
