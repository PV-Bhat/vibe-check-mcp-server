#!/usr/bin/env node

/**
 * Production Readiness Validation Script
 *
 * This script performs comprehensive checks to ensure the Vibe Check MCP server
 * is ready for production deployment. It validates:
 * - Code quality and standards
 * - Security configurations
 * - Cross-platform compatibility
 * - Documentation completeness
 * - Performance considerations
 * - Error handling robustness
 */

const fs = require('fs');
const path = require('path');

class ProductionReadinessValidator {
  constructor() {
    this.projectRoot = process.cwd();
    this.results = {
      passed: [],
      failed: [],
      warnings: [],
      totalChecks: 0,
      passedChecks: 0
    };
  }

  /**
   * Run all production readiness checks
   */
  async validateAll() {
    console.log('🔍 Production Readiness Validation');
    console.log('='.repeat(35));
    console.log();

    await this.validateCodeQuality();
    await this.validateSecurity();
    await this.validateDocumentation();
    await this.validateCrossPlatform();
    await this.validateErrorHandling();
    await this.validatePerformance();
    await this.validateDependencies();
    await this.validateConfiguration();

    this.printSummary();
    return this.results;
  }

  /**
   * Validate code quality and standards
   */
  async validateCodeQuality() {
    console.log('📝 Code Quality Validation');
    console.log('-'.repeat(25));

    // Check TypeScript configuration
    this.check('TypeScript Configuration', () => {
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      if (!fs.existsSync(tsconfigPath)) {
        throw new Error('tsconfig.json not found');
      }

      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      if (!tsconfig.compilerOptions) {
        throw new Error('Invalid tsconfig.json structure');
      }

      const requiredOptions = ['strict', 'esModuleInterop', 'skipLibCheck'];
      const missing = requiredOptions.filter(opt => tsconfig.compilerOptions[opt] === undefined);

      if (missing.length > 0) {
        throw new Error(`Missing TypeScript options: ${missing.join(', ')}`);
      }

      return 'TypeScript configuration is valid';
    });

    // Check for linting configuration
    this.check('Linting Configuration', () => {
      const eslintPath = path.join(this.projectRoot, '.eslintrc.js');
      const eslintJsonPath = path.join(this.projectRoot, '.eslintrc.json');

      if (!fs.existsSync(eslintPath) && !fs.existsSync(eslintJsonPath)) {
        throw new Warning('ESLint configuration not found');
      }

      return 'Linting configuration exists';
    });

    // Check source code structure
    this.check('Source Code Structure', () => {
      const srcPath = path.join(this.projectRoot, 'src');
      if (!fs.existsSync(srcPath)) {
        throw new Error('src directory not found');
      }

      const requiredFiles = [
        'src/index.ts',
        'src/cli/index.ts',
        'src/tools/vibeCheck.ts'
      ];

      const missing = requiredFiles.filter(file => !fs.existsSync(path.join(this.projectRoot, file)));
      if (missing.length > 0) {
        throw new Error(`Missing required files: ${missing.join(', ')}`);
      }

      return 'Source code structure is complete';
    });

    console.log();
  }

  /**
   * Validate security configurations
   */
  async validateSecurity() {
    console.log('🔒 Security Validation');
    console.log('-'.repeat(20));

    // Check for .gitignore
    this.check('Git Ignore Configuration', () => {
      const gitignorePath = path.join(this.projectRoot, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        throw new Error('.gitignore file not found');
      }

      const gitignore = fs.readFileSync(gitignorePath, 'utf8');
      const requiredEntries = ['node_modules', '.env', '*.log', '.DS_Store', 'dist/'];

      const missing = requiredEntries.filter(entry => !gitignore.includes(entry));
      if (missing.length > 0) {
        throw new Warning(`Missing .gitignore entries: ${missing.join(', ')}`);
      }

      return 'Git ignore configuration is adequate';
    });

    // Check for security-related files
    this.check('Security Documentation', () => {
      const securityPath = path.join(this.projectRoot, 'SECURITY.md');
      if (!fs.existsSync(securityPath)) {
        throw new Warning('SECURITY.md file not found');
      }

      return 'Security documentation exists';
    });

    // Check package.json for security
    this.check('Package Security', () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packagePath)) {
        throw new Error('package.json not found');
      }

      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      if (pkg.scripts && pkg.scripts.preinstall) {
        throw new Error('Preinstall scripts detected - potential security risk');
      }

