import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Platform detection and cross-platform utilities
 */
export class PlatformUtils {
  private static _instance: PlatformUtils;
  private _platform: NodeJS.Platform;
  private _arch: string;
  private _isWindows: boolean;
  private _isMacOS: boolean;
  private _isLinux: boolean;

  private constructor() {
    this._platform = os.platform();
    this._arch = os.arch();
    this._isWindows = this._platform === 'win32';
    this._isMacOS = this._platform === 'darwin';
    this._isLinux = this._platform === 'linux';
  }

  public static getInstance(): PlatformUtils {
    if (!PlatformUtils._instance) {
      PlatformUtils._instance = new PlatformUtils();
    }
    return PlatformUtils._instance;
  }

  /** Get current platform identifier */
  get platform(): NodeJS.Platform {
    return this._platform;
  }

  /** Get current architecture */
  get arch(): string {
    return this._arch;
  }

  /** Check if running on Windows */
  get isWindows(): boolean {
    return this._isWindows;
  }

  /** Check if running on macOS */
  get isMacOS(): boolean {
    return this._isMacOS;
  }

  /** Check if running on Linux */
  get isLinux(): boolean {
    return this._isLinux;
  }

  /** Get platform-specific file extension for executables */
  get executableExtension(): string {
    return this._isWindows ? '.exe' : '';
  }

  /** Get platform-specific path separator */
  get pathSeparator(): string {
    return path.sep;
  }

  /** Get platform-specific environment variable delimiter */
  get envDelimiter(): string {
    return this._isWindows ? ';' : ':';
  }

  /**
   * Get user's home directory with proper platform handling
   */
  getUserHome(): string {
    return os.homedir();
  }

  /**
   * Get user's config directory following platform conventions
   * Windows: %APPDATA% or %USERPROFILE%\.config
   * macOS: ~/Library/Application Support
   * Linux: ~/.config or XDG_CONFIG_HOME
   */
  getUserConfigDir(appName = 'vibe-check-mcp'): string {
    if (this._isWindows) {
      const appData = process.env.APPDATA;
      if (appData) {
        return path.join(appData, appName);
      }
      // Fallback to user profile
      return path.join(this.getUserHome(), '.config', appName);
    }

    if (this._isMacOS) {
      return path.join(this.getUserHome(), 'Library', 'Application Support', appName);
    }

    // Linux and other Unix-like systems
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    if (xdgConfigHome) {
      return path.join(xdgConfigHome, appName);
    }

    return path.join(this.getUserHome(), '.config', appName);
  }

  /**
   * Get user's data directory following platform conventions
   * Windows: %APPDATA% or %USERPROFILE%\.local\share
   * macOS: ~/Library/Application Support
   * Linux: ~/.local/share or XDG_DATA_HOME
   */
  getUserDataDir(appName = 'vibe-check-mcp'): string {
    if (this._isWindows) {
      const appData = process.env.APPDATA;
      if (appData) {
        return path.join(appData, appName, 'data');
      }
      return path.join(this.getUserHome(), '.local', 'share', appName);
    }

    if (this._isMacOS) {
      return path.join(this.getUserHome(), 'Library', 'Application Support', appName);
    }

    // Linux and other Unix-like systems
    const xdgDataHome = process.env.XDG_DATA_HOME;
    if (xdgDataHome) {
      return path.join(xdgDataHome, appName);
    }

    return path.join(this.getUserHome(), '.local', 'share', appName);
  }

  /**
   * Get user's cache directory following platform conventions
   * Windows: %TEMP% or %USERPROFILE%\.cache
   * macOS: ~/Library/Caches
   * Linux: ~/.cache or XDG_CACHE_HOME
   */
  getUserCacheDir(appName = 'vibe-check-mcp'): string {
    if (this._isWindows) {
      const temp = process.env.TEMP || process.env.TMP;
      if (temp) {
        return path.join(temp, appName);
      }
      return path.join(this.getUserHome(), '.cache', appName);
    }

    if (this._isMacOS) {
      return path.join(this.getUserHome(), 'Library', 'Caches', appName);
    }

    // Linux and other Unix-like systems
    const xdgCacheHome = process.env.XDG_CACHE_HOME;
    if (xdgCacheHome) {
      return path.join(xdgCacheHome, appName);
    }

    return path.join(this.getUserHome(), '.cache', appName);
  }

