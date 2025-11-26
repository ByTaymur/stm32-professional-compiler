/**
 * Core type definitions for STM32 Professional Compiler
 */

export interface ToolchainInfo {
    gcc: ToolInfo;
    gdb: ToolInfo;
    openocd: ToolInfo;
    make: ToolInfo;
    cmake?: ToolInfo;
}

export interface ToolInfo {
    found: boolean;
    path?: string;
    version?: string;
    error?: string;
}

export interface DeviceInfo {
    name: string;              // e.g., "STM32F730V8"
    family: string;            // e.g., "STM32F7"
    line: string;              // e.g., "STM32F7x"
    flashSize: number;         // KB
    ramSize: number;           // KB
    svdFile?: string;          // Path to SVD file
    openocdTarget: string;     // e.g., "stm32f7x.cfg"
}

export interface ProgrammerInfo {
    type: 'stlink' | 'jlink' | 'cmsis-dap' | 'dfu' | 'unknown';
    version?: string;
    serialNumber?: string;
    interface: string;         // OpenOCD interface config file
}

export interface BuildProfile {
    name: string;
    flags: string[];
    description: string;
}

export interface BuildResult {
    success: boolean;
    output: string;
    memoryUsage?: MemoryUsage;
    duration?: number;         // milliseconds
    errors?: string[];
    warnings?: string[];
}

export interface MemoryUsage {
    flash: {
        used: number;
        total: number;
        percentage: number;
    };
    ram: {
        used: number;
        total: number;
        percentage: number;
    };
}

export interface FlashResult {
    success: boolean;
    output: string;
    duration?: number;
    error?: string;
}

export enum ErrorCode {
    TOOLCHAIN_NOT_FOUND = 'TOOLCHAIN_NOT_FOUND',
    BUILD_FAILED = 'BUILD_FAILED',
    FLASH_FAILED = 'FLASH_FAILED',
    DEVICE_NOT_CONNECTED = 'DEVICE_NOT_CONNECTED',
    OPENOCD_ERROR = 'OPENOCD_ERROR',
    GDB_ERROR = 'GDB_ERROR',
    INVALID_PROJECT = 'INVALID_PROJECT',
    SVD_DOWNLOAD_FAILED = 'SVD_DOWNLOAD_FAILED',
    CMAKE_ERROR = 'CMAKE_ERROR'
}

export class STM32Error extends Error {
    constructor(
        public code: ErrorCode,
        message: string,
        public details?: any
    ) {
        super(message);
        this.name = 'STM32Error';
    }
}

export type BuildSystem = 'makefile' | 'cmake';

export interface ProjectConfig {
    buildSystem: BuildSystem;
    deviceName?: string;
    workspaceRoot: string;
    buildDirectory: string;
    toolchainPath?: string;
    openocdPath?: string;
}
