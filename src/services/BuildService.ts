import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ProcessUtils } from '../utils/ProcessUtils';
import { PathUtils } from '../utils/PathUtils';
import { ToolchainManager } from './ToolchainManager';
import { BuildProfile, BuildResult, MemoryUsage, STM32Error, ErrorCode, BuildSystem } from '../types';

/**
 * Manages build operations for STM32 projects
 */
export class BuildService {
    private outputChannel: vscode.OutputChannel;

    // Build Profiles - Professional GCC ARM Optimization Flags
    private static readonly BUILD_PROFILES: Record<string, BuildProfile> = {
        'O0': {
            name: 'O0',
            flags: ['-O0', '-g3', '-DDEBUG'],
            description: 'No optimization - Best for debugging'
        },
        'O1': {
            name: 'O1',
            flags: ['-O1', '-g2'],
            description: 'Basic optimization'
        },
        'O2': {
            name: 'O2',
            flags: ['-O2', '-g1', '-flto', '-ffunction-sections', '-fdata-sections'],
            description: 'Standard optimization - Recommended for production'
        },
        'O3': {
            name: 'O3',
            flags: ['-O3', '-flto', '-ffunction-sections', '-fdata-sections', '-funroll-loops', '-finline-functions'],
            description: 'Aggressive optimization - Maximum speed'
        },
        'Os': {
            name: 'Os',
            flags: ['-Os', '-flto', '-ffunction-sections', '-fdata-sections', '-fno-exceptions'],
            description: 'Size optimization - Minimum flash usage'
        },
        'Og': {
            name: 'Og',
            flags: ['-Og', '-g3', '-DDEBUG'],
            description: 'Debug-friendly optimization'
        }
    };

    private static readonly LINKER_FLAGS = '-Wl,--gc-sections -Wl,--print-memory-usage';

    constructor(
        private toolchainManager: ToolchainManager,
        outputChannel: vscode.OutputChannel
    ) {
        this.outputChannel = outputChannel;
    }

    /**
     * Build project with specified profile
     */
    async build(
        workspaceRoot: string,
        profile: string = 'O2',
        buildSystem: BuildSystem = 'makefile'
    ): Promise<BuildResult> {
        const startTime = Date.now();

        this.outputChannel.clear();
        this.outputChannel.show();
        this.outputChannel.appendLine(`=== Building with ${profile} profile ===`);

        // Validate toolchain
        const validation = await this.toolchainManager.validateToolchain();
        if (!validation.allFound) {
            const error = `Missing toolchain components: ${validation.missing.join(', ')}`;
            this.outputChannel.appendLine(`ERROR: ${error}`);
            throw new STM32Error(ErrorCode.TOOLCHAIN_NOT_FOUND, error, validation.missing);
        }

        try {
            if (buildSystem === 'cmake') {
                return await this.buildWithCMake(workspaceRoot, profile, startTime);
            } else {
                return await this.buildWithMakefile(workspaceRoot, profile, startTime);
            }
        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.outputChannel.appendLine(`\nBuild failed after ${duration}ms`);

            throw new STM32Error(
                ErrorCode.BUILD_FAILED,
                error.message || 'Build failed',
                { error, duration }
            );
        }
    }

    /**
     * Build with Makefile
     */
    private async buildWithMakefile(
        workspaceRoot: string,
        profile: string,
        startTime: number
    ): Promise<BuildResult> {
        const buildProfile = BuildService.BUILD_PROFILES[profile];
        if (!buildProfile) {
            throw new Error(`Invalid build profile: ${profile}`);
        }

        const flags = buildProfile.flags.join(' ');
        this.outputChannel.appendLine(`Flags: ${flags}`);

        // Determine number of parallel jobs
        const jobs = this.getParallelJobs();
        const buildCmd = `make -j${jobs} OPT="${flags}" LDFLAGS+="${BuildService.LINKER_FLAGS}"`;

        this.outputChannel.appendLine(`> ${buildCmd}\n`);

        const result = await ProcessUtils.exec(buildCmd, workspaceRoot, 120000);

        this.outputChannel.appendLine(result.stdout);
        if (result.stderr) {
            this.outputChannel.appendLine(result.stderr);
        }

        if (result.exitCode !== 0) {
            return {
                success: false,
                output: result.stdout + '\n' + result.stderr,
                duration: Date.now() - startTime,
                errors: this.parseErrors(result.stdout + result.stderr)
            };
        }

        // Parse memory usage
        const memoryUsage = this.parseMemoryUsage(result.stdout);
        if (memoryUsage) {
            this.outputChannel.appendLine('\n=== Memory Usage ===');
            this.outputChannel.appendLine(
                `FLASH: ${memoryUsage.flash.used} / ${memoryUsage.flash.total} bytes (${memoryUsage.flash.percentage.toFixed(1)}%)`
            );
            this.outputChannel.appendLine(
                `RAM:   ${memoryUsage.ram.used} / ${memoryUsage.ram.total} bytes (${memoryUsage.ram.percentage.toFixed(1)}%)`
            );
        }

        const duration = Date.now() - startTime;
        this.outputChannel.appendLine(`\n✓ Build successful in ${duration}ms`);

        return {
            success: true,
            output: result.stdout,
            memoryUsage,
            duration,
            warnings: this.parseWarnings(result.stdout + result.stderr)
        };
    }

