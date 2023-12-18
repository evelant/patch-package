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
        const lockFileName = isBun ? "bun.lockb" : "yarn.lock";
        let lockFilePath = lockFileName;
        if (!fs_extra_1.existsSync(lockFilePath)) {
            const workspaceRoot = find_yarn_workspace_root_1.default();
            if (!workspaceRoot) {
                throw new Error(`Can't find ${lockFileName} file`);
            }
            lockFilePath = path_1.join(workspaceRoot, lockFilePath);
        }
        if (!fs_extra_1.existsSync(lockFilePath)) {
            throw new Error(`Can't find ${lockFileName} file`);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0UGFja2FnZVJlc29sdXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZ2V0UGFja2FnZVJlc29sdXRpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsaUNBQXNDO0FBQ3RDLHFEQUErRTtBQUMvRSxpRUFBNkU7QUFDN0UsdUNBQW1EO0FBQ25ELGdEQUE4RDtBQUM5RCxnREFBdUI7QUFDdkIsd0ZBQXdEO0FBQ3hELDJEQUF1RDtBQUN2RCxpREFBNkM7QUFDN0MseURBQXFEO0FBRXJELFNBQWdCLG9CQUFvQixDQUFDLEVBQ25DLGNBQWMsRUFDZCxjQUFjLEVBQ2QsT0FBTyxHQUtSO0lBQ0MsSUFBSSxjQUFjLEtBQUssTUFBTSxJQUFJLGNBQWMsS0FBSyxLQUFLLEVBQUU7UUFDekQsTUFBTSxLQUFLLEdBQUcsY0FBYyxLQUFLLEtBQUssQ0FBQTtRQUN0QyxNQUFNLFlBQVksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsV0FBVyxDQUFBO1FBQ3RELElBQUksWUFBWSxHQUFHLFlBQVksQ0FBQTtRQUMvQixJQUFJLENBQUMscUJBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUM3QixNQUFNLGFBQWEsR0FBRyxrQ0FBaUIsRUFBRSxDQUFBO1lBQ3pDLElBQUksQ0FBQyxhQUFhLEVBQUU7Z0JBQ2xCLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxZQUFZLE9BQU8sQ0FBQyxDQUFBO2FBQ25EO1lBQ0QsWUFBWSxHQUFHLFdBQUksQ0FBQyxhQUFhLEVBQUUsWUFBWSxDQUFDLENBQUE7U0FDakQ7UUFDRCxJQUFJLENBQUMscUJBQVUsQ0FBQyxZQUFZLENBQUMsRUFBRTtZQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsWUFBWSxPQUFPLENBQUMsQ0FBQTtTQUNuRDtRQUNELE1BQU0sY0FBYyxHQUFHLEtBQUs7WUFDMUIsQ0FBQyxDQUFDLG1DQUFnQixDQUFDLFlBQVksQ0FBQztZ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LGtCQUFrQixDQUFDLFlBQVk7WUFDekMsQ0FBQyxDQUFDLGtCQUFrQixDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO1lBQ3RELENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFBO1FBQ3BELE9BQU8sR0FBRyxDQUFDLFFBQVEsSUFBSSxHQUFHLENBQUMsT0FBTyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUE7S0FDL0M7QUFDSCxDQUFDO0FBNUhELG9EQTRIQztBQUVELElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7SUFDM0IsTUFBTSxjQUFjLEdBQUcsNkNBQTRCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFBO0lBQ3BFLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDbkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxzQkFBc0IsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUE7UUFDcEQsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQTtLQUNoQjtJQUNELE9BQU8sQ0FBQyxHQUFHLENBQ1Qsb0JBQW9CLENBQUM7UUFDbkIsT0FBTyxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUU7UUFDdEIsY0FBYztRQUNkLGNBQWMsRUFBRSwyQ0FBb0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsSUFBSSxDQUFDO0tBQzFELENBQUMsQ0FDSCxDQUFBO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBqb2luLCByZXNvbHZlIH0gZnJvbSBcIi4vcGF0aFwiXG5pbXBvcnQgeyBQYWNrYWdlRGV0YWlscywgZ2V0UGF0Y2hEZXRhaWxzRnJvbUNsaVN0cmluZyB9IGZyb20gXCIuL1BhY2thZ2VEZXRhaWxzXCJcbmltcG9ydCB7IFBhY2thZ2VNYW5hZ2VyLCBkZXRlY3RQYWNrYWdlTWFuYWdlciB9IGZyb20gXCIuL2RldGVjdFBhY2thZ2VNYW5hZ2VyXCJcbmltcG9ydCB7IHJlYWRGaWxlU3luYywgZXhpc3RzU3luYyB9IGZyb20gXCJmcy1leHRyYVwiXG5pbXBvcnQgeyBwYXJzZSBhcyBwYXJzZVlhcm5Mb2NrRmlsZSB9IGZyb20gXCJAeWFybnBrZy9sb2NrZmlsZVwiXG5pbXBvcnQgeWFtbCBmcm9tIFwieWFtbFwiXG5pbXBvcnQgZmluZFdvcmtzcGFjZVJvb3QgZnJvbSBcImZpbmQteWFybi13b3Jrc3BhY2Utcm9vdFwiXG5pbXBvcnQgeyBnZXRQYWNrYWdlVmVyc2lvbiB9IGZyb20gXCIuL2dldFBhY2thZ2VWZXJzaW9uXCJcbmltcG9ydCB7IGNvZXJjZVNlbVZlciB9IGZyb20gXCIuL2NvZXJjZVNlbVZlclwiXG5pbXBvcnQgeyBwYXJzZUJ1bkxvY2tmaWxlIH0gZnJvbSBcIi4vcGFyc2VCdW5Mb2NrZmlsZVwiXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQYWNrYWdlUmVzb2x1dGlvbih7XG4gIHBhY2thZ2VEZXRhaWxzLFxuICBwYWNrYWdlTWFuYWdlcixcbiAgYXBwUGF0aCxcbn06IHtcbiAgcGFja2FnZURldGFpbHM6IFBhY2thZ2VEZXRhaWxzXG4gIHBhY2thZ2VNYW5hZ2VyOiBQYWNrYWdlTWFuYWdlclxuICBhcHBQYXRoOiBzdHJpbmdcbn0pIHtcbiAgaWYgKHBhY2thZ2VNYW5hZ2VyID09PSBcInlhcm5cIiB8fCBwYWNrYWdlTWFuYWdlciA9PT0gXCJidW5cIikge1xuICAgIGNvbnN0IGlzQnVuID0gcGFja2FnZU1hbmFnZXIgPT09IFwiYnVuXCJcbiAgICBjb25zdCBsb2NrRmlsZU5hbWUgPSBpc0J1biA/IFwiYnVuLmxvY2tiXCIgOiBcInlhcm4ubG9ja1wiXG4gICAgbGV0IGxvY2tGaWxlUGF0aCA9IGxvY2tGaWxlTmFtZVxuICAgIGlmICghZXhpc3RzU3luYyhsb2NrRmlsZVBhdGgpKSB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2VSb290ID0gZmluZFdvcmtzcGFjZVJvb3QoKVxuICAgICAgaWYgKCF3b3Jrc3BhY2VSb290KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZmluZCAke2xvY2tGaWxlTmFtZX0gZmlsZWApXG4gICAgICB9XG4gICAgICBsb2NrRmlsZVBhdGggPSBqb2luKHdvcmtzcGFjZVJvb3QsIGxvY2tGaWxlUGF0aClcbiAgICB9XG4gICAgaWYgKCFleGlzdHNTeW5jKGxvY2tGaWxlUGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ2FuJ3QgZmluZCAke2xvY2tGaWxlTmFtZX0gZmlsZWApXG4gICAgfVxuICAgIGNvbnN0IGxvY2tGaWxlU3RyaW5nID0gaXNCdW5cbiAgICAgID8gcGFyc2VCdW5Mb2NrZmlsZShsb2NrRmlsZVBhdGgpXG4gICAgICA6IHJlYWRGaWxlU3luYyhsb2NrRmlsZVBhdGgpLnRvU3RyaW5nKClcbiAgICBsZXQgYXBwTG9ja0ZpbGVcbiAgICBpZiAobG9ja0ZpbGVTdHJpbmcuaW5jbHVkZXMoXCJ5YXJuIGxvY2tmaWxlIHYxXCIpKSB7XG4gICAgICBjb25zdCBwYXJzZWRZYXJuTG9ja0ZpbGUgPSBwYXJzZVlhcm5Mb2NrRmlsZShsb2NrRmlsZVN0cmluZylcbiAgICAgIGlmIChwYXJzZWRZYXJuTG9ja0ZpbGUudHlwZSAhPT0gXCJzdWNjZXNzXCIpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBDb3VsZCBub3QgcGFyc2UgeWFybiB2MSBsb2NrIGZpbGUgJHtcbiAgICAgICAgICAgIGlzQnVuID8gXCItIHdhcyBvcmlnaW5hbGx5IGEgYnVuLmxvY2tiIGZpbGVcIiA6IFwiXCJcbiAgICAgICAgICB9YCxcbiAgICAgICAgKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXBwTG9ja0ZpbGUgPSBwYXJzZWRZYXJuTG9ja0ZpbGUub2JqZWN0XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGFwcExvY2tGaWxlID0geWFtbC5wYXJzZShsb2NrRmlsZVN0cmluZylcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coZSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBDb3VsZCBub3QgcGFyc2UgeWFybiB2MiBsb2NrIGZpbGUgJHtcbiAgICAgICAgICAgIGlzQnVuID8gXCItIHdhcyBvcmlnaW5hbGx5IGEgYnVuLmxvY2tiIGZpbGUgKHNob3VsZCBub3QgaGFwcGVuKVwiIDogXCJcIlxuICAgICAgICAgIH1gLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgaW5zdGFsbGVkVmVyc2lvbiA9IGdldFBhY2thZ2VWZXJzaW9uKFxuICAgICAgam9pbihyZXNvbHZlKGFwcFBhdGgsIHBhY2thZ2VEZXRhaWxzLnBhdGgpLCBcInBhY2thZ2UuanNvblwiKSxcbiAgICApXG5cbiAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoYXBwTG9ja0ZpbGUpLmZpbHRlcihcbiAgICAgIChbaywgdl0pID0+XG4gICAgICAgIGsuc3RhcnRzV2l0aChwYWNrYWdlRGV0YWlscy5uYW1lICsgXCJAXCIpICYmXG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgY29lcmNlU2VtVmVyKHYudmVyc2lvbikgPT09IGNvZXJjZVNlbVZlcihpbnN0YWxsZWRWZXJzaW9uKSxcbiAgICApXG5cbiAgICBjb25zdCByZXNvbHV0aW9ucyA9IGVudHJpZXMubWFwKChbXywgdl0pID0+IHtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIHJldHVybiB2LnJlc29sdmVkXG4gICAgfSlcblxuICAgIGlmIChyZXNvbHV0aW9ucy5sZW5ndGggPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYFxcYCR7cGFja2FnZURldGFpbHMucGF0aFNwZWNpZmllcn1cXGAncyBpbnN0YWxsZWQgdmVyc2lvbiBpcyAke2luc3RhbGxlZFZlcnNpb259IGJ1dCBhIGxvY2tmaWxlIGVudHJ5IGZvciBpdCBjb3VsZG4ndCBiZSBmb3VuZC4gWW91ciBsb2NrZmlsZSBpcyBsaWtlbHkgdG8gYmUgY29ycnVwdCBvciB5b3UgZm9yZ290IHRvIHJlaW5zdGFsbCB5b3VyIHBhY2thZ2VzLmAsXG4gICAgICApXG4gICAgfVxuXG4gICAgaWYgKG5ldyBTZXQocmVzb2x1dGlvbnMpLnNpemUgIT09IDEpIHtcbiAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICBgQW1iaWdpb3VzIGxvY2tmaWxlIGVudHJpZXMgZm9yICR7cGFja2FnZURldGFpbHMucGF0aFNwZWNpZmllcn0uIFVzaW5nIHZlcnNpb24gJHtpbnN0YWxsZWRWZXJzaW9ufWAsXG4gICAgICApXG4gICAgICByZXR1cm4gaW5zdGFsbGVkVmVyc2lvblxuICAgIH1cblxuICAgIGlmIChyZXNvbHV0aW9uc1swXSkge1xuICAgICAgcmV0dXJuIHJlc29sdXRpb25zWzBdXG4gICAgfVxuXG4gICAgY29uc3QgcmVzb2x1dGlvbiA9IGVudHJpZXNbMF1bMF0uc2xpY2UocGFja2FnZURldGFpbHMubmFtZS5sZW5ndGggKyAxKVxuXG4gICAgLy8gcmVzb2x2ZSByZWxhdGl2ZSBmaWxlIHBhdGhcbiAgICBpZiAocmVzb2x1dGlvbi5zdGFydHNXaXRoKFwiZmlsZTouXCIpKSB7XG4gICAgICByZXR1cm4gYGZpbGU6JHtyZXNvbHZlKGFwcFBhdGgsIHJlc29sdXRpb24uc2xpY2UoXCJmaWxlOlwiLmxlbmd0aCkpfWBcbiAgICB9XG5cbiAgICBpZiAocmVzb2x1dGlvbi5zdGFydHNXaXRoKFwibnBtOlwiKSkge1xuICAgICAgcmV0dXJuIHJlc29sdXRpb24ucmVwbGFjZShcIm5wbTpcIiwgXCJcIilcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzb2x1dGlvblxuICB9IGVsc2Uge1xuICAgIGNvbnN0IGxvY2tmaWxlID0gcmVxdWlyZShqb2luKFxuICAgICAgYXBwUGF0aCxcbiAgICAgIHBhY2thZ2VNYW5hZ2VyID09PSBcIm5wbS1zaHJpbmt3cmFwXCJcbiAgICAgICAgPyBcIm5wbS1zaHJpbmt3cmFwLmpzb25cIlxuICAgICAgICA6IFwicGFja2FnZS1sb2NrLmpzb25cIixcbiAgICApKVxuICAgIGNvbnN0IGxvY2tGaWxlU3RhY2sgPSBbbG9ja2ZpbGVdXG4gICAgZm9yIChjb25zdCBuYW1lIG9mIHBhY2thZ2VEZXRhaWxzLnBhY2thZ2VOYW1lcy5zbGljZSgwLCAtMSkpIHtcbiAgICAgIGNvbnN0IGNoaWxkID0gbG9ja0ZpbGVTdGFja1swXS5kZXBlbmRlbmNpZXNcbiAgICAgIGlmIChjaGlsZCAmJiBuYW1lIGluIGNoaWxkKSB7XG4gICAgICAgIGxvY2tGaWxlU3RhY2sucHVzaChjaGlsZFtuYW1lXSlcbiAgICAgIH1cbiAgICB9XG4gICAgbG9ja0ZpbGVTdGFjay5yZXZlcnNlKClcbiAgICBjb25zdCByZWxldmFudFN0YWNrRW50cnkgPSBsb2NrRmlsZVN0YWNrLmZpbmQoKGVudHJ5KSA9PiB7XG4gICAgICBpZiAoZW50cnkuZGVwZW5kZW5jaWVzKSB7XG4gICAgICAgIHJldHVybiBlbnRyeS5kZXBlbmRlbmNpZXMgJiYgcGFja2FnZURldGFpbHMubmFtZSBpbiBlbnRyeS5kZXBlbmRlbmNpZXNcbiAgICAgIH0gZWxzZSBpZiAoZW50cnkucGFja2FnZXMpIHtcbiAgICAgICAgcmV0dXJuIGVudHJ5LnBhY2thZ2VzICYmIHBhY2thZ2VEZXRhaWxzLnBhdGggaW4gZW50cnkucGFja2FnZXNcbiAgICAgIH1cbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIGRlcGVuZGVuY2llcyBvciBwYWNrYWdlcyBpbiBsb2NrZmlsZVwiKVxuICAgIH0pXG4gICAgY29uc3QgcGtnID0gcmVsZXZhbnRTdGFja0VudHJ5LmRlcGVuZGVuY2llc1xuICAgICAgPyByZWxldmFudFN0YWNrRW50cnkuZGVwZW5kZW5jaWVzW3BhY2thZ2VEZXRhaWxzLm5hbWVdXG4gICAgICA6IHJlbGV2YW50U3RhY2tFbnRyeS5wYWNrYWdlc1twYWNrYWdlRGV0YWlscy5wYXRoXVxuICAgIHJldHVybiBwa2cucmVzb2x2ZWQgfHwgcGtnLnZlcnNpb24gfHwgcGtnLmZyb21cbiAgfVxufVxuXG5pZiAocmVxdWlyZS5tYWluID09PSBtb2R1bGUpIHtcbiAgY29uc3QgcGFja2FnZURldGFpbHMgPSBnZXRQYXRjaERldGFpbHNGcm9tQ2xpU3RyaW5nKHByb2Nlc3MuYXJndlsyXSlcbiAgaWYgKCFwYWNrYWdlRGV0YWlscykge1xuICAgIGNvbnNvbGUubG9nKGBDYW4ndCBmaW5kIHBhY2thZ2UgJHtwcm9jZXNzLmFyZ3ZbMl19YClcbiAgICBwcm9jZXNzLmV4aXQoMSlcbiAgfVxuICBjb25zb2xlLmxvZyhcbiAgICBnZXRQYWNrYWdlUmVzb2x1dGlvbih7XG4gICAgICBhcHBQYXRoOiBwcm9jZXNzLmN3ZCgpLFxuICAgICAgcGFja2FnZURldGFpbHMsXG4gICAgICBwYWNrYWdlTWFuYWdlcjogZGV0ZWN0UGFja2FnZU1hbmFnZXIocHJvY2Vzcy5jd2QoKSwgbnVsbCksXG4gICAgfSksXG4gIClcbn1cbiJdfQ==