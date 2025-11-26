import * as path from 'path';
import { ProcessUtils } from '../utils/ProcessUtils';
import { PathUtils } from '../utils/PathUtils';
import { DetectionUtils } from '../utils/DetectionUtils';
import { ToolchainInfo, ToolInfo } from '../types';

/**
 * Manages ARM toolchain detection and validation
 */
export class ToolchainManager {
    private cachedToolchain: ToolchainInfo | null = null;

    /**
     * Detect and validate all required toolchain components
     */
    async detectToolchain(): Promise<ToolchainInfo> {
        if (this.cachedToolchain) {
            return this.cachedToolchain;
        }

        const toolchain: ToolchainInfo = {
            gcc: await this.findTool('arm-none-eabi-gcc'),
            gdb: await this.findGdb(),
            openocd: await this.findTool('openocd'),
            make: await this.findTool('make'),
            cmake: await this.findTool('cmake')
        };

        this.cachedToolchain = toolchain;
        return toolchain;
    }

    /**
     * Find a specific tool in PATH or common locations
     */
    private async findTool(toolName: string): Promise<ToolInfo> {
        const executableName = PathUtils.getExecutableName(toolName);

        // 1. Check if in PATH
        if (ProcessUtils.commandExists(executableName)) {
            const version = await ProcessUtils.getVersion(executableName);
            return {
                found: true,
                path: executableName,
                version
            };
        }

        // 2. Search in common installation directories
        const commonPath = DetectionUtils.findInCommonLocations(executableName);
        if (commonPath && PathUtils.isExecutable(commonPath)) {
            const version = await ProcessUtils.getVersion(commonPath);
            return {
                found: true,
                path: commonPath,
                version
            };
        }

        // 3. Not found
        return {
            found: false,
            error: `${toolName} not found in PATH or common locations`
        };
    }

    /**
     * Find GDB (try gdb-multiarch first on Linux, then arm-none-eabi-gdb)
     */
    private async findGdb(): Promise<ToolInfo> {
        // On Linux, prefer gdb-multiarch
        if (process.platform === 'linux') {
            const gdbMultiarch = await this.findTool('gdb-multiarch');
            if (gdbMultiarch.found) {
                return gdbMultiarch;
            }
        }

        // Try arm-none-eabi-gdb
        return await this.findTool('arm-none-eabi-gdb');
    }

    /**
     * Validate that all required tools are available
     */
    async validateToolchain(): Promise<{ allFound: boolean; missing: string[] }> {
        const toolchain = await this.detectToolchain();
        const missing: string[] = [];

        if (!toolchain.gcc.found) missing.push('arm-none-eabi-gcc');
        if (!toolchain.gdb.found) missing.push('gdb');
        if (!toolchain.openocd.found) missing.push('openocd');
        if (!toolchain.make.found) missing.push('make');

        return {
            allFound: missing.length === 0,
            missing
        };
    }

    /**
     * Get toolchain info as formatted string
     */
    async getToolchainInfo(): Promise<string> {
        const toolchain = await this.detectToolchain();

        const lines: string[] = [];
        lines.push('=== ARM Toolchain Info ===');

        const addTool = (name: string, tool: ToolInfo) => {
            if (tool.found) {
                lines.push(`✓ ${name}: ${tool.path}${tool.version ? ` (${tool.version})` : ''}`);
            } else {
                lines.push(`✗ ${name}: ${tool.error || 'Not found'}`);
            }
        };

        addTool('GCC', toolchain.gcc);
        addTool('GDB', toolchain.gdb);
        addTool('OpenOCD', toolchain.openocd);
        addTool('Make', toolchain.make);
        if (toolchain.cmake) {
            addTool('CMake', toolchain.cmake);
        }

        return lines.join('\n');
    }

    /**
     * Get GCC compiler path
     */
    async getGccPath(): Promise<string | undefined> {
        const toolchain = await this.detectToolchain();
        return toolchain.gcc.found ? toolchain.gcc.path : undefined;
    }

    /**
     * Get GDB path
     */
    async getGdbPath(): Promise<string | undefined> {
        const toolchain = await this.detectToolchain();
        return toolchain.gdb.found ? toolchain.gdb.path : undefined;
    }

    /**
     * Get OpenOCD path
     */
    async getOpenOcdPath(): Promise<string | undefined> {
        const toolchain = await this.detectToolchain();
        return toolchain.openocd.found ? toolchain.openocd.path : undefined;
    }

    /**
     * Clear cached toolchain info
     */
    clearCache(): void {
        this.cachedToolchain = null;
    }

    /**
     * Get installation instructions for missing tools
     */
    getInstallInstructions(toolName: string): string {
        const instructions: { [key: string]: { [platform: string]: string } } = {
            'arm-none-eabi-gcc': {
                'linux': 'sudo apt install gcc-arm-none-eabi',
                'darwin': 'brew install arm-none-eabi-gcc',
                'win32': 'Download from: https://developer.arm.com/tools-and-software/open-source-software/developer-tools/gnu-toolchain/gnu-rm'
            },
            'gdb': {
                'linux': 'sudo apt install gdb-multiarch',
                'darwin': 'brew install arm-none-eabi-gdb',
                'win32': 'Included with ARM GCC toolchain'
            },
            'openocd': {
                'linux': 'sudo apt install openocd',
                'darwin': 'brew install openocd',
                'win32': 'Download from: https://github.com/xpack-dev-tools/openocd-xpack/releases'
            },
            'make': {
                'linux': 'sudo apt install build-essential',
                'darwin': 'xcode-select --install',
                'win32': 'Install MinGW or use "make" from xPack Windows Build Tools'
            }
        };

        const toolInstructions = instructions[toolName];
        if (!toolInstructions) {
            return `No installation instructions available for ${toolName}`;
        }

        return toolInstructions[process.platform] || toolInstructions['linux'];
    }
}
