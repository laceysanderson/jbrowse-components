import { ServerSideRendererType } from '../../pluggableElementTypes'
import {
  RenderArgs as ServerSideRenderArgs,
  RenderArgsSerialized as ServerSideRenderArgsSerialized,
} from '../../pluggableElementTypes/renderers/ServerSideRendererType'
import { Region } from '../../util'

export interface RenderArgs extends ServerSideRenderArgs {
  adapterConfig: {}
  rendererType: string
}

export interface RenderArgsSerialized extends ServerSideRenderArgsSerialized {
  assemblyName: string
  regions: Region[]
  adapterConfig: {}
  rendererType: string
}

export function validateRendererType<T>(
  rendererType: string,
  RendererType: T,
): ServerSideRendererType {
  if (!RendererType) {
    throw new Error(`renderer "${rendererType}" not found`)
  }
  // @ts-expect-error
  if (!RendererType.ReactComponent) {
    throw new Error(
      `renderer ${rendererType} has no ReactComponent, it may not be completely implemented yet`,
    )
  }
  return RendererType as unknown as ServerSideRendererType
}

export {
  type RenderResults,
  type ResultsSerialized,
} from '../../pluggableElementTypes/renderers/ServerSideRendererType'
