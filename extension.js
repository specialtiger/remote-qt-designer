const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const ASSET_EXTENSIONS = new Set([
    '.qml', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.json', '.qmldir',
    '.ttf', '.otf', '.woff', '.wav', '.mp3', '.mp4'
]);
const EXCLUDED_DIRS = new Set(['node_modules', '.git', '.vscode', 'build', 'dist', 'release', 'debug']);
const SIBLING_ASSET_DIRS = new Set(['assets', 'images', 'icons', 'components', 'imports']);

function getHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16);
}

function isAssetFile(fileName) {
    const lowerName = fileName.toLowerCase();
    if (lowerName === 'qmldir') {
        return true;
    }
    const ext = path.extname(lowerName);
    return ASSET_EXTENSIONS.has(ext);
}

async function copyRemoteDirToLocal(remoteDirUri, localDir) {
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }
    try {
        const entries = await vscode.workspace.fs.readDirectory(remoteDirUri);
        for (const [name, type] of entries) {
            const childRemoteUri = vscode.Uri.joinPath(remoteDirUri, name);
            const childLocalPath = path.join(localDir, name);

            if (type === vscode.FileType.File) {
                if (isAssetFile(name)) {
                    try {
                        const content = await vscode.workspace.fs.readFile(childRemoteUri);
                        fs.writeFileSync(childLocalPath, content);
                    } catch (err) {
                        // Ignore individual read/write errors
                    }
                }
            } else if (type === vscode.FileType.Directory) {
                if (!EXCLUDED_DIRS.has(name.toLowerCase())) {
                    await copyRemoteDirToLocal(childRemoteUri, childLocalPath);
                }
            }
        }
    } catch (err) {
        // Ignore directory read errors
    }
}

async function copyRemoteAssetsToLocal(uri, localTmpDir, parentName) {
    const remoteParentPath = uri.path.substring(0, uri.path.lastIndexOf('/'));
    const remoteParentUri = uri.with({ path: remoteParentPath });
    
    // Copy the parent directory itself
    const localParentDir = parentName ? path.join(localTmpDir, parentName) : localTmpDir;
    await copyRemoteDirToLocal(remoteParentUri, localParentDir);

    // Look for sibling asset directories in the grandparent directory
    const grandparentSlashIdx = remoteParentPath.lastIndexOf('/');
    if (grandparentSlashIdx > 0) {
        const remoteGrandparentPath = remoteParentPath.substring(0, grandparentSlashIdx);
        const remoteGrandparentUri = uri.with({ path: remoteGrandparentPath });
        try {
            const entries = await vscode.workspace.fs.readDirectory(remoteGrandparentUri);
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory) {
                    const lowerName = name.toLowerCase();
                    if (SIBLING_ASSET_DIRS.has(lowerName)) {
                        const siblingRemoteUri = vscode.Uri.joinPath(remoteGrandparentUri, name);
                        const siblingLocalPath = path.join(localTmpDir, name);
                        await copyRemoteDirToLocal(siblingRemoteUri, siblingLocalPath);
                    }
                }
            }
        } catch (err) {
            // Ignore grandparent directory read errors
        }
    }
}

