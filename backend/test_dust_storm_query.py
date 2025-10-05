"""Test script to verify AI service can handle event queries like 'show me dust storms in mars'."""

import asyncio
import json
from ai_service import parse_natural_query, generate_embedding, cosine_similarity


async def test_dust_storm_query():
    """Test various event and feature queries."""
    
    print("=" * 80)
    print("Testing AI Service Query Parsing and Embedding Generation")
    print("=" * 80)
    
    # Test queries
    test_queries = [
        "show me dust storms in mars",
        "show me dust storms on mars",
        "martian dust storms",
        "dust storms on the red planet",
        "large craters on the moon",
        "lunar mountains",
        "wildfires on earth",
        "volcanic eruptions on mars",
    ]
    
    for query in test_queries:
        print(f"\n{'─' * 80}")
        print(f"Query: '{query}'")
        print(f"{'─' * 80}")
        
        # Test parsing
        parsed = await parse_natural_query(query)
        print("\nParsed Query:")
        print(json.dumps(parsed, indent=2))
        
        # Test embedding generation
        try:
            embedding = await generate_embedding(query)
            print(f"\nEmbedding Generated: ✓")
            print(f"Dimension: {len(embedding)}")
            print(f"First 5 values: {[round(x, 4) for x in embedding[:5]]}")
        except Exception as e:
            print(f"\nEmbedding Generation Failed: ✗")
            print(f"Error: {e}")
    
    # Test semantic similarity between event-related queries
    print("\n" + "=" * 80)
    print("Testing Semantic Similarity")
    print("=" * 80)
    
    query1 = "dust storms on mars"
    query2 = "martian sandstorms"
    query3 = "lunar craters"
    
    emb1 = await generate_embedding(query1)
    emb2 = await generate_embedding(query2)
    emb3 = await generate_embedding(query3)
    
    sim_related = cosine_similarity(emb1, emb2)
    sim_unrelated = cosine_similarity(emb1, emb3)
    
    print(f"\nSimilarity between '{query1}' and '{query2}': {sim_related:.4f}")
    print(f"Similarity between '{query1}' and '{query3}': {sim_unrelated:.4f}")
    
    if sim_related > sim_unrelated:
        print("✓ Related queries have higher similarity (expected behavior)")
    else:
        print("✗ Warning: Related queries have lower similarity than unrelated ones")
    
    print("\n" + "=" * 80)
    print("Test Complete")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(test_dust_storm_query())
