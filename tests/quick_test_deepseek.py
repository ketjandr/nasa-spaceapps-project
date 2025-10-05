#!/usr/bin/env python3
"""
Quick test of DeepSeek integration
Run this AFTER adding API key to test everything works
"""

import sys
from pathlib import Path
import asyncio

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

print("="*70)
print("  Quick DeepSeek Test")
print("="*70)

# Test 1: Check API key
print("\n[1/4] Checking DeepSeek API key...")
try:
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    api_key = os.getenv("DEEPSEEK_API_KEY")
    
    if api_key and api_key != "your_deepseek_api_key_here":
        print(f"  API Key: Configured (****{api_key[-4:]})")
    else:
        print("  API Key: NOT SET")
        print("\n  Run: python setup_deepseek.py")
        exit(1)
except Exception as e:
    print(f"  Error: {e}")
    exit(1)

# Test 2: Test DeepSeek service directly
print("\n[2/4] Testing DeepSeek service...")
try:
    from backend.deepseek_service import parse_query_with_deepseek
    
    async def test_parse():
        result = await parse_query_with_deepseek("Show me large craters on the Moon")
        return result
    
    result = asyncio.run(test_parse())
    print(f"  Query parsed: {result.get('target_body')} - {result.get('category')}")
    print(f"  Confidence: {result.get('confidence', 0):.2f}")
    print(f"  Status: WORKING")
except Exception as e:
    print(f"  Error: {e}")
    print("  DeepSeek API might be having issues - will use fallback")

# Test 3: Check database
print("\n[3/4] Checking database...")
try:
    from backend.database import get_db_session, PlanetaryFeature
    
    session = get_db_session()
    total = session.query(PlanetaryFeature).count()
    session.close()
    
    print(f"  Features: {total}")
    if total > 0:
        print(f"  Status: READY")
    else:
        print(f"  Status: EMPTY - Run parser first")
except Exception as e:
    print(f"  Error: {e}")

# Test 4: Instructions
print("\n[4/4] Next Steps")
print("="*70)
print("\nStart backend in a new terminal:")
print("  python -m uvicorn backend.main:app --reload")
print("\nYou should see:")
print("  'Using DeepSeek API-powered fast search'")
print("\nThen run full test:")
print("  python tests/test_deepseek_search.py")
print("\n" + "="*70)
print("Ready to test! Start the backend now.")
print("="*70)
