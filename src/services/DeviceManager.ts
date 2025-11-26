import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { PathUtils } from '../utils/PathUtils';
import { DeviceInfo, STM32Error, ErrorCode } from '../types';

/**
 * Manages STM32 device detection and SVD file handling
 */
export class DeviceManager {
    private static readonly SVD_CACHE_DIR = '.stm32-svd-cache';
    private cachedDeviceInfo: DeviceInfo | null = null;

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Detect STM32 device from project files
     */
    async detectDevice(workspaceRoot: string): Promise<DeviceInfo | undefined> {
        if (this.cachedDeviceInfo) {
            return this.cachedDeviceInfo;
        }

        // Try to detect from .ioc file
        const iocDevice = await this.detectFromIoc(workspaceRoot);
        if (iocDevice) {
            this.cachedDeviceInfo = iocDevice;
            return iocDevice;
        }

        // Try to detect from Makefile
        const makefileDevice = await this.detectFromMakefile(workspaceRoot);
        if (makefileDevice) {
            this.cachedDeviceInfo = makefileDevice;
            return makefileDevice;
        }

        // Try to detect from linker script
        const linkerDevice = await this.detectFromLinkerScript(workspaceRoot);
        if (linkerDevice) {
            this.cachedDeviceInfo = linkerDevice;
            return linkerDevice;
        }

        return undefined;
    }

    /**
     * Detect device from .ioc file
     */
    private async detectFromIoc(workspaceRoot: string): Promise<DeviceInfo | undefined> {
        const iocFile = PathUtils.findFile(workspaceRoot, '*.ioc', 1);
        if (!iocFile) return undefined;

        try {
            const content = fs.readFileSync(iocFile, 'utf8');

            // Extract device name from .ioc file
            const deviceMatch = content.match(/Mcu\.Name=(STM32[A-Z0-9]+)/);
            if (deviceMatch) {
                return this.parseDeviceName(deviceMatch[1]);
            }
        } catch (error) {
            // Failed to read .ioc file
        }

        return undefined;
    }

    /**
     * Detect device from Makefile
     */
    private async detectFromMakefile(workspaceRoot: string): Promise<DeviceInfo | undefined> {
        const makefilePath = path.join(workspaceRoot, 'Makefile');
        if (!fs.existsSync(makefilePath)) return undefined;

        try {
            const content = fs.readFileSync(makefilePath, 'utf8');

            // Look for device definition (e.g., -DSTM32F730xx or TARGET = STM32F730V8)
            const deviceMatch = content.match(/-D(STM32[A-Z0-9]+xx)|TARGET\s*[=:]\s*(STM32[A-Z0-9]+)/i);
            if (deviceMatch) {
                const deviceName = deviceMatch[1] || deviceMatch[2];
                return this.parseDeviceName(deviceName.replace('xx', ''));
            }
        } catch (error) {
            // Failed to read Makefile
        }

        return undefined;
    }

    /**
     * Detect device from linker script
     */
    private async detectFromLinkerScript(workspaceRoot: string): Promise<DeviceInfo | undefined> {
        const ldFile = PathUtils.findFile(workspaceRoot, '*_FLASH.ld', 2);
        if (!ldFile) return undefined;

        try {
            const fileName = path.basename(ldFile);
            const deviceMatch = fileName.match(/(STM32[A-Z0-9]+)_FLASH\.ld/i);
            if (deviceMatch) {
                return this.parseDeviceName(deviceMatch[1]);
            }
        } catch (error) {
            // Failed to process linker script
        }

        return undefined;
    }

    /**
     * Parse device name to extract family, line, and memory info
     */
    private parseDeviceName(deviceName: string): DeviceInfo {
        // Extract family (e.g., STM32F7)
        const familyMatch = deviceName.match(/STM32([A-Z]\d)/);
        const family = familyMatch ? `STM32${familyMatch[1]}` : 'STM32F4';

        // Extract line (e.g., STM32F7x for OpenOCD)
        const lineMatch = deviceName.match(/STM32([A-Z]\d)x?/);
        const line = lineMatch ? `stm32${lineMatch[1].toLowerCase()}x` : 'stm32f4x';

        // Estimate flash and RAM (this is approximate, should be refined)
        const flashSize = this.estimateFlashSize(deviceName);
        const ramSize = this.estimateRamSize(deviceName);

        return {
            name: deviceName.toUpperCase(),
            family,
            line,
            flashSize,
            ramSize,
            openocdTarget: `target/${line}.cfg`
        };
    }

