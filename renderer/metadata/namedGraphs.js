import rdf from 'rdf-ext'
import { shrink } from '../common/shrink.js'

function namedCounts (dataset) {
  const namedGraphs = rdf.termMap()
  for (const quad of dataset) {
    if (quad.graph) {
      const count = namedGraphs.get(quad.graph)
      const newCount = count !== undefined ? (count + 1) : 1
      namedGraphs.set(quad.graph, newCount)
    }
  }
  return namedGraphs
}

function getLabel (term) {
  if (term.constructor.name === 'DefaultGraph') {
    return 'Default graph'
  }
  return shrink(term.value)
}

function getNamedGraphsCounts (dataset) {
  const namedGraphs = []
  for (const [named, quadsCount] of namedCounts(dataset).entries()) {
    namedGraphs.push({
      namedGraph: named.value,
      namedGraphLabel: getLabel(named),
      quadsCount
    })
  }
  return namedGraphs
}

export { getNamedGraphsCounts }
