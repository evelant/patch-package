"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPatchSequenceError = exports.makePatch = void 0;
const chalk_1 = __importDefault(require("chalk"));
const console_1 = __importDefault(require("console"));
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const rimraf_1 = require("rimraf");
const tmp_1 = require("tmp");
const zlib_1 = require("zlib");
const applyPatches_1 = require("./applyPatches");
const createIssue_1 = require("./createIssue");
const filterFiles_1 = require("./filterFiles");
const getPackageResolution_1 = require("./getPackageResolution");
const getPackageVersion_1 = require("./getPackageVersion");
const hash_1 = require("./hash");
const PackageDetails_1 = require("./PackageDetails");
const parse_1 = require("./patch/parse");
const patchFs_1 = require("./patchFs");
const path_1 = require("./path");
const resolveRelativeFileDependencies_1 = require("./resolveRelativeFileDependencies");
const spawnSafe_1 = require("./spawnSafe");
const stateFile_1 = require("./stateFile");
function printNoPackageFoundError(packageName, packageJsonPath) {
    console_1.default.log(`No such package ${packageName}

  File not found: ${packageJsonPath}`);
}
function makePatch({ packagePathSpecifier, appPath, packageManager, includePaths, excludePaths, patchDir, createIssue, mode, }) {
    var _a, _b, _c, _d, _e;
    const packageDetails = PackageDetails_1.getPatchDetailsFromCliString(packagePathSpecifier);
    if (!packageDetails) {
        console_1.default.log("No such package", packagePathSpecifier);
        return;
    }
    const state = stateFile_1.getPatchApplicationState(packageDetails);
    const isRebasing = (_a = state === null || state === void 0 ? void 0 : state.isRebasing) !== null && _a !== void 0 ? _a : false;
    // If we are rebasing and no patches have been applied, --append is the only valid option because
    // there are no previous patches to overwrite/update
    if (isRebasing &&
        (state === null || state === void 0 ? void 0 : state.patches.filter((p) => p.didApply).length) === 0 &&
        mode.type === "overwrite_last") {
        mode = { type: "append", name: "initial" };
    }
    if (isRebasing && state) {
        stateFile_1.verifyAppliedPatches({ appPath, patchDir, state });
    }
    if (mode.type === "overwrite_last" &&
        isRebasing &&
        (state === null || state === void 0 ? void 0 : state.patches.length) === 0) {
        mode = { type: "append", name: "initial" };
    }
    const existingPatches = patchFs_1.getGroupedPatches(patchDir).pathSpecifierToPatchFiles[packageDetails.pathSpecifier] || [];
    // apply all existing patches if appending
    // otherwise apply all but the last
    const previouslyAppliedPatches = state === null || state === void 0 ? void 0 : state.patches.filter((p) => p.didApply);
    const patchesToApplyBeforeDiffing = isRebasing
        ? mode.type === "append"
            ? existingPatches.slice(0, previouslyAppliedPatches.length)
            : state.patches[state.patches.length - 1].didApply
                ? existingPatches.slice(0, previouslyAppliedPatches.length - 1)
                : existingPatches.slice(0, previouslyAppliedPatches.length)
        : mode.type === "append"
            ? existingPatches
            : existingPatches.slice(0, -1);
    if (createIssue && mode.type === "append") {
        console_1.default.log("--create-issue is not compatible with --append.");
        process.exit(1);
    }
    if (createIssue && isRebasing) {
        console_1.default.log("--create-issue is not compatible with rebasing.");
        process.exit(1);
    }
    const numPatchesAfterCreate = mode.type === "append" || existingPatches.length === 0
        ? existingPatches.length + 1
        : existingPatches.length;
    const vcs = createIssue_1.getPackageVCSDetails(packageDetails);
    const canCreateIssue = !isRebasing &&
        createIssue_1.shouldRecommendIssue(vcs) &&
        numPatchesAfterCreate === 1 &&
        mode.type !== "append";
    const appPackageJson = require(path_1.join(appPath, "package.json"));
    const packagePath = path_1.join(appPath, packageDetails.path);
    const packageJsonPath = path_1.join(packagePath, "package.json");
    if (!fs_extra_1.existsSync(packageJsonPath)) {
        printNoPackageFoundError(packagePathSpecifier, packageJsonPath);
        process.exit(1);
    }
    const tmpRepo = tmp_1.dirSync({ unsafeCleanup: true });
    const tmpRepoPackagePath = path_1.join(tmpRepo.name, packageDetails.path);
    const tmpRepoNpmRoot = tmpRepoPackagePath.slice(0, -`/node_modules/${packageDetails.name}`.length);
    const tmpRepoPackageJsonPath = path_1.join(tmpRepoNpmRoot, "package.json");
    try {
        const patchesDir = path_1.resolve(path_1.join(appPath, patchDir));
        console_1.default.info(chalk_1.default.grey("•"), "Creating temporary folder");
        // make a blank package.json
        fs_extra_1.mkdirpSync(tmpRepoNpmRoot);
        fs_extra_1.writeFileSync(tmpRepoPackageJsonPath, JSON.stringify({
            dependencies: {
                [packageDetails.name]: getPackageResolution_1.getPackageResolution({
                    packageDetails,
                    packageManager,
                    appPath,
                }),
            },
            resolutions: resolveRelativeFileDependencies_1.resolveRelativeFileDependencies(appPath, appPackageJson.resolutions || {}),
        }));
        const packageVersion = getPackageVersion_1.getPackageVersion(path_1.join(path_1.resolve(packageDetails.path), "package.json"));
        [".npmrc", ".yarnrc", ".yarn"].forEach((rcFile) => {
            const rcPath = path_1.join(appPath, rcFile);
            if (fs_extra_1.existsSync(rcPath)) {
                fs_extra_1.copySync(rcPath, path_1.join(tmpRepo.name, rcFile), { dereference: true });
            }
        });
        if (packageManager === "yarn") {
            console_1.default.info(chalk_1.default.grey("•"), `Installing ${packageDetails.name}@${packageVersion} with yarn`);
            try {
                // try first without ignoring scripts in case they are required
                // this works in 99.99% of cases
                spawnSafe_1.spawnSafeSync(`yarn`, ["install", "--ignore-engines"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: false,
                });
            }
            catch (e) {
                // try again while ignoring scripts in case the script depends on
                // an implicit context which we haven't reproduced
                spawnSafe_1.spawnSafeSync(`yarn`, ["install", "--ignore-engines", "--ignore-scripts"], {
                    cwd: tmpRepoNpmRoot,
                });
            }
        }
        else if (packageManager === "bun") {
            console_1.default.info(chalk_1.default.grey("•"), `Installing ${packageDetails.name}@${packageVersion} with bun`);
            try {
                // Try installing with bun first
                spawnSafe_1.spawnSafeSync(`bun`, ["install", "--no-save"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: true,
                    env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" })
                });
            }
            catch (e) {
                console_1.default.info(chalk_1.default.yellow("⚠"), `Bun installation failed, falling back to npm`);
                try {
                    // Fall back to npm if bun fails
                    spawnSafe_1.spawnSafeSync(`npm`, ["i", "--force", "--no-fund", "--no-audit"], {
                        cwd: tmpRepoNpmRoot,
                        logStdErrOnError: true,
                        env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" })
                    });
                }
                catch (e) {
                    // try again while ignoring scripts
                    spawnSafe_1.spawnSafeSync(`npm`, ["i", "--ignore-scripts", "--force", "--no-fund", "--no-audit"], {
                        cwd: tmpRepoNpmRoot,
                        logStdErrOnError: true,
                        env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" })
                    });
                }
            }
        }
        else {
            console_1.default.info(chalk_1.default.grey("•"), `Installing ${packageDetails.name}@${packageVersion} with npm`);
            try {
                // try first without ignoring scripts in case they are required
                // this works in 99.99% of cases
                spawnSafe_1.spawnSafeSync(`npm`, ["i", "--force", "--no-fund", "--no-audit"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: true,
                    env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" })
                });
            }
            catch (e) {
                // try again while ignoring scripts in case the script depends on
                // an implicit context which we haven't reproduced
                spawnSafe_1.spawnSafeSync(`npm`, ["i", "--ignore-scripts", "--force", "--no-fund", "--no-audit"], {
                    cwd: tmpRepoNpmRoot,
                    logStdErrOnError: true,
                    env: Object.assign(Object.assign({}, process.env), { NODE_ENV: "development" })
                });
            }
        }
        const git = (...args) => spawnSafe_1.spawnSafeSync("git", args, {
            cwd: tmpRepo.name,
            env: Object.assign(Object.assign({}, process.env), { HOME: tmpRepo.name }),
            maxBuffer: 1024 * 1024 * 100,
        });
        // remove nested node_modules just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, "node_modules"));
        // remove .git just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, ".git"));
        // remove patch-package state file
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, stateFile_1.STATE_FILE_NAME));
        // commit the package
        console_1.default.info(chalk_1.default.grey("•"), "Diffing your files with clean files");
        fs_extra_1.writeFileSync(path_1.join(tmpRepo.name, ".gitignore"), "!/node_modules\n\n");
        git("init");
        git("config", "--local", "user.name", "patch-package");
        git("config", "--local", "user.email", "patch@pack.age");
        // remove ignored files first
        filterFiles_1.removeIgnoredFiles(tmpRepoPackagePath, includePaths, excludePaths);
        for (const patchDetails of patchesToApplyBeforeDiffing) {
            if (!applyPatches_1.applyPatch({
                patchDetails,
                patchDir,
                patchFilePath: path_1.join(appPath, patchDir, patchDetails.patchFilename),
                reverse: false,
                cwd: tmpRepo.name,
                bestEffort: false,
            })) {
                // TODO: add better error message once --rebase is implemented
                console_1.default.log(`Failed to apply patch ${patchDetails.patchFilename} to ${packageDetails.pathSpecifier}`);
                process.exit(1);
            }
        }
        git("add", "-f", packageDetails.path);
        git("commit", "--allow-empty", "-m", "init");
        // replace package with user's version
        rimraf_1.sync(tmpRepoPackagePath);
        // pnpm installs packages as symlinks, copySync would copy only the symlink
        fs_extra_1.copySync(fs_extra_1.realpathSync(packagePath), tmpRepoPackagePath);
        // remove nested node_modules just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, "node_modules"));
        // remove .git just to be safe
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, ".git"));
        // remove patch-package state file
        rimraf_1.sync(path_1.join(tmpRepoPackagePath, stateFile_1.STATE_FILE_NAME));
        // also remove ignored files like before
        filterFiles_1.removeIgnoredFiles(tmpRepoPackagePath, includePaths, excludePaths);
        // stage all files
        git("add", "-f", packageDetails.path);
        // get diff of changes
        const diffResult = git("diff", "--cached", "--no-color", "--ignore-space-at-eol", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/");
        if (diffResult.stdout.length === 0) {
            console_1.default.log(`⁉️  Not creating patch file for package '${packagePathSpecifier}'`);
            console_1.default.log(`⁉️  There don't appear to be any changes.`);
            if (isRebasing && mode.type === "overwrite_last") {
                console_1.default.log("\n💡 To remove a patch file, delete it and then reinstall node_modules from scratch.");
            }
            process.exit(1);
            return;
        }
        try {
            parse_1.parsePatchFile(diffResult.stdout.toString());
        }
        catch (e) {
            if (e.message.includes("Unexpected file mode string: 120000")) {
                console_1.default.log(`
⛔️ ${chalk_1.default.red.bold("ERROR")}

  Your changes involve creating symlinks. patch-package does not yet support
  symlinks.

  ️Please use ${chalk_1.default.bold("--include")} and/or ${chalk_1.default.bold("--exclude")} to narrow the scope of your patch if
  this was unintentional.
`);
            }
            else {
                const outPath = "./patch-package-error.json.gz";
                fs_extra_1.writeFileSync(outPath, zlib_1.gzipSync(JSON.stringify({
                    error: { message: e.message, stack: e.stack },
                    patch: diffResult.stdout.toString(),
                })));
                console_1.default.log(`
⛔️ ${chalk_1.default.red.bold("ERROR")}

  patch-package was unable to read the patch-file made by git. This should not
  happen.

  A diagnostic file was written to

    ${outPath}

  Please attach it to a github issue

    https://github.com/ds300/patch-package/issues/new?title=New+patch+parse+failed&body=Please+attach+the+diagnostic+file+by+dragging+it+into+here+🙏

  Note that this diagnostic file will contain code from the package you were
  attempting to patch.

`);
            }
            process.exit(1);
            return;
        }
        // maybe delete existing
        if (mode.type === "append" && !isRebasing && existingPatches.length === 1) {
            // if we are appending to an existing patch that doesn't have a sequence number let's rename it
            const prevPatch = existingPatches[0];
            if (prevPatch.sequenceNumber === undefined) {
                const newFileName = createPatchFileName({
                    packageDetails,
                    packageVersion,
                    sequenceNumber: 1,
                    sequenceName: (_b = prevPatch.sequenceName) !== null && _b !== void 0 ? _b : "initial",
                });
                const oldPath = path_1.join(appPath, patchDir, prevPatch.patchFilename);
                const newPath = path_1.join(appPath, patchDir, newFileName);
                fs_1.renameSync(oldPath, newPath);
                prevPatch.sequenceNumber = 1;
                prevPatch.patchFilename = newFileName;
                prevPatch.sequenceName = (_c = prevPatch.sequenceName) !== null && _c !== void 0 ? _c : "initial";
            }
        }
        const lastPatch = existingPatches[state ? state.patches.length - 1 : existingPatches.length - 1];
        const sequenceName = mode.type === "append" ? mode.name : lastPatch === null || lastPatch === void 0 ? void 0 : lastPatch.sequenceName;
        const sequenceNumber = mode.type === "append"
            ? ((_d = lastPatch === null || lastPatch === void 0 ? void 0 : lastPatch.sequenceNumber) !== null && _d !== void 0 ? _d : 0) + 1
            : lastPatch === null || lastPatch === void 0 ? void 0 : lastPatch.sequenceNumber;
        const patchFileName = createPatchFileName({
            packageDetails,
            packageVersion,
            sequenceName,
            sequenceNumber,
        });
        const patchPath = path_1.join(patchesDir, patchFileName);
        if (!fs_extra_1.existsSync(path_1.dirname(patchPath))) {
            // scoped package
            fs_extra_1.mkdirSync(path_1.dirname(patchPath));
        }
        // if we are inserting a new patch into a sequence we most likely need to update the sequence numbers
        if (isRebasing && mode.type === "append") {
            const patchesToNudge = existingPatches.slice(state.patches.length);
            if (sequenceNumber === undefined) {
                throw new Error("sequenceNumber is undefined while rebasing");
            }
            if (((_e = patchesToNudge[0]) === null || _e === void 0 ? void 0 : _e.sequenceNumber) !== undefined &&
                patchesToNudge[0].sequenceNumber <= sequenceNumber) {
                let next = sequenceNumber + 1;
                for (const p of patchesToNudge) {
                    const newName = createPatchFileName({
                        packageDetails,
                        packageVersion,
                        sequenceName: p.sequenceName,
                        sequenceNumber: next++,
                    });
                    console_1.default.log("Renaming", chalk_1.default.bold(p.patchFilename), "to", chalk_1.default.bold(newName));
                    const oldPath = path_1.join(appPath, patchDir, p.patchFilename);
                    const newPath = path_1.join(appPath, patchDir, newName);
                    fs_1.renameSync(oldPath, newPath);
                }
            }
        }
        fs_extra_1.writeFileSync(patchPath, diffResult.stdout);
        console_1.default.log(`${chalk_1.default.green("✔")} Created file ${path_1.join(patchDir, patchFileName)}\n`);
        const prevState = patchesToApplyBeforeDiffing.map((p) => ({
            patchFilename: p.patchFilename,
            didApply: true,
            patchContentHash: hash_1.hashFile(path_1.join(appPath, patchDir, p.patchFilename)),
        }));
        const nextState = [
            ...prevState,
            {
                patchFilename: patchFileName,
                didApply: true,
                patchContentHash: hash_1.hashFile(patchPath),
            },
        ];
        // if any patches come after this one we just made, we should reapply them
        let didFailWhileFinishingRebase = false;
        if (isRebasing) {
            const currentPatches = patchFs_1.getGroupedPatches(path_1.join(appPath, patchDir))
                .pathSpecifierToPatchFiles[packageDetails.pathSpecifier];
            const previouslyUnappliedPatches = currentPatches.slice(nextState.length);
            if (previouslyUnappliedPatches.length) {
                console_1.default.log(`Fast forwarding...`);
                for (const patch of previouslyUnappliedPatches) {
                    const patchFilePath = path_1.join(appPath, patchDir, patch.patchFilename);
                    if (!applyPatches_1.applyPatch({
                        patchDetails: patch,
                        patchDir,
                        patchFilePath,
                        reverse: false,
                        cwd: process.cwd(),
                        bestEffort: false,
                    })) {
                        didFailWhileFinishingRebase = true;
                        logPatchSequenceError({ patchDetails: patch });
                        nextState.push({
                            patchFilename: patch.patchFilename,
                            didApply: false,
                            patchContentHash: hash_1.hashFile(patchFilePath),
                        });
                        break;
                    }
                    else {
                        console_1.default.log(`  ${chalk_1.default.green("✔")} ${patch.patchFilename}`);
                        nextState.push({
                            patchFilename: patch.patchFilename,
                            didApply: true,
                            patchContentHash: hash_1.hashFile(patchFilePath),
                        });
                    }
                }
            }
        }
        if (isRebasing || numPatchesAfterCreate > 1) {
            stateFile_1.savePatchApplicationState({
                packageDetails,
                patches: nextState,
                isRebasing: didFailWhileFinishingRebase,
            });
        }
        else {
            stateFile_1.clearPatchApplicationState(packageDetails);
        }
        if (canCreateIssue) {
            if (createIssue) {
                createIssue_1.openIssueCreationLink({
                    packageDetails,
                    patchFileContents: diffResult.stdout.toString(),
                    packageVersion,
                });
            }
            else {
                createIssue_1.maybePrintIssueCreationPrompt(vcs, packageDetails, packageManager);
            }
        }
    }
    catch (e) {
        console_1.default.log(e);
        throw e;
    }
    finally {
        tmpRepo.removeCallback();
    }
}
exports.makePatch = makePatch;
function createPatchFileName({ packageDetails, packageVersion, sequenceNumber, sequenceName, }) {
    const packageNames = packageDetails.packageNames
        .map((name) => name.replace(/\//g, "+"))
        .join("++");
    const nameAndVersion = `${packageNames}+${packageVersion}`;
    const num = sequenceNumber === undefined
        ? ""
        : `+${sequenceNumber.toString().padStart(3, "0")}`;
    const name = !sequenceName ? "" : `+${sequenceName}`;
    return `${nameAndVersion}${num}${name}.patch`;
}
function logPatchSequenceError({ patchDetails, }) {
    console_1.default.log(`
${chalk_1.default.red.bold("⛔ ERROR")}

Failed to apply patch file ${chalk_1.default.bold(patchDetails.patchFilename)}.

If this patch file is no longer useful, delete it and run

  ${chalk_1.default.bold(`patch-package`)}

To partially apply the patch (if possible) and output a log of errors to fix, run

  ${chalk_1.default.bold(`patch-package --partial`)}

After which you should make any required changes inside ${patchDetails.path}, and finally run

  ${chalk_1.default.bold(`patch-package ${patchDetails.pathSpecifier}`)}

to update the patch file.
`);
}
exports.logPatchSequenceError = logPatchSequenceError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFrZVBhdGNoLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL21ha2VQYXRjaC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBeUI7QUFDekIsc0RBQTZCO0FBQzdCLDJCQUErQjtBQUMvQix1Q0FPaUI7QUFDakIsbUNBQXVDO0FBQ3ZDLDZCQUE2QjtBQUM3QiwrQkFBK0I7QUFDL0IsaURBQTJDO0FBQzNDLCtDQUtzQjtBQUV0QiwrQ0FBa0Q7QUFDbEQsaUVBQTZEO0FBQzdELDJEQUF1RDtBQUN2RCxpQ0FBaUM7QUFDakMscURBSXlCO0FBQ3pCLHlDQUE4QztBQUM5Qyx1Q0FBNkM7QUFDN0MsaUNBQStDO0FBQy9DLHVGQUFtRjtBQUNuRiwyQ0FBMkM7QUFDM0MsMkNBT29CO0FBRXBCLFNBQVMsd0JBQXdCLENBQy9CLFdBQW1CLEVBQ25CLGVBQXVCO0lBRXZCLGlCQUFPLENBQUMsR0FBRyxDQUNULG1CQUFtQixXQUFXOztvQkFFZCxlQUFlLEVBQUUsQ0FDbEMsQ0FBQTtBQUNILENBQUM7QUFFRCxTQUFnQixTQUFTLENBQUMsRUFDeEIsb0JBQW9CLEVBQ3BCLE9BQU8sRUFDUCxjQUFjLEVBQ2QsWUFBWSxFQUNaLFlBQVksRUFDWixRQUFRLEVBQ1IsV0FBVyxFQUNYLElBQUksR0FVTDs7SUFDQyxNQUFNLGNBQWMsR0FBRyw2Q0FBNEIsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFBO0lBRXpFLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDbkIsaUJBQU8sQ0FBQyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsb0JBQW9CLENBQUMsQ0FBQTtRQUNwRCxPQUFNO0tBQ1A7SUFFRCxNQUFNLEtBQUssR0FBRyxvQ0FBd0IsQ0FBQyxjQUFjLENBQUMsQ0FBQTtJQUN0RCxNQUFNLFVBQVUsR0FBRyxNQUFBLEtBQUssYUFBTCxLQUFLLHVCQUFMLEtBQUssQ0FBRSxVQUFVLG1DQUFJLEtBQUssQ0FBQTtJQUU3QyxpR0FBaUc7SUFDakcsb0RBQW9E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LENBQUM7RUFDWixlQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7OzZCQUVFLGVBQUssQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLGFBQWEsQ0FBQzs7OztJQUkvRCxlQUFLLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQzs7OztJQUkzQixlQUFLLENBQUMsSUFBSSxDQUFDLHlCQUF5QixDQUFDOzswREFHckMsWUFBWSxDQUFDLElBQ2Y7O0lBRUUsZUFBSyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsWUFBWSxDQUFDLGFBQWEsRUFBRSxDQUFDOzs7Q0FHNUQsQ0FBQyxDQUFBO0FBQ0YsQ0FBQztBQTFCRCxzREEwQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCJcbmltcG9ydCBjb25zb2xlIGZyb20gXCJjb25zb2xlXCJcbmltcG9ydCB7IHJlbmFtZVN5bmMgfSBmcm9tIFwiZnNcIlxuaW1wb3J0IHtcbiAgY29weVN5bmMsXG4gIGV4aXN0c1N5bmMsXG4gIG1rZGlycFN5bmMsXG4gIG1rZGlyU3luYyxcbiAgcmVhbHBhdGhTeW5jLFxuICB3cml0ZUZpbGVTeW5jLFxufSBmcm9tIFwiZnMtZXh0cmFcIlxuaW1wb3J0IHsgc3luYyBhcyByaW1yYWYgfSBmcm9tIFwicmltcmFmXCJcbmltcG9ydCB7IGRpclN5bmMgfSBmcm9tIFwidG1wXCJcbmltcG9ydCB7IGd6aXBTeW5jIH0gZnJvbSBcInpsaWJcIlxuaW1wb3J0IHsgYXBwbHlQYXRjaCB9IGZyb20gXCIuL2FwcGx5UGF0Y2hlc1wiXG5pbXBvcnQge1xuICBnZXRQYWNrYWdlVkNTRGV0YWlscyxcbiAgbWF5YmVQcmludElzc3VlQ3JlYXRpb25Qcm9tcHQsXG4gIG9wZW5Jc3N1ZUNyZWF0aW9uTGluayxcbiAgc2hvdWxkUmVjb21tZW5kSXNzdWUsXG59IGZyb20gXCIuL2NyZWF0ZUlzc3VlXCJcbmltcG9ydCB7IFBhY2thZ2VNYW5hZ2VyIH0gZnJvbSBcIi4vZGV0ZWN0UGFja2FnZU1hbmFnZXJcIlxuaW1wb3J0IHsgcmVtb3ZlSWdub3JlZEZpbGVzIH0gZnJvbSBcIi4vZmlsdGVyRmlsZXNcIlxuaW1wb3J0IHsgZ2V0UGFja2FnZVJlc29sdXRpb24gfSBmcm9tIFwiLi9nZXRQYWNrYWdlUmVzb2x1dGlvblwiXG5pbXBvcnQgeyBnZXRQYWNrYWdlVmVyc2lvbiB9IGZyb20gXCIuL2dldFBhY2thZ2VWZXJzaW9uXCJcbmltcG9ydCB7IGhhc2hGaWxlIH0gZnJvbSBcIi4vaGFzaFwiXG5pbXBvcnQge1xuICBnZXRQYXRjaERldGFpbHNGcm9tQ2xpU3RyaW5nLFxuICBQYWNrYWdlRGV0YWlscyxcbiAgUGF0Y2hlZFBhY2thZ2VEZXRhaWxzLFxufSBmcm9tIFwiLi9QYWNrYWdlRGV0YWlsc1wiXG5pbXBvcnQgeyBwYXJzZVBhdGNoRmlsZSB9IGZyb20gXCIuL3BhdGNoL3BhcnNlXCJcbmltcG9ydCB7IGdldEdyb3VwZWRQYXRjaGVzIH0gZnJvbSBcIi4vcGF0Y2hGc1wiXG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luLCByZXNvbHZlIH0gZnJvbSBcIi4vcGF0aFwiXG5pbXBvcnQgeyByZXNvbHZlUmVsYXRpdmVGaWxlRGVwZW5kZW5jaWVzIH0gZnJvbSBcIi4vcmVzb2x2ZVJlbGF0aXZlRmlsZURlcGVuZGVuY2llc1wiXG5pbXBvcnQgeyBzcGF3blNhZmVTeW5jIH0gZnJvbSBcIi4vc3Bhd25TYWZlXCJcbmltcG9ydCB7XG4gIGNsZWFyUGF0Y2hBcHBsaWNhdGlvblN0YXRlLFxuICBnZXRQYXRjaEFwcGxpY2F0aW9uU3RhdGUsXG4gIFBhdGNoU3RhdGUsXG4gIHNhdmVQYXRjaEFwcGxpY2F0aW9uU3RhdGUsXG4gIFNUQVRFX0ZJTEVfTkFNRSxcbiAgdmVyaWZ5QXBwbGllZFBhdGNoZXMsXG59IGZyb20gXCIuL3N0YXRlRmlsZVwiXG5cbmZ1bmN0aW9uIHByaW50Tm9QYWNrYWdlRm91bmRFcnJvcihcbiAgcGFja2FnZU5hbWU6IHN0cmluZyxcbiAgcGFja2FnZUpzb25QYXRoOiBzdHJpbmcsXG4pIHtcbiAgY29uc29sZS5sb2coXG4gICAgYE5vIHN1Y2ggcGFja2FnZSAke3BhY2thZ2VOYW1lfVxuXG4gIEZpbGUgbm90IGZvdW5kOiAke3BhY2thZ2VKc29uUGF0aH1gLFxuICApXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBtYWtlUGF0Y2goe1xuICBwYWNrYWdlUGF0aFNwZWNpZmllcixcbiAgYXBwUGF0aCxcbiAgcGFja2FnZU1hbmFnZXIsXG4gIGluY2x1ZGVQYXRocyxcbiAgZXhjbHVkZVBhdGhzLFxuICBwYXRjaERpcixcbiAgY3JlYXRlSXNzdWUsXG4gIG1vZGUsXG59OiB7XG4gIHBhY2thZ2VQYXRoU3BlY2lmaWVyOiBzdHJpbmdcbiAgYXBwUGF0aDogc3RyaW5nXG4gIHBhY2thZ2VNYW5hZ2VyOiBQYWNrYWdlTWFuYWdlclxuICBpbmNsdWRlUGF0aHM6IFJlZ0V4cFxuICBleGNsdWRlUGF0aHM6IFJlZ0V4cFxuICBwYXRjaERpcjogc3RyaW5nXG4gIGNyZWF0ZUlzc3VlOiBib29sZWFuXG4gIG1vZGU6IHsgdHlwZTogXCJvdmVyd3JpdGVfbGFzdFwiIH0gfCB7IHR5cGU6IFwiYXBwZW5kXCI7IG5hbWU/OiBzdHJpbmcgfVxufSkge1xuICBjb25zdCBwYWNrYWdlRGV0YWlscyA9IGdldFBhdGNoRGV0YWlsc0Zyb21DbGlTdHJpbmcocGFja2FnZVBhdGhTcGVjaWZpZXIpXG5cbiAgaWYgKCFwYWNrYWdlRGV0YWlscykge1xuICAgIGNvbnNvbGUubG9nKFwiTm8gc3VjaCBwYWNrYWdlXCIsIHBhY2thZ2VQYXRoU3BlY2lmaWVyKVxuICAgIHJldHVyblxuICB9XG5cbiAgY29uc3Qgc3RhdGUgPSBnZXRQYXRjaEFwcGxpY2F0aW9uU3RhdGUocGFja2FnZURldGFpbHMpXG4gIGNvbnN0IGlzUmViYXNpbmcgPSBzdGF0ZT8uaXNSZWJhc2luZyA/PyBmYWxzZVxuXG4gIC8vIElmIHdlIGFyZSByZWJhc2luZyBhbmQgbm8gcGF0Y2hlcyBoYXZlIGJlZW4gYXBwbGllZCwgLS1hcHBlbmQgaXMgdGhlIG9ubHkgdmFsaWQgb3B0aW9uIGJlY2F1c2VcbiAgLy8gdGhlcmUgYXJlIG5vIHByZXZpb3VzIHBhdGNoZXMgdG8gb3ZlcndyaXRlL3VwZGF0ZVxuICBpZiAoXG4gICAgaXNSZWJhc2luZyAmJlxuICAgIHN0YXRlPy5wYXRjaGVzLmZpbHRlcigocCkgPT4gcC5kaWRBcHBseSkubGVuZ3RoID09PSAwICYmXG4gICAgbW9kZS50eXBlID09PSBcIm92ZXJ3cml0ZV9sYXN0XCJcbiAgKSB7XG4gICAgbW9kZSA9IHsgdHlwZTogXCJhcHBlbmRcIiwgbmFtZTogXCJpbml0aWFsXCIgfVxuICB9XG5cbiAgaWYgKGlzUmViYXNpbmcgJiYgc3RhdGUpIHtcbiAgICB2ZXJpZnlBcHBsaWVkUGF0Y2hlcyh7IGFwcFBhdGgsIHBhdGNoRGlyLCBzdGF0ZSB9KVxuICB9XG5cbiAgaWYgKFxuICAgIG1vZGUudHlwZSA9PT0gXCJvdmVyd3JpdGVfbGFzdFwiICYmXG4gICAgaXNSZWJhc2luZyAmJlxuICAgIHN0YXRlPy5wYXRjaGVzLmxlbmd0aCA9PT0gMFxuICApIHtcbiAgICBtb2RlID0geyB0eXBlOiBcImFwcGVuZFwiLCBuYW1lOiBcImluaXRpYWxcIiB9XG4gIH1cblxuICBjb25zdCBleGlzdGluZ1BhdGNoZXMgPVxuICAgIGdldEdyb3VwZWRQYXRjaGVzKHBhdGNoRGlyKS5wYXRoU3BlY2lmaWVyVG9QYXRjaEZpbGVzW1xuICAgICAgcGFja2FnZURldGFpbHMucGF0aFNwZWNpZmllclxuICAgIF0gfHwgW11cblxuICAvLyBhcHBseSBhbGwgZXhpc3RpbmcgcGF0Y2hlcyBpZiBhcHBlbmRpbmdcbiAgLy8gb3RoZXJ3aXNlIGFwcGx5IGFsbCBidXQgdGhlIGxhc3RcbiAgY29uc3QgcHJldmlvdXNseUFwcGxpZWRQYXRjaGVzID0gc3RhdGU/LnBhdGNoZXMuZmlsdGVyKChwKSA9PiBwLmRpZEFwcGx5KVxuICBjb25zdCBwYXRjaGVzVG9BcHBseUJlZm9yZURpZmZpbmc6IFBhdGNoZWRQYWNrYWdlRGV0YWlsc1tdID0gaXNSZWJhc2luZ1xuICAgID8gbW9kZS50eXBlID09PSBcImFwcGVuZFwiXG4gICAgICA/IGV4aXN0aW5nUGF0Y2hlcy5zbGljZSgwLCBwcmV2aW91c2x5QXBwbGllZFBhdGNoZXMhLmxlbmd0aClcbiAgICAgIDogc3RhdGUhLnBhdGNoZXNbc3RhdGUhLnBhdGNoZXMubGVuZ3RoIC0gMV0uZGlkQXBwbHlcbiAgICAgID8gZXhpc3RpbmdQYXRjaGVzLnNsaWNlKDAsIHByZXZpb3VzbHlBcHBsaWVkUGF0Y2hlcyEubGVuZ3RoIC0gMSlcbiAgICAgIDogZXhpc3RpbmdQYXRjaGVzLnNsaWNlKDAsIHByZXZpb3VzbHlBcHBsaWVkUGF0Y2hlcyEubGVuZ3RoKVxuICAgIDogbW9kZS50eXBlID09PSBcImFwcGVuZFwiXG4gICAgPyBleGlzdGluZ1BhdGNoZXNcbiAgICA6IGV4aXN0aW5nUGF0Y2hlcy5zbGljZSgwLCAtMSlcblxuICBpZiAoY3JlYXRlSXNzdWUgJiYgbW9kZS50eXBlID09PSBcImFwcGVuZFwiKSB7XG4gICAgY29uc29sZS5sb2coXCItLWNyZWF0ZS1pc3N1ZSBpcyBub3QgY29tcGF0aWJsZSB3aXRoIC0tYXBwZW5kLlwiKVxuICAgIHByb2Nlc3MuZXhpdCgxKVxuICB9XG5cbiAgaWYgKGNyZWF0ZUlzc3VlICYmIGlzUmViYXNpbmcpIHtcbiAgICBjb25zb2xlLmxvZyhcIi0tY3JlYXRlLWlzc3VlIGlzIG5vdCBjb21wYXRpYmxlIHdpdGggcmViYXNpbmcuXCIpXG4gICAgcHJvY2Vzcy5leGl0KDEpXG4gIH1cblxuICBjb25zdCBudW1QYXRjaGVzQWZ0ZXJDcmVhdGUgPVxuICAgIG1vZGUudHlwZSA9PT0gXCJhcHBlbmRcIiB8fCBleGlzdGluZ1BhdGNoZXMubGVuZ3RoID09PSAwXG4gICAgICA/IGV4aXN0aW5nUGF0Y2hlcy5sZW5ndGggKyAxXG4gICAgICA6IGV4aXN0aW5nUGF0Y2hlcy5sZW5ndGhcbiAgY29uc3QgdmNzID0gZ2V0UGFja2FnZVZDU0RldGFpbHMocGFja2FnZURldGFpbHMpXG4gIGNvbnN0IGNhbkNyZWF0ZUlzc3VlID1cbiAgICAhaXNSZWJhc2luZyAmJlxuICAgIHNob3VsZFJlY29tbWVuZElzc3VlKHZjcykgJiZcbiAgICBudW1QYXRjaGVzQWZ0ZXJDcmVhdGUgPT09IDEgJiZcbiAgICBtb2RlLnR5cGUgIT09IFwiYXBwZW5kXCJcblxuICBjb25zdCBhcHBQYWNrYWdlSnNvbiA9IHJlcXVpcmUoam9pbihhcHBQYXRoLCBcInBhY2thZ2UuanNvblwiKSlcbiAgY29uc3QgcGFja2FnZVBhdGggPSBqb2luKGFwcFBhdGgsIHBhY2thZ2VEZXRhaWxzLnBhdGgpXG4gIGNvbnN0IHBhY2thZ2VKc29uUGF0aCA9IGpvaW4ocGFja2FnZVBhdGgsIFwicGFja2FnZS5qc29uXCIpXG5cbiAgaWYgKCFleGlzdHNTeW5jKHBhY2thZ2VKc29uUGF0aCkpIHtcbiAgICBwcmludE5vUGFja2FnZUZvdW5kRXJyb3IocGFja2FnZVBhdGhTcGVjaWZpZXIsIHBhY2thZ2VKc29uUGF0aClcbiAgICBwcm9jZXNzLmV4aXQoMSlcbiAgfVxuXG4gIGNvbnN0IHRtcFJlcG8gPSBkaXJTeW5jKHsgdW5zYWZlQ2xlYW51cDogdHJ1ZSB9KVxuICBjb25zdCB0bXBSZXBvUGFja2FnZVBhdGggPSBqb2luKHRtcFJlcG8ubmFtZSwgcGFja2FnZURldGFpbHMucGF0aClcbiAgY29uc3QgdG1wUmVwb05wbVJvb3QgPSB0bXBSZXBvUGFja2FnZVBhdGguc2xpY2UoXG4gICAgMCxcbiAgICAtYC9ub2RlX21vZHVsZXMvJHtwYWNrYWdlRGV0YWlscy5uYW1lfWAubGVuZ3RoLFxuICApXG5cbiAgY29uc3QgdG1wUmVwb1BhY2thZ2VKc29uUGF0aCA9IGpvaW4odG1wUmVwb05wbVJvb3QsIFwicGFja2FnZS5qc29uXCIpXG5cbiAgdHJ5IHtcbiAgICBjb25zdCBwYXRjaGVzRGlyID0gcmVzb2x2ZShqb2luKGFwcFBhdGgsIHBhdGNoRGlyKSlcblxuICAgIGNvbnNvbGUuaW5mbyhjaGFsay5ncmV5KFwi4oCiXCIpLCBcIkNyZWF0aW5nIHRlbXBvcmFyeSBmb2xkZXJcIilcblxuICAgIC8vIG1ha2UgYSBibGFuayBwYWNrYWdlLmpzb25cbiAgICBta2RpcnBTeW5jKHRtcFJlcG9OcG1Sb290KVxuICAgIHdyaXRlRmlsZVN5bmMoXG4gICAgICB0bXBSZXBvUGFja2FnZUpzb25QYXRoLFxuICAgICAgSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBkZXBlbmRlbmNpZXM6IHtcbiAgICAgICAgICBbcGFja2FnZURldGFpbHMubmFtZV06IGdldFBhY2thZ2VSZXNvbHV0aW9uKHtcbiAgICAgICAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgICAgICAgcGFja2FnZU1hbmFnZXIsXG4gICAgICAgICAgICBhcHBQYXRoLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9LFxuICAgICAgICByZXNvbHV0aW9uczogcmVzb2x2ZVJlbGF0aXZlRmlsZURlcGVuZGVuY2llcyhcbiAgICAgICAgICBhcHBQYXRoLFxuICAgICAgICAgIGFwcFBhY2thZ2VKc29uLnJlc29sdXRpb25zIHx8IHt9LFxuICAgICAgICApLFxuICAgICAgfSksXG4gICAgKVxuXG4gICAgY29uc3QgcGFja2FnZVZlcnNpb24gPSBnZXRQYWNrYWdlVmVyc2lvbihcbiAgICAgIGpvaW4ocmVzb2x2ZShwYWNrYWdlRGV0YWlscy5wYXRoKSwgXCJwYWNrYWdlLmpzb25cIiksXG4gICAgKVxuXG4gICAgLy8gY29weSAubnBtcmMvLnlhcm5yYyBpbiBjYXNlIHBhY2thZ2VzIGFyZSBob3N0ZWQgaW4gcHJpdmF0ZSByZWdpc3RyeVxuICAgIC8vIGNvcHkgLnlhcm4gZGlyZWN0b3J5IGFzIHdlbGwgdG8gZW5zdXJlIGluc3RhbGxhdGlvbnMgd29yayBpbiB5YXJuIDJcbiAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6YWxpZ25cbiAgICA7W1wiLm5wbXJjXCIsIFwiLnlhcm5yY1wiLCBcIi55YXJuXCJdLmZvckVhY2goKHJjRmlsZSkgPT4ge1xuICAgICAgY29uc3QgcmNQYXRoID0gam9pbihhcHBQYXRoLCByY0ZpbGUpXG4gICAgICBpZiAoZXhpc3RzU3luYyhyY1BhdGgpKSB7XG4gICAgICAgIGNvcHlTeW5jKHJjUGF0aCwgam9pbih0bXBSZXBvLm5hbWUsIHJjRmlsZSksIHsgZGVyZWZlcmVuY2U6IHRydWUgfSlcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgaWYgKHBhY2thZ2VNYW5hZ2VyID09PSBcInlhcm5cIikge1xuICAgICAgY29uc29sZS5pbmZvKFxuICAgICAgICBjaGFsay5ncmV5KFwi4oCiXCIpLFxuICAgICAgICBgSW5zdGFsbGluZyAke3BhY2thZ2VEZXRhaWxzLm5hbWV9QCR7cGFja2FnZVZlcnNpb259IHdpdGggeWFybmAsXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICAvLyB0cnkgZmlyc3Qgd2l0aG91dCBpZ25vcmluZyBzY3JpcHRzIGluIGNhc2UgdGhleSBhcmUgcmVxdWlyZWRcbiAgICAgICAgLy8gdGhpcyB3b3JrcyBpbiA5OS45OSUgb2YgY2FzZXNcbiAgICAgICAgc3Bhd25TYWZlU3luYyhgeWFybmAsIFtcImluc3RhbGxcIiwgXCItLWlnbm9yZS1lbmdpbmVzXCJdLCB7XG4gICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICBsb2dTdGRFcnJPbkVycm9yOiBmYWxzZSxcbiAgICAgICAgfSlcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gdHJ5IGFnYWluIHdoaWxlIGlnbm9yaW5nIHNjcmlwdHMgaW4gY2FzZSB0aGUgc2NyaXB0IGRlcGVuZHMgb25cbiAgICAgICAgLy8gYW4gaW1wbGljaXQgY29udGV4dCB3aGljaCB3ZSBoYXZlbid0IHJlcHJvZHVjZWRcbiAgICAgICAgc3Bhd25TYWZlU3luYyhcbiAgICAgICAgICBgeWFybmAsXG4gICAgICAgICAgW1wiaW5zdGFsbFwiLCBcIi0taWdub3JlLWVuZ2luZXNcIiwgXCItLWlnbm9yZS1zY3JpcHRzXCJdLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGN3ZDogdG1wUmVwb05wbVJvb3QsXG4gICAgICAgICAgfSxcbiAgICAgICAgKVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocGFja2FnZU1hbmFnZXIgPT09IFwiYnVuXCIpIHtcbiAgICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgICAgY2hhbGsuZ3JleShcIuKAolwiKSxcbiAgICAgICAgYEluc3RhbGxpbmcgJHtwYWNrYWdlRGV0YWlscy5uYW1lfUAke3BhY2thZ2VWZXJzaW9ufSB3aXRoIGJ1bmAsXG4gICAgICApXG4gICAgICB0cnkge1xuICAgICAgICAvLyBUcnkgaW5zdGFsbGluZyB3aXRoIGJ1biBmaXJzdFxuICAgICAgICBzcGF3blNhZmVTeW5jKGBidW5gLCBbXCJpbnN0YWxsXCIsIFwiLS1uby1zYXZlXCJdLCB7XG4gICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICBsb2dTdGRFcnJPbkVycm9yOiB0cnVlLFxuICAgICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgTk9ERV9FTlY6IFwiZGV2ZWxvcG1lbnRcIiB9XG4gICAgICAgIH0pXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgICAgICBjaGFsay55ZWxsb3coXCLimqBcIiksXG4gICAgICAgICAgYEJ1biBpbnN0YWxsYXRpb24gZmFpbGVkLCBmYWxsaW5nIGJhY2sgdG8gbnBtYCxcbiAgICAgICAgKVxuICAgICAgICB0cnkge1xuICAgICAgICAgIC8vIEZhbGwgYmFjayB0byBucG0gaWYgYnVuIGZhaWxzXG4gICAgICAgICAgc3Bhd25TYWZlU3luYyhgbnBtYCwgW1wiaVwiLCBcIi0tZm9yY2VcIiwgXCItLW5vLWZ1bmRcIiwgXCItLW5vLWF1ZGl0XCJdLCB7XG4gICAgICAgICAgICBjd2Q6IHRtcFJlcG9OcG1Sb290LFxuICAgICAgICAgICAgbG9nU3RkRXJyT25FcnJvcjogdHJ1ZSxcbiAgICAgICAgICAgIGVudjogeyAuLi5wcm9jZXNzLmVudiwgTk9ERV9FTlY6IFwiZGV2ZWxvcG1lbnRcIiB9XG4gICAgICAgICAgfSlcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIC8vIHRyeSBhZ2FpbiB3aGlsZSBpZ25vcmluZyBzY3JpcHRzXG4gICAgICAgICAgc3Bhd25TYWZlU3luYyhgbnBtYCwgW1wiaVwiLCBcIi0taWdub3JlLXNjcmlwdHNcIiwgXCItLWZvcmNlXCIsIFwiLS1uby1mdW5kXCIsIFwiLS1uby1hdWRpdFwiXSwge1xuICAgICAgICAgICAgY3dkOiB0bXBSZXBvTnBtUm9vdCxcbiAgICAgICAgICAgIGxvZ1N0ZEVyck9uRXJyb3I6IHRydWUsXG4gICAgICAgICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIE5PREVfRU5WOiBcImRldmVsb3BtZW50XCIgfVxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29uc29sZS5pbmZvKFxuICAgICAgICBjaGFsay5ncmV5KFwi4oCiXCIpLFxuICAgICAgICBgSW5zdGFsbGluZyAke3BhY2thZ2VEZXRhaWxzLm5hbWV9QCR7cGFja2FnZVZlcnNpb259IHdpdGggbnBtYCxcbiAgICAgIClcbiAgICAgIHRyeSB7XG4gICAgICAgIC8vIHRyeSBmaXJzdCB3aXRob3V0IGlnbm9yaW5nIHNjcmlwdHMgaW4gY2FzZSB0aGV5IGFyZSByZXF1aXJlZFxuICAgICAgICAvLyB0aGlzIHdvcmtzIGluIDk5Ljk5JSBvZiBjYXNlc1xuICAgICAgICBzcGF3blNhZmVTeW5jKGBucG1gLCBbXCJpXCIsIFwiLS1mb3JjZVwiLCBcIi0tbm8tZnVuZFwiLCBcIi0tbm8tYXVkaXRcIl0sIHtcbiAgICAgICAgICBjd2Q6IHRtcFJlcG9OcG1Sb290LFxuICAgICAgICAgIGxvZ1N0ZEVyck9uRXJyb3I6IHRydWUsXG4gICAgICAgICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBOT0RFX0VOVjogXCJkZXZlbG9wbWVudFwiIH1cbiAgICAgICAgfSlcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgLy8gdHJ5IGFnYWluIHdoaWxlIGlnbm9yaW5nIHNjcmlwdHMgaW4gY2FzZSB0aGUgc2NyaXB0IGRlcGVuZHMgb25cbiAgICAgICAgLy8gYW4gaW1wbGljaXQgY29udGV4dCB3aGljaCB3ZSBoYXZlbid0IHJlcHJvZHVjZWRcbiAgICAgICAgc3Bhd25TYWZlU3luYyhgbnBtYCwgW1wiaVwiLCBcIi0taWdub3JlLXNjcmlwdHNcIiwgXCItLWZvcmNlXCIsIFwiLS1uby1mdW5kXCIsIFwiLS1uby1hdWRpdFwiXSwge1xuICAgICAgICAgIGN3ZDogdG1wUmVwb05wbVJvb3QsXG4gICAgICAgICAgbG9nU3RkRXJyT25FcnJvcjogdHJ1ZSxcbiAgICAgICAgICBlbnY6IHsgLi4ucHJvY2Vzcy5lbnYsIE5PREVfRU5WOiBcImRldmVsb3BtZW50XCIgfVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGdpdCA9ICguLi5hcmdzOiBzdHJpbmdbXSkgPT5cbiAgICAgIHNwYXduU2FmZVN5bmMoXCJnaXRcIiwgYXJncywge1xuICAgICAgICBjd2Q6IHRtcFJlcG8ubmFtZSxcbiAgICAgICAgZW52OiB7IC4uLnByb2Nlc3MuZW52LCBIT01FOiB0bXBSZXBvLm5hbWUgfSxcbiAgICAgICAgbWF4QnVmZmVyOiAxMDI0ICogMTAyNCAqIDEwMCxcbiAgICAgIH0pXG5cbiAgICAvLyByZW1vdmUgbmVzdGVkIG5vZGVfbW9kdWxlcyBqdXN0IHRvIGJlIHNhZmVcbiAgICByaW1yYWYoam9pbih0bXBSZXBvUGFja2FnZVBhdGgsIFwibm9kZV9tb2R1bGVzXCIpKVxuICAgIC8vIHJlbW92ZSAuZ2l0IGp1c3QgdG8gYmUgc2FmZVxuICAgIHJpbXJhZihqb2luKHRtcFJlcG9QYWNrYWdlUGF0aCwgXCIuZ2l0XCIpKVxuICAgIC8vIHJlbW92ZSBwYXRjaC1wYWNrYWdlIHN0YXRlIGZpbGVcbiAgICByaW1yYWYoam9pbih0bXBSZXBvUGFja2FnZVBhdGgsIFNUQVRFX0ZJTEVfTkFNRSkpXG5cbiAgICAvLyBjb21taXQgdGhlIHBhY2thZ2VcbiAgICBjb25zb2xlLmluZm8oY2hhbGsuZ3JleShcIuKAolwiKSwgXCJEaWZmaW5nIHlvdXIgZmlsZXMgd2l0aCBjbGVhbiBmaWxlc1wiKVxuICAgIHdyaXRlRmlsZVN5bmMoam9pbih0bXBSZXBvLm5hbWUsIFwiLmdpdGlnbm9yZVwiKSwgXCIhL25vZGVfbW9kdWxlc1xcblxcblwiKVxuICAgIGdpdChcImluaXRcIilcbiAgICBnaXQoXCJjb25maWdcIiwgXCItLWxvY2FsXCIsIFwidXNlci5uYW1lXCIsIFwicGF0Y2gtcGFja2FnZVwiKVxuICAgIGdpdChcImNvbmZpZ1wiLCBcIi0tbG9jYWxcIiwgXCJ1c2VyLmVtYWlsXCIsIFwicGF0Y2hAcGFjay5hZ2VcIilcblxuICAgIC8vIHJlbW92ZSBpZ25vcmVkIGZpbGVzIGZpcnN0XG4gICAgcmVtb3ZlSWdub3JlZEZpbGVzKHRtcFJlcG9QYWNrYWdlUGF0aCwgaW5jbHVkZVBhdGhzLCBleGNsdWRlUGF0aHMpXG5cbiAgICBmb3IgKGNvbnN0IHBhdGNoRGV0YWlscyBvZiBwYXRjaGVzVG9BcHBseUJlZm9yZURpZmZpbmcpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIWFwcGx5UGF0Y2goe1xuICAgICAgICAgIHBhdGNoRGV0YWlscyxcbiAgICAgICAgICBwYXRjaERpcixcbiAgICAgICAgICBwYXRjaEZpbGVQYXRoOiBqb2luKGFwcFBhdGgsIHBhdGNoRGlyLCBwYXRjaERldGFpbHMucGF0Y2hGaWxlbmFtZSksXG4gICAgICAgICAgcmV2ZXJzZTogZmFsc2UsXG4gICAgICAgICAgY3dkOiB0bXBSZXBvLm5hbWUsXG4gICAgICAgICAgYmVzdEVmZm9ydDogZmFsc2UsXG4gICAgICAgIH0pXG4gICAgICApIHtcbiAgICAgICAgLy8gVE9ETzogYWRkIGJldHRlciBlcnJvciBtZXNzYWdlIG9uY2UgLS1yZWJhc2UgaXMgaW1wbGVtZW50ZWRcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYEZhaWxlZCB0byBhcHBseSBwYXRjaCAke3BhdGNoRGV0YWlscy5wYXRjaEZpbGVuYW1lfSB0byAke3BhY2thZ2VEZXRhaWxzLnBhdGhTcGVjaWZpZXJ9YCxcbiAgICAgICAgKVxuICAgICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgIH1cbiAgICB9XG4gICAgZ2l0KFwiYWRkXCIsIFwiLWZcIiwgcGFja2FnZURldGFpbHMucGF0aClcbiAgICBnaXQoXCJjb21taXRcIiwgXCItLWFsbG93LWVtcHR5XCIsIFwiLW1cIiwgXCJpbml0XCIpXG5cbiAgICAvLyByZXBsYWNlIHBhY2thZ2Ugd2l0aCB1c2VyJ3MgdmVyc2lvblxuICAgIHJpbXJhZih0bXBSZXBvUGFja2FnZVBhdGgpXG5cbiAgICAvLyBwbnBtIGluc3RhbGxzIHBhY2thZ2VzIGFzIHN5bWxpbmtzLCBjb3B5U3luYyB3b3VsZCBjb3B5IG9ubHkgdGhlIHN5bWxpbmtcbiAgICBjb3B5U3luYyhyZWFscGF0aFN5bmMocGFja2FnZVBhdGgpLCB0bXBSZXBvUGFja2FnZVBhdGgpXG5cbiAgICAvLyByZW1vdmUgbmVzdGVkIG5vZGVfbW9kdWxlcyBqdXN0IHRvIGJlIHNhZmVcbiAgICByaW1yYWYoam9pbih0bXBSZXBvUGFja2FnZVBhdGgsIFwibm9kZV9tb2R1bGVzXCIpKVxuICAgIC8vIHJlbW92ZSAuZ2l0IGp1c3QgdG8gYmUgc2FmZVxuICAgIHJpbXJhZihqb2luKHRtcFJlcG9QYWNrYWdlUGF0aCwgXCIuZ2l0XCIpKVxuICAgIC8vIHJlbW92ZSBwYXRjaC1wYWNrYWdlIHN0YXRlIGZpbGVcbiAgICByaW1yYWYoam9pbih0bXBSZXBvUGFja2FnZVBhdGgsIFNUQVRFX0ZJTEVfTkFNRSkpXG5cbiAgICAvLyBhbHNvIHJlbW92ZSBpZ25vcmVkIGZpbGVzIGxpa2UgYmVmb3JlXG4gICAgcmVtb3ZlSWdub3JlZEZpbGVzKHRtcFJlcG9QYWNrYWdlUGF0aCwgaW5jbHVkZVBhdGhzLCBleGNsdWRlUGF0aHMpXG5cbiAgICAvLyBzdGFnZSBhbGwgZmlsZXNcbiAgICBnaXQoXCJhZGRcIiwgXCItZlwiLCBwYWNrYWdlRGV0YWlscy5wYXRoKVxuXG4gICAgLy8gZ2V0IGRpZmYgb2YgY2hhbmdlc1xuICAgIGNvbnN0IGRpZmZSZXN1bHQgPSBnaXQoXG4gICAgICBcImRpZmZcIixcbiAgICAgIFwiLS1jYWNoZWRcIixcbiAgICAgIFwiLS1uby1jb2xvclwiLFxuICAgICAgXCItLWlnbm9yZS1zcGFjZS1hdC1lb2xcIixcbiAgICAgIFwiLS1uby1leHQtZGlmZlwiLFxuICAgICAgXCItLXNyYy1wcmVmaXg9YS9cIixcbiAgICAgIFwiLS1kc3QtcHJlZml4PWIvXCIsXG4gICAgKVxuXG4gICAgaWYgKGRpZmZSZXN1bHQuc3Rkb3V0Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc29sZS5sb2coXG4gICAgICAgIGDigYnvuI8gIE5vdCBjcmVhdGluZyBwYXRjaCBmaWxlIGZvciBwYWNrYWdlICcke3BhY2thZ2VQYXRoU3BlY2lmaWVyfSdgLFxuICAgICAgKVxuICAgICAgY29uc29sZS5sb2coYOKBie+4jyAgVGhlcmUgZG9uJ3QgYXBwZWFyIHRvIGJlIGFueSBjaGFuZ2VzLmApXG4gICAgICBpZiAoaXNSZWJhc2luZyAmJiBtb2RlLnR5cGUgPT09IFwib3ZlcndyaXRlX2xhc3RcIikge1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICBcIlxcbvCfkqEgVG8gcmVtb3ZlIGEgcGF0Y2ggZmlsZSwgZGVsZXRlIGl0IGFuZCB0aGVuIHJlaW5zdGFsbCBub2RlX21vZHVsZXMgZnJvbSBzY3JhdGNoLlwiLFxuICAgICAgICApXG4gICAgICB9XG4gICAgICBwcm9jZXNzLmV4aXQoMSlcbiAgICAgIHJldHVyblxuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICBwYXJzZVBhdGNoRmlsZShkaWZmUmVzdWx0LnN0ZG91dC50b1N0cmluZygpKVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChcbiAgICAgICAgKGUgYXMgRXJyb3IpLm1lc3NhZ2UuaW5jbHVkZXMoXCJVbmV4cGVjdGVkIGZpbGUgbW9kZSBzdHJpbmc6IDEyMDAwMFwiKVxuICAgICAgKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKGBcbuKblO+4jyAke2NoYWxrLnJlZC5ib2xkKFwiRVJST1JcIil9XG5cbiAgWW91ciBjaGFuZ2VzIGludm9sdmUgY3JlYXRpbmcgc3ltbGlua3MuIHBhdGNoLXBhY2thZ2UgZG9lcyBub3QgeWV0IHN1cHBvcnRcbiAgc3ltbGlua3MuXG5cbiAg77iPUGxlYXNlIHVzZSAke2NoYWxrLmJvbGQoXCItLWluY2x1ZGVcIil9IGFuZC9vciAke2NoYWxrLmJvbGQoXG4gICAgICAgICAgXCItLWV4Y2x1ZGVcIixcbiAgICAgICAgKX0gdG8gbmFycm93IHRoZSBzY29wZSBvZiB5b3VyIHBhdGNoIGlmXG4gIHRoaXMgd2FzIHVuaW50ZW50aW9uYWwuXG5gKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgb3V0UGF0aCA9IFwiLi9wYXRjaC1wYWNrYWdlLWVycm9yLmpzb24uZ3pcIlxuICAgICAgICB3cml0ZUZpbGVTeW5jKFxuICAgICAgICAgIG91dFBhdGgsXG4gICAgICAgICAgZ3ppcFN5bmMoXG4gICAgICAgICAgICBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgIGVycm9yOiB7IG1lc3NhZ2U6IGUubWVzc2FnZSwgc3RhY2s6IGUuc3RhY2sgfSxcbiAgICAgICAgICAgICAgcGF0Y2g6IGRpZmZSZXN1bHQuc3Rkb3V0LnRvU3RyaW5nKCksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApLFxuICAgICAgICApXG4gICAgICAgIGNvbnNvbGUubG9nKGBcbuKblO+4jyAke2NoYWxrLnJlZC5ib2xkKFwiRVJST1JcIil9XG5cbiAgcGF0Y2gtcGFja2FnZSB3YXMgdW5hYmxlIHRvIHJlYWQgdGhlIHBhdGNoLWZpbGUgbWFkZSBieSBnaXQuIFRoaXMgc2hvdWxkIG5vdFxuICBoYXBwZW4uXG5cbiAgQSBkaWFnbm9zdGljIGZpbGUgd2FzIHdyaXR0ZW4gdG9cblxuICAgICR7b3V0UGF0aH1cblxuICBQbGVhc2UgYXR0YWNoIGl0IHRvIGEgZ2l0aHViIGlzc3VlXG5cbiAgICBodHRwczovL2dpdGh1Yi5jb20vZHMzMDAvcGF0Y2gtcGFja2FnZS9pc3N1ZXMvbmV3P3RpdGxlPU5ldytwYXRjaCtwYXJzZStmYWlsZWQmYm9keT1QbGVhc2UrYXR0YWNoK3RoZStkaWFnbm9zdGljK2ZpbGUrYnkrZHJhZ2dpbmcraXQraW50bytoZXJlK/CfmY9cblxuICBOb3RlIHRoYXQgdGhpcyBkaWFnbm9zdGljIGZpbGUgd2lsbCBjb250YWluIGNvZGUgZnJvbSB0aGUgcGFja2FnZSB5b3Ugd2VyZVxuICBhdHRlbXB0aW5nIHRvIHBhdGNoLlxuXG5gKVxuICAgICAgfVxuICAgICAgcHJvY2Vzcy5leGl0KDEpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICAvLyBtYXliZSBkZWxldGUgZXhpc3RpbmdcbiAgICBpZiAobW9kZS50eXBlID09PSBcImFwcGVuZFwiICYmICFpc1JlYmFzaW5nICYmIGV4aXN0aW5nUGF0Y2hlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgIC8vIGlmIHdlIGFyZSBhcHBlbmRpbmcgdG8gYW4gZXhpc3RpbmcgcGF0Y2ggdGhhdCBkb2Vzbid0IGhhdmUgYSBzZXF1ZW5jZSBudW1iZXIgbGV0J3MgcmVuYW1lIGl0XG4gICAgICBjb25zdCBwcmV2UGF0Y2ggPSBleGlzdGluZ1BhdGNoZXNbMF1cbiAgICAgIGlmIChwcmV2UGF0Y2guc2VxdWVuY2VOdW1iZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb25zdCBuZXdGaWxlTmFtZSA9IGNyZWF0ZVBhdGNoRmlsZU5hbWUoe1xuICAgICAgICAgIHBhY2thZ2VEZXRhaWxzLFxuICAgICAgICAgIHBhY2thZ2VWZXJzaW9uLFxuICAgICAgICAgIHNlcXVlbmNlTnVtYmVyOiAxLFxuICAgICAgICAgIHNlcXVlbmNlTmFtZTogcHJldlBhdGNoLnNlcXVlbmNlTmFtZSA/PyBcImluaXRpYWxcIixcbiAgICAgICAgfSlcbiAgICAgICAgY29uc3Qgb2xkUGF0aCA9IGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIsIHByZXZQYXRjaC5wYXRjaEZpbGVuYW1lKVxuICAgICAgICBjb25zdCBuZXdQYXRoID0gam9pbihhcHBQYXRoLCBwYXRjaERpciwgbmV3RmlsZU5hbWUpXG4gICAgICAgIHJlbmFtZVN5bmMob2xkUGF0aCwgbmV3UGF0aClcbiAgICAgICAgcHJldlBhdGNoLnNlcXVlbmNlTnVtYmVyID0gMVxuICAgICAgICBwcmV2UGF0Y2gucGF0Y2hGaWxlbmFtZSA9IG5ld0ZpbGVOYW1lXG4gICAgICAgIHByZXZQYXRjaC5zZXF1ZW5jZU5hbWUgPSBwcmV2UGF0Y2guc2VxdWVuY2VOYW1lID8/IFwiaW5pdGlhbFwiXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgbGFzdFBhdGNoID0gZXhpc3RpbmdQYXRjaGVzW1xuICAgICAgc3RhdGUgPyBzdGF0ZS5wYXRjaGVzLmxlbmd0aCAtIDEgOiBleGlzdGluZ1BhdGNoZXMubGVuZ3RoIC0gMVxuICAgIF0gYXMgUGF0Y2hlZFBhY2thZ2VEZXRhaWxzIHwgdW5kZWZpbmVkXG4gICAgY29uc3Qgc2VxdWVuY2VOYW1lID1cbiAgICAgIG1vZGUudHlwZSA9PT0gXCJhcHBlbmRcIiA/IG1vZGUubmFtZSA6IGxhc3RQYXRjaD8uc2VxdWVuY2VOYW1lXG4gICAgY29uc3Qgc2VxdWVuY2VOdW1iZXIgPVxuICAgICAgbW9kZS50eXBlID09PSBcImFwcGVuZFwiXG4gICAgICAgID8gKGxhc3RQYXRjaD8uc2VxdWVuY2VOdW1iZXIgPz8gMCkgKyAxXG4gICAgICAgIDogbGFzdFBhdGNoPy5zZXF1ZW5jZU51bWJlclxuXG4gICAgY29uc3QgcGF0Y2hGaWxlTmFtZSA9IGNyZWF0ZVBhdGNoRmlsZU5hbWUoe1xuICAgICAgcGFja2FnZURldGFpbHMsXG4gICAgICBwYWNrYWdlVmVyc2lvbixcbiAgICAgIHNlcXVlbmNlTmFtZSxcbiAgICAgIHNlcXVlbmNlTnVtYmVyLFxuICAgIH0pXG5cbiAgICBjb25zdCBwYXRjaFBhdGggPSBqb2luKHBhdGNoZXNEaXIsIHBhdGNoRmlsZU5hbWUpXG4gICAgaWYgKCFleGlzdHNTeW5jKGRpcm5hbWUocGF0Y2hQYXRoKSkpIHtcbiAgICAgIC8vIHNjb3BlZCBwYWNrYWdlXG4gICAgICBta2RpclN5bmMoZGlybmFtZShwYXRjaFBhdGgpKVxuICAgIH1cblxuICAgIC8vIGlmIHdlIGFyZSBpbnNlcnRpbmcgYSBuZXcgcGF0Y2ggaW50byBhIHNlcXVlbmNlIHdlIG1vc3QgbGlrZWx5IG5lZWQgdG8gdXBkYXRlIHRoZSBzZXF1ZW5jZSBudW1iZXJzXG4gICAgaWYgKGlzUmViYXNpbmcgJiYgbW9kZS50eXBlID09PSBcImFwcGVuZFwiKSB7XG4gICAgICBjb25zdCBwYXRjaGVzVG9OdWRnZSA9IGV4aXN0aW5nUGF0Y2hlcy5zbGljZShzdGF0ZSEucGF0Y2hlcy5sZW5ndGgpXG4gICAgICBpZiAoc2VxdWVuY2VOdW1iZXIgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJzZXF1ZW5jZU51bWJlciBpcyB1bmRlZmluZWQgd2hpbGUgcmViYXNpbmdcIilcbiAgICAgIH1cbiAgICAgIGlmIChcbiAgICAgICAgcGF0Y2hlc1RvTnVkZ2VbMF0/LnNlcXVlbmNlTnVtYmVyICE9PSB1bmRlZmluZWQgJiZcbiAgICAgICAgcGF0Y2hlc1RvTnVkZ2VbMF0uc2VxdWVuY2VOdW1iZXIgPD0gc2VxdWVuY2VOdW1iZXJcbiAgICAgICkge1xuICAgICAgICBsZXQgbmV4dCA9IHNlcXVlbmNlTnVtYmVyICsgMVxuICAgICAgICBmb3IgKGNvbnN0IHAgb2YgcGF0Y2hlc1RvTnVkZ2UpIHtcbiAgICAgICAgICBjb25zdCBuZXdOYW1lID0gY3JlYXRlUGF0Y2hGaWxlTmFtZSh7XG4gICAgICAgICAgICBwYWNrYWdlRGV0YWlscyxcbiAgICAgICAgICAgIHBhY2thZ2VWZXJzaW9uLFxuICAgICAgICAgICAgc2VxdWVuY2VOYW1lOiBwLnNlcXVlbmNlTmFtZSxcbiAgICAgICAgICAgIHNlcXVlbmNlTnVtYmVyOiBuZXh0KyssXG4gICAgICAgICAgfSlcbiAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgIFwiUmVuYW1pbmdcIixcbiAgICAgICAgICAgIGNoYWxrLmJvbGQocC5wYXRjaEZpbGVuYW1lKSxcbiAgICAgICAgICAgIFwidG9cIixcbiAgICAgICAgICAgIGNoYWxrLmJvbGQobmV3TmFtZSksXG4gICAgICAgICAgKVxuICAgICAgICAgIGNvbnN0IG9sZFBhdGggPSBqb2luKGFwcFBhdGgsIHBhdGNoRGlyLCBwLnBhdGNoRmlsZW5hbWUpXG4gICAgICAgICAgY29uc3QgbmV3UGF0aCA9IGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIsIG5ld05hbWUpXG4gICAgICAgICAgcmVuYW1lU3luYyhvbGRQYXRoLCBuZXdQYXRoKVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgd3JpdGVGaWxlU3luYyhwYXRjaFBhdGgsIGRpZmZSZXN1bHQuc3Rkb3V0KVxuICAgIGNvbnNvbGUubG9nKFxuICAgICAgYCR7Y2hhbGsuZ3JlZW4oXCLinJRcIil9IENyZWF0ZWQgZmlsZSAke2pvaW4ocGF0Y2hEaXIsIHBhdGNoRmlsZU5hbWUpfVxcbmAsXG4gICAgKVxuXG4gICAgY29uc3QgcHJldlN0YXRlOiBQYXRjaFN0YXRlW10gPSBwYXRjaGVzVG9BcHBseUJlZm9yZURpZmZpbmcubWFwKFxuICAgICAgKHApOiBQYXRjaFN0YXRlID0+ICh7XG4gICAgICAgIHBhdGNoRmlsZW5hbWU6IHAucGF0Y2hGaWxlbmFtZSxcbiAgICAgICAgZGlkQXBwbHk6IHRydWUsXG4gICAgICAgIHBhdGNoQ29udGVudEhhc2g6IGhhc2hGaWxlKGpvaW4oYXBwUGF0aCwgcGF0Y2hEaXIsIHAucGF0Y2hGaWxlbmFtZSkpLFxuICAgICAgfSksXG4gICAgKVxuICAgIGNvbnN0IG5leHRTdGF0ZTogUGF0Y2hTdGF0ZVtdID0gW1xuICAgICAgLi4ucHJldlN0YXRlLFxuICAgICAge1xuICAgICAgICBwYXRjaEZpbGVuYW1lOiBwYXRjaEZpbGVOYW1lLFxuICAgICAgICBkaWRBcHBseTogdHJ1ZSxcbiAgICAgICAgcGF0Y2hDb250ZW50SGFzaDogaGFzaEZpbGUocGF0Y2hQYXRoKSxcbiAgICAgIH0sXG4gICAgXVxuXG4gICAgLy8gaWYgYW55IHBhdGNoZXMgY29tZSBhZnRlciB0aGlzIG9uZSB3ZSBqdXN0IG1hZGUsIHdlIHNob3VsZCByZWFwcGx5IHRoZW1cbiAgICBsZXQgZGlkRmFpbFdoaWxlRmluaXNoaW5nUmViYXNlID0gZmFsc2VcbiAgICBpZiAoaXNSZWJhc2luZykge1xuICAgICAgY29uc3QgY3VycmVudFBhdGNoZXMgPSBnZXRHcm91cGVkUGF0Y2hlcyhqb2luKGFwcFBhdGgsIHBhdGNoRGlyKSlcbiAgICAgICAgLnBhdGhTcGVjaWZpZXJUb1BhdGNoRmlsZXNbcGFja2FnZURldGFpbHMucGF0aFNwZWNpZmllcl1cblxuICAgICAgY29uc3QgcHJldmlvdXNseVVuYXBwbGllZFBhdGNoZXMgPSBjdXJyZW50UGF0Y2hlcy5zbGljZShuZXh0U3RhdGUubGVuZ3RoKVxuICAgICAgaWYgKHByZXZpb3VzbHlVbmFwcGxpZWRQYXRjaGVzLmxlbmd0aCkge1xuICAgICAgICBjb25zb2xlLmxvZyhgRmFzdCBmb3J3YXJkaW5nLi4uYClcbiAgICAgICAgZm9yIChjb25zdCBwYXRjaCBvZiBwcmV2aW91c2x5VW5hcHBsaWVkUGF0Y2hlcykge1xuICAgICAgICAgIGNvbnN0IHBhdGNoRmlsZVBhdGggPSBqb2luKGFwcFBhdGgsIHBhdGNoRGlyLCBwYXRjaC5wYXRjaEZpbGVuYW1lKVxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICFhcHBseVBhdGNoKHtcbiAgICAgICAgICAgICAgcGF0Y2hEZXRhaWxzOiBwYXRjaCxcbiAgICAgICAgICAgICAgcGF0Y2hEaXIsXG4gICAgICAgICAgICAgIHBhdGNoRmlsZVBhdGgsXG4gICAgICAgICAgICAgIHJldmVyc2U6IGZhbHNlLFxuICAgICAgICAgICAgICBjd2Q6IHByb2Nlc3MuY3dkKCksXG4gICAgICAgICAgICAgIGJlc3RFZmZvcnQ6IGZhbHNlLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGRpZEZhaWxXaGlsZUZpbmlzaGluZ1JlYmFzZSA9IHRydWVcbiAgICAgICAgICAgIGxvZ1BhdGNoU2VxdWVuY2VFcnJvcih7IHBhdGNoRGV0YWlsczogcGF0Y2ggfSlcbiAgICAgICAgICAgIG5leHRTdGF0ZS5wdXNoKHtcbiAgICAgICAgICAgICAgcGF0Y2hGaWxlbmFtZTogcGF0Y2gucGF0Y2hGaWxlbmFtZSxcbiAgICAgICAgICAgICAgZGlkQXBwbHk6IGZhbHNlLFxuICAgICAgICAgICAgICBwYXRjaENvbnRlbnRIYXNoOiBoYXNoRmlsZShwYXRjaEZpbGVQYXRoKSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgICAke2NoYWxrLmdyZWVuKFwi4pyUXCIpfSAke3BhdGNoLnBhdGNoRmlsZW5hbWV9YClcbiAgICAgICAgICAgIG5leHRTdGF0ZS5wdXNoKHtcbiAgICAgICAgICAgICAgcGF0Y2hGaWxlbmFtZTogcGF0Y2gucGF0Y2hGaWxlbmFtZSxcbiAgICAgICAgICAgICAgZGlkQXBwbHk6IHRydWUsXG4gICAgICAgICAgICAgIHBhdGNoQ29udGVudEhhc2g6IGhhc2hGaWxlKHBhdGNoRmlsZVBhdGgpLFxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoaXNSZWJhc2luZyB8fCBudW1QYXRjaGVzQWZ0ZXJDcmVhdGUgPiAxKSB7XG4gICAgICBzYXZlUGF0Y2hBcHBsaWNhdGlvblN0YXRlKHtcbiAgICAgICAgcGFja2FnZURldGFpbHMsXG4gICAgICAgIHBhdGNoZXM6IG5leHRTdGF0ZSxcbiAgICAgICAgaXNSZWJhc2luZzogZGlkRmFpbFdoaWxlRmluaXNoaW5nUmViYXNlLFxuICAgICAgfSlcbiAgICB9IGVsc2Uge1xuICAgICAgY2xlYXJQYXRjaEFwcGxpY2F0aW9uU3RhdGUocGFja2FnZURldGFpbHMpXG4gICAgfVxuXG4gICAgaWYgKGNhbkNyZWF0ZUlzc3VlKSB7XG4gICAgICBpZiAoY3JlYXRlSXNzdWUpIHtcbiAgICAgICAgb3Blbklzc3VlQ3JlYXRpb25MaW5rKHtcbiAgICAgICAgICBwYWNrYWdlRGV0YWlscyxcbiAgICAgICAgICBwYXRjaEZpbGVDb250ZW50czogZGlmZlJlc3VsdC5zdGRvdXQudG9TdHJpbmcoKSxcbiAgICAgICAgICBwYWNrYWdlVmVyc2lvbixcbiAgICAgICAgfSlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG1heWJlUHJpbnRJc3N1ZUNyZWF0aW9uUHJvbXB0KHZjcywgcGFja2FnZURldGFpbHMsIHBhY2thZ2VNYW5hZ2VyKVxuICAgICAgfVxuICAgIH1cbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUubG9nKGUpXG4gICAgdGhyb3cgZVxuICB9IGZpbmFsbHkge1xuICAgIHRtcFJlcG8ucmVtb3ZlQ2FsbGJhY2soKVxuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVBhdGNoRmlsZU5hbWUoe1xuICBwYWNrYWdlRGV0YWlscyxcbiAgcGFja2FnZVZlcnNpb24sXG4gIHNlcXVlbmNlTnVtYmVyLFxuICBzZXF1ZW5jZU5hbWUsXG59OiB7XG4gIHBhY2thZ2VEZXRhaWxzOiBQYWNrYWdlRGV0YWlsc1xuICBwYWNrYWdlVmVyc2lvbjogc3RyaW5nXG4gIHNlcXVlbmNlTnVtYmVyPzogbnVtYmVyXG4gIHNlcXVlbmNlTmFtZT86IHN0cmluZ1xufSkge1xuICBjb25zdCBwYWNrYWdlTmFtZXMgPSBwYWNrYWdlRGV0YWlscy5wYWNrYWdlTmFtZXNcbiAgICAubWFwKChuYW1lKSA9PiBuYW1lLnJlcGxhY2UoL1xcLy9nLCBcIitcIikpXG4gICAgLmpvaW4oXCIrK1wiKVxuXG4gIGNvbnN0IG5hbWVBbmRWZXJzaW9uID0gYCR7cGFja2FnZU5hbWVzfSske3BhY2thZ2VWZXJzaW9ufWBcbiAgY29uc3QgbnVtID1cbiAgICBzZXF1ZW5jZU51bWJlciA9PT0gdW5kZWZpbmVkXG4gICAgICA/IFwiXCJcbiAgICAgIDogYCske3NlcXVlbmNlTnVtYmVyLnRvU3RyaW5nKCkucGFkU3RhcnQoMywgXCIwXCIpfWBcbiAgY29uc3QgbmFtZSA9ICFzZXF1ZW5jZU5hbWUgPyBcIlwiIDogYCske3NlcXVlbmNlTmFtZX1gXG5cbiAgcmV0dXJuIGAke25hbWVBbmRWZXJzaW9ufSR7bnVtfSR7bmFtZX0ucGF0Y2hgXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2dQYXRjaFNlcXVlbmNlRXJyb3Ioe1xuICBwYXRjaERldGFpbHMsXG59OiB7XG4gIHBhdGNoRGV0YWlsczogUGF0Y2hlZFBhY2thZ2VEZXRhaWxzXG59KSB7XG4gIGNvbnNvbGUubG9nKGBcbiR7Y2hhbGsucmVkLmJvbGQoXCLim5QgRVJST1JcIil9XG5cbkZhaWxlZCB0byBhcHBseSBwYXRjaCBmaWxlICR7Y2hhbGsuYm9sZChwYXRjaERldGFpbHMucGF0Y2hGaWxlbmFtZSl9LlxuXG5JZiB0aGlzIHBhdGNoIGZpbGUgaXMgbm8gbG9uZ2VyIHVzZWZ1bCwgZGVsZXRlIGl0IGFuZCBydW5cblxuICAke2NoYWxrLmJvbGQoYHBhdGNoLXBhY2thZ2VgKX1cblxuVG8gcGFydGlhbGx5IGFwcGx5IHRoZSBwYXRjaCAoaWYgcG9zc2libGUpIGFuZCBvdXRwdXQgYSBsb2cgb2YgZXJyb3JzIHRvIGZpeCwgcnVuXG5cbiAgJHtjaGFsay5ib2xkKGBwYXRjaC1wYWNrYWdlIC0tcGFydGlhbGApfVxuXG5BZnRlciB3aGljaCB5b3Ugc2hvdWxkIG1ha2UgYW55IHJlcXVpcmVkIGNoYW5nZXMgaW5zaWRlICR7XG4gICAgcGF0Y2hEZXRhaWxzLnBhdGhcbiAgfSwgYW5kIGZpbmFsbHkgcnVuXG5cbiAgJHtjaGFsay5ib2xkKGBwYXRjaC1wYWNrYWdlICR7cGF0Y2hEZXRhaWxzLnBhdGhTcGVjaWZpZXJ9YCl9XG5cbnRvIHVwZGF0ZSB0aGUgcGF0Y2ggZmlsZS5cbmApXG59XG4iXX0=