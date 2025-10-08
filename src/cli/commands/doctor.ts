#!/usr/bin/env node

/**
 * Doctor command - Diagnoses common issues
 *
 * This command handles:
 * - Comprehensive system diagnostics
 * - Configuration validation
 * - API key verification
 * - Client status checking
 * - Remediation suggestions
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { platform } from '../utils/platform.js';
import { ConfigManager, DefaultConfigs } from '../utils/config.js';
import { EnvironmentManager } from '../utils/environment.js';
import { validateClientConfig } from '../utils/clients.js';
import { detectClient } from '../utils/detection.js';
import { installationDetector, InstallationState } from '../utils/installation.js';
import { MessageFormatter, ProgressTracker } from '../utils/messaging.js';

interface DoctorOptions {
  verbose: boolean;
  fix: boolean;
  'check-network': boolean;
  'check-clients': boolean;
  'check-config': boolean;
  'check-env': boolean;
}

interface DiagnosticResult {
  category: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  message: string;
  details?: string;
  suggestions?: string[];
  fixable?: boolean;
}

interface DiagnosticReport {
  overall: 'healthy' | 'warning' | 'error';
  timestamp: string;
  results: DiagnosticResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
    info: number;
  };
}

/**
 * System diagnostics collector
 */
class SystemDiagnostics {
  private results: DiagnosticResult[] = [];

  constructor(private verbose: boolean = false) {}

  /**
   * Add diagnostic result
   */
  addResult(result: DiagnosticResult): void {
    this.results.push(result);
  }

  /**
   * Run all system checks with enhanced messaging
   */
  async runAllChecks(options: DoctorOptions): Promise<void> {
    MessageFormatter.info('Starting Diagnostics', 'Performing comprehensive system health check...');

    // System requirements
    this.checkNodeVersion();
    this.checkPlatform();
    this.checkMemory();
    this.checkDiskSpace();

    // Installation checks
    if (options['check-config'] !== false) {
      await this.checkInstallation();
    }

    // Environment checks
    if (options['check-env'] !== false) {
      await this.checkEnvironment();
    }

    // Client checks
    if (options['check-clients'] !== false) {
      await this.checkClients();
    }

    // Network checks
    if (options['check-network']) {
      await this.checkNetwork();
    }
  }

