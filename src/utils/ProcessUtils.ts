import { exec, execSync, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Cross-platform process utilities
 */
export class ProcessUtils {
    /**
     * Execute command synchronously with timeout
     */
    static execSync(
        command: string,
        cwd?: string,
        timeoutMs: number = 30000
    ): ExecResult {
        try {
            const stdout = execSync(command, {
                cwd,
                encoding: 'utf8',
                timeout: timeoutMs,
                maxBuffer: 10 * 1024 * 1024,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            return {
                stdout: stdout.toString(),
                stderr: '',
                exitCode: 0
            };
        } catch (error: any) {
            return {
                stdout: error.stdout?.toString() || '',
                stderr: error.stderr?.toString() || error.message,
                exitCode: error.status || 1
            };
        }
    }

    /**
     * Execute command asynchronously
     */
    static async exec(
        command: string,
        cwd?: string,
        timeoutMs: number = 30000
    ): Promise<ExecResult> {
        try {
            const { stdout, stderr } = await execAsync(command, {
                cwd,
                encoding: 'utf8',
                timeout: timeoutMs,
                maxBuffer: 10 * 1024 * 1024
            });

            return {
                stdout,
                stderr,
                exitCode: 0
            };
        } catch (error: any) {
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                exitCode: error.code || 1
            };
        }
    }

    /**
     * Check if a command exists in PATH
     */
    static commandExists(command: string): boolean {
        const checkCmd = process.platform === 'win32'
            ? `where ${command}`
            : `which ${command}`;

        try {
            execSync(checkCmd, { stdio: 'ignore' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Kill process by name (cross-platform)
     */
    static killProcessByName(processName: string): boolean {
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /IM ${processName}.exe`, { stdio: 'ignore' });
            } else {
                execSync(`pkill -9 ${processName}`, { stdio: 'ignore' });
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get command version
     */
    static async getVersion(command: string, versionFlag: string = '--version'): Promise<string | undefined> {
        try {
            const result = await this.exec(`${command} ${versionFlag}`, undefined, 5000);
            if (result.exitCode === 0) {
                // Extract version from output (first line usually)
                const firstLine = result.stdout.split('\n')[0];
                const versionMatch = firstLine.match(/(\d+\.\d+\.\d+)/);
                return versionMatch ? versionMatch[1] : firstLine.trim();
            }
        } catch {
            // Command doesn't exist or failed
        }
        return undefined;
    }

    /**
     * Spawn a long-running process
     */
    static spawnProcess(
        command: string,
        args: string[],
        cwd?: string
    ): ChildProcess {
        return spawn(command, args, {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe']
        });
    }
}
