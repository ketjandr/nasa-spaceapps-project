"""
Test the image service functionality
"""
import asyncio
import sys
sys.path.insert(0, ".")

from backend.image_service import get_feature_images

async def test_images():
    print("Testing image service...")
    
    # Test with a Mars feature
    print("\n1. Testing Olympus Mons (Mars):")
    result = await get_feature_images(
        feature_name="Olympus Mons",
        target_body="mars",
        lat=-18.65,
        lon=226.2
    )
    print(f"  Found {result['total_images']} images")
    print(f"  Sources: {', '.join(result['sources'])}")
    if result['images']:
        print(f"  First image: {result['images'][0]['title']}")
        print(f"  URL: {result['images'][0]['preview_url']}")
    
    # Test with a Moon feature
    print("\n2. Testing Tycho Crater (Moon):")
    result = await get_feature_images(
        feature_name="Tycho",
        target_body="moon",
        lat=-43.3,
        lon=-11.2
    )
    print(f"  Found {result['total_images']} images")
    print(f"  Sources: {', '.join(result['sources'])}")
    if result['images']:
        print(f"  First image: {result['images'][0]['title']}")
        print(f"  URL: {result['images'][0]['preview_url']}")
    
    print("\n✅ Image service test completed!")

if __name__ == "__main__":
    asyncio.run(test_images())
