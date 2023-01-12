import {
  render as renderWebComponent,
} from '@lit-labs/ssr/lib/render-with-global-dom-shim.js'
import {
  DEFAULT_LABEL_PROPERTIES,
} from 'rdf-entity-webcomponent/src/builder/entityBuilder.js'
import { getLabel } from 'rdf-entity-webcomponent/src/builder/labels.js'
import { ns } from 'rdf-entity-webcomponent/src/namespaces.js'
import rdf from 'rdf-ext'
import { LabelLoader } from './labels/labelLoader.js'
import {
  TrifidResourceDescription,
} from './web-component/TrifidResourceDescription.js'

const DEFAULTS = {
  compactMode: true,
  technicalCues: true,
  simplifiedMode: false,
  showImages: true,
  labelProperties: DEFAULT_LABEL_PROPERTIES,
  preferredLanguages: ['en', 'fr', 'de', 'it'],
  highlightLanguage: 'en',
  embedBlankNodes: true,
  embedNamedNodes: false,
  embedLists: true,
  debug: false,
  maxLevel: 3,
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
function createEntityRenderer ({ options = {} }) {
  return async (req, { dataset }) => {
    const rendererConfig = { ...DEFAULTS, ...options }

    // Honor parameters in the request
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

    if (req.query.compactMode !== undefined) {
      rendererConfig.compactMode = toBoolean(req.query.compactMode)
    }

    if (rendererConfig.compactMode !== undefined) {
      rendererConfig.groupValuesByProperty = rendererConfig.compactMode
      rendererConfig.groupPropertiesByValue = rendererConfig.compactMode
    }

    if (req.query.simplifiedMode !== undefined) {
      rendererConfig.simplifiedMode = toBoolean(req.query.simplifiedMode)
    }

    if (rendererConfig.simplifiedMode) {
      rendererConfig.ignoreProperties = rdf.termSet(
        [ns.rdf.type, ...DEFAULT_LABEL_PROPERTIES])
    }

    // rendererConfig.showImages = true

    const term = rdf.namedNode(req.iri)
    const foundQuad = [...dataset].find(quad => quad.subject.equals(term))
    const cf = rdf.clownface({ dataset, term: foundQuad ? term : undefined })

    rendererConfig.metadata = {}

    const externalLabels = rdf.clownface({ dataset: rdf.dataset() })
    // If a labelLoader is configured, try to fetch the labels
    if (options.labelLoader) {
      const endpoint = options.labelLoader.endpointUrl || '/query'
      const endpointUrl = new URL(endpoint, req.absoluteUrl())

      const labelLoader = new LabelLoader(
        { ...options.labelLoader, endpointUrl })
      const quadChunks = await labelLoader.tryFetchAll(cf)
      const labelQuads = quadChunks.filter(notNull => notNull).flat()
      externalLabels.dataset.addAll(labelQuads)
    }
    rendererConfig.externalLabels = externalLabels

    const resourceWebComponent = TrifidResourceDescription(cf, rendererConfig)
    const stringIterator = renderWebComponent(resourceWebComponent)
    const entityHtml = Array.from(stringIterator).join('')

    const entityLabel = cf.term ? getLabel(cf, rendererConfig)?.value : ''
    const entityUrl = cf.term?.value

    return {
      entityHtml,
      entityLabel,
      entityUrl
    }
  }
}

export { createEntityRenderer }
