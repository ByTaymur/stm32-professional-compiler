import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ProcessUtils } from '../utils/ProcessUtils';
import { PathUtils } from '../utils/PathUtils';
import { DetectionUtils } from '../utils/DetectionUtils';
import { ToolchainManager } from './ToolchainManager';
import { DeviceManager } from './DeviceManager';
import { FlashResult, ProgrammerInfo, STM32Error, ErrorCode } from '../types';

/**
 * Manages firmware flashing to STM32 devices
 */
export class FlashService {
    private outputChannel: vscode.OutputChannel;

    constructor(
        private toolchainManager: ToolchainManager,
        private deviceManager: DeviceManager,
        outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel = outputChannel;
    }

    /**
     * Flash firmware to device
     */
    async flash(workspaceRoot: string, elfFile?: string): Promise<FlashResult> {
        const startTime = Date.now();

        this.outputChannel.appendLine('\n=== Flashing Firmware ===');

        try {
            // Find ELF file if not specified
            if (!elfFile) {
                elfFile = this.findElfFile(workspaceRoot);
                if (!elfFile) {
                    throw new STM32Error(
                        ErrorCode.FLASH_FAILED,
                        'No .elf file found in build directory'
                    );
                }
            }

            this.outputChannel.appendLine(`Binary: ${elfFile}`);

            // Detect programmer
            const programmer = await DetectionUtils.detectProgrammer();
            this.outputChannel.appendLine(`Programmer: ${programmer.type}${programmer.version ? ' ' + programmer.version : ''}`);

            if (programmer.type === 'unknown') {
                throw new STM32Error(
                    ErrorCode.DEVICE_NOT_CONNECTED,
                    'No programmer detected. Please connect ST-Link, J-Link, or CMSIS-DAP.'
                );
            }

            // Get device info for target selection
            const deviceInfo = await this.deviceManager.detectDevice(workspaceRoot);
            const targetConfig = deviceInfo?.openocdTarget || 'target/stm32f4x.cfg';

            // Flash using appropriate method
            let result: FlashResult;

            switch (programmer.type) {
                case 'stlink':
                    result = await this.flashWithOpenOCD(elfFile, programmer, targetConfig);
                    break;
                case 'jlink':
                    result = await this.flashWithJLink(elfFile, deviceInfo?.name);
                    break;
                case 'cmsis-dap':
                    result = await this.flashWithOpenOCD(elfFile, programmer, targetConfig);
                    break;
                default:
                    result = await this.flashWithOpenOCD(elfFile, programmer, targetConfig);
            }

            const duration = Date.now() - startTime;

            if (result.success) {
                this.outputChannel.appendLine(`\n✓ Flash successful in ${duration}ms`);
            } else {
                this.outputChannel.appendLine(`\n✗ Flash failed after ${duration}ms`);
            }

            return { ...result, duration };

        } catch (error: any) {
            const duration = Date.now() - startTime;
            const errorMsg = error.message || 'Flash operation failed';

            this.outputChannel.appendLine(`\nERROR: ${errorMsg}`);

            return {
                success: false,
                output: '',
                error: errorMsg,
                duration
            };
        }
    }

    /**
     * Flash using OpenOCD
     */
    private async flashWithOpenOCD(
        elfFile: string,
        programmer: ProgrammerInfo,
        targetConfig: string
    ): Promise<FlashResult> {
        const openocdPath = await this.toolchainManager.getOpenOcdPath();

        if (!openocdPath) {
            throw new STM32Error(
                ErrorCode.TOOLCHAIN_NOT_FOUND,
                'OpenOCD not found. Please install OpenOCD.'
            );
        }

        const flashCmd = `${openocdPath} -f ${programmer.interface} -f ${targetConfig} -c "program ${elfFile} verify reset exit"`;

        this.outputChannel.appendLine(`\n> ${flashCmd}\n`);

        const result = await ProcessUtils.exec(flashCmd, undefined, 60000);

        this.outputChannel.appendLine(result.stdout);
        if (result.stderr) {
            this.outputChannel.appendLine(result.stderr);
        }

        return {
            success: result.exitCode === 0,
            output: result.stdout,
            error: result.exitCode !== 0 ? result.stderr : undefined
        };
    }

