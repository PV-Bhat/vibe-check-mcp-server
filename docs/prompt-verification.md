# Prompt Verification and Security Best Practices

## Overview

Vibe Check MCP uses a centralized prompt management system to ensure transparency, traceability, and security. All prompts used by the system are stored in markdown files and loaded through a configuration system, making them easily auditable and resistant to malicious prompt injection.

## Prompt Management Architecture

### Directory Structure

```
config/
├── prompts.json              # Central prompt configuration
└── prompts/
    ├── meta-mentor-system.md         # Main system prompt for meta-mentor
    ├── fallback-questions-llm.md     # Fallback when LLM API fails
    └── fallback-questions-tool.md    # Fallback when tool errors occur
```

### Configuration File

The `config/prompts.json` file contains:
- **Path references** to each prompt markdown file
- **Metadata** including version, description, and last modified date
- **Settings** for prompt validation and security controls

### Prompt Loading System

The `src/utils/prompts.ts` module provides:
- **Centralized loading**: All prompts are loaded through `getPrompt(key)` function
- **Caching**: Prompts are cached in memory to improve performance
- **Validation**: `validatePrompts()` ensures all configured prompts exist and are readable
- **Metadata access**: `getPromptMetadata(key)` provides version and configuration details

## Security Features

### 1. **No Dynamic Prompt Generation**

All prompts are stored as static files in the repository. This ensures:
- **Traceability**: Every prompt change is tracked in version control
- **Auditability**: Anyone can review the exact prompts being used
- **Immutability**: Prompts cannot be modified at runtime without filesystem access

### 2. **Prompt Isolation**

The system separates prompts from code:
- Prompts are stored in dedicated markdown files
- Code references prompts by configuration keys, not inline strings
- Changes to prompts don't require code changes

### 3. **Version Tracking**

Each prompt configuration includes:
- Version number following semantic versioning
- Last modified date
- Description of the prompt's purpose

### 4. **Configuration Validation**

The `validatePrompts()` function can be run to ensure:
- All configured prompts exist on the filesystem
- All prompt files are readable
- No broken references in the configuration

## Verification Procedures

### Pre-Deployment Checklist

Before deploying or releasing a new version:

1. **Review Prompt Changes**
   ```bash
   git diff config/prompts/
   ```
   Examine any modifications to prompt files for:
   - Unintended behavioral changes
   - Potential injection vectors
   - Alignment with system goals

2. **Validate Configuration**
   Run the validation function in your test suite or manually:
   ```typescript
   import { validatePrompts } from './src/utils/prompts.js';
   const result = validatePrompts();
   if (!result.valid) {
     console.error('Prompt validation failed:', result.errors);
   }
   ```

3. **Check Version Metadata**
   Ensure `config/prompts.json` has updated version numbers and dates for modified prompts.

4. **Review Git History**
   ```bash
   git log --follow config/prompts/meta-mentor-system.md
   ```
   Verify all changes have legitimate commit messages and authors.

### Runtime Verification

During system operation:

1. **Enable Prompt Usage Logging** (optional)
   Set `logPromptUsage: true` in `config/prompts.json` to log each prompt load.

2. **Monitor Prompt Access**
   Check application logs for unexpected prompt loading patterns.

3. **Integrity Checks**
   Implement file integrity monitoring (e.g., checksums) on the `config/prompts/` directory.

## Threat Model & Mitigation

### Threat: Malicious Prompt Modification

**Attack Vector**: An attacker gains write access to the filesystem and modifies prompt files.

**Mitigation**:
- Use proper file system permissions (read-only for application process)
- Implement file integrity monitoring (FIM) tools
- Deploy from version-controlled sources only
- Use container immutability in production environments

### Threat: Prompt Injection via User Input

**Attack Vector**: User-supplied data is interpolated into prompts, allowing injection attacks.

**Mitigation**:
- User input is passed as separate context parameters, NOT embedded in system prompts
- The meta-mentor system prompt is completely static
- Context is clearly separated from instructions in the LLM call structure

### Threat: Configuration File Tampering

**Attack Vector**: Attacker modifies `config/prompts.json` to point to malicious prompt files.