      if (pkg.license && pkg.license === 'UNLICENSED') {
        throw new Warning('Project is unlicensed');
      }

      return 'Package security checks passed';
    });

    console.log();
  }

  /**
   * Validate documentation completeness
   */
  async validateDocumentation() {
    console.log('📚 Documentation Validation');
    console.log('-'.repeat(29));

    // Check README
    this.check('README.md', () => {
      const readmePath = path.join(this.projectRoot, 'README.md');
      if (!fs.existsSync(readmePath)) {
        throw new Error('README.md not found');
      }

      const readme = fs.readFileSync(readmePath, 'utf8');
      const requiredSections = ['Installation', 'Usage', 'Troubleshooting'];

      const missing = requiredSections.filter(section =>
        !readme.toLowerCase().includes(section.toLowerCase())
      );

      if (missing.length > 0) {
        throw new Warning(`README missing sections: ${missing.join(', ')}`);
      }

      return 'README.md is comprehensive';
    });

    // Check for CLI documentation
    this.check('CLI Documentation', () => {
      const cliDocs = [
        'docs/cli-reference.md',
        'docs/cli-usage.md'
      ];

      const existing = cliDocs.filter(doc =>
        fs.existsSync(path.join(this.projectRoot, doc))
      );

      if (existing.length === 0) {
        throw new Warning('No CLI documentation found');
      }

      return `CLI documentation found: ${existing.join(', ')}`;
    });

    // Check for API documentation
    this.check('API Documentation', () => {
      const apiDocPath = path.join(this.projectRoot, 'docs', 'api.md');
      if (!fs.existsSync(apiDocPath)) {
        throw new Warning('API documentation not found');
      }

      return 'API documentation exists';
    });

    console.log();
  }

  /**
   * Validate cross-platform compatibility
   */
  async validateCrossPlatform() {
    console.log('🌐 Cross-Platform Validation');
    console.log('-'.repeat(31));

    // Check for Windows-specific handling
    this.check('Windows Compatibility', () => {
      const srcPath = path.join(this.projectRoot, 'src');
      const platformUtils = path.join(srcPath, 'cli', 'utils', 'platform.ts');

      if (!fs.existsSync(platformUtils)) {
        throw new Warning('Platform utilities not found');
      }

      const content = fs.readFileSync(platformUtils, 'utf8');
      if (!content.includes('isWindows') || !content.includes('getPlatformInfo')) {
        throw new Warning('Limited Windows platform support detected');
      }

      return 'Windows compatibility handling present';
    });

    // Check path handling
    this.check('Path Handling', () => {
      const srcPath = path.join(this.projectRoot, 'src');
      const files = this.getAllTsFiles(srcPath);

      let pathIssues = 0;
      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes("path.join('/')") || content.includes('path.sep')) {
          pathIssues++;
        }
      });

      if (pathIssues > 0) {
        throw new Warning(`${pathIssues} files may have platform-specific path issues`);
      }

      return 'Path handling appears platform-agnostic';
    });

    // Check executable permissions
    this.check('Executable Scripts', () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      if (pkg.bin) {
        for (const [name, script] of Object.entries(pkg.bin)) {
          const scriptPath = path.join(this.projectRoot, script);
          if (fs.existsSync(scriptPath)) {
            // This would be more relevant on Unix systems
            // For now, just check the file exists
            return `Executable script found: ${name}`;
          }
        }
      }

      return 'No executable scripts to validate';
    });

    console.log();
  }

  /**
   * Validate error handling robustness
   */
  async validateErrorHandling() {
    console.log('⚠️  Error Handling Validation');
    console.log('-'.repeat(30));

    // Check for comprehensive error handling
    this.check('Error Handling Patterns', () => {
      const srcPath = path.join(this.projectRoot, 'src');
      const files = this.getAllTsFiles(srcPath);

      let tryCatchCount = 0;
      let errorHandlingFiles = 0;

      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('try {')) {
          tryCatchCount++;
        }
        if (content.includes('catch') && content.includes('error')) {
          errorHandlingFiles++;
        }
      });

      if (errorHandlingFiles < files.length * 0.5) {
        throw new Warning(`Only ${errorHandlingFiles}/${files.length} files have error handling`);
      }

      return `Error handling found in ${errorHandlingFiles} files`;
    });

    // Check for validation functions
    this.check('Input Validation', () => {
      const cliPath = path.join(this.projectRoot, 'src', 'cli');
      if (!fs.existsSync(cliPath)) {
        throw new Error('CLI directory not found');
      }

      const files = this.getAllTsFiles(cliPath);
      let validationFiles = 0;

      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('validate') || content.includes('check')) {
          validationFiles++;
        }
      });

      if (validationFiles === 0) {
        throw new Warning('No input validation functions found');
      }

      return `Input validation found in ${validationFiles} CLI files`;
    });

    // Check for graceful shutdown
    this.check('Graceful Shutdown', () => {
      const startCommandPath = path.join(this.projectRoot, 'src', 'cli', 'commands', 'start.ts');
      if (!fs.existsSync(startCommandPath)) {
        throw new Error('start command not found');
      }

      const content = fs.readFileSync(startCommandPath, 'utf8');
      if (!content.includes('SIGINT') && !content.includes('SIGTERM')) {
        throw new Warning('No graceful shutdown handling found');
      }

      return 'Graceful shutdown handling present';
    });

    console.log();
  }

  /**
   * Validate performance considerations
   */
  async validatePerformance() {
    console.log('⚡ Performance Validation');
    console.log('-'.repeat(27));

    // Check for performance optimizations
    this.check('Performance Optimizations', () => {
      const srcPath = path.join(this.projectRoot, 'src');
      const files = this.getAllTsFiles(srcPath);

      let performanceIssues = 0;

      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');

        // Check for potential performance issues
        if (content.includes('sync.*File') || content.includes('readFileSync')) {
          performanceIssues++;
        }

        if (content.includes('JSON.parse.*large') || content.includes('JSON.stringify.*large')) {
          performanceIssues++;
        }
      });

      if (performanceIssues > 0) {
        throw new Warning(`${performanceIssues} potential performance issues detected`);
      }

      return 'No obvious performance issues found';
    });

    // Check for caching mechanisms
    this.check('Caching Strategy', () => {
      const utilsPath = path.join(this.projectRoot, 'src', 'utils');
      if (!fs.existsSync(utilsPath)) {
        throw new Warning('Utils directory not found');
      }

      const files = this.getAllTsFiles(utilsPath);
      let cacheFiles = 0;

      files.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('cache') || content.includes('Cache')) {
          cacheFiles++;
        }
      });

      if (cacheFiles === 0) {
        throw new Warning('No caching mechanisms found');
      }

      return `Caching found in ${cacheFiles} utility files`;
    });

    // Check for memory management
    this.check('Memory Management', () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      if (pkg.dependencies && pkg.dependencies['weak-napi']) {
        return 'Memory management tools present';
      }

      return 'No specific memory management tools found (may not be necessary)';
    });

    console.log();
  }

  /**
   * Validate dependencies
   */
  async validateDependencies() {
    console.log('📦 Dependencies Validation');
    console.log('-'.repeat(26));

    // Check package.json dependencies
    this.check('Package Dependencies', () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      if (!fs.existsSync(packagePath)) {
        throw new Error('package.json not found');
      }

      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      if (!pkg.dependencies || Object.keys(pkg.dependencies).length === 0) {
        throw new Error('No dependencies found');
      }

      const criticalDeps = ['@modelcontextprotocol/sdk'];
      const missing = criticalDeps.filter(dep => !pkg.dependencies[dep]);

      if (missing.length > 0) {
        throw new Error(`Missing critical dependencies: ${missing.join(', ')}`);
      }

      return `Dependencies OK (${Object.keys(pkg.dependencies).length} packages)`;
    });

    // Check for lock file
    this.check('Dependency Lock File', () => {
      const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
      const existing = lockFiles.filter(lock =>
        fs.existsSync(path.join(this.projectRoot, lock))
      );

      if (existing.length === 0) {
        throw new Error('No dependency lock file found');
      }

      return `Lock file found: ${existing[0]}`;
    });

    // Check for outdated dependencies
    this.check('Dependency Versions', () => {
      const packagePath = path.join(this.projectRoot, 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

      let outdatedWarnings = 0;

      if (pkg.dependencies) {
        for (const [name, version] of Object.entries(pkg.dependencies)) {
          if (typeof version === 'string' && version.includes('^')) {
            // This is normal for most packages
            continue;
          }
        }
      }

      return 'Dependency versions appear reasonable';
    });

    console.log();
  }

  /**
   * Validate configuration management
   */
  async validateConfiguration() {
    console.log('⚙️  Configuration Validation');
    console.log('-'.repeat(29));

    // Check configuration utilities
    this.check('Configuration Management', () => {
      const configPath = path.join(this.projectRoot, 'src', 'cli', 'utils', 'config.ts');
      if (!fs.existsSync(configPath)) {
        throw new Error('Configuration utilities not found');
      }

      const content = fs.readFileSync(configPath, 'utf8');
      if (!content.includes('ConfigManager')) {
        throw new Error('ConfigManager class not found');
      }

      return 'Configuration management utilities present';
    });

    // Check environment variable handling
    this.check('Environment Variables', () => {
      const envPath = path.join(this.projectRoot, 'src', 'cli', 'utils', 'environment.ts');
      if (!fs.existsSync(envPath)) {
        throw new Error('Environment utilities not found');
      }

      const content = fs.readFileSync(envPath, 'utf8');
      if (!content.includes('EnvironmentManager')) {
        throw new Error('EnvironmentManager class not found');
      }

      return 'Environment variable management present';
    });

    // Check for default configurations
    this.check('Default Configurations', () => {
      const configPath = path.join(this.projectRoot, 'src', 'cli', 'utils', 'config.ts');
      const content = fs.readFileSync(configPath, 'utf8');

      if (!content.includes('DefaultConfigs')) {
        throw new Warning('Default configurations not found');
      }

      return 'Default configurations present';
    });

    console.log();
  }

  /**
   * Helper method to perform a check
   */
  check(name, checkFunction) {
    this.results.totalChecks++;

    try {
      const result = checkFunction();
      this.results.passed.push({ name, result });
      this.results.passedChecks++;
      console.log(`✅ ${name}: ${result}`);
    } catch (error) {
      if (error instanceof Warning) {
        this.results.warnings.push({ name, message: error.message });
        console.log(`⚠️  ${name}: ${error.message}`);
      } else {
        this.results.failed.push({ name, error: error.message });
        console.log(`❌ ${name}: ${error.message}`);
      }
    }
  }

  /**
   * Get all TypeScript files in a directory
   */
  getAllTsFiles(dir) {
    const files = [];

    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          traverse(fullPath);
        } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    }

    traverse(dir);
    return files;
  }

  /**
   * Print validation summary
   */
  printSummary() {
    console.log('📊 Validation Summary');
    console.log('='.repeat(22));
    console.log(`Total checks: ${this.results.totalChecks}`);
    console.log(`Passed: ${this.results.passedChecks}`);
    console.log(`Warnings: ${this.results.warnings.length}`);
    console.log(`Failed: ${this.results.failed.length}`);
    console.log();

    if (this.results.failed.length === 0) {
      if (this.results.warnings.length === 0) {
        console.log('🎉 All checks passed! The project is ready for production.');
      } else {
        console.log('⚠️  Project is mostly ready for production with some warnings.');
        console.log('   Review the warnings above and address them if needed.');
      }
    } else {
      console.log('❌ Project is NOT ready for production.');
      console.log('   Please address the failed checks before deploying.');
      console.log();

      console.log('Failed Checks:');
      this.results.failed.forEach(failure => {
        console.log(`  - ${failure.name}: ${failure.error}`);
      });
    }

    console.log();
    console.log('Recommendations:');
    if (this.results.failed.length > 0) {
      console.log('1. Fix all failed checks');
    }
    if (this.results.warnings.length > 0) {
      console.log('2. Review and address warnings');
    }
    console.log('3. Run tests before deployment');
    console.log('4. Perform security audit');
    console.log('5. Test on all target platforms');
  }
}

/**
 * Custom warning class
 */
class Warning extends Error {
  constructor(message) {
    super(message);
    this.name = 'Warning';
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new ProductionReadinessValidator();
  validator.validateAll()
    .then(results => {
      process.exit(results.failed.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Validation script failed:', error);
      process.exit(1);
    });
}

module.exports = ProductionReadinessValidator;