    /**
     * Flash using J-Link Commander
     */
    private async flashWithJLink(elfFile: string, deviceName?: string): Promise<FlashResult> {
        // Convert ELF to HEX for J-Link
        const hexFile = elfFile.replace('.elf', '.hex');

        if (!fs.existsSync(hexFile)) {
            // Try to create hex file using objcopy
            const objcopyResult = await ProcessUtils.exec(
                `arm-none-eabi-objcopy -O ihex ${elfFile} ${hexFile}`,
                undefined,
                30000
            );

            if (objcopyResult.exitCode !== 0) {
                throw new Error('Failed to convert ELF to HEX for J-Link');
            }
        }

        // Create J-Link script
        const scriptContent = [
            'r',  // Reset
            'h',  // Halt
            `loadfile ${hexFile}`,
            'r',  // Reset again
            'g',  // Go
            'q'   // Quit
        ].join('\n');

        const scriptPath = path.join(path.dirname(elfFile), 'jlink_flash.jlink');
        fs.writeFileSync(scriptPath, scriptContent);

        const jlinkCmd = `JLinkExe -device ${deviceName || 'STM32F407VG'} -if SWD -speed 4000 -CommanderScript ${scriptPath}`;

        this.outputChannel.appendLine(`\n> ${jlinkCmd}\n`);

        const result = await ProcessUtils.exec(jlinkCmd, undefined, 60000);

        this.outputChannel.appendLine(result.stdout);

        // Clean up script
        try {
            fs.unlinkSync(scriptPath);
        } catch { }

        return {
            success: result.exitCode === 0 && result.stdout.includes('O.K.'),
            output: result.stdout,
            error: result.exitCode !== 0 ? result.stderr : undefined
        };
    }

    /**
     * Test connection to device
     */
    async testConnection(workspaceRoot: string): Promise<boolean> {
        this.outputChannel.appendLine('\n=== Testing Connection ===');

        try {
            const programmer = await DetectionUtils.detectProgrammer();
            this.outputChannel.appendLine(`Programmer: ${programmer.type}`);

            if (programmer.type === 'unknown') {
                this.outputChannel.appendLine('✗ No programmer detected');
                return false;
            }

            const deviceInfo = await this.deviceManager.detectDevice(workspaceRoot);
            const targetConfig = deviceInfo?.openocdTarget || 'target/stm32f4x.cfg';

            const openocdPath = await this.toolchainManager.getOpenOcdPath();
            if (!openocdPath) {
                this.outputChannel.appendLine('✗ OpenOCD not found');
                return false;
            }

            const testCmd = `${openocdPath} -f ${programmer.interface} -f ${targetConfig} -c "init; reset halt; exit"`;

            this.outputChannel.appendLine(`\n> ${testCmd}\n`);

            const result = await ProcessUtils.exec(testCmd, undefined, 15000);

            this.outputChannel.appendLine(result.stdout);

            if (result.exitCode === 0) {
                this.outputChannel.appendLine('\n✓ Device connected successfully');
                return true;
            } else {
                this.outputChannel.appendLine('\n✗ Connection failed');
                return false;
            }

        } catch (error: any) {
            this.outputChannel.appendLine(`\nERROR: ${error.message}`);
            return false;
        }
    }

    /**
     * Find ELF file in build directory
     */
    private findElfFile(workspaceRoot: string): string | undefined {
        const buildDir = path.join(workspaceRoot, 'build');

        if (!fs.existsSync(buildDir)) {
            return undefined;
        }

        const files = fs.readdirSync(buildDir);
        const elfFile = files.find(f => f.endsWith('.elf'));

        return elfFile ? path.join(buildDir, elfFile) : undefined;
    }

    /**
     * Disconnect from device (kill OpenOCD processes)
     */
    disconnect(): void {
        this.outputChannel.appendLine('\n=== Disconnecting ===');

        const killed = ProcessUtils.killProcessByName('openocd');

        if (killed) {
            this.outputChannel.appendLine('✓ Disconnected from device');
        } else {
            this.outputChannel.appendLine('No active connections found');
        }
    }
}
