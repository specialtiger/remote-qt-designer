const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

function activate(context) {
    // 注册右键菜单命令
    let disposable = vscode.commands.registerCommand('remote-qt-designer.openLocal', async (uri) => {
        if (!uri) {
            vscode.window.showErrorMessage('请先右键点击一个 .ui 文件');
            return;
        }

        // 1. 获取本地配置的 Qt Designer 路径 (可以在 VS Code 设置中配置)
        const config = vscode.workspace.getConfiguration('remoteQtDesigner');
        let designerPath = config.get('designerPath') || "D:\\Qt5.15\\Tools\\QtCreator\\bin\\designer.exe";

        if (!fs.existsSync(designerPath)) {
            vscode.window.showErrorMessage(`未找到本地 Qt Designer，请检查路径: ${designerPath}`);
            return;
        }

        try {
            // 2. 读取远程文件内容 (VS Code 会自动处理 SSH 远程读取)
            const remoteDocument = await vscode.workspace.fs.readFile(uri);
            
            // 3. 在本地创建临时文件
            const fileName = path.basename(uri.path);
            const localTmpDir = path.join(os.tmpdir(), 'vscode-remote-qt');
            if (!fs.existsSync(localTmpDir)) {
                fs.mkdirSync(localTmpDir, { recursive: true });
            }
            const localFilePath = path.join(localTmpDir, fileName);
            fs.writeFileSync(localFilePath, remoteDocument);

            vscode.window.showInformationMessage(`正在使用本地 Designer 打开: ${fileName}`);

            // 4. 调用本地 Qt Designer 打开该文件
            // 使用双引号包裹路径防止空格导致解析失败
            const cmd = `"${designerPath}" "${localFilePath}"`;
            const designerProcess = exec(cmd, (error) => {
                if (error) {
                    vscode.window.showErrorMessage(`启动 Designer 失败: ${error.message}`);
                }
            });

            // 5. 监听本地临时文件变动，自动保存回远程
            let lastMtime = 0;
            let syncTimeout = null;

            const watcher = fs.watch(localTmpDir, (eventType, filename) => {
                if (filename && filename.toLowerCase() === fileName.toLowerCase()) {
                    if (syncTimeout) {
                        clearTimeout(syncTimeout);
                    }
                    syncTimeout = setTimeout(async () => {
                        try {
                            if (fs.existsSync(localFilePath)) {
                                const stats = fs.statSync(localFilePath);
                                if (stats.mtimeMs !== lastMtime) {
                                    lastMtime = stats.mtimeMs;
                                    const updatedContent = fs.readFileSync(localFilePath);
                                    // 写回远程
                                    await vscode.workspace.fs.writeFile(uri, updatedContent);
                                    vscode.window.setStatusBarMessage(`[Remote Qt] 已同步到远程: ${fileName}`, 3000);
                                }
                            }
                        } catch (err) {
                            // 忽略重命名/锁定等暂态下的读取错误
                        }
                    }, 100);
                }
            });

            // 当进程退出或关闭插件时释放监听和定时器
            context.subscriptions.push({
                dispose: () => {
                    watcher.close();
                    if (syncTimeout) {
                        clearTimeout(syncTimeout);
                    }
                }
            });

        } catch (error) {
            vscode.window.showErrorMessage(`操作失败: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};