async function openFileWithLocalTool(uri, configKey, defaultToolPath, toolName, fileExtensionHint, context) {
    if (!uri) {
        vscode.window.showErrorMessage(`请先右键点击一个 ${fileExtensionHint}`);
        return;
    }

    // 1. 获取本地配置的工具路径 (可以在 VS Code 设置中配置)
    const config = vscode.workspace.getConfiguration('remoteQtDesigner');
    let toolPath = config.get(configKey) || defaultToolPath;

    if (!fs.existsSync(toolPath)) {
        vscode.window.showErrorMessage(`未找到本地 ${toolName}，请检查路径: ${toolPath}`);
        return;
    }

    try {
        // 2. 读取远程文件内容 (VS Code 会自动处理 SSH 远程读取)
        const remoteDocument = await vscode.workspace.fs.readFile(uri);
        
        // 3. 在本地创建临时文件
        const fileName = path.basename(uri.path);
        const remoteParentPath = uri.path.substring(0, uri.path.lastIndexOf('/'));
        const parentName = remoteParentPath.substring(remoteParentPath.lastIndexOf('/') + 1);
        const dirHash = getHash(remoteParentPath);
        const localTmpDir = path.join(os.tmpdir(), 'vscode-remote-qt', dirHash);
        
        const localParentDir = parentName ? path.join(localTmpDir, parentName) : localTmpDir;

        const isQmlFile = fileName.toLowerCase().endsWith('.qml');
        if (isQmlFile) {
            vscode.window.setStatusBarMessage(`[Remote Qt] 正在同步 QML 依赖及资产文件...`, 3000);
            await copyRemoteAssetsToLocal(uri, localTmpDir, parentName);
        } else if (!fs.existsSync(localParentDir)) {
            fs.mkdirSync(localParentDir, { recursive: true });
        }

        const localFilePath = path.join(localParentDir, fileName);
        fs.writeFileSync(localFilePath, remoteDocument);

        // 3.1. 如果是 .ts 文件，尝试下载远程已有的 .qm 文件
        const isTsFile = fileName.toLowerCase().endsWith('.ts');
        const filesToSync = [
            {
                localPath: localFilePath,
                remoteUri: uri,
                name: fileName,
                lastMtime: 0,
                syncTimeout: null
            }
        ];

        if (isTsFile) {
            const qmFileName = fileName.replace(/\.ts$/i, '.qm');
            const remoteQmUri = uri.with({ path: uri.path.replace(/\.ts$/i, '.qm') });
            try {
                const remoteQmDocument = await vscode.workspace.fs.readFile(remoteQmUri);
                const localQmFilePath = path.join(localParentDir, qmFileName);
                fs.writeFileSync(localQmFilePath, remoteQmDocument);
            } catch (err) {
                // 如果远程还没有对应的 .qm 文件，忽略读取错误
            }
            filesToSync.push({
                localPath: path.join(localParentDir, qmFileName),
                remoteUri: remoteQmUri,
                name: qmFileName,
                lastMtime: 0,
                syncTimeout: null
            });
        }

        // 初始化已有文件的修改时间，避免刚打开时的重复同步
        for (const file of filesToSync) {
            if (fs.existsSync(file.localPath)) {
                file.lastMtime = fs.statSync(file.localPath).mtimeMs;
            }
        }

        vscode.window.showInformationMessage(`正在使用本地 ${toolName} 打开: ${fileName}`);

        // 4. 调用本地工具打开该文件
        // 使用双引号包裹路径防止空格导致解析失败
        const cmd = `"${toolPath}" "${localFilePath}"`;
        const toolProcess = exec(cmd, (error) => {
            if (error) {
                vscode.window.showErrorMessage(`启动 ${toolName} 失败: ${error.message}`);
            }
        });

        // 5. 监听本地临时文件变动，自动保存回远程
        const watcher = fs.watch(localTmpDir, { recursive: true }, (eventType, filename) => {
            if (filename) {
                const changedName = path.basename(filename);
                const target = filesToSync.find(f => f.name.toLowerCase() === changedName.toLowerCase());
                if (target) {
                    if (target.syncTimeout) {
                        clearTimeout(target.syncTimeout);
                    }
                    target.syncTimeout = setTimeout(async () => {
                        try {
                            if (fs.existsSync(target.localPath)) {
                                const stats = fs.statSync(target.localPath);
                                if (stats.mtimeMs !== target.lastMtime) {
                                    target.lastMtime = stats.mtimeMs;
                                    const updatedContent = fs.readFileSync(target.localPath);
                                    // 写回远程
                                    await vscode.workspace.fs.writeFile(target.remoteUri, updatedContent);
                                    vscode.window.setStatusBarMessage(`[Remote Qt] 已同步到远程: ${target.name}`, 3000);
                                }
                            }
                        } catch (err) {
                            // 忽略重命名/锁定等暂态下的读取错误
                        }
                    }, 100);
                }
            }
        });

        // 当进程退出或关闭插件时释放监听和定时器
        context.subscriptions.push({
            dispose: () => {
                watcher.close();
                for (const file of filesToSync) {
                    if (file.syncTimeout) {
                        clearTimeout(file.syncTimeout);
                    }
                }
            }
        });

    } catch (error) {
        vscode.window.showErrorMessage(`操作失败: ${error.message}`);
    }
}

function activate(context) {
    // 注册右键菜单命令 (Qt Designer)
    let disposableDesigner = vscode.commands.registerCommand('remote-qt-designer.openLocal', async (uri) => {
        await openFileWithLocalTool(
            uri,
            'designerPath',
            "D:\\Qt5.15\\Tools\\QtCreator\\bin\\designer.exe",
            'Designer',
            '.ui 文件',
            context
        );
    });

    // 注册右键菜单命令 (Qt Linguist)
    let disposableLinguist = vscode.commands.registerCommand('remote-qt-designer.openLinguist', async (uri) => {
        await openFileWithLocalTool(
            uri,
            'linguistPath',
            "D:\\Qt5.15\\5.15.2\\msvc2019_64\\bin\\linguist.exe",
            'Linguist',
            '.ts 文件',
            context
        );
    });

    // 注册右键菜单命令 (Qt QML Scene)
    let disposableQmlscene = vscode.commands.registerCommand('remote-qt-designer.openQmlscene', async (uri) => {
        await openFileWithLocalTool(
            uri,
            'qmlscenePath',
            "D:\\Qt5.15\\5.15.2\\msvc2019_64\\bin\\qmlscene.exe",
            'qmlscene',
            '.qml 文件',
            context
        );
    });

    context.subscriptions.push(disposableDesigner);
    context.subscriptions.push(disposableLinguist);
    context.subscriptions.push(disposableQmlscene);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};