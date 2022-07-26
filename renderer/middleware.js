import {
  render as renderWebComponent
} from '@lit-labs/ssr/lib/render-with-global-dom-shim.js'
import rdf from 'rdf-ext'
import {
  TrifidResourceDescription
} from './web-component/TrifidResourceDescription.js'
import { LabelLoader } from './labelLoader.js'

const DEFAULTS = {
  compactMode: true,
  technicalCues: true,
  preferredLanguages: ['en', 'fr', 'de', 'it'],
  highlightLanguage: 'en',
  embedBlankNodes: true,
  embedNamedNodes: false,
  embedLists: true,
  debug: false,
  maxLevel: 3,
  showNamedGraphs: true
}

function toBoolean (val) {
  if (val === 'false') {
    return false
  }
  if (val === 'true') {
    return true
  }
  return undefined
}

/**
 * Render HTML.
 *
 * @param {*} req Express request.
 * @param {*} graph Graph from a handler (JSON object).
 * @returns {function(*, *): Promise<string>} Rendered output as string.
 */
function createRenderer ({ options = {} }) {
  return async (req, { dataset }) => {
    const rendererConfig = Object.assign({}, DEFAULTS, options)

    // Honor parameters in the request
    if (req.query.compactMode !== undefined) {
      rendererConfig.compactMode = toBoolean(req.query.compactMode)
    }

    if (req.query.technicalCues !== undefined) {
      rendererConfig.technicalCues = toBoolean(req.query.technicalCues)
    }

    if (req.query.embedNamedNodes !== undefined) {
      rendererConfig.embedNamedNodes = toBoolean(req.query.embedNamedNodes)
    }

    if (req.query.embedBlankNodes !== undefined) {
      rendererConfig.embedBlankNodes = toBoolean(req.query.embedBlankNodes)
    }

    if (req.query.embedLists !== undefined) {
      rendererConfig.embedLists = toBoolean(req.query.embedLists)
    }

    if (req.query.maxLevel !== undefined) {
      rendererConfig.maxLevel = parseInt(req.query.maxLevel)
    }

    if (req.query.debug !== undefined) {
      rendererConfig.debug = toBoolean(req.query.debug)
    }

    if (req.query.showNamedGraphs !== undefined) {
      rendererConfig.showNamedGraphs = toBoolean(req.query.showNamedGraphs)
    }

    if (req.query.lang) {
      rendererConfig.preferredLanguages = [
        req.query.lang, ...DEFAULTS.preferredLanguages]
    }

    if (req.query.highlightLanguage !== undefined) {
      rendererConfig.highlightLanguage = req.query.highlightLanguage
    }

    if (!rendererConfig.highlightLanguage) {
      rendererConfig.highlightLanguage = rendererConfig.preferredLanguages[0]
    }

    if (rendererConfig.compactMode !== undefined) {
      rendererConfig.groupValuesByProperty = rendererConfig.compactMode
      rendererConfig.groupPropertiesByValue = rendererConfig.compactMode
    }

    const term = rdf.namedNode(req.iri)
    const foundQuad = [...dataset].find(quad => quad.subject.equals(term))
    const cf = rdf.clownface({ dataset, term: foundQuad ? term : undefined })

    rendererConfig.metadata = {}

    const externalLabels = rdf.clownface({ dataset: rdf.dataset() })
    // If a labelLoader is configured, try to fetch the labels
    if (options.labelLoader) {
      const endpoint = options.labelLoader.endpointUrl || '/query'
      const endpointUrl = new URL(endpoint, req.absoluteUrl())

      // Add to the metadata
      rendererConfig.metadata['SPARQL endpoint:'] = rdf.namedNode(
        `${endpointUrl}`)

      const labelLoader = new LabelLoader(
        { ...options.labelLoader, endpointUrl })
      const quadChunks = await labelLoader.tryFetchAll(cf)
      const labelQuads = quadChunks.filter(notNull => notNull).flat()
      externalLabels.dataset.addAll(labelQuads)
    }
    rendererConfig.externalLabels = externalLabels

    const resourceWebComponent = TrifidResourceDescription(cf, rendererConfig)
    const stringIterator = renderWebComponent(resourceWebComponent)

    return Array.from(stringIterator).join('')
  }
}

export { createRenderer }
