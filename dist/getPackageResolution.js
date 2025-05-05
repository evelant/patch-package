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
        if (lockFileString.includes("yarn lockfile v1")) {
            const parsedYarnLockFile = lockfile_1.parse(lockFileString);
            if (parsedYarnLockFile.type !== "success") {
                throw new Error(`Could not parse yarn v1 lock file ${isBun ? "- was originally a bun.lockb file" : ""}`);
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
                throw new Error(`Could not parse yarn v2 lock file ${isBun ? "- was originally a bun.lockb file (should not happen)" : ""}`);
            }
        }
        const installedVersion = getPackageVersion_1.getPackageVersion(path_1.join(path_1.resolve(appPath, packageDetails.path), "package.json"));
        const entries = Object.entries(appLockFile).filter(([k, v]) => k.startsWith(packageDetails.name + "@") &&
            // @ts-ignore
            coerceSemVer_1.coerceSemVer(v.version) === coerceSemVer_1.coerceSemVer(installedVersion));
        const resolutions = entries.map(([_, v]) => {
            // @ts-ignore
            return v.resolved;
        });
        if (resolutions.length === 0) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UGFja2FnZVJlc29sdXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ2V0UGFja2FnZVJlc29sdXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsaUNBQXNDO0FBQ3RDLHFEQUErRTtBQUMvRSxpRUFBNkU7QUFDN0UsdUNBQW1EO0FBQ25ELGdEQUE4RDtBQUM5RCxnREFBdUI7QUFDdkIsd0ZBQXdEO0FBQ3hELDJEQUF1RDtBQUN2RCxpREFBNkM7QUFDN0MseURBQXFEO0FBRXJELFNBQWdCLG9CQUFvQixDQUFDLEVBQ25DLGNBQWMsRUFDZCxjQUFjLEVBQ2QsT0FBTyxHQUtSO0lBQ0MsSUFBSSxjQUFjLEtBQUssTUFBTSxJQUFJLGNBQWMsS0FBSyxLQUFLLEVBQUU7UUFDekQsTUFBTSxLQUFLLEdBQUcsY0FBYyxLQUFLLEtBQUssQ0FBQTtRQUN0QyxJQUFJLFlBQVksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFBO1FBQ3BELElBQUksWUFBWSxHQUFHLFlBQVksQ0FBQTtRQUUvQiwrQ0FBK0M7UUFDL0MsSUFBSSxLQUFLLElBQUkscUJBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUNuQyxZQUFZLEdBQUcsVUFBVSxDQUFBO1lBQ3pCLFlBQVksR0FBRyxZQUFZLENBQUE7U0FDNUI7YUFBTSxJQUFJLENBQUMscUJBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUNwQyxNQUFNLGFBQWEsR0FBRyxrQ0FBaUIsRUFBRSxDQUFBO1lBQ3pDLElBQUksQ0FBQyxhQUFhLEVBQUU7Z0JBQ2xCLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxLQUFLLENBQUMsQ0FBQyxDQUFDLHVCQUF1QixDQUFDLENBQUMsQ0FBQyxZQUFZLE9BQU8sQ0FBQyxDQUFBO2FBQ3JGO1lBRUQsMkRBQTJEO1lBQzNELElBQUksS0FBSyxJQUFJLHFCQUFVLENBQUMsV0FBSSxDQUFDLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQyxFQUFFO2dCQUN4RCxZQUFZLEdBQUcsVUFBVSxDQUFBO2dCQUN6QixZQUFZLEdBQUcsV0FBSSxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsQ0FBQTthQUNqRDtpQkFBTTtnQkFDTCxZQUFZLEdBQUcsV0FBSSxDQUFDLGFBQWEsRUFBRSxZQUFZLENBQUMsQ0FBQTthQUNqRDtTQUNGO1FBRUQsSUFBSSxDQUFDLHFCQUFVLENBQUMsWUFBWSxDQUFDLEVBQUU7WUFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLEtBQUssQ0FBQyxDQUFDLENBQUMsdUJBQXVCLENBQUMsQ0FBQyxDQUFDLFlBQVksT0FBTyxDQUFDLENBQUE7U0FDckY7UUFDRCxNQUFNLGNBQWMsR0FBRyxLQUFLO1lBQzFCLENBQUMsQ0FBQyxtQ0FBZ0IsQ0FBQyxZQUFZLENBQUM7WUFDaEMsQ0FBQyxDQUFDLHVCQUFZLENBQUMsWUFBWSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUE7UUFDekMsSUFBSSxXQUFXLENBQUE7UUFDZixJQUFJLGNBQWMsQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsRUFBRTtZQUMvQyxNQUFNLGtCQUFrQixHQUFHLGdCQUFpQixDQUFDLGNBQWMsQ0FBQyxDQUFBO1lBQzVELElBQUksa0JBQWtCLENBQUMsSUFBSSxLQUFLLFNBQVMsRUFBRTtnQkFDekMsTUFBTSxJQUFJLEtBQUssQ0FDYixxQ0FDRSxLQUFLLENBQUMsQ0FBQyxDQUFDLG1DQUFtQyxDQUFDLENBQUMsQ0FBQyxFQUNoRCxFQUFFLENBQ0gsQ0FBQTthQUNGO2lCQUFNO2dCQUNMLFdBQVcsR0FBRyxrQkFBa0IsQ0FBQyxNQUFNLENBQUE7YUFDeEM7U0FDRjthQUFNO1lBQ0wsSUFBSTtnQkFDRixXQUFXLEdBQUcsY0FBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQTthQUN6QztZQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNWLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUE7Z0JBQ2QsTUFBTSxJQUFJLEtBQUssQ0FDYixxQ0FDRSxLQUFLLENBQUMsQ0FBQyxDQUFDLHVEQUF1RCxDQUFDLENBQUMsQ0FBQyxFQUNwRSxFQUFFLENBQ0gsQ0FBQTthQUNGO1NBQ0Y7UUFFRCxNQUFNLGdCQUFnQixHQUFHLHFDQUFpQixDQUN4QyxXQUFJLENBQUMsY0FBTyxDQUFDLE9BQU8sRUFBRSxjQUFjLENBQUMsSUFBSSxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQzVELENBQUE7UUFFRCxNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxDQUFDLE1BQU0sQ0FDaEQsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFLENBQ1QsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztZQUN2QyxhQUFhO1lBQ2IsMkJBQVksQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssMkJBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUM3RCxDQUFBO1FBRUQsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxFQUFFLEVBQUU7WUFDekMsYUFBYTtZQUNiLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQTtRQUNuQixDQUFDLENBQUMsQ0FBQTtRQUVGLElBQUksV0FBVyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FDYixLQUFLLGNBQWMsQ0FBQyxhQUFhLDZCQUE2QixnQkFBZ0IsaUlBQWlJLENBQ2hOLENBQUE7U0FDRjtRQUVELElBQUksSUFBSSxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsSUFBSSxLQUFLLENBQUMsRUFBRTtZQUNuQyxPQUFPLENBQUMsR0FBRyxDQUNULGtDQUFrQyxjQUFjLENBQUMsYUFBYSxtQkFBbUIsZ0JBQWdCLEVBQUUsQ0FDcEcsQ0FBQTtZQUNELE9BQU8sZ0JBQWdCLENBQUE7U0FDeEI7UUFFRCxJQUFJLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBRTtZQUNsQixPQUFPLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQTtTQUN0QjtRQUVELE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUE7UUFFdEUsNkJBQTZCO1FBQzdCLElBQUksVUFBVSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUNuQyxPQUFPLFFBQVEsY0FBTyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUE7U0FDcEU7UUFFRCxJQUFJLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUU7WUFDakMsT0FBTyxVQUFVLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBQTtTQUN0QztRQUVELE9BQU8sVUFBVSxDQUFBO0tBQ2xCO1NBQU07UUFDTCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsV0FBSSxDQUMzQixPQUFPLEVBQ1AsY0FBYyxLQUFLLGdCQUFnQjtZQUNqQyxDQUFDLENBQUMscUJBQXFCO1lBQ3ZCLENBQUMsQ0FBQyxtQkFBbUIsQ0FDeEIsQ0FBQyxDQUFBO1FBQ0YsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQTtRQUNoQyxLQUFLLE1BQU0sSUFBSSxJQUFJLGNBQWMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFO1lBQzNELE1BQU0sS0FBSyxHQUFHLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUE7WUFDM0MsSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRTtnQkFDMUIsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQTthQUNoQztTQUNGO1FBQ0QsYUFBYSxDQUFDLE9BQU8sRUFBRSxDQUFBO1FBQ3ZCLE1BQU0sa0JBQWtCLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQ3RELElBQUksS0FBSyxDQUFDLFlBQVksRUFBRTtnQkFDdEIsT0FBTyxLQUFLLENBQUMsWUFBWSxJQUFJLGNBQWMsQ0FBQyxJQUFJLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQTthQUN2RTtpQkFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7Z0JBQ3pCLE9BQU8sS0FBSyxDQUFDLFFBQVEsSUFBSSxjQUFjLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUE7YUFDL0Q7WUFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGtEQUFrRCxDQUFDLENBQUE7UUFDckUsQ0FBQyxDQUFDLENBQUE7UUFDRixNQUFNLEdBQUcsR0FBRyxrQkFBa0IsQ0FBQyxZQUFZO1lBQ3pDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQztZQUN0RCxDQUFDLENBQUMsa0JBQWtCLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQTtRQUNwRCxPQUFPLEdBQUcsQ0FBQyxRQUFRLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFBO0tBQy9DO0FBQ0gsQ0FBQztBQXpJRCxvREF5SUM7QUFFRCxJQUFJLE9BQU8sQ0FBQyxJQUFJLEtBQUssTUFBTSxFQUFFO0lBQzNCLE1BQU0sY0FBYyxHQUFHLDZDQUE0QixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQTtJQUNwRSxJQUFJLENBQUMsY0FBYyxFQUFFO1FBQ25CLE9BQU8sQ0FBQyxHQUFHLENBQUMsc0JBQXNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFBO1FBQ3BELE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUE7S0FDaEI7SUFDRCxPQUFPLENBQUMsR0FBRyxDQUNULG9CQUFvQixDQUFDO1FBQ25CLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxFQUFFO1FBQ3RCLGNBQWM7UUFDZCxjQUFjLEVBQUUsMkNBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksQ0FBQztLQUMxRCxDQUFDLENBQ0gsQ0FBQTtDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgam9pbiwgcmVzb2x2ZSB9IGZyb20gXCIuL3BhdGhcIlxuaW1wb3J0IHsgUGFja2FnZURldGFpbHMsIGdldFBhdGNoRGV0YWlsc0Zyb21DbGlTdHJpbmcgfSBmcm9tIFwiLi9QYWNrYWdlRGV0YWlsc1wiXG5pbXBvcnQgeyBQYWNrYWdlTWFuYWdlciwgZGV0ZWN0UGFja2FnZU1hbmFnZXIgfSBmcm9tIFwiLi9kZXRlY3RQYWNrYWdlTWFuYWdlclwiXG5pbXBvcnQgeyByZWFkRmlsZVN5bmMsIGV4aXN0c1N5bmMgfSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VZYXJuTG9ja0ZpbGUgfSBmcm9tIFwiQHlhcm5wa2cvbG9ja2ZpbGVcIlxuaW1wb3J0IHlhbWwgZnJvbSBcInlhbWxcIlxuaW1wb3J0IGZpbmRXb3Jrc3BhY2VSb290IGZyb20gXCJmaW5kLXlhcm4td29ya3NwYWNlLXJvb3RcIlxuaW1wb3J0IHsgZ2V0UGFja2FnZVZlcnNpb24gfSBmcm9tIFwiLi9nZXRQYWNrYWdlVmVyc2lvblwiXG5pbXBvcnQgeyBjb2VyY2VTZW1WZXIgfSBmcm9tIFwiLi9jb2VyY2VTZW1WZXJcIlxuaW1wb3J0IHsgcGFyc2VCdW5Mb2NrZmlsZSB9IGZyb20gXCIuL3BhcnNlQnVuTG9ja2ZpbGVcIlxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UGFja2FnZVJlc29sdXRpb24oe1xuICBwYWNrYWdlRGV0YWlscyxcbiAgcGFja2FnZU1hbmFnZXIsXG4gIGFwcFBhdGgsXG59OiB7XG4gIHBhY2thZ2VEZXRhaWxzOiBQYWNrYWdlRGV0YWlsc1xuICBwYWNrYWdlTWFuYWdlcjogUGFja2FnZU1hbmFnZXJcbiAgYXBwUGF0aDogc3RyaW5nXG59KSB7XG4gIGlmIChwYWNrYWdlTWFuYWdlciA9PT0gXCJ5YXJuXCIgfHwgcGFja2FnZU1hbmFnZXIgPT09IFwiYnVuXCIpIHtcbiAgICBjb25zdCBpc0J1biA9IHBhY2thZ2VNYW5hZ2VyID09PSBcImJ1blwiXG4gICAgbGV0IGxvY2tGaWxlTmFtZSA9IGlzQnVuID8gXCJidW4ubG9ja2JcIiA6IFwieWFybi5sb2NrXCJcbiAgICBsZXQgbG9ja0ZpbGVQYXRoID0gbG9ja0ZpbGVOYW1lXG5cbiAgICAvLyBGb3IgQnVuLCBjaGVjayBmb3IgdGV4dC1iYXNlZCBsb2NrZmlsZSBmaXJzdFxuICAgIGlmIChpc0J1biAmJiBleGlzdHNTeW5jKFwiYnVuLmxvY2tcIikpIHtcbiAgICAgIGxvY2tGaWxlTmFtZSA9IFwiYnVuLmxvY2tcIlxuICAgICAgbG9ja0ZpbGVQYXRoID0gbG9ja0ZpbGVOYW1lXG4gICAgfSBlbHNlIGlmICghZXhpc3RzU3luYyhsb2NrRmlsZVBhdGgpKSB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSb290ID0gZmluZFdvcmtzcGFjZVJvb3QoKVxuICAgICAgaWYgKCF3b3Jrc3BhY2VSb290KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZmluZCAke2lzQnVuID8gXCJidW4ubG9ja2Igb3IgYnVuLmxvY2tcIiA6IGxvY2tGaWxlTmFtZX0gZmlsZWApXG4gICAgICB9XG5cbiAgICAgIC8vIEZvciBCdW4sIGNoZWNrIGZvciB0ZXh0LWJhc2VkIGxvY2tmaWxlIGluIHdvcmtzcGFjZSByb290XG4gICAgICBpZiAoaXNCdW4gJiYgZXhpc3RzU3luYyhqb2luKHdvcmtzcGFjZVJvb3QsIFwiYnVuLmxvY2tcIikpKSB7XG4gICAgICAgIGxvY2tGaWxlTmFtZSA9IFwiYnVuLmxvY2tcIlxuICAgICAgICBsb2NrRmlsZVBhdGggPSBqb2luKHdvcmtzcGFjZVJvb3QsIGxvY2tGaWxlTmFtZSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2tGaWxlUGF0aCA9IGpvaW4od29ya3NwYWNlUm9vdCwgbG9ja0ZpbGVQYXRoKVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZXhpc3RzU3luYyhsb2NrRmlsZVBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbid0IGZpbmQgJHtpc0J1biA/IFwiYnVuLmxvY2tiIG9yIGJ1bi5sb2NrXCIgOiBsb2NrRmlsZU5hbWV9IGZpbGVgKVxuICAgIH1cbiAgICBjb25zdCBsb2NrRmlsZVN0cmluZyA9IGlzQnVuXG4gICAgICA/IHBhcnNlQnVuTG9ja2ZpbGUobG9ja0ZpbGVQYXRoKVxuICAgICAgOiByZWFkRmlsZVN5bmMobG9ja0ZpbGVQYXRoKS50b1N0cmluZygpXG4gICAgbGV0IGFwcExvY2tGaWxlXG4gICAgaWYgKGxvY2tGaWxlU3RyaW5nLmluY2x1ZGVzKFwieWFybiBsb2NrZmlsZSB2MVwiKSkge1xuICAgICAgY29uc3QgcGFyc2VkWWFybkxvY2tGaWxlID0gcGFyc2VZYXJuTG9ja0ZpbGUobG9ja0ZpbGVTdHJpbmcpXG4gICAgICBpZiAocGFyc2VkWWFybkxvY2tGaWxlLnR5cGUgIT09IFwic3VjY2Vzc1wiKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQ291bGQgbm90IHBhcnNlIHlhcm4gdjEgbG9jayBmaWxlICR7XG4gICAgICAgICAgICBpc0J1biA/IFwiLSB3YXMgb3JpZ2luYWxseSBhIGJ1bi5sb2NrYiBmaWxlXCIgOiBcIlwiXG4gICAgICAgICAgfWAsXG4gICAgICAgIClcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFwcExvY2tGaWxlID0gcGFyc2VkWWFybkxvY2tGaWxlLm9iamVjdFxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0cnkge1xuICAgICAgICBhcHBMb2NrRmlsZSA9IHlhbWwucGFyc2UobG9ja0ZpbGVTdHJpbmcpXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGUpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgQ291bGQgbm90IHBhcnNlIHlhcm4gdjIgbG9jayBmaWxlICR7XG4gICAgICAgICAgICBpc0J1biA/IFwiLSB3YXMgb3JpZ2luYWxseSBhIGJ1bi5sb2NrYiBmaWxlIChzaG91bGQgbm90IGhhcHBlbilcIiA6IFwiXCJcbiAgICAgICAgICB9YCxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGluc3RhbGxlZFZlcnNpb24gPSBnZXRQYWNrYWdlVmVyc2lvbihcbiAgICAgIGpvaW4ocmVzb2x2ZShhcHBQYXRoLCBwYWNrYWdlRGV0YWlscy5wYXRoKSwgXCJwYWNrYWdlLmpzb25cIiksXG4gICAgKVxuXG4gICAgY29uc3QgZW50cmllcyA9IE9iamVjdC5lbnRyaWVzKGFwcExvY2tGaWxlKS5maWx0ZXIoXG4gICAgICAoW2ssIHZdKSA9PlxuICAgICAgICBrLnN0YXJ0c1dpdGgocGFja2FnZURldGFpbHMubmFtZSArIFwiQFwiKSAmJlxuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGNvZXJjZVNlbVZlcih2LnZlcnNpb24pID09PSBjb2VyY2VTZW1WZXIoaW5zdGFsbGVkVmVyc2lvbiksXG4gICAgKVxuXG4gICAgY29uc3QgcmVzb2x1dGlvbnMgPSBlbnRyaWVzLm1hcCgoW18sIHZdKSA9PiB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICByZXR1cm4gdi5yZXNvbHZlZFxuICAgIH0pXG5cbiAgICBpZiAocmVzb2x1dGlvbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBcXGAke3BhY2thZ2VEZXRhaWxzLnBhdGhTcGVjaWZpZXJ9XFxgJ3MgaW5zdGFsbGVkIHZlcnNpb24gaXMgJHtpbnN0YWxsZWRWZXJzaW9ufSBidXQgYSBsb2NrZmlsZSBlbnRyeSBmb3IgaXQgY291bGRuJ3QgYmUgZm91bmQuIFlvdXIgbG9ja2ZpbGUgaXMgbGlrZWx5IHRvIGJlIGNvcnJ1cHQgb3IgeW91IGZvcmdvdCB0byByZWluc3RhbGwgeW91ciBwYWNrYWdlcy5gLFxuICAgICAgKVxuICAgIH1cblxuICAgIGlmIChuZXcgU2V0KHJlc29sdXRpb25zKS5zaXplICE9PSAxKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgYEFtYmlnaW91cyBsb2NrZmlsZSBlbnRyaWVzIGZvciAke3BhY2thZ2VEZXRhaWxzLnBhdGhTcGVjaWZpZXJ9LiBVc2luZyB2ZXJzaW9uICR7aW5zdGFsbGVkVmVyc2lvbn1gLFxuICAgICAgKVxuICAgICAgcmV0dXJuIGluc3RhbGxlZFZlcnNpb25cbiAgICB9XG5cbiAgICBpZiAocmVzb2x1dGlvbnNbMF0pIHtcbiAgICAgIHJldHVybiByZXNvbHV0aW9uc1swXVxuICAgIH1cblxuICAgIGNvbnN0IHJlc29sdXRpb24gPSBlbnRyaWVzWzBdWzBdLnNsaWNlKHBhY2thZ2VEZXRhaWxzLm5hbWUubGVuZ3RoICsgMSlcblxuICAgIC8vIHJlc29sdmUgcmVsYXRpdmUgZmlsZSBwYXRoXG4gICAgaWYgKHJlc29sdXRpb24uc3RhcnRzV2l0aChcImZpbGU6LlwiKSkge1xuICAgICAgcmV0dXJuIGBmaWxlOiR7cmVzb2x2ZShhcHBQYXRoLCByZXNvbHV0aW9uLnNsaWNlKFwiZmlsZTpcIi5sZW5ndGgpKX1gXG4gICAgfVxuXG4gICAgaWYgKHJlc29sdXRpb24uc3RhcnRzV2l0aChcIm5wbTpcIikpIHtcbiAgICAgIHJldHVybiByZXNvbHV0aW9uLnJlcGxhY2UoXCJucG06XCIsIFwiXCIpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc29sdXRpb25cbiAgfSBlbHNlIHtcbiAgICBjb25zdCBsb2NrZmlsZSA9IHJlcXVpcmUoam9pbihcbiAgICAgIGFwcFBhdGgsXG4gICAgICBwYWNrYWdlTWFuYWdlciA9PT0gXCJucG0tc2hyaW5rd3JhcFwiXG4gICAgICAgID8gXCJucG0tc2hyaW5rd3JhcC5qc29uXCJcbiAgICAgICAgOiBcInBhY2thZ2UtbG9jay5qc29uXCIsXG4gICAgKSlcbiAgICBjb25zdCBsb2NrRmlsZVN0YWNrID0gW2xvY2tmaWxlXVxuICAgIGZvciAoY29uc3QgbmFtZSBvZiBwYWNrYWdlRGV0YWlscy5wYWNrYWdlTmFtZXMuc2xpY2UoMCwgLTEpKSB7XG4gICAgICBjb25zdCBjaGlsZCA9IGxvY2tGaWxlU3RhY2tbMF0uZGVwZW5kZW5jaWVzXG4gICAgICBpZiAoY2hpbGQgJiYgbmFtZSBpbiBjaGlsZCkge1xuICAgICAgICBsb2NrRmlsZVN0YWNrLnB1c2goY2hpbGRbbmFtZV0pXG4gICAgICB9XG4gICAgfVxuICAgIGxvY2tGaWxlU3RhY2sucmV2ZXJzZSgpXG4gICAgY29uc3QgcmVsZXZhbnRTdGFja0VudHJ5ID0gbG9ja0ZpbGVTdGFjay5maW5kKChlbnRyeSkgPT4ge1xuICAgICAgaWYgKGVudHJ5LmRlcGVuZGVuY2llcykge1xuICAgICAgICByZXR1cm4gZW50cnkuZGVwZW5kZW5jaWVzICYmIHBhY2thZ2VEZXRhaWxzLm5hbWUgaW4gZW50cnkuZGVwZW5kZW5jaWVzXG4gICAgICB9IGVsc2UgaWYgKGVudHJ5LnBhY2thZ2VzKSB7XG4gICAgICAgIHJldHVybiBlbnRyeS5wYWNrYWdlcyAmJiBwYWNrYWdlRGV0YWlscy5wYXRoIGluIGVudHJ5LnBhY2thZ2VzXG4gICAgICB9XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBkZXBlbmRlbmNpZXMgb3IgcGFja2FnZXMgaW4gbG9ja2ZpbGVcIilcbiAgICB9KVxuICAgIGNvbnN0IHBrZyA9IHJlbGV2YW50U3RhY2tFbnRyeS5kZXBlbmRlbmNpZXNcbiAgICAgID8gcmVsZXZhbnRTdGFja0VudHJ5LmRlcGVuZGVuY2llc1twYWNrYWdlRGV0YWlscy5uYW1lXVxuICAgICAgOiByZWxldmFudFN0YWNrRW50cnkucGFja2FnZXNbcGFja2FnZURldGFpbHMucGF0aF1cbiAgICByZXR1cm4gcGtnLnJlc29sdmVkIHx8IHBrZy52ZXJzaW9uIHx8IHBrZy5mcm9tXG4gIH1cbn1cblxuaWYgKHJlcXVpcmUubWFpbiA9PT0gbW9kdWxlKSB7XG4gIGNvbnN0IHBhY2thZ2VEZXRhaWxzID0gZ2V0UGF0Y2hEZXRhaWxzRnJvbUNsaVN0cmluZyhwcm9jZXNzLmFyZ3ZbMl0pXG4gIGlmICghcGFja2FnZURldGFpbHMpIHtcbiAgICBjb25zb2xlLmxvZyhgQ2FuJ3QgZmluZCBwYWNrYWdlICR7cHJvY2Vzcy5hcmd2WzJdfWApXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cbiAgY29uc29sZS5sb2coXG4gICAgZ2V0UGFja2FnZVJlc29sdXRpb24oe1xuICAgICAgYXBwUGF0aDogcHJvY2Vzcy5jd2QoKSxcbiAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgcGFja2FnZU1hbmFnZXI6IGRldGVjdFBhY2thZ2VNYW5hZ2VyKHByb2Nlc3MuY3dkKCksIG51bGwpLFxuICAgIH0pLFxuICApXG59XG4iXX0=