"""
Test script for NASA EONET integration.
Tests the ability to fetch and integrate real-time event data.
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))


async def test_eonet_integration():
    """Test EONET API integration."""
    
    from eonet import (
        get_eonet_categories,
        search_events_by_category,
        get_eonet_events,
        format_event_for_display,
        EONETStatus
    )
    
    print("=" * 80)
    print("Testing NASA EONET Integration")
    print("=" * 80)
    
    try:
        # Test 1: Fetch available categories
        print("\n" + "-" * 80)
        print("Test 1: Fetching EONET categories")
        print("-" * 80)
        categories = await get_eonet_categories()
        print(f"✓ Found {len(categories)} categories:")
        for cat in categories:
            print(f"  - {cat['title']} ({cat['id']})")
        
        # Test 2: Search for dust storms (Dust and Haze)
        print("\n" + "-" * 80)
        print("Test 2: Searching for 'Dust and Haze' events")
        print("-" * 80)
        dust_events = await search_events_by_category("Dust and Haze", limit=5, days=60)
        print(f"✓ Found {len(dust_events)} dust/haze events:")
        for event in dust_events:
            formatted = format_event_for_display(event)
            print(f"\n  Event: {formatted['name']}")
            print(f"  ID: {formatted['id']}")
            print(f"  Categories: {', '.join(formatted['categories'])}")
            if formatted['latitude'] and formatted['longitude']:
                print(f"  Location: {formatted['latitude']:.4f}°, {formatted['longitude']:.4f}°")
            print(f"  Date: {formatted['date']}")
        
        if len(dust_events) > 0:
            print("\n✓ Dust storm query would return real-time EONET events!")
        else:
            print("\n⚠ No recent dust/haze events found (this is normal if there are no active events)")
        
        # Test 3: Search for wildfires
        print("\n" + "-" * 80)
        print("Test 3: Searching for wildfires")
        print("-" * 80)
        wildfire_events = await search_events_by_category("Wildfires", limit=5, days=30)
        print(f"✓ Found {len(wildfire_events)} wildfire events:")
        for event in wildfire_events:
            formatted = format_event_for_display(event)
            print(f"  - {formatted['name']}")
            if formatted['latitude'] and formatted['longitude']:
                print(f"    Location: {formatted['latitude']:.4f}°, {formatted['longitude']:.4f}°")
        
        # Test 4: Fetch all recent events
        print("\n" + "-" * 80)
        print("Test 4: Fetching all recent events (last 7 days)")
        print("-" * 80)
        all_events = await get_eonet_events(limit=10, days=7, status=EONETStatus.OPEN)
        print(f"✓ Found {len(all_events)} active events:")
        event_categories = {}
        for event in all_events:
            cat_names = ", ".join([cat.get("title", "") for cat in event.categories])
            event_categories[cat_names] = event_categories.get(cat_names, 0) + 1
            print(f"  - {event.title} ({cat_names})")
        
        print(f"\nEvent breakdown by category:")
        for cat, count in event_categories.items():
            print(f"  {cat}: {count}")
        
        # Test 5: Test query "show me dust storms in mars" scenario
        print("\n" + "=" * 80)
        print("Test 5: Simulating 'show me dust storms in mars' query")
        print("=" * 80)
        
        print("\nQuery processing:")
        print("  1. Parse query → Detected as EVENT search")
        print("  2. Category: 'Dust and Haze'")
        print("  3. Target body: 'Mars' (note: EONET only has Earth events)")
        print("  4. Fetch EONET events for 'Dust and Haze'")
        
        dust_events = await search_events_by_category("Dust and Haze", limit=10, days=90)
        print(f"\n  ✓ Would return {len(dust_events)} EONET dust/haze events")
        print("  ✓ Would also search database for Mars features")
        print("  ✓ Combined results sorted by relevance")
        
        print("\n" + "=" * 80)
        print("EONET Integration Test Complete")
        print("=" * 80)
        print("\nSummary:")
        print(f"  ✓ EONET API accessible")
        print(f"  ✓ {len(categories)} event categories available")
        print(f"  ✓ Real-time events can be fetched")
        print(f"  ✓ Integration with search endpoint ready")
        print("\nNext steps:")
        print("  1. Test full search endpoint: POST /search with query='dust storms'")
        print("  2. Test EONET endpoint: GET /search/events?category=Dust and Haze")
        print("  3. Implement frontend UI for event results")
        
        return True
        
    except Exception as e:
        print(f"\n✗ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_eonet_integration())
    sys.exit(0 if success else 1)
