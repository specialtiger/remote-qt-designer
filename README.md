# Remote Qt Designer Connector (远程 Qt Designer 连接器)

Remote Qt Designer Connector 是一个轻量级且实用的 VS Code 插件，旨在解决在 VS Code 远程开发（SSH / WSL / 容器等）中无法直接编辑 `.ui` 界面文件的问题。

通过该插件，您可以在本地电脑上直接编辑远程的 Qt `.ui` 文件，保存后插件会自动同步回远程服务器。

## 功能特性 ✨

- 🚀 **一键本地编辑**：在 VS Code 资源管理器中右键点击 `.ui` 文件，即可调用本地的 Qt Designer 打开。
- 🔄 **自动实时同步**：在本地 Qt Designer 中保存修改时，插件会自动将更改写回远程服务器，无需手动上传。
- 📦 **自动临时管理**：无需担心垃圾文件，插件会自动将文件同步到本地系统的临时目录，并在关闭或退出时释放相关资源。

## 准备工作 ⚙️

为了使用该插件，您必须在**本地电脑**上安装有 Qt Designer。

## 配置说明 🛠️

在 VS Code 的设置中，您可以配置本地 Qt Designer 的绝对路径：

- **设置项**: `remoteQtDesigner.designerPath`
- **默认值**: `D:\Qt5.15\5.15.2\msvc2019_64\bin\designer.exe` (请根据您本地的实际安装路径进行修改)

例如，在 Windows 上：
```json
"remoteQtDesigner.designerPath": "C:\\Qt\\6.5.0\\msvc2019_64\\bin\\designer.exe"
```

## 使用方法 📖

1. 在 VS Code 中连接到远程服务器（SSH/WSL 等）。
2. 在左侧资源管理器中，**右键**点击任意 `.ui` 文件。
3. 选择 **用本地 Qt Designer 打开 (Open with local Qt Designer)**。
4. 本地 Qt Designer 会自动启动并加载该文件。
5. 在 Qt Designer 中编辑并保存 (`Ctrl + S`)，修改将自动同步至远程！

## 许可协议 📄

[MIT License](LICENSE)
