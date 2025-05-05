import { spawnSync } from "child_process"
import { readFileSync, existsSync } from "fs-extra"
import { join, dirname } from "./path"
import JSON5 from "json5"

// Adapted from https://github.com/oven-sh/bun/blob/ffe4f561a3af53b9f5a41c182de55d7199b5d692/packages/bun-vscode/src/features/lockfile.ts#L39,
// rewritten to use spawnSync instead of spawn.
export function parseBunLockfile(lockFilePath: string): string {
  // Check if the file is a text-based lockfile (bun.lock)
  if (lockFilePath.endsWith(".lock")) {
    const content = readFileSync(lockFilePath, "utf8")
    try {
      // Parse with JSON5 and stringify with standard JSON to ensure compatibility
      const parsed = JSON5.parse(content)
      return JSON.stringify(parsed)
    } catch (e) {
      console.error(`Error parsing bun.lock file: ${e.message}`)
      // Return the raw content as a fallback
      return content
    }
  }

  // Check if there's a text-based lockfile in the same directory
  const lockDir = dirname(lockFilePath)
  const textLockfilePath = join(lockDir, "bun.lock")
  if (existsSync(textLockfilePath)) {
    const content = readFileSync(textLockfilePath, "utf8")
    try {
      // Parse with JSON5 and stringify with standard JSON to ensure compatibility
      const parsed = JSON5.parse(content)
      return JSON.stringify(parsed)
    } catch (e) {
      console.error(`Error parsing bun.lock file: ${e.message}`)
      // Return the raw content as a fallback
      return content
    }
  }

  // Otherwise, use bun CLI to parse the binary lockfile
  const process = spawnSync("bun", [lockFilePath], {
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (process.status !== 0) {
    throw new Error(
      `Bun exited with code: ${process.status}\n${process.stderr.toString()}`,
    )
  }
  return process.stdout.toString()
}
