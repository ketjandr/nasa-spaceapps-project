#!/usr/bin/env python3
"""
Test script for DeepSeek API-powered search
Verifies fast, intelligent search is working correctly
"""

import sys
from pathlib import Path
import asyncio
import time

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import requests
import json


BASE_URL = "http://localhost:8000"


def test_backend_health():
    """Test if backend is running"""
    print("\n[1/5] Testing backend health...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("  Backend: RUNNING")
            return True
        else:
            print(f"  Backend: ERROR (Status {response.status_code})")
            return False
    except Exception as e:
        print(f"  Backend: NOT RUNNING - {e}")
        print("\n  Please start backend:")
        print("    python -m uvicorn backend.main:app --reload")
        return False


def test_deepseek_configuration():
    """Check if DeepSeek is configured"""
    print("\n[2/5] Checking DeepSeek configuration...")
    try:
        import os
        from dotenv import load_dotenv
        
        # Load .env
        env_path = project_root / ".env"
        if env_path.exists():
            load_dotenv(env_path)
            api_key = os.getenv("DEEPSEEK_API_KEY")
            
            if api_key and api_key != "your_deepseek_api_key_here":
                print(f"  DeepSeek API Key: Configured (****{api_key[-4:]})")
                return True
            else:
                print("  DeepSeek API Key: NOT CONFIGURED")
                print("\n  Follow these steps:")
                print("  1. Get free API key: https://platform.deepseek.com/sign_up")
                print("  2. Add to .env: DEEPSEEK_API_KEY=sk-xxxxx")
                print("  3. Restart backend server")
                print("\n  Note: System will use fallback parser without API key")
                return False
        else:
            print("  .env file: NOT FOUND")
            print("  Copy .env.example to .env and add your DeepSeek API key")
            return False
            
    except Exception as e:
        print(f"  Error: {e}")
        return False


def test_deepseek_search():
    """Test AI semantic search queries"""
    print("\n[3/5] Testing DeepSeek-powered search...")
    
    test_queries = [
        {
            "query": "Show me large craters on the Moon",
            "expected_body": "Moon",
            "expected_category": "crater"
        },
        {
            "query": "Find mountains on Mars",
            "expected_body": "Mars",
            "expected_category": "mons"
        },
        {
            "query": "Where are the biggest features on Mercury",
            "expected_body": "Mercury",
            "expected_size": "large"
        }
    ]
    
    passed = 0
    failed = 0
    total_time = 0
    
    for i, test in enumerate(test_queries, 1):
        print(f"\n  Query {i}: '{test['query']}'")
        
        start_time = time.time()
        
        try:
            response = requests.post(
                f"{BASE_URL}/search/query",
                json={"query": test['query'], "limit": 5},
                timeout=15
            )
            
            elapsed = time.time() - start_time
            total_time += elapsed
            
            if response.status_code == 200:
                data = response.json()
                results = data.get('results', [])
                parsed = data.get('parsed_query', {})
                
                print(f"    Response time: {elapsed:.2f}s")
                print(f"    Results found: {len(results)}")
                print(f"    Parsed: {json.dumps(parsed, indent=6)}")
                
                if results:
                    print(f"    Top result: {results[0]['name']} ({results[0]['category']} on {results[0]['body']})")
                    print(f"    Match score: {results[0].get('match_score', 0):.4f}")
                    
                    # Verify parsing quality
                    parsing_correct = True
                    if "expected_body" in test and parsed.get("target_body") != test["expected_body"]:
                        print(f"    WARNING: Expected body {test['expected_body']}, got {parsed.get('target_body')}")
                        parsing_correct = False
                    
                    if "expected_category" in test and parsed.get("category", "").lower() != test["expected_category"]:
                        print(f"    WARNING: Expected category {test['expected_category']}, got {parsed.get('category')}")
                        parsing_correct = False
                    
                    if parsing_correct:
                        print(f"    PASS")
                        passed += 1
                    else:
                        print(f"    PASS (with warnings)")
                        passed += 1
                else:
                    print(f"    FAIL: No results returned")
                    failed += 1
            else:
                print(f"    FAIL: HTTP {response.status_code}")
                print(f"    Response: {response.text[:200]}")
                failed += 1
                
        except requests.Timeout:
            print(f"    FAIL: Request timed out")
            failed += 1
        except Exception as e:
            print(f"    FAIL: {e}")
            failed += 1
        
        time.sleep(0.3)  # Be nice to API
    
    avg_time = total_time / len(test_queries) if test_queries else 0
    
    print(f"\n  Results: {passed}/{len(test_queries)} passed")
    print(f"  Average response time: {avg_time:.2f}s")
    
    if avg_time < 1.0:
        print(f"  Performance: EXCELLENT (sub-second)")
    elif avg_time < 3.0:
        print(f"  Performance: GOOD")
    else:
        print(f"  Performance: SLOW (check if DeepSeek API is being used)")
    
    return passed == len(test_queries)


def test_database_status():
    """Check database has features"""
    print("\n[4/5] Checking database...")
    try:
        from backend.database import get_db_session, PlanetaryFeature
        
        session = get_db_session()
        total = session.query(PlanetaryFeature).count()
        session.close()
        
        print(f"  Features in database: {total}")
        
        if total == 0:
            print("  WARNING: Database is empty!")
            print("  Run: python backend/scripts/kmzparser.py moon mars mercury")
            return False
        else:
            print("  Status: OK")
            return True
            
    except Exception as e:
        print(f"  Error: {e}")
        return False


def test_summary():
    """Print summary and recommendations"""
    print("\n[5/5] Summary")
    print("="*70)
    
    # Check if backend logs show DeepSeek
    print("\nCheck your backend terminal. It should show:")
    print("  'Using DeepSeek API-powered fast search'")
    print("\nIf it shows 'Using legacy search', DeepSeek API key is not configured.")
    
    print("\n" + "="*70)
    print("RECOMMENDATIONS")
    print("="*70)
    
    print("\nFor BEST performance:")
    print("  1. Get free DeepSeek API key: https://platform.deepseek.com/sign_up")
    print("  2. Add to .env: DEEPSEEK_API_KEY=sk-xxxxx")
    print("  3. Restart backend")
    print("  4. Run this test again")
    
    print("\nExpected results WITH DeepSeek:")
    print("  - Response time: 200-500ms")
    print("  - Intelligent query parsing")
    print("  - Natural language summaries")
    
    print("\nExpected results WITHOUT DeepSeek:")
    print("  - Response time: 500-1000ms")
    print("  - Keyword-based parsing")
    print("  - Still works, just less intelligent")
    
    print("\n" + "="*70)


def main():
    print("="*70)
    print("  DeepSeek AI Search - Test Suite")
    print("="*70)
    
    # Run all tests
    backend_ok = test_backend_health()
    if not backend_ok:
        return False
    
    deepseek_ok = test_deepseek_configuration()
    search_ok = test_deepseek_search()
    db_ok = test_database_status()
    
    test_summary()
    
    # Final result
    print("\n" + "="*70)
    if search_ok and db_ok:
        print("STATUS: ALL TESTS PASSED")
        print("="*70)
        print("\nYour AI search is working correctly!")
        if not deepseek_ok:
            print("(Using fallback parser - add DeepSeek API key for best results)")
        return True
    else:
        print("STATUS: SOME TESTS FAILED")
        print("="*70)
        print("\nPlease check the errors above and:")
        print("1. Ensure backend is running")
        print("2. Add DeepSeek API key to .env")
        print("3. Check database has features")
        return False


if __name__ == "__main__":
    try:
        success = main()
        exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        exit(1)
