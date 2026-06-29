# Contributing to Monster AI

Thank you for helping build a local-first, open-source AI platform.

## Getting started

1. Fork the repository and clone your fork.
2. Create a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   source .venv/bin/activate  # Linux/macOS
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```
4. Run tests:
   ```bash
   pytest
   ```

## Project structure

- `monster_ai/core/` — self-repair, health checks
- `monster_ai/llm/` — LLM backends (Ollama, fallback)
- `monster_ai/api/` — HTTP and WebSocket routes
- `monster_ai/modules/` — optional feature modules (image, Discord, TTS, training)
- `monster_ai/web/static/` — web UI

## How to add a module

1. Create a folder under `monster_ai/modules/your_module/`.
2. Implement a `service.py` with an async `health()` method.
3. Register it in `monster_ai/modules/registry.py`.
4. Add an `enabled` flag in `config.yaml`.
5. Document it in `README.md`.

## Code style

- Python 3.11+
- Type hints on public functions
- Keep modules small and focused
- No cloud dependencies in core code

## Pull requests

- One feature or fix per PR
- Include tests when changing core logic
- Update README if user-facing behavior changes
- Describe VRAM/GPU impact if touching LLM or image code

## Reporting issues

Include:
- OS and GPU model
- Python version
- Ollama version (`ollama --version`)
- Relevant logs from `data/logs/`
- Steps to reproduce