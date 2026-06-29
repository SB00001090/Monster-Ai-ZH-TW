"""CrimeGuard — HK crime prevention with device contact + VPN + network lock."""
from monster_ai.protection.crimeguard.device_contact import DeviceContactScanResult, scan_device_contact
from monster_ai.protection.crimeguard.engine import CrimeGuardEngine

__all__ = ["CrimeGuardEngine", "DeviceContactScanResult", "scan_device_contact"]