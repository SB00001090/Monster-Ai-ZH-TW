import pytest

from monster_ai.config import FirewallSettings, NotificationSettings
from monster_ai.protection.firewall import FirewallEngine
from monster_ai.protection.rules import score_request


@pytest.fixture
def firewall(tmp_path):
    fw = FirewallSettings(
        enabled=True,
        mode="active",
        block_threshold=80,
        learn_threshold=50,
        whitelist_ips=["127.0.0.1"],
    )
    return FirewallEngine(fw, NotificationSettings(), data_dir=tmp_path / "security")


@pytest.mark.asyncio
async def test_whitelist_allows_localhost(firewall):
    allowed, reason = await firewall.check_request(
        ip="127.0.0.1", path="/api/test", method="GET"
    )
    assert allowed is True
    assert reason == "whitelisted"


@pytest.mark.asyncio
async def test_path_traversal_blocked(firewall):
    allowed, reason = await firewall.check_request(
        ip="10.0.0.99",
        path="/../../etc/passwd",
        method="GET",
        query="x=..%2f..",
    )
    assert allowed is False
    assert reason == "blocked"


def test_score_injection_pattern():
    result = score_request(
        path="/api/chat",
        body_preview="<script>alert(1)</script>",
        method="POST",
    )
    assert result.score >= 70
    assert "injection_pattern" in result.reasons


@pytest.mark.asyncio
async def test_learning_mode_logs_without_block(tmp_path):
    fw = FirewallSettings(
        enabled=True,
        mode="learning",
        block_threshold=80,
        learn_threshold=50,
    )
    engine = FirewallEngine(fw, NotificationSettings(), data_dir=tmp_path / "sec")
    allowed, reason = await engine.check_request(
        ip="10.0.0.50",
        path="/api/chat",
        body_preview="<script>x</script>",
        method="POST",
    )
    assert allowed is True
    assert reason == "ok"
    assert engine.state.learned_count >= 1