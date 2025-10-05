#!/usr/bin/env python3
"""
Quick check if database has features and embeddings
"""
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

try:
    from backend.database import get_db_session, PlanetaryFeature
    
    session = get_db_session()
    
    # Count total features
    total = session.query(PlanetaryFeature).count()
    print(f"✅ Total features in database: {total}")
    
    # Count features with embeddings
    with_embeddings = session.query(PlanetaryFeature).filter(
        PlanetaryFeature.embedding_data.isnot(None)
    ).count()
    print(f"✅ Features with embeddings: {with_embeddings}")
    
    # Sample a feature to see if embeddings are valid
    if with_embeddings > 0:
        sample = session.query(PlanetaryFeature).filter(
            PlanetaryFeature.embedding_data.isnot(None)
        ).first()
        if sample and sample.embedding_data:
            emb_len = len(sample.embedding_data)
            print(f"✅ Sample embedding dimension: {emb_len}")
            print(f"✅ Sample feature: {sample.feature_name} ({sample.target_body})")
            
            if emb_len != 384:
                print(f"⚠️  WARNING: Expected 384 dimensions, got {emb_len}")
        else:
            print("⚠️  Sample feature has no embedding data")
    
    session.close()
    
    if total == 0:
        print("\n❌ DATABASE IS EMPTY!")
        print("   Run: python backend/scripts/kmzparser.py moon mars mercury")
        print("   Then: python -m backend.scripts.ingest_features")
        sys.exit(1)
    elif with_embeddings == 0:
        print("\n❌ NO EMBEDDINGS FOUND!")
        print("   Run: python -m backend.scripts.ingest_features")
        sys.exit(1)
    elif with_embeddings < total:
        print(f"\n⚠️  Only {with_embeddings}/{total} features have embeddings")
        print("   Consider running: python -m backend.scripts.ingest_features")
    else:
        print("\n✅ Database is ready for AI search!")
        
except Exception as e:
    print(f"❌ Error checking database: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
