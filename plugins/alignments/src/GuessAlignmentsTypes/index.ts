import PluginManager from '@jbrowse/core/PluginManager'
import { FileLocation } from '@jbrowse/core/util/types'
import {
  makeIndex,
  makeIndexType,
  getFileName,
  AdapterGuesser,
  TrackTypeGuesser,
} from '@jbrowse/core/util/tracks'

export default function GuessAlignmentsTypesF(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const regexGuess = /\.cram$/i
        const adapterName = 'CramAdapter'
        const fileName = getFileName(file)
        const obj = {
          type: adapterName,
          cramLocation: file,
          craiLocation: index || makeIndex(file, '.crai'),
        }
        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        } else if (adapterHint === adapterName) {
          return obj
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )

  pluginManager.addToExtensionPoint(
    'Core-guessAdapterForLocation',
    (adapterGuesser: AdapterGuesser) => {
      return (
        file: FileLocation,
        index?: FileLocation,
        adapterHint?: string,
      ) => {
        const regexGuess = /\.bam$/i
        const adapterName = 'BamAdapter'
        const fileName = getFileName(file)
        const indexName = index && getFileName(index)

        const obj = {
          type: adapterName,
          bamLocation: file,
          index: {
            location: index || makeIndex(file, '.bai'),
            indexType: makeIndexType(indexName, 'CSI', 'BAI'),
          },
        }
        if (regexGuess.test(fileName) && !adapterHint) {
          return obj
        } else if (adapterHint === adapterName) {
          return obj
        }
        return adapterGuesser(file, index, adapterHint)
      }
    },
  )
  pluginManager.addToExtensionPoint(
    'Core-guessTrackTypeForLocation',
    (trackTypeGuesser: TrackTypeGuesser) => {
      return (adapterName: string) => {
        if (adapterName === 'BamAdapter' || adapterName === 'CramAdapter') {
          return 'AlignmentsTrack'
        }
        return trackTypeGuesser(adapterName)
      }
    },
  )
}
