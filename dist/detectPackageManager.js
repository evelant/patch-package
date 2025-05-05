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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV0ZWN0UGFja2FnZU1hbmFnZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvZGV0ZWN0UGFja2FnZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQXlCO0FBQ3pCLGlDQUE2QjtBQUM3QixrREFBeUI7QUFDekIsc0RBQTZCO0FBQzdCLHdGQUF3RDtBQUl4RCxTQUFTLHdCQUF3QjtJQUMvQixPQUFPLENBQUMsR0FBRyxDQUFDO0VBQ1osZUFBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksZUFBSyxDQUFDLEdBQUcsQ0FDdEMsb0VBQW9FLENBQ3JFO0NBQ0YsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQUVELFNBQVMsdUJBQXVCO0lBQzlCLE9BQU8sQ0FBQyxHQUFHLENBQUM7RUFDWixlQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxlQUFLLENBQUMsR0FBRyxDQUN0QywrRUFBK0UsQ0FDaEY7Q0FDRixDQUFDLENBQUE7QUFDRixDQUFDO0FBRUQsU0FBUyxxQkFBcUI7SUFDNUIsT0FBTyxDQUFDLEdBQUcsQ0FBQztFQUNaLGVBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLGVBQUssQ0FBQyxHQUFHLENBQ3RDOzs7Y0FHVSxDQUNYO0NBQ0YsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQUVELFNBQVMsNEJBQTRCO0lBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQ1YsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUNYLGVBQWUsQ0FDaEI7c0JBQ2lCLGVBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDOzs7Q0FHdEMsQ0FDRSxDQUFBO0FBQ0gsQ0FBQztBQUVELFNBQVMsZ0NBQWdDO0lBQ3ZDLE9BQU8sQ0FBQyxJQUFJLENBQ1YsR0FBRyxlQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQztzQkFDWixlQUFLLENBQUMsSUFBSSxD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aW1wb3J0IGZzIGZyb20gXCJmcy1leHRyYVwiXG5pbXBvcnQgeyBqb2luIH0gZnJvbSBcIi4vcGF0aFwiXG5pbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCJcbmltcG9ydCBwcm9jZXNzIGZyb20gXCJwcm9jZXNzXCJcbmltcG9ydCBmaW5kV29ya3NwYWNlUm9vdCBmcm9tIFwiZmluZC15YXJuLXdvcmtzcGFjZS1yb290XCJcblxuZXhwb3J0IHR5cGUgUGFja2FnZU1hbmFnZXIgPSBcInlhcm5cIiB8IFwibnBtXCIgfCBcIm5wbS1zaHJpbmt3cmFwXCIgfCBcImJ1blwiXG5cbmZ1bmN0aW9uIHByaW50Tm9ZYXJuTG9ja2ZpbGVFcnJvcigpIHtcbiAgY29uc29sZS5sb2coYFxuJHtjaGFsay5yZWQuYm9sZChcIioqRVJST1IqKlwiKX0gJHtjaGFsay5yZWQoXG4gICAgYFRoZSAtLXVzZS15YXJuIG9wdGlvbiB3YXMgc3BlY2lmaWVkIGJ1dCB0aGVyZSBpcyBubyB5YXJuLmxvY2sgZmlsZWAsXG4gICl9XG5gKVxufVxuXG5mdW5jdGlvbiBwcmludE5vQnVuTG9ja2ZpbGVFcnJvcigpIHtcbiAgY29uc29sZS5sb2coYFxuJHtjaGFsay5yZWQuYm9sZChcIioqRVJST1IqKlwiKX0gJHtjaGFsay5yZWQoXG4gICAgYFRoZSAtLXVzZS1idW4gb3B0aW9uIHdhcyBzcGVjaWZpZWQgYnV0IHRoZXJlIGlzIG5vIGJ1bi5sb2NrYiBvciBidW4ubG9jayBmaWxlYCxcbiAgKX1cbmApXG59XG5cbmZ1bmN0aW9uIHByaW50Tm9Mb2NrZmlsZXNFcnJvcigpIHtcbiAgY29uc29sZS5sb2coYFxuJHtjaGFsay5yZWQuYm9sZChcIioqRVJST1IqKlwiKX0gJHtjaGFsay5yZWQoXG4gICAgYE5vIHBhY2thZ2UtbG9jay5qc29uLCBucG0tc2hyaW5rd3JhcC5qc29uLCB5YXJuLmxvY2ssIGJ1bi5sb2NrYiwgb3IgYnVuLmxvY2sgZmlsZS5cblxuWW91IG11c3QgdXNlIGVpdGhlciBucG1APj01LCB5YXJuLCBucG0tc2hyaW5rd3JhcCwgb3IgYnVuIHRvIG1hbmFnZSB0aGlzIHByb2plY3Qnc1xuZGVwZW5kZW5jaWVzLmAsXG4gICl9XG5gKVxufVxuXG5mdW5jdGlvbiBwcmludFNlbGVjdGluZ0RlZmF1bHRNZXNzYWdlKCkge1xuICBjb25zb2xlLmluZm8oXG4gICAgYCR7Y2hhbGsuYm9sZChcbiAgICAgIFwicGF0Y2gtcGFja2FnZVwiLFxuICAgICl9OiB5b3UgaGF2ZSBtdWx0aXBsZSBsb2NrZmlsZXMsIGUuZy4geWFybi5sb2NrIGFuZCBwYWNrYWdlLWxvY2suanNvblxuRGVmYXVsdGluZyB0byB1c2luZyAke2NoYWxrLmJvbGQoXCJucG1cIil9XG5Zb3UgY2FuIG92ZXJyaWRlIHRoaXMgc2V0dGluZyBieSBwYXNzaW5nIC0tdXNlLXlhcm4sIC0tdXNlLWJ1biwgb3JcbmRlbGV0aW5nIHRoZSBjb25mbGljdGluZyBsb2NrZmlsZSBpZiB5b3UgZG9uJ3QgbmVlZCBpdFxuYCxcbiAgKVxufVxuXG5mdW5jdGlvbiBwcmludFNlbGVjdGluZ0RlZmF1bHRZYXJuTWVzc2FnZSgpIHtcbiAgY29uc29sZS5pbmZvKFxuICAgIGAke2NoYWxrLmJvbGQoXCJwYXRjaC1wYWNrYWdlXCIpfTogeW91IGhhdmUgYm90aCB5YXJuLmxvY2sgYW5kIGJ1biBsb2NrZmlsZXNcbkRlZmF1bHRpbmcgdG8gdXNpbmcgJHtjaGFsay5ib2xkKFwieWFyblwiKX1cbllvdSBjYW4gb3ZlcnJpZGUgdGhpcyBzZXR0aW5nIGJ5IHBhc3NpbmcgLS11c2UtYnVuLCBvclxuZGVsZXRpbmcgeWFybi5sb2NrIGlmIHlvdSBkb24ndCBuZWVkIGl0XG5gLFxuICApXG59XG5cbmZ1bmN0aW9uIGNoZWNrRm9yWWFybk92ZXJyaWRlKG92ZXJyaWRlUGFja2FnZU1hbmFnZXI6IFBhY2thZ2VNYW5hZ2VyIHwgbnVsbCkge1xuICBpZiAob3ZlcnJpZGVQYWNrYWdlTWFuYWdlciA9PT0gXCJ5YXJuXCIpIHtcbiAgICBwcmludE5vWWFybkxvY2tmaWxlRXJyb3IoKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG59XG5cbmZ1bmN0aW9uIGNoZWNrRm9yQnVuT3ZlcnJpZGUob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcjogUGFja2FnZU1hbmFnZXIgfCBudWxsKSB7XG4gIGlmIChvdmVycmlkZVBhY2thZ2VNYW5hZ2VyID09PSBcImJ1blwiKSB7XG4gICAgcHJpbnROb0J1bkxvY2tmaWxlRXJyb3IoKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkZXRlY3RQYWNrYWdlTWFuYWdlciA9IChcbiAgYXBwUm9vdFBhdGg6IHN0cmluZyxcbiAgb3ZlcnJpZGVQYWNrYWdlTWFuYWdlcjogUGFja2FnZU1hbmFnZXIgfCBudWxsLFxuKTogUGFja2FnZU1hbmFnZXIgPT4ge1xuICBjb25zdCBwYWNrYWdlTG9ja0V4aXN0cyA9IGZzLmV4aXN0c1N5bmMoXG4gICAgam9pbihhcHBSb290UGF0aCwgXCJwYWNrYWdlLWxvY2suanNvblwiKSxcbiAgKVxuICBjb25zdCBzaHJpbmtXcmFwRXhpc3RzID0gZnMuZXhpc3RzU3luYyhcbiAgICBqb2luKGFwcFJvb3RQYXRoLCBcIm5wbS1zaHJpbmt3cmFwLmpzb25cIiksXG4gIClcbiAgY29uc3QgeWFybkxvY2tFeGlzdHMgPSBmcy5leGlzdHNTeW5jKFxuICAgIGpvaW4oZmluZFdvcmtzcGFjZVJvb3QoKSA/PyBhcHBSb290UGF0aCwgXCJ5YXJuLmxvY2tcIiksXG4gIClcbiAgLy8gQnVuIHdvcmtzcGFjZXMgc2VlbSB0byB3b3JrIHRoZSBzYW1lIGFzIHlhcm4gd29ya3NwYWNlcyAtIGh0dHBzOi8vYnVuLnNoL2RvY3MvaW5zdGFsbC93b3Jrc3BhY2VzXG4gIGNvbnN0IGJ1bkxvY2tiRXhpc3RzID0gZnMuZXhpc3RzU3luYyhcbiAgICBqb2luKGZpbmRXb3Jrc3BhY2VSb290KCkgPz8gYXBwUm9vdFBhdGgsIFwiYnVuLmxvY2tiXCIpLFxuICApXG4gIGNvbnN0IGJ1bkxvY2tFeGlzdHMgPSBmcy5leGlzdHNTeW5jKFxuICAgIGpvaW4oZmluZFdvcmtzcGFjZVJvb3QoKSA/PyBhcHBSb290UGF0aCwgXCJidW4ubG9ja1wiKSxcbiAgKVxuICBjb25zdCBidW5Mb2NrZmlsZUV4aXN0cyA9IGJ1bkxvY2tiRXhpc3RzIHx8IGJ1bkxvY2tFeGlzdHNcbiAgaWYgKFxuICAgIFtcbiAgICAgIHBhY2thZ2VMb2NrRXhpc3RzIHx8IHNocmlua1dyYXBFeGlzdHMsXG4gICAgICB5YXJuTG9ja0V4aXN0cyxcbiAgICAgIGJ1bkxvY2tmaWxlRXhpc3RzLFxuICAgIF0uZmlsdGVyKEJvb2xlYW4pLmxlbmd0aCA+IDFcbiAgKSB7XG4gICAgaWYgKG92ZXJyaWRlUGFja2FnZU1hbmFnZXIpIHtcbiAgICAgIHJldHVybiBvdmVycmlkZVBhY2thZ2VNYW5hZ2VyXG4gICAgfVxuICAgIGlmICghcGFja2FnZUxvY2tFeGlzdHMgJiYgIXNocmlua1dyYXBFeGlzdHMpIHtcbiAgICAgIC8vIFRoZSBvbmx5IGNhc2Ugd2hlcmUgd2UgZG9uJ3Qgd2FudCB0byBkZWZhdWx0IHRvIG5wbSBpcyB3aGVuIHdlIGhhdmUgYm90aCB5YXJuIGFuZCBidW4gbG9ja2ZpbGVzLlxuICAgICAgcHJpbnRTZWxlY3RpbmdEZWZhdWx0WWFybk1lc3NhZ2UoKVxuICAgICAgcmV0dXJuIFwieWFyblwiXG4gICAgfVxuICAgIHByaW50U2VsZWN0aW5nRGVmYXVsdE1lc3NhZ2UoKVxuICAgIHJldHVybiBzaHJpbmtXcmFwRXhpc3RzID8gXCJucG0tc2hyaW5rd3JhcFwiIDogXCJucG1cIlxuICB9IGVsc2UgaWYgKHBhY2thZ2VMb2NrRXhpc3RzIHx8IHNocmlua1dyYXBFeGlzdHMpIHtcbiAgICBjaGVja0Zvcllhcm5PdmVycmlkZShvdmVycmlkZVBhY2thZ2VNYW5hZ2VyKVxuICAgIGNoZWNrRm9yQnVuT3ZlcnJpZGUob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcilcbiAgICByZXR1cm4gc2hyaW5rV3JhcEV4aXN0cyA/IFwibnBtLXNocmlua3dyYXBcIiA6IFwibnBtXCJcbiAgfSBlbHNlIGlmICh5YXJuTG9ja0V4aXN0cykge1xuICAgIGNoZWNrRm9yQnVuT3ZlcnJpZGUob3ZlcnJpZGVQYWNrYWdlTWFuYWdlcilcbiAgICByZXR1cm4gXCJ5YXJuXCJcbiAgfSBlbHNlIGlmIChidW5Mb2NrZmlsZUV4aXN0cykge1xuICAgIGNoZWNrRm9yWWFybk92ZXJyaWRlKG92ZXJyaWRlUGFja2FnZU1hbmFnZXIpXG4gICAgcmV0dXJuIFwiYnVuXCJcbiAgfSBlbHNlIHtcbiAgICBwcmludE5vTG9ja2ZpbGVzRXJyb3IoKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG4gIHRocm93IEVycm9yKClcbn1cbiJdfQ==