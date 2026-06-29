"""ComfyUI text-to-video — outputs .mp4 only, no leftover frame images."""
from __future__ import annotations

import logging
import shutil
import subprocess
import uuid
from pathlib import Path
from typing import Any

from monster_ai.config import Settings
from monster_ai.core.generation_history import GenerationHistory
from monster_ai.core.generation_repair import GenerationRepair, validate_video_file
from monster_ai.core.progress import GenerationProgress
from monster_ai.core.self_repair import SelfRepairEngine
from monster_ai.core.vram_guard import VramGuard
from monster_ai.modules.image.comfyui import ComfyUIClient, ImageService
from monster_ai.modules.prompt.anti_collapse import build_negative
from monster_ai.modules.prompt.enhancer import PromptEnhancer
from monster_ai.modules.video.comfyui_video import build_animatediff_workflow, has_animatediff

logger = logging.getLogger(__name__)


class VideoService:
    name = "video"

    def __init__(
        self,
        settings: Settings,
        repair: SelfRepairEngine,
        gen_repair: GenerationRepair,
        vram_guard: VramGuard,
        prompt_enhancer: PromptEnhancer,
        image_service: ImageService,
        progress: GenerationProgress | None = None,
        history: GenerationHistory | None = None,
    ) -> None:
        self.settings = settings
        self.gen_repair = gen_repair
        self.vram_guard = vram_guard
        self.prompt_enhancer = prompt_enhancer
        self.image_service = image_service
        self.progress = progress
        self.client = ComfyUIClient(settings.modules.video.comfyui_url)
        self.output_dir = Path(settings.modules.video.output_dir)
        self.temp_dir = Path(settings.modules.video.temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.history = history

    async def health(self) -> dict[str, Any]:
        if not self.settings.modules.video.enabled:
            return {"enabled": False, "healthy": False, "message": "Module disabled"}
        ok = await self.client.ping()
        ad = await has_animatediff(self.client) if ok else False
        ffmpeg_ok = bool(shutil.which("ffmpeg"))

        if not ok:
            message = "Start ComfyUI on port 8188"
            healthy = False
        elif not ffmpeg_ok:
            message = (
                "ffmpeg not found on PATH — install ffmpeg for .mp4 video output"
            )
            healthy = False
        else:
            message = "ComfyUI ready for video"
            healthy = True

        warning = None
        if ok and self.settings.modules.video.mode == "animatediff" and not ad:
            warning = (
                "AnimateDiff not installed — batch mode falls back to per-frame rendering"
            )

        return {
            "enabled": True,
            "healthy": healthy,
            "message": message,
            "warning": warning,
            "ffmpeg": ffmpeg_ok,
            "mode": self.settings.modules.video.mode,
            "animatediff_plugin": ad,
        }

    def _require_ffmpeg(self) -> None:
        if self.settings.modules.video.require_ffmpeg and not shutil.which("ffmpeg"):
            raise RuntimeError(
                "ffmpeg is required for video generation (mp4 output). "
                "Install ffmpeg and ensure it is on PATH."
            )

    def _make_frames_dir(self) -> Path:
        frames_dir = self.temp_dir / f"frames_{uuid.uuid4().hex}"
        frames_dir.mkdir(parents=True, exist_ok=True)
        return frames_dir

    async def generate(
        self,
        prompt: str,
        *,
        frames: int | None = None,
        fps: int | None = None,
        width: int | None = None,
        height: int | None = None,
    ) -> dict[str, Any]:
        if not self.settings.modules.video.enabled:
            raise RuntimeError("Video module disabled")

        self._require_ffmpeg()
        vid_cfg = self.settings.modules.video
        frame_count = min(frames or vid_cfg.max_frames, vid_cfg.max_frames)
        frame_fps = fps or vid_cfg.fps
        vid_w = width or vid_cfg.width
        vid_h = height or vid_cfg.height

        await self.client.require_online()
        if self.progress:
            self.progress.start("video", frame_count, "Enhancing prompt (LLM)…")
        enhanced = await self.prompt_enhancer.for_video(prompt)
        if self.progress:
            self.progress.set_frame(0, f"ComfyUI rendering {frame_count} frames…")

        mode = vid_cfg.mode
        try:
            if mode == "animatediff":
                try:
                    return await self._generate_batch(
                        enhanced, frame_count, frame_fps, vid_w, vid_h
                    )
                except Exception as exc:
                    logger.warning("Batch video failed, falling back to frames: %s", exc)
                    return await self._generate_frames(
                        enhanced,
                        frame_count,
                        frame_fps,
                        vid_w,
                        vid_h,
                        mode_used="frames_fallback",
                    )
            return await self._generate_frames(
                enhanced, frame_count, frame_fps, vid_w, vid_h, mode_used="frames"
            )
        finally:
            if self.progress:
                self.progress.clear()

    async def _generate_batch(
        self,
        enhanced: str,
        frame_count: int,
        frame_fps: int,
        width: int,
        height: int,
    ) -> dict[str, Any]:
        img_cfg = self.settings.modules.image
        checkpoint, _ = await self.client.resolve_checkpoint_name(img_cfg.checkpoint)

        if self.progress:
            self.progress.set_frame(
                1, f"Batch render {frame_count} frames (wait 30s–3min)…"
            )

        async def _run() -> Path:
            frames_dir = self._make_frames_dir()
            try:
                async with self.vram_guard.acquire("video"):
                    workflow = build_animatediff_workflow(
                        positive=enhanced,
                        negative=build_negative(),
                        checkpoint=checkpoint,
                        frames=frame_count,
                        width=width,
                        height=height,
                        steps=self.settings.modules.video.steps,
                        cfg=img_cfg.cfg,
                    )
                    prompt_id = await self.client.queue_prompt(workflow)
                    images = await self.client.wait_for_images(prompt_id, max_wait=300)
                    for i, img_info in enumerate(images[:frame_count]):
                        dest = frames_dir / f"frame_{i:04d}.png"
                        await self.client.download_image(img_info, dest)
                    if self.progress:
                        self.progress.set_frame(
                            frame_count, "Stitching frames to .mp4 (ffmpeg)…"
                        )
                    return self._stitch_frames(frames_dir, frame_fps)
            finally:
                shutil.rmtree(frames_dir, ignore_errors=True)

        path = await self.gen_repair.run(
            "video",
            _run,
            validate=lambda p: validate_video_file(p) and p.suffix == ".mp4",
        )
        if self.progress:
            self.progress.set_frame(frame_count, "Video ready")
        return self._result(path, enhanced, frame_count, frame_fps, width, height, "animatediff")

    async def _generate_frames(
        self,
        enhanced: str,
        frame_count: int,
        frame_fps: int,
        width: int,
        height: int,
        *,
        mode_used: str,
    ) -> dict[str, Any]:
        img_cfg = self.settings.modules.image
        checkpoint, _ = await self.client.resolve_checkpoint_name(img_cfg.checkpoint)
        neg = build_negative()

        async def _run() -> Path:
            frames_dir = self._make_frames_dir()
            try:
                async with self.vram_guard.acquire("video"):
                    for i in range(frame_count):
                        if self.progress:
                            self.progress.set_frame(
                                i + 1, f"Rendering frame {i + 1}/{frame_count}"
                            )
                        motion = f"{enhanced}, frame {i + 1} of {frame_count}"
                        frame_path = await self.image_service._render_once(
                            positive=motion,
                            negative=neg,
                            checkpoint=checkpoint,
                            width=width,
                            height=height,
                            steps=img_cfg.steps,
                            cfg=img_cfg.cfg,
                            lora_name=None,
                            lora_strength=img_cfg.lora_strength,
                        )
                        dest = frames_dir / f"frame_{i:04d}.png"
                        shutil.copy(frame_path, dest)
                        frame_path.unlink(missing_ok=True)
                    if self.progress:
                        self.progress.set_frame(
                            frame_count, "Stitching frames to .mp4 (ffmpeg)…"
                        )
                    return self._stitch_frames(frames_dir, frame_fps)
            finally:
                shutil.rmtree(frames_dir, ignore_errors=True)

        path = await self.gen_repair.run(
            "video",
            _run,
            validate=lambda p: validate_video_file(p) and p.suffix == ".mp4",
        )
        if self.progress:
            self.progress.set_frame(frame_count, "Video ready")
        return self._result(path, enhanced, frame_count, frame_fps, width, height, mode_used)

    def _stitch_frames(self, frames_dir: Path, frame_fps: int) -> Path:
        self._require_ffmpeg()
        out = self.output_dir / f"{uuid.uuid4().hex}.mp4"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-framerate",
                str(frame_fps),
                "-i",
                str(frames_dir / "frame_%04d.png"),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-movflags",
                "+faststart",
                str(out),
            ],
            check=True,
            capture_output=True,
        )
        return out

    def _result(
        self,
        path: Path,
        enhanced: str,
        frame_count: int,
        frame_fps: int,
        width: int,
        height: int,
        mode: str,
    ) -> dict[str, Any]:
        result = {
            "path": str(path),
            "url": f"/api/generate/files/videos/{path.name}",
            "prompt": enhanced,
            "type": "video",
            "format": "mp4",
            "frames": frame_count,
            "fps": frame_fps,
            "width": width,
            "height": height,
            "mode": mode,
        }
        if self.history:
            self.history.record("video", result)
        return result