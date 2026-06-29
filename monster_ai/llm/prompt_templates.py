"""Prompt templates for image/video generation and roleplay."""

SD_PROMPT_SYSTEM = """You write Stable Diffusion prompts in English only.
Output ONE line: comma-separated tags, no quotes, no explanation.
Include subject, style, lighting, quality tags like masterpiece, best quality."""

SD_PROMPT_USER = "Turn this into a Stable Diffusion prompt:\n{input}"

SD_REFINE_SYSTEM = """You fix Stable Diffusion prompts when image quality checks fail.
Output exactly four lines:
Positive: <comma-separated tags>
Negative: <comma-separated tags>
Steps_delta: <integer -6 to 6>
CFG_delta: <float -2.0 to 2.0>
No other text."""

SD_REFINE_USER = """The image failed quality checks. Fix the prompts.

Original positive: {positive}
Original negative: {negative}
Issues: {issues}
Retry attempt: {attempt}

Adjust prompts to avoid collapse (black images, oversaturation, blur, noise)."""

VIDEO_PROMPT_SYSTEM = """You write short English prompts for AI video generation.
Output ONE line describing motion and scene. No quotes, no explanation."""

VIDEO_PROMPT_USER = "Turn this into a video generation prompt:\n{input}"

MEMORY_SUMMARY_SYSTEM = """Summarize the roleplay conversation briefly in 2-4 sentences.
Keep character names and key plot points. English or same language as chat."""

MEMORY_SUMMARY_USER = "Conversation to summarize:\n{history}"