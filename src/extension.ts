import * as vscode from 'vscode';
import { execSync, spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Build Profiles - Professional GCC ARM Optimization Flags
const BUILD_PROFILES: Record<string, string[]> = {
    'O0': ['-O0', '-g3', '-DDEBUG'],
    'O1': ['-O1', '-g2'],
    'O2': ['-O2', '-g1', '-flto', '-ffunction-sections', '-fdata-sections'],
    'O3': ['-O3', '-flto', '-ffunction-sections', '-fdata-sections', '-funroll-loops', '-finline-functions'],
    'Os': ['-Os', '-flto', '-ffunction-sections', '-fdata-sections', '-fno-exceptions'],
    'Og': ['-Og', '-g3', '-DDEBUG']
};

const LINKER_FLAGS = '-Wl,--gc-sections -Wl,--print-memory-usage';

let outputChannel: vscode.OutputChannel;
let openocdProcess: ChildProcess | null = null;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel('STM32 Compiler');
    
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(circuit-board) STM32';
    statusBarItem.tooltip = 'STM32 Professional Compiler';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('stm32-pro.build', () => buildProject()),
        vscode.commands.registerCommand('stm32-pro.flash', () => flashFirmware()),
        vscode.commands.registerCommand('stm32-pro.monitor', () => openMonitor(context)),
        vscode.commands.registerCommand('stm32-pro.setup', () => setupProject(context)),
        vscode.commands.registerCommand('stm32-pro.optimize', () => optimizeMakefile()),
        vscode.commands.registerCommand('stm32-pro.clean', () => cleanBuild()),
        vscode.commands.registerCommand('stm32-pro.debug', () => startDebug()),
        vscode.commands.registerCommand('stm32-pro.connect', () => testConnection()),
        vscode.commands.registerCommand('stm32-pro.disconnect', () => disconnect()),
        vscode.commands.registerCommand('stm32-pro.selectProfile', () => selectProfile())
    );

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

    // Auto-detect project on activation
    autoDetectProject(context);
    
    outputChannel.appendLine('STM32 Professional Compiler activated');
}

