import { join, resolve } from "./path"
import { PackageDetails, getPatchDetailsFromCliString } from "./PackageDetails"
import { PackageManager, detectPackageManager } from "./detectPackageManager"
import { readFileSync, existsSync } from "fs-extra"
import { parse as parseYarnLockFile } from "@yarnpkg/lockfile"
import yaml from "yaml"
import findWorkspaceRoot from "find-yarn-workspace-root"
import { getPackageVersion } from "./getPackageVersion"
import { coerceSemVer } from "./coerceSemVer"
import { parseBunLockfile } from "./parseBunLockfile"

export function getPackageResolution({
  packageDetails,
  packageManager,
  appPath,
}: {
  packageDetails: PackageDetails
  packageManager: PackageManager
  appPath: string
}) {
  if (packageManager === "yarn" || packageManager === "bun") {
    const isBun = packageManager === "bun"
    let lockFileName = isBun ? "bun.lockb" : "yarn.lock"
    let lockFilePath = lockFileName

    // For Bun, check for text-based lockfile first
    if (isBun && existsSync("bun.lock")) {
      lockFileName = "bun.lock"
      lockFilePath = lockFileName
    } else if (!existsSync(lockFilePath)) {
      const workspaceRoot = findWorkspaceRoot()
      if (!workspaceRoot) {
        throw new Error(
          `Can't find ${isBun ? "bun.lockb or bun.lock" : lockFileName} file`,
        )
      }

      // For Bun, check for text-based lockfile in workspace root
      if (isBun && existsSync(join(workspaceRoot, "bun.lock"))) {
        lockFileName = "bun.lock"
        lockFilePath = join(workspaceRoot, lockFileName)
      } else {
        lockFilePath = join(workspaceRoot, lockFilePath)
      }
    }

    if (!existsSync(lockFilePath)) {
      throw new Error(
        `Can't find ${isBun ? "bun.lockb or bun.lock" : lockFileName} file`,
      )
    }
    const lockFileString = isBun
      ? parseBunLockfile(lockFilePath)
      : readFileSync(lockFilePath).toString()
    // Define a type for the lockfile entries
    interface LockfileEntry {
      version: string
      resolved?: string
      from?: string
      dependencies?: Record<string, string>
      [key: string]: any
    }

    let appLockFile: Record<string, LockfileEntry>

    if (isBun) {
      try {
        // Parse the JSON string
        const bunLockfile = JSON.parse(lockFileString)

        // For Bun text lockfiles, we need to handle the different structure
        if (bunLockfile.packages) {
          // Create a compatible structure for our existing code
          appLockFile = {} as Record<string, LockfileEntry>

          // Convert the packages entries to the format our code expects
          Object.entries(bunLockfile.packages).forEach(
            ([packageKey, packageValue]) => {
              // Extract the package name from the key (which might be "package-name" or "@scope/package-name")
              let packageName = packageKey

              // packageValue is an array with format [resolvedNameVersion, path, metadata, hash]
              const resolvedNameVersion = (packageValue as [
                string,
                string,
                any,
                string,
              ])[0]

              if (resolvedNameVersion) {
                // The resolved name version is in the format "package-name@version"
                const parts = resolvedNameVersion.split("@")
                let version

                // Handle scoped packages (@scope/package-name)
                if (parts.length > 2 && parts[0] === "") {
                  packageName = `@${parts[1]}`
                  version = parts.slice(2).join("@") // Handle versions with @ in them
                } else {
                  packageName = parts[0]
                  version = parts.slice(1).join("@") // Handle versions with @ in them
                }

                if (packageName && version) {
                  // Create an entry in the format "package@version": { version: "version" }
                  appLockFile[`${packageName}@${version}`] = {
                    version,
                    resolved: resolvedNameVersion,
                  }
                }
              }
            },
          )
        } else if (bunLockfile.workspaces) {
          // Handle workspaces structure
          appLockFile = {} as Record<string, LockfileEntry>

          // First, collect all dependencies from workspaces
          const allDependencies: Record<string, string> = {}
          Object.values(bunLockfile.workspaces).forEach((workspace) => {
            const typedWorkspace = workspace as {
              dependencies?: Record<string, string>
            }
            if (typedWorkspace.dependencies) {
              Object.entries(typedWorkspace.dependencies).forEach(
                ([name, version]) => {
                  allDependencies[name] = version
                },
              )
            }
          })

          // Then create entries for each dependency
          Object.entries(allDependencies).forEach(([name, version]) => {
            appLockFile[`${name}@${version}`] = {
              version,
              resolved: `${name}@${version}`,
            }
          })
        } else {
          // If there's no packages object, just use the parsed JSON
          appLockFile = bunLockfile as Record<string, LockfileEntry>
        }
      } catch (e) {
        console.log(e)
        throw new Error(`Could not parse bun lock file: ${e.message}`)
      }
    } else if (lockFileString.includes("yarn lockfile v1")) {
      const parsedYarnLockFile = parseYarnLockFile(lockFileString)
      if (parsedYarnLockFile.type !== "success") {
        throw new Error(`Could not parse yarn v1 lock file`)
      } else {
        appLockFile = parsedYarnLockFile.object as Record<string, LockfileEntry>
      }
    } else {
      try {
        appLockFile = yaml.parse(lockFileString) as Record<
          string,
          LockfileEntry
        >
      } catch (e) {
        console.log(e)
        throw new Error(`Could not parse yarn v2 lock file`)
      }
    }

    const installedVersion = getPackageVersion(
      join(resolve(appPath, packageDetails.path), "package.json"),
    )

    // Debug logging
    if (isBun) {
      console.log(
        `Looking for package: ${packageDetails.name}@${installedVersion}`,
      )
      console.log(
        `Available packages in lockfile: ${Object.keys(appLockFile).join(
          ", ",
        )}`,
      )
    }

    const entries = Object.entries(appLockFile).filter(([k, v]) => {
      const matches =
        k.startsWith(packageDetails.name + "@") &&
        coerceSemVer(v.version) === coerceSemVer(installedVersion)

      // Debug logging
      if (isBun && k.startsWith(packageDetails.name + "@")) {
        console.log(
          `Found entry: ${k}, version: ${v.version}, installed version: ${installedVersion}, matches: ${matches}`,
        )
      }

      return matches
    })

    const resolutions = entries.map(([_, v]) => {
      return v.resolved || v.version
    })

    if (resolutions.length === 0) {
      // Try a more lenient approach for Bun lockfiles
      if (isBun) {
        console.log(`Trying alternative approach for Bun lockfile...`)
        // Look for the package in the original lockfile structure
        const bunLockfile = JSON.parse(lockFileString)

        if (bunLockfile.packages) {
          // Look for the package directly in the packages object
          for (const [key, value] of Object.entries(bunLockfile.packages)) {
            if (
              (value as [string, any, any, string])[0] &&
              (value as [string, any, any, string])[0].includes(
                `${packageDetails.name}@`,
              )
            ) {
              console.log(
                `Found package in raw lockfile: ${key} -> ${(value as any)[0]}`,
              )
              return (value as [string, any, any, string])[0]
            }
          }
        }

        // Try looking in workspaces
        if (bunLockfile.workspaces) {
          for (const workspace of Object.values(bunLockfile.workspaces)) {
            const typedWorkspace = workspace as {
              dependencies?: Record<string, string>
            }
            if (
              typedWorkspace.dependencies &&
              typedWorkspace.dependencies[packageDetails.name]
            ) {
              const version = typedWorkspace.dependencies[packageDetails.name]
              console.log(
                `Found package in workspace dependencies: ${packageDetails.name}@${version}`,
              )
              return `${packageDetails.name}@${version}`
            }
          }
        }
      }

      throw new Error(
        `\`${packageDetails.pathSpecifier}\`'s installed version is ${installedVersion} but a lockfile entry for it couldn't be found. Your lockfile is likely to be corrupt or you forgot to reinstall your packages.`,
      )
    }

    if (new Set(resolutions).size !== 1) {
      console.log(
        `Ambigious lockfile entries for ${packageDetails.pathSpecifier}. Using version ${installedVersion}`,
      )
      return installedVersion
    }

    if (resolutions[0]) {
      return resolutions[0]
    }

    const resolution = entries[0][0].slice(packageDetails.name.length + 1)

    // resolve relative file path
    if (resolution.startsWith("file:.")) {
      return `file:${resolve(appPath, resolution.slice("file:".length))}`
    }

    if (resolution.startsWith("npm:")) {
      return resolution.replace("npm:", "")
    }

    return resolution
  } else {
    const lockfile = require(join(
      appPath,
      packageManager === "npm-shrinkwrap"
        ? "npm-shrinkwrap.json"
        : "package-lock.json",
    ))
    const lockFileStack = [lockfile]
    for (const name of packageDetails.packageNames.slice(0, -1)) {
      const child = lockFileStack[0].dependencies
      if (child && name in child) {
        lockFileStack.push(child[name])
      }
    }
    lockFileStack.reverse()
    const relevantStackEntry = lockFileStack.find((entry) => {
      if (entry.dependencies) {
        return entry.dependencies && packageDetails.name in entry.dependencies
      } else if (entry.packages) {
        return entry.packages && packageDetails.path in entry.packages
      }
      throw new Error("Cannot find dependencies or packages in lockfile")
    })
    const pkg = relevantStackEntry.dependencies
      ? relevantStackEntry.dependencies[packageDetails.name]
      : relevantStackEntry.packages[packageDetails.path]
    return pkg.resolved || pkg.version || pkg.from
  }
}

if (require.main === module) {
  const packageDetails = getPatchDetailsFromCliString(process.argv[2])
  if (!packageDetails) {
    console.log(`Can't find package ${process.argv[2]}`)
    process.exit(1)
  }
  console.log(
    getPackageResolution({
      appPath: process.cwd(),
      packageDetails,
      packageManager: detectPackageManager(process.cwd(), null),
    }),
  )
}
