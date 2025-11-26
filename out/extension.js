"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ToolchainManager_1 = require("./services/ToolchainManager");
const DeviceManager_1 = require("./services/DeviceManager");
const BuildService_1 = require("./services/BuildService");
const FlashService_1 = require("./services/FlashService");
const ConfigManager_1 = require("./services/ConfigManager");
const types_1 = require("./types");
let outputChannel;
let statusBarItem;
// Services
let toolchainManager;
let deviceManager;
let buildService;
let flashService;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel('STM32 Compiler');
    // Initialize services
    toolchainManager = new ToolchainManager_1.ToolchainManager();
    deviceManager = new DeviceManager_1.DeviceManager(context);
    buildService = new BuildService_1.BuildService(toolchainManager, outputChannel);
    flashService = new FlashService_1.FlashService(toolchainManager, deviceManager, outputChannel);
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(circuit-board) STM32';
    statusBarItem.tooltip = 'STM32 Professional Compiler';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('stm32-pro.build', () => buildProject()), vscode.commands.registerCommand('stm32-pro.flash', () => flashFirmware()), vscode.commands.registerCommand('stm32-pro.monitor', () => openMonitor(context)), vscode.commands.registerCommand('stm32-pro.setup', () => setupProject(context)), vscode.commands.registerCommand('stm32-pro.optimize', () => optimizeMakefile()), vscode.commands.registerCommand('stm32-pro.clean', () => cleanBuild()), vscode.commands.registerCommand('stm32-pro.debug', () => startDebug()), vscode.commands.registerCommand('stm32-pro.connect', () => testConnection()), vscode.commands.registerCommand('stm32-pro.disconnect', () => disconnect()), vscode.commands.registerCommand('stm32-pro.selectProfile', () => selectProfile()));
    // Register tree views
    const actionsProvider = new TreeProvider([
        ['$(tools) Build', 'stm32-pro.build'],
        ['$(zap) Flash', 'stm32-pro.flash'],
        ['$(debug-alt) Debug', 'stm32-pro.debug'],
        ['$(trash) Clean', 'stm32-pro.clean'],
        ['$(settings-gear) Setup', 'stm32-pro.setup']
    ]);
    vscode.window.registerTreeDataProvider('stm32-pro.actions', actionsProvider);
    const profilesProvider = new TreeProvider([
        ['O0 - Debug', 'stm32-pro.selectProfile'],
        ['O1 - Basic', 'stm32-pro.selectProfile'],
        ['O2 - Standard', 'stm32-pro.selectProfile'],
        ['O3 - Aggressive', 'stm32-pro.selectProfile'],
        ['Os - Size', 'stm32-pro.selectProfile'],
        ['Og - Debug+Opt', 'stm32-pro.selectProfile']
    ]);
    vscode.window.registerTreeDataProvider('stm32-pro.profiles', profilesProvider);
    const connectionProvider = new TreeProvider([
        ['$(plug) Test Connection', 'stm32-pro.connect'],
        ['$(debug-disconnect) Disconnect', 'stm32-pro.disconnect'],
        ['$(graph) Live Monitor', 'stm32-pro.monitor']
    ]);
    vscode.window.registerTreeDataProvider('stm32-pro.connection', connectionProvider);
    // Auto-detect project and validate toolchain on activation
    initializeExtension(context);
    outputChannel.appendLine('STM32 Professional Compiler activated');
}
/**
 * Initialize extension with toolchain validation
 */
async function initializeExtension(context) {
    const ws = getWorkspace();
    if (!ws)
        return;
    // Auto-detect project
    autoDetectProject();
    // Validate toolchain in background
    try {
        const validation = await toolchainManager.validateToolchain();
        if (!validation.allFound) {
            const message = `Missing toolchain components: ${validation.missing.join(', ')}`;
            const action = await vscode.window.showWarningMessage(message, 'Show Instructions', 'Ignore');
            if (action === 'Show Instructions') {
                outputChannel.show();
                outputChannel.clear();
                outputChannel.appendLine('=== Toolchain Installation Instructions ===\n');
                for (const tool of validation.missing) {
                    const instructions = toolchainManager.getInstallInstructions(tool);
                    outputChannel.appendLine(`${tool}:`);
                    outputChannel.appendLine(`  ${instructions}\n`);
                }
            }
        }
        else {
            // Show toolchain info
            const info = await toolchainManager.getToolchainInfo();
            outputChannel.appendLine('\n' + info);
        }
    }
    catch (error) {
        // Ignore toolchain validation errors at startup
    }
}
/**
 * Select build profile
 */