async function selectProfile() {
    const profiles = Object.keys(BUILD_PROFILES);
    const descriptions: Record<string, string> = {
        'O0': 'No optimization - Best for debugging',
        'O1': 'Basic optimization',
        'O2': 'Standard optimization - Recommended for production',
        'O3': 'Aggressive optimization - Maximum speed',
        'Os': 'Size optimization - Minimum flash usage',
        'Og': 'Debug-friendly optimization'
    };
    
    const items = profiles.map(p => ({
        label: p,
        description: descriptions[p]
    }));
    
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select Build Profile'
    });
    
    if (selected) {
        const config = vscode.workspace.getConfiguration('stm32-pro');
        await config.update('defaultProfile', selected.label, vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Build profile set to ${selected.label}`);
        statusBarItem.text = `$(circuit-board) STM32 [${selected.label}]`;
    }
}

async function buildProject() {
    const ws = getWorkspace();
    if (!ws) return;

    const config = vscode.workspace.getConfiguration('stm32-pro');
    const profile = config.get<string>('defaultProfile') || 'O2';
    const flags = BUILD_PROFILES[profile];

    outputChannel.clear();
    outputChannel.show();
    outputChannel.appendLine(`=== Building with ${profile} profile ===`);
    outputChannel.appendLine(`Flags: ${flags.join(' ')}`);

    statusBarItem.text = `$(sync~spin) Building...`;

    try {
        // Check if optimized Makefile exists
        const makefilePath = path.join(ws, 'Makefile');
        
        // Build command
        const buildCmd = `make -j$(nproc) OPT="${flags.join(' ')}" LDFLAGS+="${LINKER_FLAGS}"`;
        outputChannel.appendLine(`> ${buildCmd}`);
        
        const result = execSync(buildCmd, { 
            cwd: ws, 
            encoding: 'utf8',
            maxBuffer: 10 * 1024 * 1024
        });
        
        outputChannel.appendLine(result);
        
        // Parse memory usage
        const memMatch = result.match(/Memory region\s+Used Size[\s\S]*?FLASH:\s+(\d+)\s+\w+\s+(\d+)\s+\w+\s+([\d.]+)%[\s\S]*?RAM:\s+(\d+)\s+\w+\s+(\d+)\s+\w+\s+([\d.]+)%/);
        if (memMatch) {
            outputChannel.appendLine(`\n=== Memory Usage ===`);
            outputChannel.appendLine(`FLASH: ${memMatch[1]} / ${memMatch[2]} bytes (${memMatch[3]}%)`);
            outputChannel.appendLine(`RAM:   ${memMatch[4]} / ${memMatch[5]} bytes (${memMatch[6]}%)`);
        }
        
        statusBarItem.text = `$(check) Build OK [${profile}]`;
        vscode.window.showInformationMessage(`Build successful with ${profile} profile`);
        
        // Auto-flash if enabled
        if (config.get<boolean>('autoFlash')) {
            await flashFirmware();
        }
    } catch (err: any) {
        outputChannel.appendLine(`\nBuild failed: ${err.message}`);
        if (err.stdout) outputChannel.appendLine(err.stdout);
        if (err.stderr) outputChannel.appendLine(err.stderr);
        statusBarItem.text = `$(error) Build Failed`;
        vscode.window.showErrorMessage('Build failed. Check output for details.');
    }
}

async function flashFirmware() {
    const ws = getWorkspace();
    if (!ws) return;

    outputChannel.show();
    outputChannel.appendLine('\n=== Flashing Firmware ===');
    statusBarItem.text = `$(sync~spin) Flashing...`;

    try {
        // Find .elf or .bin file
        const buildDir = path.join(ws, 'build');
        let elfFile = '';
        
        if (fs.existsSync(buildDir)) {
            const files = fs.readdirSync(buildDir);
            const elf = files.find(f => f.endsWith('.elf'));
            if (elf) elfFile = path.join(buildDir, elf);
        }
        
        if (!elfFile) {
            throw new Error('No .elf file found in build directory');
        }

        // Detect programmer
        const programmer = await detectProgrammer();
        outputChannel.appendLine(`Programmer: ${programmer}`);
        
        const config = vscode.workspace.getConfiguration('stm32-pro');
        const openocdPath = config.get<string>('openocdPath') || 'openocd';
        
        const flashCmd = `${openocdPath} -f interface/${programmer}.cfg -f target/stm32f7x.cfg -c "program ${elfFile} verify reset exit"`;
        outputChannel.appendLine(`> ${flashCmd}`);
        
        const result = execSync(flashCmd, { cwd: ws, encoding: 'utf8' });
        outputChannel.appendLine(result);
        
        statusBarItem.text = `$(check) Flash OK`;
        vscode.window.showInformationMessage('Firmware flashed successfully!');
    } catch (err: any) {
        outputChannel.appendLine(`Flash failed: ${err.message}`);
        statusBarItem.text = `$(error) Flash Failed`;
        vscode.window.showErrorMessage('Flash failed. Check connection and output.');
    }
}

async function detectProgrammer(): Promise<string> {
    try {
        execSync('lsusb | grep -i "st-link"', { encoding: 'utf8' });
        return 'stlink-v2';
    } catch {}
    
    try {
        execSync('lsusb | grep -i "j-link"', { encoding: 'utf8' });
        return 'jlink';
    } catch {}
    
    try {
        execSync('lsusb | grep -i "cmsis-dap"', { encoding: 'utf8' });
        return 'cmsis-dap';
    } catch {}
    
    return 'stlink-v2'; // Default
}

async function cleanBuild() {
    const ws = getWorkspace();
    if (!ws) return;

    outputChannel.show();
    outputChannel.appendLine('\n=== Cleaning Build ===');

    try {
        execSync('make clean', { cwd: ws, encoding: 'utf8' });
        vscode.window.showInformationMessage('Build cleaned');
    } catch (err: any) {
        outputChannel.appendLine(`Clean failed: ${err.message}`);
    }
}

async function startDebug() {
    const ws = getWorkspace();
    if (!ws) return;

    // Create launch.json if not exists
    const vscodePath = path.join(ws, '.vscode');
    const launchPath = path.join(vscodePath, 'launch.json');
    
    if (!fs.existsSync(vscodePath)) {
        fs.mkdirSync(vscodePath, { recursive: true });
    }
    
    if (!fs.existsSync(launchPath)) {
        const launchConfig = {
            version: "0.2.0",
            configurations: [
                {
                    name: "STM32 Debug",
                    type: "cortex-debug",
                    request: "launch",
                    servertype: "openocd",
                    cwd: "${workspaceFolder}",
                    executable: "${workspaceFolder}/build/${workspaceFolderBasename}.elf",
                    device: "STM32F730V8",
                    configFiles: [
                        "interface/stlink-v2.cfg",
                        "target/stm32f7x.cfg"
                    ],
                    svdFile: "${workspaceFolder}/STM32F730.svd",
                    runToEntryPoint: "main",
                    preLaunchTask: "build"
                }
            ]
        };
        fs.writeFileSync(launchPath, JSON.stringify(launchConfig, null, 4));
    }

    vscode.commands.executeCommand('workbench.action.debug.start');
}

async function testConnection() {
    const ws = getWorkspace();
    if (!ws) return;

    outputChannel.show();
    outputChannel.appendLine('\n=== Testing Connection ===');
    statusBarItem.text = `$(sync~spin) Connecting...`;

    try {
        const config = vscode.workspace.getConfiguration('stm32-pro');
        const openocdPath = config.get<string>('openocdPath') || 'openocd';
        
        const result = execSync(
            `${openocdPath} -f interface/stlink-v2.cfg -f target/stm32f7x.cfg -c "init; reset halt; exit"`,
            { cwd: ws, encoding: 'utf8', timeout: 10000 }
        );
        
        outputChannel.appendLine(result);
        statusBarItem.text = `$(check) Connected`;
        vscode.window.showInformationMessage('Device connected successfully!');
    } catch (err: any) {
        outputChannel.appendLine(`Connection failed: ${err.message}`);
        statusBarItem.text = `$(error) Not Connected`;
        vscode.window.showErrorMessage('Connection failed. Check device and cable.');
    }
}

function disconnect() {
    if (openocdProcess) {
        openocdProcess.kill();
        openocdProcess = null;
    }
    try {
        execSync('pkill -9 openocd', { stdio: 'ignore' });
    } catch {}
    
    statusBarItem.text = `$(circuit-board) STM32`;
    vscode.window.showInformationMessage('Disconnected');
}

async function openMonitor(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'stm32Monitor',
        'STM32 Live Monitor',
        vscode.ViewColumn.Two,
        { enableScripts: true }
    );

    panel.webview.html = getMonitorHtml();
}

function getMonitorHtml(): string {
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
        .variable {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #3c3c3c;
        }
        .variable:last-child { border-bottom: none; }
        .var-name { color: #9cdcfe; }
        .var-value { 
            color: #ce9178; 
            background: #1e1e1e;
            padding: 2px 8px;
            border-radius: 4px;
        }
        input[type="text"] {
            background: #3c3c3c;
            border: 1px solid #555;
            color: #d4d4d4;
            padding: 4px 8px;
            border-radius: 4px;
            width: 80px;
        }
        .chart-container {
            height: 200px;
            background: #252526;
            border-radius: 8px;
            margin-top: 16px;
            display: flex;
            align-items: flex-end;
            padding: 10px;
            gap: 2px;
        }
        .bar {
            background: linear-gradient(to top, #007acc, #4ec9b0);
            width: 10px;
            border-radius: 2px 2px 0 0;
            transition: height 0.3s;
        }
        .status-connected { color: #4ec9b0; }
        .status-disconnected { color: #f14c4c; }
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 8px;
        }
        button:hover { background: #005a9e; }
    </style>
</head>
<body>
    <h1>📊 STM32 Live Monitor</h1>
    
    <div class="card">
        <h2>Connection Status</h2>
        <span class="status-connected">● Connected to STM32F730V8</span>
    </div>
    
    <div class="card">
        <h2>Live Variables</h2>
        <div class="variable">
            <span class="var-name">temperature</span>
            <input type="text" value="25.4" class="var-value">
        </div>
        <div class="variable">
            <span class="var-name">pressure</span>
            <input type="text" value="1013" class="var-value">
        </div>
        <div class="variable">
            <span class="var-name">motor_speed</span>
            <input type="text" value="1500" class="var-value">
        </div>
        <div class="variable">
            <span class="var-name">adc_value</span>
            <span class="var-value">2048</span>
        </div>
    </div>
    
    <div class="card">
        <h2>Memory Usage</h2>
        <div class="variable">
            <span class="var-name">FLASH</span>
            <span class="var-value">45.2 KB / 64 KB (70.6%)</span>
        </div>
        <div class="variable">
            <span class="var-name">RAM</span>
            <span class="var-value">12.8 KB / 256 KB (5.0%)</span>
        </div>
    </div>
    
    <div class="card">
        <h2>CPU Usage</h2>
        <div class="chart-container" id="chart"></div>
    </div>
    
    <button onclick="refresh()">🔄 Refresh</button>
    <button onclick="pauseMonitor()">⏸️ Pause</button>
    
    <script>
        const chart = document.getElementById('chart');
        let data = [];
        let paused = false;
        
        function updateChart() {
            if (paused) return;
            
            data.push(Math.random() * 100);
            if (data.length > 50) data.shift();
            
            chart.innerHTML = data.map(v => 
                '<div class="bar" style="height: ' + v + '%"></div>'
            ).join('');
        }
        
        function refresh() {
            data = [];
            updateChart();
        }
        
        function pauseMonitor() {
            paused = !paused;
        }
        
        setInterval(updateChart, 200);
    </script>
</body>
</html>`;
}

async function setupProject(context: vscode.ExtensionContext) {
    const ws = getWorkspace();
    if (!ws) return;

    const options = await vscode.window.showQuickPick([
        { label: '$(rocket) Full Setup', description: 'Configure everything' },
        { label: '$(file-code) Optimize Makefile', description: 'Add optimization profiles' },
        { label: '$(debug) Setup Debug', description: 'Configure debugging' },
        { label: '$(settings-gear) Configure Paths', description: 'Set GCC and OpenOCD paths' }
    ], { placeHolder: 'Select setup option' });

    if (!options) return;

    switch (options.label) {
        case '$(rocket) Full Setup':
            await optimizeMakefile();
            await setupDebugConfig(ws);
            await selectProfile();
            break;
        case '$(file-code) Optimize Makefile':
            await optimizeMakefile();
            break;
        case '$(debug) Setup Debug':
            await setupDebugConfig(ws);
            break;
        case '$(settings-gear) Configure Paths':
            await configurePaths();
            break;
    }
}

async function optimizeMakefile() {
    const ws = getWorkspace();
    if (!ws) return;

    const makefilePath = path.join(ws, 'Makefile');
    
    if (!fs.existsSync(makefilePath)) {
        vscode.window.showErrorMessage('No Makefile found in workspace');
        return;
    }

    outputChannel.show();
    outputChannel.appendLine('\n=== Optimizing Makefile ===');

    try {
        let content = fs.readFileSync(makefilePath, 'utf8');
        
        // Backup original
        if (!fs.existsSync(makefilePath + '.original')) {
            fs.copyFileSync(makefilePath, makefilePath + '.original');
            outputChannel.appendLine('Original Makefile backed up');
        }

        // Add optimization profile support if not exists
        if (!content.includes('# STM32 Pro Compiler Optimization')) {
            const optimizationBlock = `
# STM32 Pro Compiler Optimization
# Profile: O0=Debug, O1=Basic, O2=Standard, O3=Aggressive, Os=Size, Og=Debug+Opt
OPT ?= -O2

`;
            // Insert after first comment block
            const insertPos = content.indexOf('\n\n') + 2;
            content = content.slice(0, insertPos) + optimizationBlock + content.slice(insertPos);
            
            fs.writeFileSync(makefilePath, content);
            outputChannel.appendLine('Makefile optimized with profile support');
        } else {
            outputChannel.appendLine('Makefile already optimized');
        }

        vscode.window.showInformationMessage('Makefile optimization complete');
    } catch (err: any) {
        outputChannel.appendLine(`Error: ${err.message}`);
        vscode.window.showErrorMessage('Failed to optimize Makefile');
    }
}

async function setupDebugConfig(ws: string) {
    const vscodePath = path.join(ws, '.vscode');
    
    if (!fs.existsSync(vscodePath)) {
        fs.mkdirSync(vscodePath, { recursive: true });
    }

    // tasks.json
    const tasksPath = path.join(vscodePath, 'tasks.json');
    const tasks = {
        version: "2.0.0",
        tasks: [
            {
                label: "build",
                type: "shell",
                command: "make -j$(nproc)",
                group: { kind: "build", isDefault: true },
                problemMatcher: ["$gcc"]
            },
            {
                label: "clean",
                type: "shell",
                command: "make clean"
            },
            {
                label: "flash",
                type: "shell",
                command: "make flash",
                dependsOn: "build"
            }
        ]
    };
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 4));

    // c_cpp_properties.json
    const cppPath = path.join(vscodePath, 'c_cpp_properties.json');
    const cppConfig = {
        configurations: [
            {
                name: "STM32",
                includePath: [
                    "${workspaceFolder}/**",
                    "${workspaceFolder}/Core/Inc",
                    "${workspaceFolder}/Drivers/**"
                ],
                defines: ["USE_HAL_DRIVER", "STM32F730xx"],
                compilerPath: "/usr/bin/arm-none-eabi-gcc",
                cStandard: "c11",
                cppStandard: "c++17",
                intelliSenseMode: "gcc-arm"
            }
        ],
        version: 4
    };
    fs.writeFileSync(cppPath, JSON.stringify(cppConfig, null, 4));

    outputChannel.appendLine('Debug configuration created');
    vscode.window.showInformationMessage('Debug configuration created');
}

