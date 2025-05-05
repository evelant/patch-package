"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPackageResolution = void 0;
const path_1 = require("./path");
const PackageDetails_1 = require("./PackageDetails");
const detectPackageManager_1 = require("./detectPackageManager");
const fs_extra_1 = require("fs-extra");
const lockfile_1 = require("@yarnpkg/lockfile");
const yaml_1 = __importDefault(require("yaml"));
const find_yarn_workspace_root_1 = __importDefault(require("find-yarn-workspace-root"));
const getPackageVersion_1 = require("./getPackageVersion");
const coerceSemVer_1 = require("./coerceSemVer");
const parseBunLockfile_1 = require("./parseBunLockfile");
function getPackageResolution({ packageDetails, packageManager, appPath, }) {
    if (packageManager === "yarn" || packageManager === "bun") {
        const isBun = packageManager === "bun";
        let lockFileName = isBun ? "bun.lockb" : "yarn.lock";
        let lockFilePath = lockFileName;
        // For Bun, check for text-based lockfile first
        if (isBun && fs_extra_1.existsSync("bun.lock")) {
            lockFileName = "bun.lock";
            lockFilePath = lockFileName;
        }
        else if (!fs_extra_1.existsSync(lockFilePath)) {
            const workspaceRoot = find_yarn_workspace_root_1.default();
            if (!workspaceRoot) {
                throw new Error(`Can't find ${isBun ? "bun.lockb or bun.lock" : lockFileName} file`);
            }
            // For Bun, check for text-based lockfile in workspace root
            if (isBun && fs_extra_1.existsSync(path_1.join(workspaceRoot, "bun.lock"))) {
                lockFileName = "bun.lock";
                lockFilePath = path_1.join(workspaceRoot, lockFileName);
            }
            else {
                lockFilePath = path_1.join(workspaceRoot, lockFilePath);
            }
        }
        if (!fs_extra_1.existsSync(lockFilePath)) {
            throw new Error(`Can't find ${isBun ? "bun.lockb or bun.lock" : lockFileName} file`);
        }
        const lockFileString = isBun
            ? parseBunLockfile_1.parseBunLockfile(lockFilePath)
            : fs_extra_1.readFileSync(lockFilePath).toString();
        let appLockFile;
        if (isBun) {
            try {
                // Parse the JSON string
                const bunLockfile = JSON.parse(lockFileString);
                // For Bun text lockfiles, we need to handle the different structure
                if (bunLockfile.packages) {
                    // Create a compatible structure for our existing code
                    appLockFile = {};
                    // Convert the packages entries to the format our code expects
                    Object.entries(bunLockfile.packages).forEach(([packageKey, packageValue]) => {
                        // Extract the package name from the key (which might be "package-name" or "@scope/package-name")
                        let packageName = packageKey;
                        // packageValue is an array with format [resolvedNameVersion, path, metadata, hash]
                        const resolvedNameVersion = packageValue[0];
                        if (resolvedNameVersion) {
                            // The resolved name version is in the format "package-name@version"
                            const parts = resolvedNameVersion.split("@");
                            let version;
                            // Handle scoped packages (@scope/package-name)
                            if (parts.length > 2 && parts[0] === "") {
                                packageName = `@${parts[1]}`;
                                version = parts.slice(2).join("@"); // Handle versions with @ in them
                            }
                            else {
                                packageName = parts[0];
                                version = parts.slice(1).join("@"); // Handle versions with @ in them
                            }
                            if (packageName && version) {
                                // Create an entry in the format "package@version": { version: "version" }
                                appLockFile[`${packageName}@${version}`] = {
                                    version,
                                    resolved: resolvedNameVersion,
                                };
                            }
                        }
                    });
                }
                else if (bunLockfile.workspaces) {
                    // Handle workspaces structure
                    appLockFile = {};
                    // First, collect all dependencies from workspaces
                    const allDependencies = {};
                    Object.values(bunLockfile.workspaces).forEach((workspace) => {
                        const typedWorkspace = workspace;
                        if (typedWorkspace.dependencies) {
                            Object.entries(typedWorkspace.dependencies).forEach(([name, version]) => {
                                allDependencies[name] = version;
                            });
                        }
                    });
                    // Then create entries for each dependency
                    Object.entries(allDependencies).forEach(([name, version]) => {
                        appLockFile[`${name}@${version}`] = {
                            version,
                            resolved: `${name}@${version}`,
                        };
                    });
                }
                else {
                    // If there's no packages object, just use the parsed JSON
                    appLockFile = bunLockfile;
                }
            }
            catch (e) {
                console.log(e);
                throw new Error(`Could not parse bun lock file: ${e.message}`);
            }
        }
        else if (lockFileString.includes("yarn lockfile v1")) {
            const parsedYarnLockFile = lockfile_1.parse(lockFileString);
            if (parsedYarnLockFile.type !== "success") {
                throw new Error(`Could not parse yarn v1 lock file`);
            }
            else {
                appLockFile = parsedYarnLockFile.object;
            }
        }
        else {
            try {
                appLockFile = yaml_1.default.parse(lockFileString);
            }
            catch (e) {
                console.log(e);
                throw new Error(`Could not parse yarn v2 lock file`);
            }
        }
        const installedVersion = getPackageVersion_1.getPackageVersion(path_1.join(path_1.resolve(appPath, packageDetails.path), "package.json"));
        // Debug logging
        if (isBun) {
            console.log(`Looking for package: ${packageDetails.name}@${installedVersion}`);
            console.log(`Available packages in lockfile: ${Object.keys(appLockFile).join(", ")}`);
        }
        const entries = Object.entries(appLockFile).filter(([k, v]) => {
            const matches = k.startsWith(packageDetails.name + "@") &&
                coerceSemVer_1.coerceSemVer(v.version) === coerceSemVer_1.coerceSemVer(installedVersion);
            // Debug logging
            if (isBun && k.startsWith(packageDetails.name + "@")) {
                console.log(`Found entry: ${k}, version: ${v.version}, installed version: ${installedVersion}, matches: ${matches}`);
            }
            return matches;
        });
        const resolutions = entries.map(([_, v]) => {
            return v.resolved || v.version;
        });
        if (resolutions.length === 0) {
            // Try a more lenient approach for Bun lockfiles
            if (isBun) {
                console.log(`Trying alternative approach for Bun lockfile...`);
                // Look for the package in the original lockfile structure
                const bunLockfile = JSON.parse(lockFileString);
                if (bunLockfile.packages) {
                    // Look for the package directly in the packages object
                    for (const [key, value] of Object.entries(bunLockfile.packages)) {
                        if (value[0] &&
                            value[0].includes(`${packageDetails.name}@`)) {
                            console.log(`Found package in raw lockfile: ${key} -> ${value[0]}`);
                            return value[0];
                        }
                    }
                }
                // Try looking in workspaces
                if (bunLockfile.workspaces) {
                    for (const workspace of Object.values(bunLockfile.workspaces)) {
                        const typedWorkspace = workspace;
                        if (typedWorkspace.dependencies &&
                            typedWorkspace.dependencies[packageDetails.name]) {
                            const version = typedWorkspace.dependencies[packageDetails.name];
                            console.log(`Found package in workspace dependencies: ${packageDetails.name}@${version}`);
                            return `${packageDetails.name}@${version}`;
                        }
                    }
                }
            }
            throw new Error(`\`${packageDetails.pathSpecifier}\`'s installed version is ${installedVersion} but a lockfile entry for it couldn't be found. Your lockfile is likely to be corrupt or you forgot to reinstall your packages.`);
        }
        if (new Set(resolutions).size !== 1) {
            console.log(`Ambigious lockfile entries for ${packageDetails.pathSpecifier}. Using version ${installedVersion}`);
            return installedVersion;
        }
        if (resolutions[0]) {
            return resolutions[0];
        }
        const resolution = entries[0][0].slice(packageDetails.name.length + 1);
        // resolve relative file path
        if (resolution.startsWith("file:.")) {
            return `file:${path_1.resolve(appPath, resolution.slice("file:".length))}`;
        }
        if (resolution.startsWith("npm:")) {
            return resolution.replace("npm:", "");
        }
        return resolution;
    }
    else {
        const lockfile = require(path_1.join(appPath, packageManager === "npm-shrinkwrap"
            ? "npm-shrinkwrap.json"
            : "package-lock.json"));
        const lockFileStack = [lockfile];
        for (const name of packageDetails.packageNames.slice(0, -1)) {
            const child = lockFileStack[0].dependencies;
            if (child && name in child) {
                lockFileStack.push(child[name]);
            }
        }
        lockFileStack.reverse();
        const relevantStackEntry = lockFileStack.find((entry) => {
            if (entry.dependencies) {
                return entry.dependencies && packageDetails.name in entry.dependencies;
            }
            else if (entry.packages) {
                return entry.packages && packageDetails.path in entry.packages;
            }
            throw new Error("Cannot find dependencies or packages in lockfile");
        });
        const pkg = relevantStackEntry.dependencies
            ? relevantStackEntry.dependencies[packageDetails.name]
            : relevantStackEntry.packages[packageDetails.path];
        return pkg.resolved || pkg.version || pkg.from;
    }
}
exports.getPackageResolution = getPackageResolution;
if (require.main === module) {
    const packageDetails = PackageDetails_1.getPatchDetailsFromCliString(process.argv[2]);
    if (!packageDetails) {
        console.log(`Can't find package ${process.argv[2]}`);
        process.exit(1);
    }
    console.log(getPackageResolution({
        appPath: process.cwd(),
        packageDetails,
        packageManager: detectPackageManager_1.detectPackageManager(process.cwd(), null),
    }));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UGFja2FnZVJlc29sdXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ2V0UGFja2FnZVJlc29sdXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsaUNBQXNDO0FBQ3RDLHFEQUErRTtBQUMvRSxpRUFBNkU7QUFDN0UsdUNBQW1EO0FBQ25ELGdEQUE4RDtBQUM5RCxnREFBdUI7QUFDdkIsd0ZBQXdEO0FBQ3hELDJEQUF1RDtBQUN2RCxpREFBNkM7QUFDN0MseURBQXFEO0FBRXJELFNBQWdCLG9CQUFvQixDQUFDLEVBQ25DLGNBQWMsRUFDZCxjQUFjLEVBQ2QsT0FBTyxHQUtSO0lBQ0MsSUFBSSxjQUFjLEtBQUssTUFBTSxJQUFJLGNBQWMsS0FBSyxLQUFLLEVBQUU7UUFDekQsTUFBTSxLQUFLLEdBQUcsY0FBYyxLQUFLLEtBQUssQ0FBQTtRQUN0QyxJQUFJLFlBQVksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFBO1FBQ3BELElBQUksWUFBWSxHQUFHLFlBQVksQ0FBQTtRQUUvQiwrQ0FBK0M7UUFDL0MsSUFBSSxLQUFLLElBQUkscUJBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUNuQyxZQUFZLEdBQUcsVUFBVSxDQUFBO1lBQ3pCLFlBQVksR0FBRyxZQUFZLENBQUE7U0FDNUI7YUFBTSxJQUFJLENBQUMscUJBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUNwQyxNQUFNLGFBQWEsR0FBRyxrQ0FBaUIsRUFBRSxDQUFBO1lBQ3pDLElBQUksQ0FBQyxhQUFhLEVBQUU7Z0JBQ2xCLE1BQU0sSUFBSSxLQUFLLENBQ2IsY0FBYyxLQUFLLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxZQUFZLE9BQU8sQ0FDcEUsQ0FBQTthQUNGO1lBRUQsMkRBQTJEO1lBQzNELElBQUksS0FBSyxJQUFJLHFCQUFVLENBQUMsV0FBSSxDQUFDLGFBQWEs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QUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUE7YUFDL0Q7WUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUE7UUFDckUsQ0FBQyxDQUFDLENBQUE7UUFDRixNQUFNLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxZQUFZO1lBQ3pDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztZQUN0RCxDQUFDLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwRCxPQUFPLEdBQUcsQ0FBQyxRQUFRLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFBO0tBQy9DO0FBQ0gsQ0FBQztBQWxTRCxvREFrU0M7QUFFRCxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFO0lBQzNCLE1BQU0sY0FBYyxHQUFHLDZDQUE0QixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUNwRSxJQUFJLENBQUMsY0FBYyxFQUFFO1FBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO1FBQ3BELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7S0FDaEI7SUFDRCxPQUFPLENBQUMsR0FBRyxDQUNULG9CQUFvQixDQUFDO1FBQ25CLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQ3RCLGNBQWM7UUFDZCxjQUFjLEVBQUUsMkNBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksQ0FBQztLQUMxRCxDQUFDLENBQ0gsQ0FBQTtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgam9pbiwgcmVzb2x2ZSB9IGZyb20gXCIuL3BhdGhcIlxuaW1wb3J0IHsgUGFja2FnZURldGFpbHMsIGdldFBhdGNoRGV0YWlsc0Zyb21DbGlTdHJpbmcgfSBmcm9tIFwiLi9QYWNrYWdlRGV0YWlsc1wiXG5pbXBvcnQgeyBQYWNrYWdlTWFuYWdlciwgZGV0ZWN0UGFja2FnZU1hbmFnZXIgfSBmcm9tIFwiLi9kZXRlY3RQYWNrYWdlTWFuYWdlclwiXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIGV4aXN0c1N5bmMgfSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VZYXJuTG9ja0ZpbGUgfSBmcm9tIFwiQHlhcm5wa2cvbG9ja2ZpbGVcIlxuaW1wb3J0IHlhbWwgZnJvbSBcInlhbWxcIlxuaW1wb3J0IGZpbmRXb3Jrc3BhY2VSb290IGZyb20gXCJmaW5kLXlhcm4td29ya3NwYWNlLXJvb3RcIlxuaW1wb3J0IHsgZ2V0UGFja2FnZVZlcnNpb24gfSBmcm9tIFwiLi9nZXRQYWNrYWdlVmVyc2lvblwiXG5pbXBvcnQgeyBjb2VyY2VTZW1WZXIgfSBmcm9tIFwiLi9jb2VyY2VTZW1WZXJcIlxuaW1wb3J0IHsgcGFyc2VCdW5Mb2NrZmlsZSB9IGZyb20gXCIuL3BhcnNlQnVuTG9ja2ZpbGVcIlxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFja2FnZVJlc29sdXRpb24oe1xuICBwYWNrYWdlRGV0YWlscyxcbiAgcGFja2FnZU1hbmFnZXIsXG4gIGFwcFBhdGgsXG59OiB7XG4gIHBhY2thZ2VEZXRhaWxzOiBQYWNrYWdlRGV0YWlsc1xuICBwYWNrYWdlTWFuYWdlcjogUGFja2FnZU1hbmFnZXJcbiAgYXBwUGF0aDogc3RyaW5nXG59KSB7XG4gIGlmIChwYWNrYWdlTWFuYWdlciA9PT0gXCJ5YXJuXCIgfHwgcGFja2FnZU1hbmFnZXIgPT09IFwiYnVuXCIpIHtcbiAgICBjb25zdCBpc0J1biA9IHBhY2thZ2VNYW5hZ2VyID09PSBcImJ1blwiXG4gICAgbGV0IGxvY2tGaWxlTmFtZSA9IGlzQnVuID8gXCJidW4ubG9ja2JcIiA6IFwieWFybi5sb2NrXCJcbiAgICBsZXQgbG9ja0ZpbGVQYXRoID0gbG9ja0ZpbGVOYW1lXG5cbiAgICAvLyBGb3IgQnVuLCBjaGVjayBmb3IgdGV4dC1iYXNlZCBsb2NrZmlsZSBmaXJzdFxuICAgIGlmIChpc0J1biAmJiBleGlzdHNTeW5jKFwiYnVuLmxvY2tcIikpIHtcbiAgICAgIGxvY2tGaWxlTmFtZSA9IFwiYnVuLmxvY2tcIlxuICAgICAgbG9ja0ZpbGVQYXRoID0gbG9ja0ZpbGVOYW1lXG4gICAgfSBlbHNlIGlmICghZXhpc3RzU3luYyhsb2NrRmlsZVBhdGgpKSB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSb290ID0gZmluZFdvcmtzcGFjZVJvb3QoKVxuICAgICAgaWYgKCF3b3Jrc3BhY2VSb290KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQ2FuJ3QgZmluZCAke2lzQnVuID8gXCJidW4ubG9ja2Igb3IgYnVuLmxvY2tcIiA6IGxvY2tGaWxlTmFtZX0gZmlsZWAsXG4gICAgICAgIClcbiAgICAgIH1cblxuICAgICAgLy8gRm9yIEJ1biwgY2hlY2sgZm9yIHRleHQtYmFzZWQgbG9ja2ZpbGUgaW4gd29ya3NwYWNlIHJvb3RcbiAgICAgIGlmIChpc0J1biAmJiBleGlzdHNTeW5jKGpvaW4od29ya3NwYWNlUm9vdCwgXCJidW4ubG9ja1wiKSkpIHtcbiAgICAgICAgbG9ja0ZpbGVOYW1lID0gXCJidW4ubG9ja1wiXG4gICAgICAgIGxvY2tGaWxlUGF0aCA9IGpvaW4od29ya3NwYWNlUm9vdCwgbG9ja0ZpbGVOYW1lKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbG9ja0ZpbGVQYXRoID0gam9pbih3b3Jrc3BhY2VSb290LCBsb2NrRmlsZVBhdGgpXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCFleGlzdHNTeW5jKGxvY2tGaWxlUGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYENhbid0IGZpbmQgJHtpc0J1biA/IFwiYnVuLmxvY2tiIG9yIGJ1bi5sb2NrXCIgOiBsb2NrRmlsZU5hbWV9IGZpbGVgLFxuICAgICAgKVxuICAgIH1cbiAgICBjb25zdCBsb2NrRmlsZVN0cmluZyA9IGlzQnVuXG4gICAgICA/IHBhcnNlQnVuTG9ja2ZpbGUobG9ja0ZpbGVQYXRoKVxuICAgICAgOiByZWFkRmlsZVN5bmMobG9ja0ZpbGVQYXRoKS50b1N0cmluZygpXG4gICAgLy8gRGVmaW5lIGEgdHlwZSBmb3IgdGhlIGxvY2tmaWxlIGVudHJpZXNcbiAgICBpbnRlcmZhY2UgTG9ja2ZpbGVFbnRyeSB7XG4gICAgICB2ZXJzaW9uOiBzdHJpbmdcbiAgICAgIHJlc29sdmVkPzogc3RyaW5nXG4gICAgICBmcm9tPzogc3RyaW5nXG4gICAgICBkZXBlbmRlbmNpZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gICAgICBba2V5OiBzdHJpbmddOiBhbnlcbiAgICB9XG5cbiAgICBsZXQgYXBwTG9ja0ZpbGU6IFJlY29yZDxzdHJpbmcsIExvY2tmaWxlRW50cnk+XG5cbiAgICBpZiAoaXNCdW4pIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIFBhcnNlIHRoZSBKU09OIHN0cmluZ1xuICAgICAgICBjb25zdCBidW5Mb2NrZmlsZSA9IEpTT04ucGFyc2UobG9ja0ZpbGVTdHJpbmcpXG5cbiAgICAgICAgLy8gRm9yIEJ1biB0ZXh0IGxvY2tmaWxlcywgd2UgbmVlZCB0byBoYW5kbGUgdGhlIGRpZmZlcmVudCBzdHJ1Y3R1cmVcbiAgICAgICAgaWYgKGJ1bkxvY2tmaWxlLnBhY2thZ2VzKSB7XG4gICAgICAgICAgLy8gQ3JlYXRlIGEgY29tcGF0aWJsZSBzdHJ1Y3R1cmUgZm9yIG91ciBleGlzdGluZyBjb2RlXG4gICAgICAgICAgYXBwTG9ja0ZpbGUgPSB7fSBhcyBSZWNvcmQ8c3RyaW5nLCBMb2NrZmlsZUVudHJ5PlxuXG4gICAgICAgICAgLy8gQ29udmVydCB0aGUgcGFja2FnZXMgZW50cmllcyB0byB0aGUgZm9ybWF0IG91ciBjb2RlIGV4cGVjdHNcbiAgICAgICAgICBPYmplY3QuZW50cmllcyhidW5Mb2NrZmlsZS5wYWNrYWdlcykuZm9yRWFjaChcbiAgICAgICAgICAgIChbcGFja2FnZUtleSwgcGFja2FnZVZhbHVlXSkgPT4ge1xuICAgICAgICAgICAgICAvLyBFeHRyYWN0IHRoZSBwYWNrYWdlIG5hbWUgZnJvbSB0aGUga2V5ICh3aGljaCBtaWdodCBiZSBcInBhY2thZ2UtbmFtZVwiIG9yIFwiQHNjb3BlL3BhY2thZ2UtbmFtZVwiKVxuICAgICAgICAgICAgICBsZXQgcGFja2FnZU5hbWUgPSBwYWNrYWdlS2V5XG5cbiAgICAgICAgICAgICAgLy8gcGFja2FnZVZhbHVlIGlzIGFuIGFycmF5IHdpdGggZm9ybWF0IFtyZXNvbHZlZE5hbWVWZXJzaW9uLCBwYXRoLCBtZXRhZGF0YSwgaGFzaF1cbiAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWROYW1lVmVyc2lvbiA9IChwYWNrYWdlVmFsdWUgYXMgW1xuICAgICAgICAgICAgICAgIHN0cmluZyxcbiAgICAgICAgICAgICAgICBzdHJpbmcsXG4gICAgICAgICAgICAgICAgYW55LFxuICAgICAgICAgICAgICAgIHN0cmluZyxcbiAgICAgICAgICAgICAgXSlbMF1cblxuICAgICAgICAgICAgICBpZiAocmVzb2x2ZWROYW1lVmVyc2lvbikge1xuICAgICAgICAgICAgICAgIC8vIFRoZSByZXNvbHZlZCBuYW1lIHZlcnNpb24gaXMgaW4gdGhlIGZvcm1hdCBcInBhY2thZ2UtbmFtZUB2ZXJzaW9uXCJcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHJlc29sdmVkTmFtZVZlcnNpb24uc3BsaXQoXCJAXCIpXG4gICAgICAgICAgICAgICAgbGV0IHZlcnNpb25cblxuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBzY29wZWQgcGFja2FnZXMgKEBzY29wZS9wYWNrYWdlLW5hbWUpXG4gICAgICAgICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA+IDIgJiYgcGFydHNbMF0gPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICAgIHBhY2thZ2VOYW1lID0gYEAke3BhcnRzWzFdfWBcbiAgICAgICAgICAgICAgICAgIHZlcnNpb24gPSBwYXJ0cy5zbGljZSgyKS5qb2luKFwiQFwiKSAvLyBIYW5kbGUgdmVyc2lvbnMgd2l0aCBAIGluIHRoZW1cbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgcGFja2FnZU5hbWUgPSBwYXJ0c1swXVxuICAgICAgICAgICAgICAgICAgdmVyc2lvbiA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oXCJAXCIpIC8vIEhhbmRsZSB2ZXJzaW9ucyB3aXRoIEAgaW4gdGhlbVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChwYWNrYWdlTmFtZSAmJiB2ZXJzaW9uKSB7XG4gICAgICAgICAgICAgICAgICAvLyBDcmVhdGUgYW4gZW50cnkgaW4gdGhlIGZvcm1hdCBcInBhY2thZ2VAdmVyc2lvblwiOiB7IHZlcnNpb246IFwidmVyc2lvblwiIH1cbiAgICAgICAgICAgICAgICAgIGFwcExvY2tGaWxlW2Ake3BhY2thZ2VOYW1lfUAke3ZlcnNpb259YF0gPSB7XG4gICAgICAgICAgICAgICAgICAgIHZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmVkOiByZXNvbHZlZE5hbWVWZXJzaW9uLFxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICApXG4gICAgICAgIH0gZWxzZSBpZiAoYnVuTG9ja2ZpbGUud29ya3NwYWNlcykge1xuICAgICAgICAgIC8vIEhhbmRsZSB3b3Jrc3BhY2VzIHN0cnVjdHVyZVxuICAgICAgICAgIGFwcExvY2tGaWxlID0ge30gYXMgUmVjb3JkPHN0cmluZywgTG9ja2ZpbGVFbnRyeT5cblxuICAgICAgICAgIC8vIEZpcnN0LCBjb2xsZWN0IGFsbCBkZXBlbmRlbmNpZXMgZnJvbSB3b3Jrc3BhY2VzXG4gICAgICAgICAgY29uc3QgYWxsRGVwZW5kZW5jaWVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge31cbiAgICAgICAgICBPYmplY3QudmFsdWVzKGJ1bkxvY2tmaWxlLndvcmtzcGFjZXMpLmZvckVhY2goKHdvcmtzcGFjZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdHlwZWRXb3Jrc3BhY2UgPSB3b3Jrc3BhY2UgYXMge1xuICAgICAgICAgICAgICBkZXBlbmRlbmNpZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZWRXb3Jrc3BhY2UuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgICAgICAgIE9iamVjdC5lbnRyaWVzKHR5cGVkV29ya3NwYWNlLmRlcGVuZGVuY2llcykuZm9yRWFjaChcbiAgICAgICAgICAgICAgICAoW25hbWUsIHZlcnNpb25dKSA9PiB7XG4gICAgICAgICAgICAgICAgICBhbGxEZXBlbmRlbmNpZXNbbmFtZV0gPSB2ZXJzaW9uXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICAvLyBUaGVuIGNyZWF0ZSBlbnRyaWVzIGZvciBlYWNoIGRlcGVuZGVuY3lcbiAgICAgICAgICBPYmplY3QuZW50cmllcyhhbGxEZXBlbmRlbmNpZXMpLmZvckVhY2goKFtuYW1lLCB2ZXJzaW9uXSkgPT4ge1xuICAgICAgICAgICAgYXBwTG9ja0ZpbGVbYCR7bmFtZX1AJHt2ZXJzaW9ufWBdID0ge1xuICAgICAgICAgICAgICB2ZXJzaW9uLFxuICAgICAgICAgICAgICByZXNvbHZlZDogYCR7bmFtZX1AJHt2ZXJzaW9ufWAsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBJZiB0aGVyZSdzIG5vIHBhY2thZ2VzIG9iamVjdCwganVzdCB1c2UgdGhlIHBhcnNlZCBKU09OXG4gICAgICAgICAgYXBwTG9ja0ZpbGUgPSBidW5Mb2NrZmlsZSBhcyBSZWNvcmQ8c3RyaW5nLCBMb2NrZmlsZUVudHJ5PlxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGUpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHBhcnNlIGJ1biBsb2NrIGZpbGU6ICR7ZS5tZXNzYWdlfWApXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChsb2NrRmlsZVN0cmluZy5pbmNsdWRlcyhcInlhcm4gbG9ja2ZpbGUgdjFcIikpIHtcbiAgICAgIGNvbnN0IHBhcnNlZFlhcm5Mb2NrRmlsZSA9IHBhcnNlWWFybkxvY2tGaWxlKGxvY2tGaWxlU3RyaW5nKVxuICAgICAgaWYgKHBhcnNlZFlhcm5Mb2NrRmlsZS50eXBlICE9PSBcInN1Y2Nlc3NcIikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwYXJzZSB5YXJuIHYxIGxvY2sgZmlsZWApXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhcHBMb2NrRmlsZSA9IHBhcnNlZFlhcm5Mb2NrRmlsZS5vYmplY3QgYXMgUmVjb3JkPHN0cmluZywgTG9ja2ZpbGVFbnRyeT5cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXBwTG9ja0ZpbGUgPSB5YW1sLnBhcnNlKGxvY2tGaWxlU3RyaW5nKSBhcyBSZWNvcmQ8XG4gICAgICAgICAgc3RyaW5nLFxuICAgICAgICAgIExvY2tmaWxlRW50cnlcbiAgICAgICAgPlxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmxvZyhlKVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBwYXJzZSB5YXJuIHYyIGxvY2sgZmlsZWApXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaW5zdGFsbGVkVmVyc2lvbiA9IGdldFBhY2thZ2VWZXJzaW9uKFxuICAgICAgam9pbihyZXNvbHZlKGFwcFBhdGgsIHBhY2thZ2VEZXRhaWxzLnBhdGgpLCBcInBhY2thZ2UuanNvblwiKSxcbiAgICApXG5cbiAgICAvLyBEZWJ1ZyBsb2dnaW5nXG4gICAgaWYgKGlzQnVuKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYExvb2tpbmcgZm9yIHBhY2thZ2U6ICR7cGFja2FnZURldGFpbHMubmFtZX1AJHtpbnN0YWxsZWRWZXJzaW9ufWAsXG4gICAgICApXG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYEF2YWlsYWJsZSBwYWNrYWdlcyBpbiBsb2NrZmlsZTogJHtPYmplY3Qua2V5cyhhcHBMb2NrRmlsZSkuam9pbihcbiAgICAgICAgICBcIiwgXCIsXG4gICAgICAgICl9YCxcbiAgICAgIClcbiAgICB9XG5cbiAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoYXBwTG9ja0ZpbGUpLmZpbHRlcigoW2ssIHZdKSA9PiB7XG4gICAgICBjb25zdCBtYXRjaGVzID1cbiAgICAgICAgay5zdGFydHNXaXRoKHBhY2thZ2VEZXRhaWxzLm5hbWUgKyBcIkBcIikgJiZcbiAgICAgICAgY29lcmNlU2VtVmVyKHYudmVyc2lvbikgPT09IGNvZXJjZVNlbVZlcihpbnN0YWxsZWRWZXJzaW9uKVxuXG4gICAgICAvLyBEZWJ1ZyBsb2dnaW5nXG4gICAgICBpZiAoaXNCdW4gJiYgay5zdGFydHNXaXRoKHBhY2thZ2VEZXRhaWxzLm5hbWUgKyBcIkBcIikpIHtcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYEZvdW5kIGVudHJ5OiAke2t9LCB2ZXJzaW9uOiAke3YudmVyc2lvbn0sIGluc3RhbGxlZCB2ZXJzaW9uOiAke2luc3RhbGxlZFZlcnNpb259LCBtYXRjaGVzOiAke21hdGNoZXN9YCxcbiAgICAgICAgKVxuICAgICAgfVxuXG4gICAgICByZXR1cm4gbWF0Y2hlc1xuICAgIH0pXG5cbiAgICBjb25zdCByZXNvbHV0aW9ucyA9IGVudHJpZXMubWFwKChbXywgdl0pID0+IHtcbiAgICAgIHJldHVybiB2LnJlc29sdmVkIHx8IHYudmVyc2lvblxuICAgIH0pXG5cbiAgICBpZiAocmVzb2x1dGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBUcnkgYSBtb3JlIGxlbmllbnQgYXBwcm9hY2ggZm9yIEJ1biBsb2NrZmlsZXNcbiAgICAgIGlmIChpc0J1bikge1xuICAgICAgICBjb25zb2xlLmxvZyhgVHJ5aW5nIGFsdGVybmF0aXZlIGFwcHJvYWNoIGZvciBCdW4gbG9ja2ZpbGUuLi5gKVxuICAgICAgICAvLyBMb29rIGZvciB0aGUgcGFja2FnZSBpbiB0aGUgb3JpZ2luYWwgbG9ja2ZpbGUgc3RydWN0dXJlXG4gICAgICAgIGNvbnN0IGJ1bkxvY2tmaWxlID0gSlNPTi5wYXJzZShsb2NrRmlsZVN0cmluZylcblxuICAgICAgICBpZiAoYnVuTG9ja2ZpbGUucGFja2FnZXMpIHtcbiAgICAgICAgICAvLyBMb29rIGZvciB0aGUgcGFja2FnZSBkaXJlY3RseSBpbiB0aGUgcGFja2FnZXMgb2JqZWN0XG4gICAgICAgICAgZm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgT2JqZWN0LmVudHJpZXMoYnVuTG9ja2ZpbGUucGFja2FnZXMpKSB7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICh2YWx1ZSBhcyBbc3RyaW5nLCBhbnksIGFueSwgc3RyaW5nXSlbMF0gJiZcbiAgICAgICAgICAgICAgKHZhbHVlIGFzIFtzdHJpbmcsIGFueSwgYW55LCBzdHJpbmddKVswXS5pbmNsdWRlcyhcbiAgICAgICAgICAgICAgICBgJHtwYWNrYWdlRGV0YWlscy5uYW1lfUBgLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgICAgICAgYEZvdW5kIHBhY2thZ2UgaW4gcmF3IGxvY2tmaWxlOiAke2tleX0gLT4gJHsodmFsdWUgYXMgYW55KVswXX1gLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIHJldHVybiAodmFsdWUgYXMgW3N0cmluZywgYW55LCBhbnksIHN0cmluZ10pWzBdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gVHJ5IGxvb2tpbmcgaW4gd29ya3NwYWNlc1xuICAgICAgICBpZiAoYnVuTG9ja2ZpbGUud29ya3NwYWNlcykge1xuICAgICAgICAgIGZvciAoY29uc3Qgd29ya3NwYWNlIG9mIE9iamVjdC52YWx1ZXMoYnVuTG9ja2ZpbGUud29ya3NwYWNlcykpIHtcbiAgICAgICAgICAgIGNvbnN0IHR5cGVkV29ya3NwYWNlID0gd29ya3NwYWNlIGFzIHtcbiAgICAgICAgICAgICAgZGVwZW5kZW5jaWVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICB0eXBlZFdvcmtzcGFjZS5kZXBlbmRlbmNpZXMgJiZcbiAgICAgICAgICAgICAgdHlwZWRXb3Jrc3BhY2UuZGVwZW5kZW5jaWVzW3BhY2thZ2VEZXRhaWxzLm5hbWVdXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IHR5cGVkV29ya3NwYWNlLmRlcGVuZGVuY2llc1twYWNrYWdlRGV0YWlscy5uYW1lXVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICAgICBgRm91bmQgcGFja2FnZSBpbiB3b3Jrc3BhY2UgZGVwZW5kZW5jaWVzOiAke3BhY2thZ2VEZXRhaWxzLm5hbWV9QCR7dmVyc2lvbn1gLFxuICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgIHJldHVybiBgJHtwYWNrYWdlRGV0YWlscy5uYW1lfUAke3ZlcnNpb259YFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBcXGAke3BhY2thZ2VEZXRhaWxzLnBhdGhTcGVjaWZpZXJ9XFxgJ3MgaW5zdGFsbGVkIHZlcnNpb24gaXMgJHtpbnN0YWxsZWRWZXJzaW9ufSBidXQgYSBsb2NrZmlsZSBlbnRyeSBmb3IgaXQgY291bGRuJ3QgYmUgZm91bmQuIFlvdXIgbG9ja2ZpbGUgaXMgbGlrZWx5IHRvIGJlIGNvcnJ1cHQgb3IgeW91IGZvcmdvdCB0byByZWluc3RhbGwgeW91ciBwYWNrYWdlcy5gLFxuICAgICAgKVxuICAgIH1cblxuICAgIGlmIChuZXcgU2V0KHJlc29sdXRpb25zKS5zaXplICE9PSAxKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYEFtYmlnaW91cyBsb2NrZmlsZSBlbnRyaWVzIGZvciAke3BhY2thZ2VEZXRhaWxzLnBhdGhTcGVjaWZpZXJ9LiBVc2luZyB2ZXJzaW9uICR7aW5zdGFsbGVkVmVyc2lvbn1gLFxuICAgICAgKVxuICAgICAgcmV0dXJuIGluc3RhbGxlZFZlcnNpb25cbiAgICB9XG5cbiAgICBpZiAocmVzb2x1dGlvbnNbMF0pIHtcbiAgICAgIHJldHVybiByZXNvbHV0aW9uc1swXVxuICAgIH1cblxuICAgIGNvbnN0IHJlc29sdXRpb24gPSBlbnRyaWVzWzBdWzBdLnNsaWNlKHBhY2thZ2VEZXRhaWxzLm5hbWUubGVuZ3RoICsgMSlcblxuICAgIC8vIHJlc29sdmUgcmVsYXRpdmUgZmlsZSBwYXRoXG4gICAgaWYgKHJlc29sdXRpb24uc3RhcnRzV2l0aChcImZpbGU6LlwiKSkge1xuICAgICAgcmV0dXJuIGBmaWxlOiR7cmVzb2x2ZShhcHBQYXRoLCByZXNvbHV0aW9uLnNsaWNlKFwiZmlsZTpcIi5sZW5ndGgpKX1gXG4gICAgfVxuXG4gICAgaWYgKHJlc29sdXRpb24uc3RhcnRzV2l0aChcIm5wbTpcIikpIHtcbiAgICAgIHJldHVybiByZXNvbHV0aW9uLnJlcGxhY2UoXCJucG06XCIsIFwiXCIpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc29sdXRpb25cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsb2NrZmlsZSA9IHJlcXVpcmUoam9pbihcbiAgICAgIGFwcFBhdGgsXG4gICAgICBwYWNrYWdlTWFuYWdlciA9PT0gXCJucG0tc2hyaW5rd3JhcFwiXG4gICAgICAgID8gXCJucG0tc2hyaW5rd3JhcC5qc29uXCJcbiAgICAgICAgOiBcInBhY2thZ2UtbG9jay5qc29uXCIsXG4gICAgKSlcbiAgICBjb25zdCBsb2NrRmlsZVN0YWNrID0gW2xvY2tmaWxlXVxuICAgIGZvciAoY29uc3QgbmFtZSBvZiBwYWNrYWdlRGV0YWlscy5wYWNrYWdlTmFtZXMuc2xpY2UoMCwgLTEpKSB7XG4gICAgICBjb25zdCBjaGlsZCA9IGxvY2tGaWxlU3RhY2tbMF0uZGVwZW5kZW5jaWVzXG4gICAgICBpZiAoY2hpbGQgJiYgbmFtZSBpbiBjaGlsZCkge1xuICAgICAgICBsb2NrRmlsZVN0YWNrLnB1c2goY2hpbGRbbmFtZV0pXG4gICAgICB9XG4gICAgfVxuICAgIGxvY2tGaWxlU3RhY2sucmV2ZXJzZSgpXG4gICAgY29uc3QgcmVsZXZhbnRTdGFja0VudHJ5ID0gbG9ja0ZpbGVTdGFjay5maW5kKChlbnRyeSkgPT4ge1xuICAgICAgaWYgKGVudHJ5LmRlcGVuZGVuY2llcykge1xuICAgICAgICByZXR1cm4gZW50cnkuZGVwZW5kZW5jaWVzICYmIHBhY2thZ2VEZXRhaWxzLm5hbWUgaW4gZW50cnkuZGVwZW5kZW5jaWVzXG4gICAgICB9IGVsc2UgaWYgKGVudHJ5LnBhY2thZ2VzKSB7XG4gICAgICAgIHJldHVybiBlbnRyeS5wYWNrYWdlcyAmJiBwYWNrYWdlRGV0YWlscy5wYXRoIGluIGVudHJ5LnBhY2thZ2VzXG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBkZXBlbmRlbmNpZXMgb3IgcGFja2FnZXMgaW4gbG9ja2ZpbGVcIilcbiAgICB9KVxuICAgIGNvbnN0IHBrZyA9IHJlbGV2YW50U3RhY2tFbnRyeS5kZXBlbmRlbmNpZXNcbiAgICAgID8gcmVsZXZhbnRTdGFja0VudHJ5LmRlcGVuZGVuY2llc1twYWNrYWdlRGV0YWlscy5uYW1lXVxuICAgICAgOiByZWxldmFudFN0YWNrRW50cnkucGFja2FnZXNbcGFja2FnZURldGFpbHMucGF0aF1cbiAgICByZXR1cm4gcGtnLnJlc29sdmVkIHx8IHBrZy52ZXJzaW9uIHx8IHBrZy5mcm9tXG4gIH1cbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGNvbnN0IHBhY2thZ2VEZXRhaWxzID0gZ2V0UGF0Y2hEZXRhaWxzRnJvbUNsaVN0cmluZyhwcm9jZXNzLmFyZ3ZbMl0pXG4gIGlmICghcGFja2FnZURldGFpbHMpIHtcbiAgICBjb25zb2xlLmxvZyhgQ2FuJ3QgZmluZCBwYWNrYWdlICR7cHJvY2Vzcy5hcmd2WzJdfWApXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cbiAgY29uc29sZS5sb2coXG4gICAgZ2V0UGFja2FnZVJlc29sdXRpb24oe1xuICAgICAgYXBwUGF0aDogcHJvY2Vzcy5jd2QoKSxcbiAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgcGFja2FnZU1hbmFnZXI6IGRldGVjdFBhY2thZ2VNYW5hZ2VyKHByb2Nlc3MuY3dkKCksIG51bGwpLFxuICAgIH0pLFxuICApXG59XG4iXX0=