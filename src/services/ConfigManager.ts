import * as vscode from 'vscode';
import { BuildSystem } from '../types';

/**
 * Manages VS Code configuration and workspace settings
 */
export class ConfigManager {
    private static readonly CONFIG_SECTION = 'stm32-pro';

    /**
     * Get configuration value
     */
    static get<T>(key: string, defaultValue?: T): T {
        const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_SECTION);
        return config.get<T>(key, defaultValue as T);
    }

    /**
     * Set configuration value
     */
    static async set(
        key: string,
        value: any,
        target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
    ): Promise<void> {
        const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_SECTION);
        await config.update(key, value, target);
    }

    /**
     * Get default build profile
     */
    static getDefaultProfile(): string {
        return this.get<string>('defaultProfile', 'O2');
    }

    /**
     * Set default build profile
     */
    static async setDefaultProfile(profile: string): Promise<void> {
        await this.set('defaultProfile', profile);
    }

    /**
     * Get build system preference
     */
    static getBuildSystem(): BuildSystem {
        return this.get<BuildSystem>('buildSystem', 'makefile');
    }

    /**
     * Set build system preference
     */
    static async setBuildSystem(system: BuildSystem): Promise<void> {
        await this.set('buildSystem', system);
    }

    /**
     * Get auto-flash setting
     */
    static getAutoFlash(): boolean {
        return this.get<boolean>('autoFlash', false);
    }

    /**
     * Set auto-flash setting
     */
    static async setAutoFlash(enabled: boolean): Promise<void> {
        await this.set('autoFlash', enabled);
    }

    /**
     * Get custom GCC path (if set)
     */
    static getGccPath(): string | undefined {
        const path = this.get<string>('gccPath', 'arm-none-eabi-gcc');
        return path === 'arm-none-eabi-gcc' ? undefined : path;
    }

    /**
     * Get custom OpenOCD path (if set)
     */
    static getOpenOcdPath(): string | undefined {
        const path = this.get<string>('openocdPath', 'openocd');
        return path === 'openocd' ? undefined : path;
    }

    /**
     * Get SVD cache path
     */
    static getSvdCachePath(): string | undefined {
        return this.get<string>('svdCachePath');
    }

    /**
     * Get preferred programmer
     */
    static getPreferredProgrammer(): string {
        return this.get<string>('preferredProgrammer', 'auto');
    }
}