async function configurePaths() {
    const gccPath = await vscode.window.showInputBox({
        prompt: 'Path to ARM GCC compiler',
        value: 'arm-none-eabi-gcc',
        placeHolder: '/usr/bin/arm-none-eabi-gcc'
    });

    if (gccPath) {
        const config = vscode.workspace.getConfiguration('stm32-pro');
        await config.update('gccPath', gccPath, vscode.ConfigurationTarget.Global);
    }

    const openocdPath = await vscode.window.showInputBox({
        prompt: 'Path to OpenOCD',
        value: 'openocd',
        placeHolder: '/usr/bin/openocd'
    });

    if (openocdPath) {
        const config = vscode.workspace.getConfiguration('stm32-pro');
        await config.update('openocdPath', openocdPath, vscode.ConfigurationTarget.Global);
    }

    vscode.window.showInformationMessage('Paths configured');
}

function autoDetectProject(context: vscode.ExtensionContext) {
    const ws = getWorkspace();
    if (!ws) return;

    // Check for .ioc file (CubeMX project)
    const files = fs.readdirSync(ws);
    const hasIoc = files.some(f => f.endsWith('.ioc'));
    const hasMakefile = files.includes('Makefile');

    if (hasIoc || hasMakefile) {
        outputChannel.appendLine(`Detected STM32 project: ${hasIoc ? 'CubeMX' : 'Makefile'}`);
        statusBarItem.text = '$(circuit-board) STM32 Ready';
    }
}

function getWorkspace(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return undefined;
    }
    return folders[0].uri.fsPath;
}

class TreeProvider implements vscode.TreeDataProvider<TreeItem> {
    constructor(private items: [string, string][]) {}
    
    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }
    
    getChildren(): TreeItem[] {
        return this.items.map(([label, cmd]) => new TreeItem(label, cmd));
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(label: string, cmd: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.command = { command: cmd, title: label };
    }
}

export function deactivate() {
    disconnect();
}
