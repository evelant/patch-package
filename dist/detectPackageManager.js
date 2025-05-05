"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPackageManager = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = require("./path");
const chalk_1 = __importDefault(require("chalk"));
const process_1 = __importDefault(require("process"));
const find_yarn_workspace_root_1 = __importDefault(require("find-yarn-workspace-root"));
function printNoYarnLockfileError() {
    console.log(`
${chalk_1.default.red.bold("**ERROR**")} ${chalk_1.default.red(`The --use-yarn option was specified but there is no yarn.lock file`)}
`);
}
function printNoBunLockfileError() {
    console.log(`
${chalk_1.default.red.bold("**ERROR**")} ${chalk_1.default.red(`The --use-bun option was specified but there is no bun.lockb or bun.lock file`)}
`);
}
function printNoLockfilesError() {
    console.log(`
${chalk_1.default.red.bold("**ERROR**")} ${chalk_1.default.red(`No package-lock.json, npm-shrinkwrap.json, yarn.lock, bun.lockb, or bun.lock file.

You must use either npm@>=5, yarn, npm-shrinkwrap, or bun to manage this project's
dependencies.`)}
`);
}
function printSelectingDefaultMessage() {
    console.info(`${chalk_1.default.bold("patch-package")}: you have multiple lockfiles, e.g. yarn.lock and package-lock.json
Defaulting to using ${chalk_1.default.bold("npm")}
You can override this setting by passing --use-yarn, --use-bun, or
deleting the conflicting lockfile if you don't need it
`);
}
function printSelectingDefaultYarnMessage() {
    console.info(`${chalk_1.default.bold("patch-package")}: you have both yarn.lock and bun lockfiles
Defaulting to using ${chalk_1.default.bold("yarn")}
You can override this setting by passing --use-bun, or
deleting yarn.lock if you don't need it
`);
}
function checkForYarnOverride(overridePackageManager) {
    if (overridePackageManager === "yarn") {
        printNoYarnLockfileError();
        process_1.default.exit(1);
    }
}
function checkForBunOverride(overridePackageManager) {
    if (overridePackageManager === "bun") {
        printNoBunLockfileError();
        process_1.default.exit(1);
    }
}
const detectPackageManager = (appRootPath, overridePackageManager) => {
    var _a, _b, _c;
    const packageLockExists = fs_extra_1.default.existsSync(path_1.join(appRootPath, "package-lock.json"));
    const shrinkWrapExists = fs_extra_1.default.existsSync(path_1.join(appRootPath, "npm-shrinkwrap.json"));
    const yarnLockExists = fs_extra_1.default.existsSync(path_1.join((_a = find_yarn_workspace_root_1.default()) !== null && _a !== void 0 ? _a : appRootPath, "yarn.lock"));
    // Bun workspaces seem to work the same as yarn workspaces - https://bun.sh/docs/install/workspaces
    const bunLockbExists = fs_extra_1.default.existsSync(path_1.join((_b = find_yarn_workspace_root_1.default()) !== null && _b !== void 0 ? _b : appRootPath, "bun.lockb"));
    const bunLockExists = fs_extra_1.default.existsSync(path_1.join((_c = find_yarn_workspace_root_1.default()) !== null && _c !== void 0 ? _c : appRootPath, "bun.lock"));
    const bunLockfileExists = bunLockbExists || bunLockExists;
    if ([
        packageLockExists || shrinkWrapExists,
        yarnLockExists,
        bunLockfileExists,
    ].filter(Boolean).length > 1) {
        if (overridePackageManager) {
            return overridePackageManager;
        }
        if (!packageLockExists && !shrinkWrapExists) {
            // The only case where we don't want to default to npm is when we have both yarn and bun lockfiles.
            printSelectingDefaultYarnMessage();
            return "yarn";
        }
        printSelectingDefaultMessage();
        return shrinkWrapExists ? "npm-shrinkwrap" : "npm";
    }
    else if (packageLockExists || shrinkWrapExists) {
        checkForYarnOverride(overridePackageManager);
        checkForBunOverride(overridePackageManager);
        return shrinkWrapExists ? "npm-shrinkwrap" : "npm";
    }
    else if (yarnLockExists) {
        checkForBunOverride(overridePackageManager);
        return "yarn";
    }
    else if (bunLockfileExists) {
        checkForYarnOverride(overridePackageManager);
        return "bun";
    }
    else {
        printNoLockfilesError();
        process_1.default.exit(1);
    }
    throw Error();
};
exports.detectPackageManager = detectPackageManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV0ZWN0UGFja2FnZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGV0ZWN0UGFja2FnZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQXlCO0FBQ3pCLGlDQUE2QjtBQUM3QixrREFBeUI7QUFDekIsc0RBQTZCO0FBQzdCLHdGQUF3RDtBQUl4RCxTQUFTLHdCQUF3QjtJQUMvQixPQUFPLENBQUMsR0FBRyxDQUFDO0VBQ1osZUFBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksZUFBSyxDQUFDLEdBQUcsQ0FDdEMsb0VBQW9FLENBQ3JFO0NBQ0YsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQUVELFNBQVMsdUJBQXVCO0lBQzlCLE9BQU8sQ0FBQyxHQUFHLENBQUM7RUFDWixlQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxlQUFLLENBQUMsR0FBRyxDQUN0QywrRUFBK0UsQ0FDaEY7Q0FDRixDQUFDLENBQUE7QUFDRixDQUFDO0FBRUQsU0FBUyxxQkFBcUI7SUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQztFQUNaLGVBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLGVBQUssQ0FBQyxHQUFHLENBQ3RDOzs7Y0FHVSxDQUNYO0NBQ0YsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQUVELFNBQVMsNEJBQTRCO0lBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQ1YsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUNYLGVBQWUsQ0FDaEI7c0JBQ2lCLGVBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDOzs7Q0FHdEMsQ0FDRSxDQUFBO0FBQ0gsQ0FBQztBQUVELFNBQVMsZ0NBQWdDO0lBQ3ZDLE9BQU8sQ0FBQyxJQUFJLENBQ1YsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUNYLGVBQWUsQ0FDaEI7c0JBQ2lCLGVBQUssQ0FBQyxJQUFJ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WyJpbXBvcnQgZnMgZnJvbSBcImZzLWV4dHJhXCJcbmltcG9ydCB7IGpvaW4gfSBmcm9tIFwiLi9wYXRoXCJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIlxuaW1wb3J0IHByb2Nlc3MgZnJvbSBcInByb2Nlc3NcIlxuaW1wb3J0IGZpbmRXb3Jrc3BhY2VSb290IGZyb20gXCJmaW5kLXlhcm4td29ya3NwYWNlLXJvb3RcIlxuXG5leHBvcnQgdHlwZSBQYWNrYWdlTWFuYWdlciA9IFwieWFyblwiIHwgXCJucG1cIiB8IFwibnBtLXNocmlua3dyYXBcIiB8IFwiYnVuXCJcblxuZnVuY3Rpb24gcHJpbnROb1lhcm5Mb2NrZmlsZUVycm9yKCkge1xuICBjb25zb2xlLmxvZyhgXG4ke2NoYWxrLnJlZC5ib2xkKFwiKipFUlJPUioqXCIpfSAke2NoYWxrLnJlZChcbiAgICBgVGhlIC0tdXNlLXlhcm4gb3B0aW9uIHdhcyBzcGVjaWZpZWQgYnV0IHRoZXJlIGlzIG5vIHlhcm4ubG9jayBmaWxlYCxcbiAgKX1cbmApXG59XG5cbmZ1bmN0aW9uIHByaW50Tm9CdW5Mb2NrZmlsZUVycm9yKCkge1xuICBjb25zb2xlLmxvZyhgXG4ke2NoYWxrLnJlZC5ib2xkKFwiKipFUlJPUioqXCIpfSAke2NoYWxrLnJlZChcbiAgICBgVGhlIC0tdXNlLWJ1biBvcHRpb24gd2FzIHNwZWNpZmllZCBidXQgdGhlcmUgaXMgbm8gYnVuLmxvY2tiIG9yIGJ1bi5sb2NrIGZpbGVgLFxuICApfVxuYClcbn1cblxuZnVuY3Rpb24gcHJpbnROb0xvY2tmaWxlc0Vycm9yKCkge1xuICBjb25zb2xlLmxvZyhgXG4ke2NoYWxrLnJlZC5ib2xkKFwiKipFUlJPUioqXCIpfSAke2NoYWxrLnJlZChcbiAgICBgTm8gcGFja2FnZS1sb2NrLmpzb24sIG5wbS1zaHJpbmt3cmFwLmpzb24sIHlhcm4ubG9jaywgYnVuLmxvY2tiLCBvciBidW4ubG9jayBmaWxlLlxuXG5Zb3UgbXVzdCB1c2UgZWl0aGVyIG5wbUA+PTUsIHlhcm4sIG5wbS1zaHJpbmt3cmFwLCBvciBidW4gdG8gbWFuYWdlIHRoaXMgcHJvamVjdCdzXG5kZXBlbmRlbmNpZXMuYCxcbiAgKX1cbmApXG59XG5cbmZ1bmN0aW9uIHByaW50U2VsZWN0aW5nRGVmYXVsdE1lc3NhZ2UoKSB7XG4gIGNvbnNvbGUuaW5mbyhcbiAgICBgJHtjaGFsay5ib2xkKFxuICAgICAgXCJwYXRjaC1wYWNrYWdlXCIsXG4gICAgKX06IHlvdSBoYXZlIG11bHRpcGxlIGxvY2tmaWxlcywgZS5nLiB5YXJuLmxvY2sgYW5kIHBhY2thZ2UtbG9jay5qc29uXG5EZWZhdWx0aW5nIHRvIHVzaW5nICR7Y2hhbGsuYm9sZChcIm5wbVwiKX1cbllvdSBjYW4gb3ZlcnJpZGUgdGhpcyBzZXR0aW5nIGJ5IHBhc3NpbmcgLS11c2UteWFybiwgLS11c2UtYnVuLCBvclxuZGVsZXRpbmcgdGhlIGNvbmZsaWN0aW5nIGxvY2tmaWxlIGlmIHlvdSBkb24ndCBuZWVkIGl0XG5gLFxuICApXG59XG5cbmZ1bmN0aW9uIHByaW50U2VsZWN0aW5nRGVmYXVsdFlhcm5NZXNzYWdlKCkge1xuICBjb25zb2xlLmluZm8oXG4gICAgYCR7Y2hhbGsuYm9sZChcbiAgICAgIFwicGF0Y2gtcGFja2FnZVwiLFxuICAgICl9OiB5b3UgaGF2ZSBib3RoIHlhcm4ubG9jayBhbmQgYnVuIGxvY2tmaWxlc1xuRGVmYXVsdGluZyB0byB1c2luZyAke2NoYWxrLmJvbGQoXCJ5YXJuXCIpfVxuWW91IGNhbiBvdmVycmlkZSB0aGlzIHNldHRpbmcgYnkgcGFzc2luZyAtLXVzZS1idW4sIG9yXG5kZWxldGluZyB5YXJuLmxvY2sgaWYgeW91IGRvbid0IG5lZWQgaXRcbmAsXG4gIClcbn1cblxuZnVuY3Rpb24gY2hlY2tGb3JZYXJuT3ZlcnJpZGUob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcjogUGFja2FnZU1hbmFnZXIgfCBudWxsKSB7XG4gIGlmIChvdmVycmlkZVBhY2thZ2VNYW5hZ2VyID09PSBcInlhcm5cIikge1xuICAgIHByaW50Tm9ZYXJuTG9ja2ZpbGVFcnJvcigpXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cbn1cblxuZnVuY3Rpb24gY2hlY2tGb3JCdW5PdmVycmlkZShvdmVycmlkZVBhY2thZ2VNYW5hZ2VyOiBQYWNrYWdlTWFuYWdlciB8IG51bGwpIHtcbiAgaWYgKG92ZXJyaWRlUGFja2FnZU1hbmFnZXIgPT09IFwiYnVuXCIpIHtcbiAgICBwcmludE5vQnVuTG9ja2ZpbGVFcnJvcigpXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGRldGVjdFBhY2thZ2VNYW5hZ2VyID0gKFxuICBhcHBSb290UGF0aDogc3RyaW5nLFxuICBvdmVycmlkZVBhY2thZ2VNYW5hZ2VyOiBQYWNrYWdlTWFuYWdlciB8IG51bGwsXG4pOiBQYWNrYWdlTWFuYWdlciA9PiB7XG4gIGNvbnN0IHBhY2thZ2VMb2NrRXhpc3RzID0gZnMuZXhpc3RzU3luYyhcbiAgICBqb2luKGFwcFJvb3RQYXRoLCBcInBhY2thZ2UtbG9jay5qc29uXCIpLFxuICApXG4gIGNvbnN0IHNocmlua1dyYXBFeGlzdHMgPSBmcy5leGlzdHNTeW5jKFxuICAgIGpvaW4oYXBwUm9vdFBhdGgsIFwibnBtLXNocmlua3dyYXAuanNvblwiKSxcbiAgKVxuICBjb25zdCB5YXJuTG9ja0V4aXN0cyA9IGZzLmV4aXN0c1N5bmMoXG4gICAgam9pbihmaW5kV29ya3NwYWNlUm9vdCgpID8/IGFwcFJvb3RQYXRoLCBcInlhcm4ubG9ja1wiKSxcbiAgKVxuICAvLyBCdW4gd29ya3NwYWNlcyBzZWVtIHRvIHdvcmsgdGhlIHNhbWUgYXMgeWFybiB3b3Jrc3BhY2VzIC0gaHR0cHM6Ly9idW4uc2gvZG9jcy9pbnN0YWxsL3dvcmtzcGFjZXNcbiAgY29uc3QgYnVuTG9ja2JFeGlzdHMgPSBmcy5leGlzdHNTeW5jKFxuICAgIGpvaW4oZmluZFdvcmtzcGFjZVJvb3QoKSA/PyBhcHBSb290UGF0aCwgXCJidW4ubG9ja2JcIiksXG4gIClcbiAgY29uc3QgYnVuTG9ja0V4aXN0cyA9IGZzLmV4aXN0c1N5bmMoXG4gICAgam9pbihmaW5kV29ya3NwYWNlUm9vdCgpID8/IGFwcFJvb3RQYXRoLCBcImJ1bi5sb2NrXCIpLFxuICApXG4gIGNvbnN0IGJ1bkxvY2tmaWxlRXhpc3RzID0gYnVuTG9ja2JFeGlzdHMgfHwgYnVuTG9ja0V4aXN0c1xuICBpZiAoXG4gICAgW1xuICAgICAgcGFja2FnZUxvY2tFeGlzdHMgfHwgc2hyaW5rV3JhcEV4aXN0cyxcbiAgICAgIHlhcm5Mb2NrRXhpc3RzLFxuICAgICAgYnVuTG9ja2ZpbGVFeGlzdHMsXG4gICAgXS5maWx0ZXIoQm9vbGVhbikubGVuZ3RoID4gMVxuICApIHtcbiAgICBpZiAob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcikge1xuICAgICAgcmV0dXJuIG92ZXJyaWRlUGFja2FnZU1hbmFnZXJcbiAgICB9XG4gICAgaWYgKCFwYWNrYWdlTG9ja0V4aXN0cyAmJiAhc2hyaW5rV3JhcEV4aXN0cykge1xuICAgICAgLy8gVGhlIG9ubHkgY2FzZSB3aGVyZSB3ZSBkb24ndCB3YW50IHRvIGRlZmF1bHQgdG8gbnBtIGlzIHdoZW4gd2UgaGF2ZSBib3RoIHlhcm4gYW5kIGJ1biBsb2NrZmlsZXMuXG4gICAgICBwcmludFNlbGVjdGluZ0RlZmF1bHRZYXJuTWVzc2FnZSgpXG4gICAgICByZXR1cm4gXCJ5YXJuXCJcbiAgICB9XG4gICAgcHJpbnRTZWxlY3RpbmdEZWZhdWx0TWVzc2FnZSgpXG4gICAgcmV0dXJuIHNocmlua1dyYXBFeGlzdHMgPyBcIm5wbS1zaHJpbmt3cmFwXCIgOiBcIm5wbVwiXG4gIH0gZWxzZSBpZiAocGFja2FnZUxvY2tFeGlzdHMgfHwgc2hyaW5rV3JhcEV4aXN0cykge1xuICAgIGNoZWNrRm9yWWFybk92ZXJyaWRlKG92ZXJyaWRlUGFja2FnZU1hbmFnZXIpXG4gICAgY2hlY2tGb3JCdW5PdmVycmlkZShvdmVycmlkZVBhY2thZ2VNYW5hZ2VyKVxuICAgIHJldHVybiBzaHJpbmtXcmFwRXhpc3RzID8gXCJucG0tc2hyaW5rd3JhcFwiIDogXCJucG1cIlxuICB9IGVsc2UgaWYgKHlhcm5Mb2NrRXhpc3RzKSB7XG4gICAgY2hlY2tGb3JCdW5PdmVycmlkZShvdmVycmlkZVBhY2thZ2VNYW5hZ2VyKVxuICAgIHJldHVybiBcInlhcm5cIlxuICB9IGVsc2UgaWYgKGJ1bkxvY2tmaWxlRXhpc3RzKSB7XG4gICAgY2hlY2tGb3JZYXJuT3ZlcnJpZGUob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcilcbiAgICByZXR1cm4gXCJidW5cIlxuICB9IGVsc2Uge1xuICAgIHByaW50Tm9Mb2NrZmlsZXNFcnJvcigpXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cbiAgdGhyb3cgRXJyb3IoKVxufVxuIl19