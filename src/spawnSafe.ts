import { sync as spawnSync } from "cross-spawn"
import { SpawnOptions } from "child_process"

export interface SpawnSafeOptions extends SpawnOptions {
  throwOnError?: boolean
  logStdErrOnError?: boolean
  maxBuffer?: number
}

const defaultOptions: SpawnSafeOptions = {
  logStdErrOnError: true,
  throwOnError: true,
}

export const spawnSafeSync = (
  command: string,
  args?: string[],
  options?: SpawnSafeOptions,
) => {
  const mergedOptions = Object.assign({}, defaultOptions, options)
  const result = spawnSync(command, args, options)
  if (result.error || result.status !== 0) {
    if (mergedOptions.logStdErrOnError) {
      console.log(`Command failed: ${command} ${args ? args.join(" ") : ""}`)
      if (result.stderr) {
        console.log(result.stderr.toString())
      } else if (result.error) {
        console.log(result.error)
      }
      if (result.stdout) {
        console.log(result.stdout.toString())
      }
    }
    if (mergedOptions.throwOnError) {
      throw result
    }
  }
  return result
}
