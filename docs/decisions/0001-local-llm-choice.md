# ADR 0001: Local LLM Model Choice

## Status
Accepted

## Context
Vaada requires natural language understanding for two critical tasks:
1. Interpreting ambiguous customer replies in natural English, Hindi, and code-mixed Hinglish to extract structured `PromiseCommitment` models (`amount`, `promised_date`, `confidence`, `language_mix`).
2. Performing fallback root-cause classification when payment failure codes are ambiguous or free-text notes are provided.

We evaluated two open-weights 7B-class local LLM options for local VRAM serving (Ollama GGUF Q4_K_M):
- **Qwen2.5-7B-Instruct** (Alibaba Cloud / open weights)
- **OpenHathi-7B** (Sarvam AI)

## Decision
We selected **Qwen2.5-7B-Instruct** served locally via Ollama as the primary LLM engine.

### Rationale
1. **Instruction Following & JSON Schema Enforcement**: Qwen2.5-7B-Instruct excels at strict JSON format adherence and system prompt compliance out of the box, whereas OpenHathi-7B is released primarily as a base model requiring task-specific instruction tuning.
2. **Multilingual Hinglish Capabilities**: Qwen2.5 demonstrates strong multilingual tokenization and comprehension across Devanagari Hindi, Romanized Hindi (Hinglish), and Indian English.
3. **Engineered Failover**: All model interactions are routed strictly through the `LLMClient` abstraction. When Ollama is offline or uninstalled, `LLMClient` gracefully degrades to deterministic rule-based regex parsing and sets the case state to `needs_human_review`.

## Consequences
- **Future Fine-tuning Path**: OpenHathi-7B remains documented as the primary target for future fine-tuning on proprietary Indian merchant WhatsApp transcript datasets once specialized instruction datasets are labeled.
- **Single Component Boundary**: No module calls Ollama or HTTP directly; swapping model providers requires changing only `LLMClient` configuration.
