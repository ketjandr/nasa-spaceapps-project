"""
Comprehensive test to verify AI service query parsing works correctly.
Tests the parse_natural_query function with various event and feature queries.
"""

import sys
import os
import asyncio
import json

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))


async def test_query_parsing():
    """Test query parsing with the actual parse_natural_query function."""
    
    from ai_service import parse_natural_query, generate_embedding, cosine_similarity
    
    test_cases = [
        # Dust storm queries (the main test case)
        {
            "query": "show me dust storms in mars",
            "expected_type": "event",
            "expected_category": "Dust and Haze",
            "expected_body": "Mars"
        },
        {
            "query": "show me dust storms on mars",
            "expected_type": "event",
            "expected_category": "Dust and Haze",
            "expected_body": "Mars"
        },
        {
            "query": "martian dust storms",
            "expected_type": "event",
            "expected_category": "Dust and Haze",
            "expected_body": "Mars"
        },
        {
            "query": "sandstorms on the red planet",
            "expected_type": "event",
            "expected_category": "Dust and Haze",
            "expected_body": "Mars"
        },
        
        # Other event queries
        {
            "query": "wildfires on earth",
            "expected_type": "event",
            "expected_category": "Wildfires",
            "expected_body": "Earth"
        },
        {
            "query": "volcanic eruptions on mars",
            "expected_type": "event",
            "expected_category": "Volcanoes",
            "expected_body": "Mars"
        },
        
        # Feature queries (should NOT be events)
        {
            "query": "large craters on the moon",
            "expected_type": "feature",
            "expected_category": None,
            "expected_body": "Moon"
        },
        {
            "query": "lunar mountains",
            "expected_type": "feature",
            "expected_category": None,
            "expected_body": "Moon"
        },
        {
            "query": "tycho crater",
            "expected_type": "feature",
            "expected_category": None,
            "expected_body": None
        }
    ]
    
    print("=" * 80)
    print("Testing AI Service Query Parsing")
    print("=" * 80)
    
    passed = 0
    failed = 0
    
    for i, test_case in enumerate(test_cases, 1):
        query = test_case["query"]
        print(f"\n{'─' * 80}")
        print(f"Test {i}/{len(test_cases)}: '{query}'")
        print(f"{'─' * 80}")
        
        try:
            # Parse the query
            result = await parse_natural_query(query)
            print(f"\nParsed Result:")
            print(json.dumps(result, indent=2))
            
            # Check expectations
            checks = []
            
            # Check search type
            if result.get("search_type") == test_case["expected_type"]:
                checks.append(f"✓ Search type: {result.get('search_type')}")
            else:
                checks.append(f"✗ Search type: expected '{test_case['expected_type']}', got '{result.get('search_type')}'")
                failed += 1
            
            # Check event category (only for event searches)
            if test_case["expected_type"] == "event":
                if result.get("event_category") == test_case["expected_category"]:
                    checks.append(f"✓ Event category: {result.get('event_category')}")
                else:
                    checks.append(f"✗ Event category: expected '{test_case['expected_category']}', got '{result.get('event_category')}'")
                    failed += 1
            
            # Check target body
            if test_case["expected_body"]:
                if result.get("target_body") == test_case["expected_body"]:
                    checks.append(f"✓ Target body: {result.get('target_body')}")
                else:
                    checks.append(f"✗ Target body: expected '{test_case['expected_body']}', got '{result.get('target_body')}'")
                    failed += 1
            
            # Print check results
            print("\nValidation:")
            for check in checks:
                print(f"  {check}")
            
            if all(c.startswith("✓") for c in checks):
                passed += 1
                print("\n✓ TEST PASSED")
            else:
                print("\n✗ TEST FAILED")
            
            # Show warning if present
            if "warning" in result:
                print(f"\nWarning: {result['warning']}")
            
        except Exception as e:
            print(f"\n✗ ERROR: {e}")
            failed += 1
    
    # Test embedding generation
    print("\n" + "=" * 80)
    print("Testing Embedding Generation")
    print("=" * 80)
    
    try:
        query1 = "dust storms on mars"
        query2 = "martian sandstorms"
        query3 = "lunar craters"
        
        print(f"\nGenerating embeddings...")
        emb1 = await generate_embedding(query1)
        emb2 = await generate_embedding(query2)
        emb3 = await generate_embedding(query3)
        
        print(f"✓ Embeddings generated (dimension: {len(emb1)})")
        
        # Test similarity
        sim_related = cosine_similarity(emb1, emb2)
        sim_unrelated = cosine_similarity(emb1, emb3)
        
        print(f"\nSemantic Similarity:")
        print(f"  '{query1}' vs '{query2}': {sim_related:.4f}")
        print(f"  '{query1}' vs '{query3}': {sim_unrelated:.4f}")
        
        if sim_related > sim_unrelated:
            print("✓ Related queries have higher similarity")
            passed += 1
        else:
            print("✗ Warning: Related queries have lower similarity than unrelated ones")
            failed += 1
            
    except Exception as e:
        print(f"✗ Embedding generation failed: {e}")
        failed += 1
    
    # Summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total: {passed + failed}")
    
    if failed == 0:
        print("\n✓ ALL TESTS PASSED!")
    else:
        print(f"\n✗ {failed} test(s) failed")
    
    return failed == 0


if __name__ == "__main__":
    success = asyncio.run(test_query_parsing())
    sys.exit(0 if success else 1)