**Mitigation**:
- Configuration files should be deployed from trusted sources
- File permissions should prevent runtime modification
- Consider signing configuration files in high-security deployments

### Threat: Path Traversal

**Attack Vector**: Attacker crafts a malicious path in configuration to read arbitrary files.

**Mitigation**:
- The `loadPromptFromFile()` function uses `join()` to construct paths safely
- Paths are relative to a known base directory
- Consider adding path validation to ensure all prompts are in `config/prompts/`

## Best Practices for Prompt Development

### 1. **Maintain Clear Intent**

Each prompt should:
- Have a single, well-defined purpose
- Include comments or metadata explaining its role
- Avoid mixing concerns (e.g., don't combine system instructions with fallback messages)

### 2. **Use Markdown Formatting**

- Store prompts in markdown format for readability
- Use headers, lists, and formatting to structure complex prompts
- The loader automatically strips the title header for clean processing

### 3. **Version Control Discipline**

- Make prompt changes in dedicated commits
- Use descriptive commit messages explaining the rationale
- Tag major prompt revisions in version control

### 4. **Test Prompt Changes**

Before committing prompt modifications:
- Test with representative agent scenarios
- Verify the tone and guidance align with meta-mentor philosophy
- Ensure fallback prompts still provide useful guidance

### 5. **Document Prompt Rationale**

In `config/prompts.json`, use the `description` field to explain:
- What the prompt is used for
- Why specific phrasing was chosen
- Any dependencies or integration points

## Code Examples

### Loading a Prompt

```typescript
import { getPrompt } from './utils/prompts.js';

// Retrieve the meta-mentor system prompt
const systemPrompt = getPrompt('metaMentorSystem');

// Use in LLM call
const response = await llm.generate({
  systemPrompt,
  userContext: context
});
```

### Validating Prompts on Startup

```typescript
import { validatePrompts } from './utils/prompts.js';

export async function startServer() {
  const validation = validatePrompts();
  if (!validation.valid) {
    console.error('Prompt validation failed:', validation.errors);
    throw new Error('Cannot start server with invalid prompt configuration');
  }
  
  // Continue with server initialization...
}
```

### Getting Prompt Metadata

```typescript
import { getPromptMetadata } from './utils/prompts.js';

const metadata = getPromptMetadata('metaMentorSystem');
console.log(`Using prompt version: ${metadata?.version}`);
console.log(`Last updated: ${metadata?.lastModified}`);
```

## Compliance and Auditing

### Audit Trail

All prompt changes are tracked in Git, providing:
- **Who** made the change (commit author)
- **When** it was made (commit timestamp)
- **Why** it was made (commit message)
- **What** changed (diff)

### Compliance Reporting

For compliance requirements, you can generate reports:

```bash
# List all prompt files with last modification
ls -la config/prompts/

# Get full change history
git log --all --full-history -- config/prompts/

# Generate a compliance report
git log --pretty=format:"%h - %an, %ar : %s" -- config/prompts/ > prompt-audit-trail.txt
```

### Third-Party Review

To facilitate external security audits:
1. Share the `config/prompts/` directory
2. Provide access to `config/prompts.json` for context
3. Include this documentation for understanding the security model
4. Grant read-only access to the Git history for prompt files

## Future Enhancements

Potential improvements to the prompt security model:

1. **Prompt Signing**: Cryptographically sign prompt files to detect tampering
2. **Schema Validation**: Add JSON Schema validation for prompt configuration
3. **Hot Reloading**: Allow prompt updates without server restart (with proper security controls)
4. **A/B Testing**: Support multiple prompt versions for experimentation
5. **Prompt Metrics**: Track usage, effectiveness, and failure rates per prompt

## References

- [OWASP LLM Top 10 - Prompt Injection](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)
- [NIST Guidelines for AI Security](https://www.nist.gov/artificial-intelligence)

## Contact

For security concerns related to prompt management:
- Open a GitHub issue tagged with `security`
- Follow the responsible disclosure process outlined in `SECURITY.md`
- Contact the maintainers directly for critical vulnerabilities