    /**
     * Estimate flash size from device name (very approximate)
     */
    private estimateFlashSize(deviceName: string): number {
        const sizeCode = deviceName.match(/STM32[A-Z]\d+([A-Z])\d/);
        if (!sizeCode) return 512; // Default

        const code = sizeCode[1];
        const sizeMap: { [key: string]: number } = {
            '4': 16, '6': 32, '8': 64, 'B': 128, 'C': 256,
            'E': 512, 'F': 768, 'G': 1024, 'H': 1536, 'I': 2048
        };

        return sizeMap[code] || 512;
    }

    /**
     * Estimate RAM size from device name (very approximate)
     */
    private estimateRamSize(deviceName: string): number {
        const family = deviceName.match(/STM32([A-Z]\d)/)?.[1];

        // Very rough estimates
        const ramMap: { [key: string]: number } = {
            'F0': 8, 'F1': 20, 'F2': 128, 'F3': 40,
            'F4': 192, 'F7': 320, 'G0': 36, 'G4': 128,
            'H7': 1024, 'L0': 8, 'L1': 16, 'L4': 128, 'L5': 256
        };

        return ramMap[family || 'F4'] || 128;
    }

    /**
     * Download SVD file for device
     */
    async downloadSvdFile(deviceInfo: DeviceInfo): Promise<string | undefined> {
        const svdCacheDir = path.join(
            this.context.globalStorageUri.fsPath,
            DeviceManager.SVD_CACHE_DIR
        );

        PathUtils.ensureDir(svdCacheDir);

        const svdFileName = `${deviceInfo.name}.svd`;
        const svdFilePath = path.join(svdCacheDir, svdFileName);

        // Check if already cached
        if (fs.existsSync(svdFilePath)) {
            return svdFilePath;
        }

        // Try to download from CMSIS-SVD repository
        try {
            const axios = require('axios');
            const baseUrl = 'https://raw.githubusercontent.com/posborne/cmsis-svd/master/data/STMicro';

            // Try exact match first
            let svdUrl = `${baseUrl}/${svdFileName}`;
            let response = await axios.get(svdUrl);

            if (response.status === 200) {
                fs.writeFileSync(svdFilePath, response.data);
                return svdFilePath;
            }
        } catch (error) {
            // Try with 'x' suffix (e.g., STM32F730x.svd)
            try {
                const axios = require('axios');
                const baseUrl = 'https://raw.githubusercontent.com/posborne/cmsis-svd/master/data/STMicro';
                const genericName = deviceInfo.name.replace(/\d[A-Z]\d?$/, 'x') + '.svd';
                const svdUrl = `${baseUrl}/${genericName}`;

                const response = await axios.get(svdUrl);
                if (response.status === 200) {
                    fs.writeFileSync(svdFilePath, response.data);
                    return svdFilePath;
                }
            } catch (innerError) {
                // Failed to download
            }
        }

        return undefined;
    }

    /**
     * Get SVD file path for device
     */
    async getSvdFile(deviceInfo: DeviceInfo): Promise<string | undefined> {
        // Check if SVD already downloaded
        const svdCacheDir = path.join(
            this.context.globalStorageUri.fsPath,
            DeviceManager.SVD_CACHE_DIR
        );

        const svdFileName = `${deviceInfo.name}.svd`;
        const svdFilePath = path.join(svdCacheDir, svdFileName);

        if (fs.existsSync(svdFilePath)) {
            return svdFilePath;
        }

        // Download if not cached
        return await this.downloadSvdFile(deviceInfo);
    }

    /**
     * Clear cached device info
     */
    clearCache(): void {
        this.cachedDeviceInfo = null;
    }
}