  /**
   * Check Node.js version
   */
  private checkNodeVersion(): void {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion >= 18) {
      this.addResult({
        category: 'System',
        status: 'pass',
        message: `Node.js version: ${nodeVersion}`,
        details: `Version ${majorVersion} meets minimum requirements (>= 18.0.0)`
      });
    } else {
      this.addResult({
        category: 'System',
        status: 'fail',
        message: `Node.js version ${nodeVersion} is not supported`,
        details: `Current version: ${majorVersion}, Required: >= 18.0.0`,
        suggestions: [
          'Upgrade to Node.js 18 or later using your package manager',
          'Download from: https://nodejs.org/',
          'Use a version manager like nvm or n for easy switching'
        ],
        fixable: false
      });
    }
  }

  /**
   * Check platform compatibility
   */
  private checkPlatform(): void {
    const platformInfo = platform.getPlatformInfo();
    const isContainerized = platform.isContainerized();

    this.addResult({
      category: 'System',
      status: 'info',
      message: `Platform: ${platformInfo}`,
      details: isContainerized ? 'Running in containerized environment' : 'Running on bare metal'
    });

    if (this.verbose) {
      console.log(`  Platform details: ${platform.platform} ${platform.arch}`);
      console.log(`  Shell: ${platform.getShellCommand()}`);
      console.log(`  Temp directory: ${platform.getTempDir()}`);
    }
  }

  /**
   * Check memory availability
   */
  private checkMemory(): void {
    const os = require('os');
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    const totalGB = (totalMemory / (1024 * 1024 * 1024)).toFixed(2);
    const freeGB = (freeMemory / (1024 * 1024 * 1024)).toFixed(2);

    if (totalMemory >= 1024 * 1024 * 1024) { // >= 1GB
      if (memoryUsagePercent < 90) {
        this.addResult({
          category: 'System',
          status: 'pass',
          message: `Memory: ${freeGB}GB free of ${totalGB}GB`,
          details: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`
        });
      } else {
        this.addResult({
          category: 'System',
          status: 'warn',
          message: `High memory usage: ${memoryUsagePercent.toFixed(1)}%`,
          details: `Only ${freeGB}GB free of ${totalGB}GB`,
          suggestions: [
            'Close unnecessary applications',
            'Consider increasing system memory',
            'Monitor memory usage during operation'
          ]
        });
      }
    } else {
      this.addResult({
        category: 'System',
        status: 'warn',
        message: `Low memory: ${totalGB}GB total`,
        details: 'At least 1GB RAM recommended for optimal performance',
        suggestions: [
          'Consider upgrading system memory',
          'Monitor performance during operation'
        ]
      });
    }
  }

  /**
   * Check disk space
   */
  private checkDiskSpace(): void {
    try {
      const stats = fs.statSync(process.cwd());
      const projectRoot = process.cwd();

      // Basic disk space check (this is simplified)
      this.addResult({
        category: 'System',
        status: 'info',
        message: `Working directory: ${projectRoot}`,
        details: 'Disk space check not implemented - verify manually if needed'
      });

      if (this.verbose) {
        console.log(`  Project directory: ${projectRoot}`);
        console.log(`  Directory permissions: ${stats.mode.toString(8)}`);
      }
    } catch (error) {
      this.addResult({
        category: 'System',
        status: 'fail',
        message: 'Cannot access working directory',
        details: error instanceof Error ? error.message : String(error),
        suggestions: [
          'Check directory permissions',
          'Ensure you have read/write access',
          'Try running from a different directory'
        ]
      });
    }
  }

  /**
   * Check installation status with enhanced detection
   */
  private async checkInstallation(): Promise<void> {
    try {
      // Use the new installation state detector
      const installationState = await installationDetector.detectInstallationState();

      // Add overall installation state result
      const stateIcon = {
        [InstallationState.NOT_INSTALLED]: '❌',
        [InstallationState.INSTALLED]: '✅',
        [InstallationState.CORRUPTED]: '🔧',
        [InstallationState.PARTIAL]: '⚠️',
        [InstallationState.UPGRADE_NEEDED]: '🔄'
      }[installationState.state];

      const stateStatus = {
        [InstallationState.NOT_INSTALLED]: 'fail' as const,
        [InstallationState.INSTALLED]: 'pass' as const,
        [InstallationState.CORRUPTED]: 'fail' as const,
        [InstallationState.PARTIAL]: 'warn' as const,
        [InstallationState.UPGRADE_NEEDED]: 'warn' as const
      }[installationState.state];

      this.addResult({
        category: 'Installation',
        status: stateStatus,
        message: `Installation state: ${installationState.state}`,
        details: `${stateIcon} ${installationState.details.version ? `Version ${installationState.details.version}` : 'Version unknown'}`,
        suggestions: installationState.recommendations,
        fixable: installationState.state !== InstallationState.INSTALLED
      });

      // Add detailed component status
      const componentStatuses = [
        { key: 'configExists', name: 'Configuration file', icon: '📄' },
        { key: 'configValid', name: 'Configuration validity', icon: '✅' },
        { key: 'binariesExist', name: 'Server binaries', icon: '🔧' },
        { key: 'dependenciesMet', name: 'Dependencies', icon: '📦' },
        { key: 'permissionsOk', name: 'File permissions', icon: '🔐' },
        { key: 'pathsValid', name: 'Path validation', icon: '🛤️' }
      ];

      for (const component of componentStatuses) {
        const isGood = installationState.details[component.key as keyof typeof installationState.details];
        const status = isGood ? 'pass' : 'fail';
        const icon = isGood ? '✅' : '❌';

        this.addResult({
          category: 'Installation',
          status,
          message: `${component.icon} ${component.name}: ${isGood ? 'OK' : 'Issue detected'}`,
          details: `${icon} ${component.name} check ${isGood ? 'passed' : 'failed'}`
        });
      }

      // Add issues and recovery actions
      if (installationState.issues.length > 0) {
        this.addResult({
          category: 'Installation',
          status: 'warn',
          message: 'Installation issues detected',
          details: installationState.issues.slice(0, 3).join('; '),
          suggestions: installationState.issues
        });
      }

      if (installationState.recoveryActions.length > 0) {
        this.addResult({
          category: 'Installation',
          status: 'info',
          message: 'Recovery actions available',
          details: installationState.recoveryActions.slice(0, 2).join('; '),
          suggestions: installationState.recoveryActions
        });
      }

    } catch (error) {
      // Fallback to basic checks if installation detector fails
      this.addResult({
        category: 'Installation',
        status: 'fail',
        message: 'Installation state detection failed',
        details: error instanceof Error ? error.message : String(error),
        suggestions: [
          'Run basic installation checks manually',
          'Check file permissions and disk space',
          'Ensure you\'re in the correct project directory'
        ]
      });

      // Perform basic fallback checks
      await this.performBasicInstallationChecks();
    }
  }

  /**
   * Fallback basic installation checks
   */
  private async performBasicInstallationChecks(): Promise<void> {
    const configManager = new ConfigManager({
      configName: 'mcp-server',
      defaultConfig: DefaultConfigs.mcpServer
    });

    // Check if configuration exists
    if (configManager.exists()) {
      this.addResult({
        category: 'Installation',
        status: 'pass',
        message: 'Configuration file found',
        details: `Location: ${configManager.getConfigPath()}`
      });
    } else {
      this.addResult({
        category: 'Installation',
        status: 'fail',
        message: 'Configuration file not found',
        details: 'Run "vibe-check-mcp install" to create configuration',
        suggestions: ['Run "vibe-check-mcp install" to set up the server'],
        fixable: true
      });
    }

    // Check server build
    const serverScript = path.resolve(process.cwd(), 'build', 'index.js');
    if (fs.existsSync(serverScript)) {
      this.addResult({
        category: 'Installation',
        status: 'pass',
        message: 'Server build found',
        details: `Location: ${serverScript}`
      });
    } else {
      this.addResult({
        category: 'Installation',
        status: 'fail',
        message: 'Server build not found',
        details: 'Build the project with "npm run build"',
        suggestions: ['Run "npm run build" to create the server build'],
        fixable: true
      });
    }
  }

  /**
   * Check environment configuration
   */
  private async checkEnvironment(): Promise<void> {
    const environment = new EnvironmentManager();

    // Check API keys
    const apiKeyStatus = environment.checkApiKeys();
    const configuredProviders = Object.keys(apiKeyStatus).filter(p => apiKeyStatus[p]);
    const totalProviders = Object.keys(apiKeyStatus).length;

    if (configuredProviders.length > 0) {
      this.addResult({
        category: 'Environment',
        status: 'pass',
        message: `${configuredProviders.length}/${totalProviders} API key(s) configured`,
        details: `Configured: ${configuredProviders.join(', ')}`
      });

      // Validate each configured API key
      for (const provider of configuredProviders) {
        try {
          const validation = await environment.validateApiKey(provider);
          if (validation.valid) {
            this.addResult({
              category: 'Environment',
              status: 'pass',
              message: `${provider} API key: Valid`
            });
          } else {
            this.addResult({
              category: 'Environment',
              status: 'fail',
              message: `${provider} API key: Invalid`,
              details: validation.error || 'Validation failed',
              suggestions: validation.suggestions,
              fixable: true
            });
          }
        } catch (error) {
          this.addResult({
            category: 'Environment',
            status: 'warn',
            message: `${provider} API key: Validation error`,
            details: error instanceof Error ? error.message : String(error)
          });
        }
      }
    } else {
      this.addResult({
        category: 'Environment',
        status: 'warn',
        message: 'No API keys configured',
        details: 'API keys are required for full functionality',
        suggestions: [
          'Set GEMINI_API_KEY environment variable',
          'Run "vibe-check-mcp install --interactive"',
          'Configure API keys in environment or .env file'
        ],
        fixable: true
      });
    }

    // Check environment files
    const envSummary = environment.getConfigurationSummary();
    for (const configFile of envSummary.configFiles) {
      if (fs.existsSync(configFile)) {
        this.addResult({
          category: 'Environment',
          status: 'info',
          message: `Environment file: ${path.basename(configFile)}`,
          details: `Location: ${configFile}`
        });
      }
    }
  }

  /**
   * Check client configurations
   */
  private async checkClients(): Promise<void> {
    const clients = ['claude', 'cursor'];

    for (const client of clients) {
      try {
        // Check if client is running
        const status = await detectClient(client as any, 'stdio', '.');

        if (status.isRunning) {
          this.addResult({
            category: 'Clients',
            status: 'info',
            message: `${client}: Running`,
            details: 'Configuration changes will require restart'
          });
        } else {
          this.addResult({
            category: 'Clients',
            status: 'info',
            message: `${client}: Not running`
          });
        }

        // Check client configuration
        const isValid = await validateClientConfig(client as any, 'stdio', '.');
        if (isValid) {
          this.addResult({
            category: 'Clients',
            status: 'pass',
            message: `${client}: Configuration valid`
          });
        } else {
          this.addResult({
            category: 'Clients',
            status: 'warn',
            message: `${client}: Configuration invalid`,
            details: 'Run "vibe-check-mcp install" to fix client configuration',
            suggestions: [
              'Run "vibe-check-mcp install" to register with client',
              'Check client configuration file manually',
              'Restart the client after configuration changes'
            ],
            fixable: true
          });
        }
      } catch (error) {
        this.addResult({
          category: 'Clients',
          status: 'warn',
          message: `${client}: Check failed`,
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Check network connectivity
   */
  private async checkNetwork(): Promise<void> {
    // This is a basic network check - in a real implementation, you would
    // actually try to connect to the provider APIs

    this.addResult({
      category: 'Network',
      status: 'info',
      message: 'Network check not implemented',
      details: 'Manual verification required for API connectivity',
      suggestions: [
        'Test API key validity with provider-specific tools',
        'Check firewall and proxy settings',
        'Verify internet connectivity'
      ]
    });
  }

  /**
   * Generate diagnostic report
   */
  generateReport(): DiagnosticReport {
    const summary = {
      pass: 0,
      warn: 0,
      fail: 0,
      info: 0
    };

    for (const result of this.results) {
      summary[result.status]++;
    }

    let overall: 'healthy' | 'warning' | 'error';
    if (summary.fail > 0) {
      overall = 'error';
    } else if (summary.warn > 0) {
      overall = 'warning';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      timestamp: new Date().toISOString(),
      results: this.results,
      summary
    };
  }

  /**
   * Apply fixes for fixable issues
   */
  async applyFixes(): Promise<number> {
    let fixedCount = 0;

    for (const result of this.results) {
      if (result.fixable && result.status === 'fail') {
        try {
          // Apply fix based on category and message
          const fixed = await this.applyFix(result);
          if (fixed) {
            fixedCount++;
            console.log(`  ✓ Fixed: ${result.message}`);
          }
        } catch (error) {
          console.log(`  ✗ Failed to fix: ${result.message}`);
        }
      }
    }

    return fixedCount;
  }

  /**
   * Apply specific fix
   */
  private async applyFix(result: DiagnosticResult): Promise<boolean> {
    // This is a placeholder for automatic fixes
    // In a real implementation, you would implement specific fixes for each issue

    switch (result.category) {
      case 'Installation':
        if (result.message.includes('Configuration')) {
          // Could attempt to recreate configuration
          return false; // Not implemented
        }
        break;
      case 'Environment':
        if (result.message.includes('API key')) {
          // Could prompt for API key input
          return false; // Not implemented
        }
        break;
    }

    return false;
  }
}

/**
 * Doctor command implementation
 */
export const doctorCommand = new Command('doctor')
  .description('Diagnose and troubleshoot installation issues')
  .option('-v, --verbose', 'Verbose diagnostic output', false)
  .option('--fix', 'Attempt to automatically fix issues', false)
  .option('--check-network', 'Check network connectivity', false)
  .option('--check-clients', 'Check MCP client configurations', true)
  .option('--check-config', 'Check configuration files', true)
  .option('--check-env', 'Check environment variables', true)
  .action(async (options: DoctorOptions) => {
    const diagnostics = new SystemDiagnostics(options.verbose);

    try {
      // Run all diagnostic checks
      await diagnostics.runAllChecks(options);

      // Generate and display report
      const report = diagnostics.generateReport();

      console.log('\n📊 Diagnostic Results');
      console.log('===================');

      // Display results by category
      const categorySet = new Set(report.results.map(r => r.category));
      const categories = Array.from(categorySet);
      for (const category of categories) {
        const categoryResults = report.results.filter(r => r.category === category);
        console.log(`\n${category}:`);

        for (const result of categoryResults) {
          const icon = {
            pass: '✓',
            warn: '⚠',
            fail: '✗',
            info: 'ℹ'
          }[result.status];

          console.log(`  ${icon} ${result.message}`);

          if (options.verbose && result.details) {
            console.log(`    ${result.details}`);
          }

          if (result.suggestions && result.suggestions.length > 0) {
            if (options.verbose) {
              console.log('    Suggestions:');
              result.suggestions.forEach(suggestion => {
                console.log(`      - ${suggestion}`);
              });
            } else {
              console.log(`    ${result.suggestions.length} suggestion(s) available (use --verbose for details)`);
            }
          }
        }
      }

      // Display summary
      console.log('\n📈 Summary');
      console.log('=========');
      console.log(`Overall status: ${report.overall.toUpperCase()}`);
      console.log(`Passed: ${report.summary.pass}`);
      console.log(`Warnings: ${report.summary.warn}`);
      console.log(`Failed: ${report.summary.fail}`);
      console.log(`Info: ${report.summary.info}`);

      // Apply fixes if requested
      if (options.fix) {
        console.log('\n🔧 Applying fixes...');
        const fixedCount = await diagnostics.applyFixes();
        if (fixedCount > 0) {
          console.log(`✅ Fixed ${fixedCount} issue(s)`);
        } else {
          console.log('ℹ️  No automatic fixes available');
        }
      }

      // Provide recommendations
      if (report.overall === 'error' || report.overall === 'warning') {
        console.log('\n💡 Recommendations');
        console.log('================');

        const failedResults = report.results.filter(r => r.status === 'fail' || r.status === 'warn');
        for (const result of failedResults.slice(0, 5)) { // Limit to top 5
          if (result.suggestions && result.suggestions.length > 0) {
            console.log(`• ${result.message}: ${result.suggestions[0]}`);
          }
        }

        if (failedResults.length > 5) {
          console.log(`... and ${failedResults.length - 5} more issues (use --verbose for all details)`);
        }
      }

      // Final status
      console.log('\n🎯 Final Status');
      console.log('==============');
      if (report.overall === 'healthy') {
        console.log('✅ All systems operational! Your Vibe Check MCP installation is working correctly.');
      } else if (report.overall === 'warning') {
        console.log('⚠️  Minor issues detected. Your installation should work, but some features may be limited.');
        console.log('   Run with --fix to attempt automatic fixes, or address the warnings manually.');
      } else {
        console.log('❌ Critical issues detected. Your installation may not work correctly.');
        console.log('   Please address the failed checks before using the server.');
      }

      // Show next steps
      console.log('\n🔗 Useful Commands');
      console.log('==================');
      console.log('vibe-check-mcp install    - Install or reinstall the server');
      console.log('vibe-check-mcp start      - Start the server');
      console.log('vibe-check-mcp uninstall  - Remove the installation');
      console.log('vibe-check-mcp doctor     - Run diagnostics (this command)');

      if (options.verbose) {
        console.log('\n🔍 Technical Details');
        console.log('===================');
        console.log(`Report timestamp: ${report.timestamp}`);
        console.log(`Platform: ${platform.getPlatformInfo()}`);
        console.log(`Node.js: ${process.version}`);
        console.log(`Working directory: ${process.cwd()}`);
      }

      // Exit with appropriate code
      if (report.overall === 'error') {
        process.exit(1);
      } else if (report.overall === 'warning') {
        process.exit(2);
      } else {
        process.exit(0);
      }

    } catch (error) {
      console.error(`\n❌ Diagnostic failed: ${error instanceof Error ? error.message : String(error)}`);

      if (options.verbose && error instanceof Error && error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }

      console.error('\nTroubleshooting:');
      console.error('1. Check that you have the required permissions');
      console.error('2. Ensure you\'re in the correct directory');
      console.error('3. Try running with --verbose for more details');

      process.exit(3);
    }
  });

// Export for use in main CLI
export default doctorCommand;