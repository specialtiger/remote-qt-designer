# Remote Qt Designer Connector (远程 Qt Designer/Linguist/QML 连接器)

Remote Qt Designer Connector 是一个轻量级且实用的 VS Code 插件，旨在解决在 VS Code 远程开发（SSH / WSL / 容器等）中无法直接编辑和运行本地 Qt `.ui` 界面文件、`.ts` 多语言翻译文件以及 `.qml` 视图文件的问题。

通过该插件，您可以在本地电脑上直接编辑和预览远程的 Qt 相关文件，保存后插件会自动同步回远程服务器。同时，插件也支持**本地项目**，在本地项目中它将以“零开销”直接打开本地文件。

## 功能特性 ✨

- **一键本地编辑与预览**：在 VS Code 资源管理器中右键点击 `.ui`、`.ts` 或 `.qml` 文件，即可调用本地的 Qt Designer、Qt Linguist 或 qmlscene 打开。
- **本地项目智能识别**：自动识别当前项目类型。如果是本地项目，直接启动本地工具打开本地文件，无需复制临时文件与后台文件监听，实现零开销秒开。
- **自动实时同步（远程项目）**：在本地 Qt 工具中保存修改时，插件会自动将更改写回远程服务器，无需手动上传。
- **QML 依赖及资产完整同步**：打开 `.qml` 文件时，插件会自动识别并同步同级目录的 `.qml` 依赖文件，以及同级和上级（如 `../assets`, `../images` 等）的图片、JS、字体和音频等资产文件，确保本地 `qmlscene` 渲染完全正常。
- **自动临时管理**：无需担心垃圾文件，插件会自动将文件同步到本地系统的临时目录，并在关闭或退出时释放相关资源。

## 准备工作 ⚙️

为了使用该插件，您必须在**本地电脑**上安装有 Qt 相应的 GUI 工具（Qt Designer / Qt Linguist / qmlscene）。

## 配置说明 🛠️

在 VS Code 的设置中，您可以分别配置本地 Qt Designer、Qt Linguist 和 qmlscene 的绝对路径：

- **Qt Designer 绝对路径**: `remoteQtDesigner.designerPath`
  - **默认值**: `D:\Qt5.15\5.15.2\msvc2019_64\bin\designer.exe`
- **Qt Linguist 绝对路径**: `remoteQtDesigner.linguistPath`
  - **默认值**: `D:\Qt5.15\5.15.2\msvc2019_64\bin\linguist.exe`
- **qmlscene 绝对路径**: `remoteQtDesigner.qmlscenePath`
  - **默认值**: `D:\Qt5.15\5.15.2\msvc2019_64\bin\qmlscene.exe`

例如，在 Windows 上进行自定义配置：
```json
"remoteQtDesigner.designerPath": "C:\\Qt\\6.5.0\\msvc2019_64\\bin\\designer.exe",
"remoteQtDesigner.linguistPath": "C:\\Qt\\6.5.0\\msvc2019_64\\bin\\linguist.exe",
"remoteQtDesigner.qmlscenePath": "C:\\Qt\\6.5.0\\msvc2019_64\\bin\\qmlscene.exe"
```

## 使用方法 📖

1. 在左侧资源管理器中，**右键**点击任意 `.ui`、`.ts` 或 `.qml` 文件。
2. 在上下文菜单中选择对应的操作：
   - **用本地 Qt Designer 打开 (Open with local Qt Designer)**
   - **用本地 Qt Linguist 打开 (Open with local Qt Linguist)**
   - **用本地 qmlscene 打开 (Open with local qmlscene)**
3. 本地工具会自动启动并加载该文件。
4. 在工具中编辑并保存 (`Ctrl + S`)。如果是远程项目，修改将自动同步至远程！

## 许可协议 📄

[MIT License](LICENSE)
