"""
Ingest planetary features from JSON files into the database with AI embeddings.

This script:
1. Loads feature data from data/features/*.json
2. Generates OpenAI embeddings for each feature
3. Stores features with embeddings in the database

Usage:
    python -m backend.scripts.ingest_features
"""

import json
import asyncio
import os
import sys
from pathlib import Path
from typing import List, Dict, Any
from dotenv import load_dotenv

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Load environment variables from .env file
env_path = project_root / ".env"
if env_path.exists():
    load_dotenv(env_path)
    print(f"✅ Loaded environment from {env_path}")
else:
    print(f"⚠️  No .env file found at {env_path}")
    print("   Looking for BACKEND_OPENAI_API_KEY in environment...")

from backend.database import init_db, get_db_session, PlanetaryFeature
from backend.ai_service import generate_embedding, create_searchable_text
from sqlalchemy.exc import IntegrityError


async def load_features_from_json(json_path: str) -> List[Dict[str, Any]]:
    """Load features from a JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f" Loaded {len(data)} features from {json_path}")
    return data


async def ingest_feature(feature_data: Dict[str, Any], session) -> bool:
    """
    Process and ingest a single feature with embedding.
    
    Args:
        feature_data: Raw feature dictionary
        session: Database session
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Create searchable text
        searchable_text = create_searchable_text(feature_data)
        
        # Generate embedding (validate=False for trusted ingestion data)
        embedding = await generate_embedding(searchable_text, validate=False)
        
        # Create database record
        feature = PlanetaryFeature(
            feature_name=feature_data.get("feature_name", "Unknown"),
            target_body=feature_data.get("target", "Unknown"),
            category=feature_data.get("category", "Unknown"),
            latitude=float(feature_data.get("center_lat", 0.0)),
            longitude=float(feature_data.get("center_lon", 0.0)),
            diameter=float(feature_data["diameter"]) if feature_data.get("diameter") else None,
            origin=feature_data.get("origin"),
            approval_date=feature_data.get("approval_date"),
            description=searchable_text,
            embedding_data=embedding  # Store as JSON array
        )
        
        session.add(feature)
        return True
        
    except Exception as e:
        print(f" Error processing feature {feature_data.get('feature_name', 'Unknown')}: {e}")
        return False


async def ingest_batch(features: List[Dict[str, Any]], batch_size: int = 50) -> None:
    """
    Ingest features in batches with progress tracking.
    
    Args:
        features: List of feature dictionaries
        batch_size: Number of features to process before committing
    """
    session = get_db_session()
    total = len(features)
    success_count = 0
    
    try:
        for i in range(0, total, batch_size):
            batch = features[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total + batch_size - 1) // batch_size
            
            print(f"\n Processing batch {batch_num}/{total_batches} ({len(batch)} features)...")
            
            # Process each feature in the batch
            for feature_data in batch:
                success = await ingest_feature(feature_data, session)
                if success:
                    success_count += 1
            
            # Commit the batch
            try:
                session.commit()
                print(f" Batch {batch_num} committed successfully")
            except IntegrityError as e:
                print(f" Batch {batch_num} had integrity errors, rolling back: {e}")
                session.rollback()
            
            # Progress update
            progress = (i + len(batch)) / total * 100
            print(f" Progress: {success_count}/{total} features ingested ({progress:.1f}%)")
        
        print(f"\n Ingestion complete! {success_count}/{total} features successfully added.")
        
    finally:
        session.close()


async def main():
    """Main ingestion workflow."""
    print("Starting planetary feature ingestion with sentence transformer embeddings...")
    
    # Initialize sentence transformer model (will download on first run)
    print("\nInitializing sentence transformer model...")
    print("(First run will download the model, approximately 80-90 MB)")
    from backend.ai_service import get_model
    model = get_model()
    print(f"Model ready: {model.get_sentence_embedding_dimension()} dimensions")
    
    # Initialize database
    print("\nInitializing database...")
    init_db()
    
    # Find all JSON files in data/features/
    features_dir = project_root / "data" / "features"
    
    # Only use all_features.json which contains all unique features
    main_file = features_dir / "all_features.json"
    
    if not main_file.exists():
        print(f"File not found: {main_file}")
        print("   Run the KMZ parser first: python -m backend.scripts.kmzparser")
        return
    
    print(f"\nLoading from: {main_file.name}")
    
    # Load features
    all_features = await load_features_from_json(str(main_file))
    
    print(f"\nTotal features to ingest: {len(all_features)}")
    print("Note: Using local sentence transformers model (no API costs)")
    
    # Ask for confirmation
    response = input("\nContinue with ingestion? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        print("Ingestion cancelled")
        return
    
    # Run ingestion
    print("\nStarting ingestion...")
    await ingest_batch(all_features, batch_size=50)
    
    print("\nAll done!")


if __name__ == "__main__":
    asyncio.run(main())