async function selectProfile() {
    const profiles = buildService.getProfiles();
    const items = profiles.map(p => ({
        label: p.name,
        description: p.description
    }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select Build Profile'
    });
    if (selected) {
        await ConfigManager_1.ConfigManager.setDefaultProfile(selected.label);
        vscode.window.showInformationMessage(`Build profile set to ${selected.label}`);
        statusBarItem.text = `$(circuit-board) STM32 [${selected.label}]`;
    }
}
/**
 * Build project
 */
async function buildProject() {
    const ws = getWorkspace();
    if (!ws)
        return;
    const profile = ConfigManager_1.ConfigManager.getDefaultProfile();
    const buildSystem = ConfigManager_1.ConfigManager.getBuildSystem();
    statusBarItem.text = `$(sync~spin) Building...`;
    try {
        const result = await buildService.build(ws, profile, buildSystem);
        if (result.success) {
            statusBarItem.text = `$(check) Build OK [${profile}]`;
            vscode.window.showInformationMessage(`Build successful with ${profile} profile`);
            // Auto-flash if enabled
            if (ConfigManager_1.ConfigManager.getAutoFlash()) {
                await flashFirmware();
            }
        }
        else {
            statusBarItem.text = `$(error) Build Failed`;
            vscode.window.showErrorMessage('Build failed. Check output for details.');
        }
    }
    catch (error) {
        statusBarItem.text = `$(error) Build Failed`;
        handleError(error, 'Build failed');
    }
}
/**
 * Flash firmware
 */
async function flashFirmware() {
    const ws = getWorkspace();
    if (!ws)
        return;
    statusBarItem.text = `$(sync~spin) Flashing...`;
    try {
        const result = await flashService.flash(ws);
        if (result.success) {
            statusBarItem.text = `$(check) Flash OK`;
            vscode.window.showInformationMessage('Firmware flashed successfully!');
        }
        else {
            statusBarItem.text = `$(error) Flash Failed`;
            vscode.window.showErrorMessage(result.error || 'Flash failed. Check output.');
        }
    }
    catch (error) {
        statusBarItem.text = `$(error) Flash Failed`;
        handleError(error, 'Flash failed');
    }
}
/**
 * Clean build
 */
async function cleanBuild() {
    const ws = getWorkspace();
    if (!ws)
        return;
    const buildSystem = ConfigManager_1.ConfigManager.getBuildSystem();
    try {
        await buildService.clean(ws, buildSystem);
        vscode.window.showInformationMessage('Build cleaned');
    }
    catch (error) {
        handleError(error, 'Clean failed');
    }
}
/**
 * Start debug session
 */
async function startDebug() {
    const ws = getWorkspace();
    if (!ws)
        return;
    try {
        // Get device info
        const deviceInfo = await deviceManager.detectDevice(ws);
        if (!deviceInfo) {
            vscode.window.showWarningMessage('Could not detect device. Using default configuration.');
        }
        // TODO: Create advanced launch.json with SVD support
        // For now, delegate to VS Code debug
        vscode.commands.executeCommand('workbench.action.debug.start');
    }
    catch (error) {
        handleError(error, 'Debug setup failed');
    }
}
/**
 * Test connection
 */
