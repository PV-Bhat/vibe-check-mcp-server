# API Keys & Secret Management

Vibe Check MCP works with multiple LLM providers. Use this guide to decide which keys you need, how they are discovered, where they are stored, and how to keep them secure.

## Supported providers

- **Anthropic** – `ANTHROPIC_API_KEY`
- **Google Gemini** – `GEMINI_API_KEY`
- **OpenAI** – `OPENAI_API_KEY`
- **OpenRouter** – `OPENROUTER_API_KEY`

Only one key is required to run the server, but you can set more than one to enable provider switching.

## Secret resolution order

When the CLI or server looks up a provider key it evaluates sources in the following order:

1. Existing process environment variables.
2. The current project's `.env` file (pass `--local` to write here).
3. Your home directory config at `~/.vibe-check/.env`.

The first match wins, so values in the shell take priority over project-level overrides, which in turn take priority over the persisted home config.

## Storage locations

- Interactive CLI runs create or update `~/.vibe-check/.env` with `0600` permissions so only your user can read it.
- Supplying `--local` targets the project `.env`, letting you keep per-repository overrides under version control ignore rules.
- Non-interactive runs expect keys to already be available in the environment or the relevant `.env` file; they will exit early if a required key is missing.

## Security recommendations

- Treat `.env` files as secrets: keep them out of version control and shared storage.
- Use the minimal set of provider keys required for your workflow and rotate them periodically.
- Prefer scoped or workspace-specific keys when your provider supports them.
- Restrict file permissions to your user (the CLI enforces this for the home config) and avoid copying secrets into client config files.
