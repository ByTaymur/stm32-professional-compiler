import { ProcessUtils, ExecResult } from '../utils/ProcessUtils';
import { ProgrammerInfo } from '../types';

/**
 * Cross-platform device and programmer detection utilities
 */
export class DetectionUtils {
    /**
     * Detect connected programmer (ST-Link, J-Link, CMSIS-DAP)
     */
    static async detectProgrammer(): Promise<ProgrammerInfo> {
        if (process.platform === 'win32') {
            return this.detectProgrammerWindows();
        } else if (process.platform === 'darwin') {
            return this.detectProgrammerMacOS();
        } else {
            return this.detectProgrammerLinux();
        }
    }

    /**
     * Detect programmer on Linux using lsusb
     */
    private static async detectProgrammerLinux(): Promise<ProgrammerInfo> {
        try {
            const result = await ProcessUtils.exec('lsusb', undefined, 5000);

            if (result.stdout.toLowerCase().includes('st-link')) {
                return {
                    type: 'stlink',
                    interface: 'interface/stlink.cfg',
                    version: this.extractStLinkVersion(result.stdout)
                };
            }

            if (result.stdout.toLowerCase().includes('j-link') ||
                result.stdout.toLowerCase().includes('segger')) {
                return {
                    type: 'jlink',
                    interface: 'interface/jlink.cfg'
                };
            }

            if (result.stdout.toLowerCase().includes('cmsis-dap')) {
                return {
                    type: 'cmsis-dap',
                    interface: 'interface/cmsis-dap.cfg'
                };
            }
        } catch (error) {
            // lsusb failed
        }

        return { type: 'unknown', interface: 'interface/stlink.cfg' };
    }

    /**
     * Detect programmer on macOS using system_profiler
     */
    private static async detectProgrammerMacOS(): Promise<ProgrammerInfo> {
        try {
            const result = await ProcessUtils.exec(
                'system_profiler SPUSBDataType',
                undefined,
                10000
            );

            const output = result.stdout.toLowerCase();

            if (output.includes('st-link') || output.includes('stm32')) {
                return {
                    type: 'stlink',
                    interface: 'interface/stlink.cfg',
                    version: this.extractStLinkVersion(result.stdout)
                };
            }

            if (output.includes('j-link') || output.includes('segger')) {
                return {
                    type: 'jlink',
                    interface: 'interface/jlink.cfg'
                };
            }

            if (output.includes('cmsis-dap')) {
                return {
                    type: 'cmsis-dap',
                    interface: 'interface/cmsis-dap.cfg'
                };
            }
        } catch (error) {
            // system_profiler failed
        }

        return { type: 'unknown', interface: 'interface/stlink.cfg' };
    }

    /**
     * Detect programmer on Windows using WMI or registry
     */
    private static async detectProgrammerWindows(): Promise<ProgrammerInfo> {
        try {
            // Try using WMIC to query USB devices
            const result = await ProcessUtils.exec(
                'wmic path Win32_PnPEntity where "DeviceID like \'%USB%\'" get Caption',
                undefined,
                10000
            );

            const output = result.stdout.toLowerCase();

            if (output.includes('st-link') || output.includes('stm32')) {
                return {
                    type: 'stlink',
                    interface: 'interface/stlink.cfg',
                    version: this.extractStLinkVersion(result.stdout)
                };
            }

            if (output.includes('j-link') || output.includes('segger')) {
                return {
                    type: 'jlink',
                    interface: 'interface/jlink.cfg'
                };
            }

            if (output.includes('cmsis-dap')) {
                return {
                    type: 'cmsis-dap',
                    interface: 'interface/cmsis-dap.cfg'
                };
            }
        } catch (error) {
            // WMIC failed, try alternative method

            // Try ST-Link CLI if installed
            if (ProcessUtils.commandExists('ST-LINK_CLI')) {
                return {
                    type: 'stlink',
                    interface: 'interface/stlink.cfg'
                };
            }
        }

        return { type: 'unknown', interface: 'interface/stlink.cfg' };
    }

    /**
     * Extract ST-Link version from output
     */
    private static extractStLinkVersion(output: string): string | undefined {
        const versionMatch = output.match(/V(\d+)/i);
        return versionMatch ? `V${versionMatch[1]}` : undefined;
    }

    /**
     * Find toolchain in common installation directories
     */
    static findInCommonLocations(toolName: string): string | undefined {
        const locations = this.getCommonToolchainLocations();

        for (const location of locations) {
            const fullPath = require('path').join(location, 'bin', toolName);

            if (require('fs').existsSync(fullPath)) {
                return fullPath;
            }
        }

        return undefined;
    }

    /**
     * Get platform-specific common toolchain installation directories
     */
    static getCommonToolchainLocations(): string[] {
        if (process.platform === 'win32') {
            return [
                'C:\\Program Files (x86)\\GNU Arm Embedded Toolchain',
                'C:\\Program Files\\GNU Arm Embedded Toolchain',
                'C:\\xPack\\arm-none-eabi-gcc',
                'C:\\tools\\arm-none-eabi-gcc',
                process.env.LOCALAPPDATA + '\\xPacks\\@xpack-dev-tools\\arm-none-eabi-gcc'
            ].filter(p => p);
        } else if (process.platform === 'darwin') {
            return [
                '/usr/local/bin',
                '/opt/homebrew/bin',
                '/Applications/ARM/bin',
                process.env.HOME + '/.local/xPacks/@xpack-dev-tools/arm-none-eabi-gcc'
            ].filter(p => p);
        } else {
            // Linux
            return [
                '/usr/bin',
                '/usr/local/bin',
                process.env.HOME + '/.local/bin',
                '/opt/gcc-arm-none-eabi/bin',
                process.env.HOME + '/.local/xPacks/@xpack-dev-tools/arm-none-eabi-gcc'
            ].filter(p => p);
        }
    }
}