async function testConnection() {
    const ws = getWorkspace();
    if (!ws)
        return;
    statusBarItem.text = `$(sync~spin) Connecting...`;
    try {
        const connected = await flashService.testConnection(ws);
        if (connected) {
            statusBarItem.text = `$(check) Connected`;
            vscode.window.showInformationMessage('Device connected successfully!');
        }
        else {
            statusBarItem.text = `$(error) Not Connected`;
            vscode.window.showErrorMessage('Connection failed. Check device and cable.');
        }
    }
    catch (error) {
        statusBarItem.text = `$(error) Not Connected`;
        handleError(error, 'Connection test failed');
    }
}
/**
 * Disconnect from device
 */
function disconnect() {
    flashService.disconnect();
    statusBarItem.text = `$(circuit-board) STM32`;
    vscode.window.showInformationMessage('Disconnected');
}
/**
 * Open live monitor
 */
async function openMonitor(context) {
    const panel = vscode.window.createWebviewPanel('stm32Monitor', 'STM32 Live Monitor', vscode.ViewColumn.Two, { enableScripts: true });
    panel.webview.html = getMonitorHtml();
}
/**
 * Setup project
 */
async function setupProject(context) {
    const ws = getWorkspace();
    if (!ws)
        return;
    const options = await vscode.window.showQuickPick([
        { label: '$(rocket) Full Setup', description: 'Configure everything' },
        { label: '$(file-code) Optimize Makefile', description: 'Add optimization profiles' },
        { label: '$(tools) Check Toolchain', description: 'Validate ARM toolchain' },
        { label: '$(device-mobile) Detect Device', description: 'Auto-detect STM32 device' },
        { label: '$(settings-gear) Configure Build System', description: 'Choose Makefile or CMake' }
    ], { placeHolder: 'Select setup option' });
    if (!options)
        return;
    switch (options.label) {
        case '$(rocket) Full Setup':
            await fullSetup(ws);
            break;
        case '$(file-code) Optimize Makefile':
            await optimizeMakefile();
            break;
        case '$(tools) Check Toolchain':
            await checkToolchain();
            break;
        case '$(device-mobile) Detect Device':
            await detectDevice(ws);
            break;
        case '$(settings-gear) Configure Build System':
            await configureBuildSystem();
            break;
    }
}
/**
 * Full project setup
 */
async function fullSetup(workspaceRoot) {
    outputChannel.show();
    outputChannel.clear();
    outputChannel.appendLine('=== Full Project Setup ===\n');
    // 1. Check toolchain
    outputChannel.appendLine('1. Checking toolchain...');
    const info = await toolchainManager.getToolchainInfo();
    outputChannel.appendLine(info + '\n');
    // 2. Detect device
    outputChannel.appendLine('2. Detecting device...');
    const deviceInfo = await deviceManager.detectDevice(workspaceRoot);
    if (deviceInfo) {
        outputChannel.appendLine(`✓ Detected: ${deviceInfo.name} (${deviceInfo.family})`);
        outputChannel.appendLine(`  Flash: ${deviceInfo.flashSize}KB, RAM: ${deviceInfo.ramSize}KB\n`);
    }
    else {
        outputChannel.appendLine('✗ Could not detect device\n');
    }
    // 3. Select build profile
    outputChannel.appendLine('3. Selecting build profile...');
    await selectProfile();
    outputChannel.appendLine('\n✓ Setup complete!');
}
/**
 * Check toolchain
 */
async function checkToolchain() {
    outputChannel.show();
    outputChannel.clear();
    const info = await toolchainManager.getToolchainInfo();
    outputChannel.appendLine(info);
}
/**
 * Detect device
 */
async function detectDevice(workspaceRoot) {
    outputChannel.show();
    outputChannel.clear();
    outputChannel.appendLine('=== Device Detection ===\n');
    const deviceInfo = await deviceManager.detectDevice(workspaceRoot);
    if (deviceInfo) {
        outputChannel.appendLine(`Device: ${deviceInfo.name}`);
        outputChannel.appendLine(`Family: ${deviceInfo.family}`);
        outputChannel.appendLine(`OpenOCD Target: ${deviceInfo.openocdTarget}`);
        outputChannel.appendLine(`Flash: ${deviceInfo.flashSize}KB`);
        outputChannel.appendLine(`RAM: ${deviceInfo.ramSize}KB`);
        vscode.window.showInformationMessage(`Detected ${deviceInfo.name}`);
    }
    else {
        outputChannel.appendLine('Could not detect device from project files.');
        vscode.window.showWarningMessage('Could not detect STM32 device');
    }
}
/**
 * Configure build system
 */
