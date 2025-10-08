/**
 * Simple test to verify configuration utilities work correctly
 */

import { platform } from './platform.js';
import { ConfigManager, DefaultConfigs } from './config.js';
import { EnvironmentManager } from './environment.js';

async function testConfigurationSystem() {
  console.log('Testing Configuration Management System');
  console.log('=====================================');

  // Test platform utilities
  console.log('\n1. Platform Information:');
  console.log(`   Platform: ${platform.platform}`);
  console.log(`   Architecture: ${platform.arch}`);
  console.log(`   Is Windows: ${platform.isWindows}`);
  console.log(`   Config Directory: ${platform.getUserConfigDir()}`);
  console.log(`   Data Directory: ${platform.getUserDataDir()}`);
  console.log(`   Cache Directory: ${platform.getUserCacheDir()}`);

  // Test configuration manager
  console.log('\n2. Configuration Manager Test:');
  try {
    const configManager = new ConfigManager({
      configName: 'test-config',
      defaultConfig: DefaultConfigs.cli
    });

    const config = configManager.read();
    console.log(`   Config loaded successfully: ${config.version}`);
    console.log(`   Config path: ${configManager.getConfigPath()}`);
    console.log(`   Backup directory: ${configManager.getBackupDir()}`);
    console.log(`   Config exists: ${configManager.exists()}`);
  } catch (error) {
    console.log(`   Config test failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Test environment manager
  console.log('\n3. Environment Manager Test:');
  try {
    const envManager = new EnvironmentManager({
      appName: 'vibe-check-mcp-test'
    });

    const summary = envManager.getConfigurationSummary();
    console.log(`   Available providers: ${summary.providers.join(', ')}`);
    console.log(`   Providers with API keys: ${summary.hasApiKeys.join(', ')}`);
    console.log(`   Log level: ${summary.global.logLevel}`);
    console.log(`   Config files: ${summary.configFiles.join(', ')}`);

    const apiKeyStatus = envManager.checkApiKeys();
    console.log('   API Key Status:');
    for (const [provider, hasKey] of Object.entries(apiKeyStatus)) {
      console.log(`     ${provider}: ${hasKey ? '✓' : '✗'}`);
    }
  } catch (error) {
    console.log(`   Environment test failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log('\nConfiguration system test completed!');
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConfigurationSystem().catch(console.error);
}

export { testConfigurationSystem };