  /**
   * Get platform-specific temporary directory
   */
  getTempDir(): string {
    return os.tmpdir();
  }

  /**
   * Resolve a path to be platform-specific
   * Converts forward slashes to platform-specific separators
   */
  resolvePath(...pathSegments: string[]): string {
    return path.resolve(...pathSegments);
  }

  /**
   * Join path segments using platform-specific separator
   */
  joinPath(...pathSegments: string[]): string {
    return path.join(...pathSegments);
  }

  /**
   * Normalize path separators for current platform
   */
  normalizePath(filePath: string): string {
    return path.normalize(filePath);
  }

  /**
   * Get platform-specific file permissions mode
   * Returns 0o600 for private files on Unix systems
   */
  getPrivateFileMode(): number | undefined {
    if (this._isWindows) {
      return undefined; // Windows uses ACLs
    }
    return 0o600;
  }

  /**
   * Get platform-specific directory permissions mode
   * Returns 0o700 for private directories on Unix systems
   */
  getPrivateDirMode(): number | undefined {
    if (this._isWindows) {
      return undefined; // Windows uses ACLs
    }
    return 0o700;
  }

  /**
   * Ensure directory exists with proper permissions and Windows compatibility
   */
  ensureDir(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        const mode = this.getPrivateDirMode();
        if (mode !== undefined) {
          fs.mkdirSync(dirPath, { recursive: true, mode });
        } else {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
    } catch (error) {
      // Enhanced error handling for Windows-specific issues
      if (error instanceof Error && 'code' in error) {
        const fsError = error as NodeJS.ErrnoException;

        switch (fsError.code) {
          case 'EACCES':
          case 'EPERM':
            throw new Error(`Permission denied creating directory ${dirPath}. On Windows, try running as administrator or check folder permissions.`);

          case 'EBUSY':
            throw new Error(`Resource busy creating directory ${dirPath}. Another process may be using the parent directory. Close any applications that might be locking the folder and try again.`);

          case 'ENAMETOOLONG':
            if (this._isWindows) {
              throw new Error(`Path too long for Windows: ${dirPath}. Windows has a 260 character path limit. Try using a shorter path or enabling long path support.`);
            }
            throw new Error(`Path too long: ${dirPath}`);

          case 'ENOENT':
            if (this._isWindows) {
              throw new Error(`Parent directory not found: ${dirPath}. On Windows, ensure the drive exists and is accessible.`);
            }
            throw new Error(`Parent directory not found: ${dirPath}`);

          case 'EEXIST':
            if (this._isWindows) {
              throw new Error(`Path already exists but is not a directory: ${dirPath}. Windows cannot create a directory where a file exists.`);
            }
            throw new Error(`Path already exists but is not a directory: ${dirPath}`);

          case 'EINVAL':
            if (this._isWindows) {
              throw new Error(`Invalid path for Windows: ${dirPath}. Check for invalid characters: <>:"/\\|?*`);
            }
            throw new Error(`Invalid path: ${dirPath}`);

          default:
            break;
        }
      }

      throw new Error(`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a path is absolute for the current platform
   */
  isAbsolute(filePath: string): boolean {
    return path.isAbsolute(filePath);
  }

  /**
   * Get relative path from one directory to another
   */
  getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Get platform-specific shell command for running executables
   */
  getShellCommand(): string {
    if (this._isWindows) {
      return 'cmd.exe';
    }
    return '/bin/sh';
  }

  /**
   * Get platform-specific shell arguments
   */
  getShellArgs(): string[] {
    if (this._isWindows) {
      return ['/c'];
    }
    return ['-c'];
  }

  /**
   * Check if running inside a container or virtual environment
   */
  isContainerized(): boolean {
    // Check for common container indicators
    const indicators = [
      '/.dockerenv',           // Docker
      '/proc/1/cgroup',        // Docker and other containers
      '/.dockerinit',          // Docker (old)
      '/proc/self/cgroup',     // Various container runtimes
    ];

    for (const indicator of indicators) {
      if (fs.existsSync(indicator)) {
        return true;
      }
    }

    // Check environment variables
    const containerEnvVars = [
      'DOCKER_CONTAINER',
      'KUBERNETES_SERVICE_HOST',
      'CONTAINER',
    ];

    for (const envVar of containerEnvVars) {
      if (process.env[envVar]) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get platform information as a string
   */
  getPlatformInfo(): string {
    return `${this._platform}-${this._arch} (container: ${this.isContainerized()})`;
  }

  /**
   * Validate Windows path for compatibility
   */
  validateWindowsPath(filePath: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!this._isWindows) {
      return { valid: true, issues: [] };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(filePath)) {
      issues.push('Path contains invalid characters: < > : " | ? *');
    }

    // Check path length
    if (filePath.length > 260) {
      issues.push('Path exceeds Windows 260 character limit');
    }

    // Check for reserved names
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    const pathParts = filePath.split(/[\\\/]/);
    for (const part of pathParts) {
      if (reservedNames.test(part)) {
        issues.push(`Path contains reserved Windows name: ${part}`);
      }
    }

    // Check for trailing spaces or periods
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && (lastPart.endsWith(' ') || lastPart.endsWith('.'))) {
      issues.push('Path cannot end with space or period on Windows');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Fix Windows path compatibility issues
   */
  fixWindowsPath(filePath: string): string {
    if (!this._isWindows) {
      return filePath;
    }

    // Convert forward slashes to backslashes
    let fixedPath = filePath.replace(/\//g, '\\');

    // Remove trailing spaces and periods
    fixedPath = fixedPath.replace(/[ .]+$/g, '');

    // Handle reserved names by prefixing with underscore
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
    fixedPath = fixedPath.replace(/(^|\\)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/gi, '$1_$2$3');

    return fixedPath;
  }

  /**
   * Check if running under Windows with limited permissions
   */
  isWindowsWithRestrictedPermissions(): boolean {
    if (!this._isWindows) {
      return false;
    }

    // Check if running in a restricted environment
    const restrictedIndicators = [
      process.env.TEMP?.includes('Windows\\Temp'), // System temp
      process.env.USERPROFILE?.includes('Windows\\System32'), // System32
      process.env.APPDATA?.includes('Windows\\System32') // System32 app data
    ];

    return restrictedIndicators.some(indicator => indicator === true);
  }

  /**
   * Get Windows-specific safe temporary directory
   */
  getWindowsSafeTempDir(): string {
    if (!this._isWindows) {
      return this.getTempDir();
    }

    // Try user temp first
    const userTemp = path.join(this.getUserHome(), 'AppData', 'Local', 'Temp');
    if (fs.existsSync(userTemp)) {
      return userTemp;
    }

    // Fall back to system temp
    const systemTemp = process.env.TEMP || process.env.TMP || this.getTempDir();
    return systemTemp;
  }

  /**
   * Check if Windows long path support is available
   */
  hasWindowsLongPathSupport(): boolean {
    if (!this._isWindows) {
      return false;
    }

    try {
      // Try to create a long path and see if it works
      const testPath = '\\\\?\\' + this.getTempDir();
      fs.accessSync(testPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Windows-appropriate file permissions handling
   */
  getWindowsFilePermissions(filePath: string): { readable: boolean; writable: boolean } {
    if (!this._isWindows) {
      // On Unix systems, we'd check file mode bits
      try {
        fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
        return { readable: true, writable: true };
      } catch {
        return { readable: false, writable: false };
      }
    }

    // Windows uses ACLs, so we try to access the file
    try {
      fs.accessSync(filePath, fs.constants.R_OK);
      const readable = true;

      try {
        fs.accessSync(filePath, fs.constants.W_OK);
        return { readable, writable: true };
      } catch {
        return { readable, writable: false };
      }
    } catch {
      return { readable: false, writable: false };
    }
  }
}

// Export singleton instance for easy usage
export const platform = PlatformUtils.getInstance();

// Export types for TypeScript users
export type PlatformType = NodeJS.Platform;
export type ArchitectureType = string;