async function configureBuildSystem() {
    const selected = await vscode.window.showQuickPick([
        { label: 'Makefile', description: 'Traditional Makefile (default)' },
        { label: 'CMake', description: 'Modern CMake build system' }
    ], { placeHolder: 'Select build system' });
    if (selected) {
        const system = selected.label.toLowerCase();
        await ConfigManager_1.ConfigManager.setBuildSystem(system);
        vscode.window.showInformationMessage(`Build system set to ${selected.label}`);
    }
}
/**
 * Optimize Makefile (legacy function, kept for compatibility)
 */
async function optimizeMakefile() {
    vscode.window.showInformationMessage('Makefile optimization is automatic. Build profiles are injected during build.');
}
/**
 * Auto-detect project type
 */
function autoDetectProject() {
    const ws = getWorkspace();
    if (!ws)
        return;
    const fs = require('fs');
    const path = require('path');
    const files = fs.readdirSync(ws);
    const hasIoc = files.some((f) => f.endsWith('.ioc'));
    const hasMakefile = files.includes('Makefile');
    const hasCMake = files.includes('CMakeLists.txt');
    if (hasIoc || hasMakefile || hasCMake) {
        let projectType = hasIoc ? 'CubeMX' : hasCMake ? 'CMake' : 'Makefile';
        outputChannel.appendLine(`Detected STM32 project: ${projectType}`);
        statusBarItem.text = '$(circuit-board) STM32 Ready';
    }
}
/**
 * Get workspace root
 */
function getWorkspace() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return undefined;
    }
    return folders[0].uri.fsPath;
}
/**
 * Handle errors with user-friendly messages
 */
function handleError(error, defaultMessage) {
    if (error instanceof types_1.STM32Error) {
        switch (error.code) {
            case types_1.ErrorCode.TOOLCHAIN_NOT_FOUND:
                vscode.window.showErrorMessage(error.message, 'Show Instructions').then(action => {
                    if (action === 'Show Instructions') {
                        vscode.commands.executeCommand('stm32-pro.setup');
                    }
                });
                break;
            default:
                vscode.window.showErrorMessage(error.message);
        }
        outputChannel.appendLine(`ERROR [${error.code}]: ${error.message}`);
    }
    else {
        vscode.window.showErrorMessage(`${defaultMessage}: ${error.message}`);
        outputChannel.appendLine(`ERROR: ${error.message}`);
    }
}
/**
 * Get monitor HTML (kept from original)
 */
function getMonitorHtml() {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { 
            background: #1e1e1e; 
            color: #d4d4d4; 
            font-family: 'Segoe UI', sans-serif;
            padding: 20px;
            margin: 0;
        }
        h1 { color: #4ec9b0; margin-bottom: 20px; }
        .card {
            background: #252526;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
        }
        .card h2 { color: #569cd6; margin: 0 0 12px 0; font-size: 14px; }
        .status-connected { color: #4ec9b0; }
    </style>
</head>
<body>
    <h1>📊 STM32 Live Monitor</h1>
    
    <div class="card">
        <h2>Connection Status</h2>
        <span class="status-connected">● Ready</span>
    </div>
    
    <div class="card">
        <h2>Live Variables</h2>
        <p>Connect debugger to view live variables</p>
    </div>
</body>
</html>`;
}
/**
 * Tree provider implementation
 */
class TreeProvider {
    constructor(items) {
        this.items = items;
    }
    getTreeItem(element) {
        return element;
    }
    getChildren() {
        return this.items.map(([label, cmd]) => new TreeItem(label, cmd));
    }
}
class TreeItem extends vscode.TreeItem {
    constructor(label, cmd) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = { command: cmd, title: label };
    }
}
function deactivate() {
    disconnect();
}
//# sourceMappingURL=extension.js.map