#!/usr/bin/env python3
"""Verify backend functionality"""

print("Starting verification...")

try:
    # Test basic imports
    import httpx
    print("✅ httpx imported")
    
    import fastapi
    print("✅ fastapi imported")
    
    import structlog
    print("✅ structlog imported")
    
    # Test our modules
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent))
    
    from python_backend.app.utils.logger import get_logger
    print("✅ logger imported")
    
    from python_backend.app.models.dto import OrderBook
    print("✅ DTOs imported")
    
    from python_backend.app.services.cache_manager import TTLCache
    print("✅ Cache imported")
    
    # Test basic functionality
    cache = TTLCache()
    cache.set("test", "value")
    assert cache.get("test") == "value"
    print("✅ Cache works")
    
    print("✅ All basic tests passed!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