    /**
     * Build with CMake
     */
    private async buildWithCMake(
        workspaceRoot: string,
        profile: string,
        startTime: number
    ): Promise<BuildResult> {
        const buildDir = path.join(workspaceRoot, 'build');
        PathUtils.ensureDir(buildDir);

        // Configure
        this.outputChannel.appendLine('Configuring CMake...\n');
        const configCmd = `cmake -DCMAKE_BUILD_TYPE=${profile} -DBUILD_PROFILE=${profile} ..`;
        const configResult = await ProcessUtils.exec(configCmd, buildDir, 60000);

        this.outputChannel.appendLine(configResult.stdout);

        if (configResult.exitCode !== 0) {
            throw new Error(`CMake configuration failed: ${configResult.stderr}`);
        }

        // Build
        const jobs = this.getParallelJobs();
        this.outputChannel.appendLine('\nBuilding...\n');
        const buildCmd = `cmake --build . -j${jobs}`;
        const buildResult = await ProcessUtils.exec(buildCmd, buildDir, 120000);

        this.outputChannel.appendLine(buildResult.stdout);

        if (buildResult.exitCode !== 0) {
            return {
                success: false,
                output: buildResult.stdout + '\n' + buildResult.stderr,
                duration: Date.now() - startTime,
                errors: this.parseErrors(buildResult.stdout + buildResult.stderr)
            };
        }

        const duration = Date.now() - startTime;
        this.outputChannel.appendLine(`\n✓ Build successful in ${duration}ms`);

        return {
            success: true,
            output: buildResult.stdout,
            duration
        };
    }

    /**
     * Clean build artifacts
     */
    async clean(workspaceRoot: string, buildSystem: BuildSystem = 'makefile'): Promise<void> {
        this.outputChannel.appendLine('=== Cleaning Build ===\n');

        if (buildSystem === 'cmake') {
            const buildDir = path.join(workspaceRoot, 'build');
            if (fs.existsSync(buildDir)) {
                fs.rmSync(buildDir, { recursive: true, force: true });
                this.outputChannel.appendLine('✓ Removed build directory');
            }
        } else {
            const result = await ProcessUtils.exec('make clean', workspaceRoot, 30000);
            this.outputChannel.appendLine(result.stdout);

            if (result.exitCode === 0) {
                this.outputChannel.appendLine('✓ Clean successful');
            } else {
                this.outputChannel.appendLine('✗ Clean failed');
            }
        }
    }

    /**
     * Get available build profiles
     */
    getProfiles(): BuildProfile[] {
        return Object.values(BuildService.BUILD_PROFILES);
    }

    /**
     * Parse memory usage from build output
     */
    private parseMemoryUsage(output: string): MemoryUsage | undefined {
        const memMatch = output.match(
            /Memory region\s+Used Size[\s\S]*?FLASH:\s+(\d+)\s+\w+\s+(\d+)\s+\w+\s+([\d.]+)%[\s\S]*?RAM:\s+(\d+)\s+\w+\s+(\d+)\s+\w+\s+([\d.]+)%/
        );

        if (memMatch) {
            return {
                flash: {
                    used: parseInt(memMatch[1]),
                    total: parseInt(memMatch[2]),
                    percentage: parseFloat(memMatch[3])
                },
                ram: {
                    used: parseInt(memMatch[4]),
                    total: parseInt(memMatch[5]),
                    percentage: parseFloat(memMatch[6])
                }
            };
        }

        return undefined;
    }

    /**
     * Parse errors from build output
     */
    private parseErrors(output: string): string[] {
        const errors: string[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (line.includes('error:') || line.includes('ERROR:')) {
                errors.push(line.trim());
            }
        }

        return errors;
    }

    /**
     * Parse warnings from build output
     */
    private parseWarnings(output: string): string[] {
        const warnings: string[] = [];
        const lines = output.split('\n');

        for (const line of lines) {
            if (line.includes('warning:') && !line.includes('error:')) {
                warnings.push(line.trim());
            }
        }

        return warnings;
    }

    /**
     * Get number of parallel jobs for build
     */
    private getParallelJobs(): number {
        const cpus = require('os').cpus().length;
        return Math.max(1, cpus);
    }
}
