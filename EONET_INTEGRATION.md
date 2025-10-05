# NASA EONET Integration - Implementation Guide

## Overview

NASA EONET (Earth Observatory Natural Event Tracker) integration has been successfully implemented to provide real-time natural event data alongside static planetary features.

## What is EONET?

EONET is NASA's system for tracking natural events happening on Earth in near real-time. It aggregates data from multiple NASA sources to provide a unified API for:

- **Wildfires** - Forest fires, brush fires
- **Dust and Haze** - Dust storms, saharan dust, haze events
- **Volcanoes** - Volcanic eruptions and activity
- **Severe Storms** - Hurricanes, cyclones, typhoons
- **Floods** - Flooding events
- **Earthquakes** - Seismic activity
- **Drought** - Prolonged dry periods
- **Sea and Lake Ice** - Ice formation and melting
- **Snow** - Snowfall and blizzards
- And more...

### Key Features:
- **Real-time data** - Events are updated continuously
- **Geographic coordinates** - Each event has lat/lon position
- **Temporal tracking** - Events have start dates and updates
- **Source attribution** - Links to original data sources
- **Open API** - No authentication required

## Implementation

### New Files Created

1. **`backend/eonet.py`** - Core EONET API integration
   - `get_eonet_events()` - Fetch events with filters
   - `get_eonet_categories()` - Get available event categories
   - `get_event_by_id()` - Fetch specific event details
   - `search_events_by_category()` - Search by internal category names
   - `search_events_in_region()` - Geographic bounding box search
   - `format_event_for_display()` - Format events for frontend

2. **`backend/test_eonet_integration.py`** - Comprehensive test suite
   - Tests all EONET functionality
   - Validates query "show me dust storms in mars"
   - Tests category mapping and event formatting

### Modified Files

1. **`backend/search.py`** - Enhanced search endpoint
   - Updated `SearchRequest` model to include `include_events` flag
   - Modified `semantic_search()` to fetch and combine EONET events
   - Added `get_eonet_events()` endpoint for direct event access
   - Added `get_event_detail()` endpoint for event details
   - Updated `FeatureResult` model to support both features and events

2. **`backend/ai_service.py`** - Enhanced event detection
   - Expanded EVENT_KEYWORDS dictionary
   - Added more variations for dust storms, fires, etc.
   - Improved BODY_KEYWORDS with synonyms

## API Endpoints

### 1. Unified Search (Features + Events)

```bash
POST /search/query
Content-Type: application/json

{
  "query": "show me dust storms in mars",
  "limit": 10,
  "include_events": true,
  "event_days": 30
}
```

**Response:**
```json
{
  "query": "show me dust storms in mars",
  "parsed_query": {
    "semantic_query": "show me dust storms in mars",
    "search_type": "event",
    "event_category": "Dust and Haze",
    "event_keyword": "dust storms",
    "target_body": "Mars",
    "warning": "Searching for dynamic events like 'dust storms'..."
  },
  "results": [
    {
      "id": "EONET_6543",
      "name": "Dust Storm over North Africa",
      "body": null,
      "category": ["Dust and Haze"],
      "latitude": 23.5,
      "longitude": 12.3,
      "description": "Saharan dust event...",
      "is_dynamic_event": true,
      "event_date": "2025-10-01",
      "event_link": "https://...",
      "similarity_score": 0.95
    }
  ],
  "total_results": 5,
  "event_count": 3,
  "feature_count": 2
}
```

### 2. Direct EONET Events Access

```bash
GET /search/events?category=Dust%20and%20Haze&limit=10&days=30
```

**Response:**
```json
{
  "total": 5,
  "category": "Dust and Haze",
  "days": 30,
  "events": [
    {
      "id": "EONET_6543",
      "type": "event",
      "name": "Dust Storm over North Africa",
      "description": "Saharan dust event...",
      "categories": ["Dust and Haze"],
      "latitude": 23.5,
      "longitude": 12.3,
      "date": "2025-10-01",
      "sources": [...],
      "link": "https://...",
      "is_dynamic_event": true
    }
  ]
}
```

### 3. Get Event Details

```bash
GET /search/events/EONET_6543
```

**Response:**
```json
{
  "id": "EONET_6543",
  "type": "event",
  "name": "Dust Storm over North Africa",
  "description": "...",
  "categories": ["Dust and Haze"],
  "latitude": 23.5,
  "longitude": 12.3,
  "date": "2025-10-01",
  "sources": [...],
  "link": "...",
  "is_dynamic_event": true
}
```

## Query Flow: "show me dust storms in mars"

1. **Query Parsing** (`ai_service.py`)
   - Detects "dust storms" → EVENT search
   - Maps to category: "Dust and Haze"
   - Detects "mars" → Target body: Mars
   - Adds warning about EONET integration

2. **Event Fetching** (if `include_events=true`)
   - Calls `search_events_by_category("Dust and Haze")`
   - Fetches EONET events from last 30 days (configurable)
   - Converts to `FeatureResult` format
   - Assigns high similarity score (0.95) for direct category match

3. **Feature Search** (database)
   - Filters features by target_body="Mars"
   - Generates semantic embeddings
   - Ranks by cosine similarity
   - Formats as `FeatureResult` objects

4. **Result Combination**
   - Merges EONET events + database features
   - Sorts by similarity score
   - Returns top N results
   - Includes counts for events vs features

## Category Mapping

Internal category names map to EONET categories:

```python
CATEGORY_MAPPING = {
    "Dust and Haze": "dustHaze",
    "Wildfires": "wildfires",
    "Volcanoes": "volcanoes",
    "Severe Storms": "severeStorms",
    "Floods": "floods",
    "Earthquakes": "earthquakes",
    "Drought": "drought",
    "Sea and Lake Ice": "seaLakeIce",
    "Snow": "snow"
}
```

## Frontend Integration

### Display Event Results

```typescript
// Event result structure
interface EventResult {
  id: string;
  name: string;
  body: string | null;
  category: string | string[];
  latitude: number | null;
  longitude: number | null;
  is_dynamic_event: boolean;
  event_date: string | null;
  event_link: string | null;
  event_sources: any[] | null;
  similarity_score: number;
}

// Check if result is an event
if (result.is_dynamic_event) {
  // Display with event-specific UI
  // - Show date badge
  // - Add "LIVE" or "ACTIVE" indicator
  // - Link to source data
  // - Animate on globe
}
```

### Visual Indicators

- **Events**: Use orange/red markers with pulse animation
- **Features**: Use blue/gray static markers
- **Event Badge**: Display "LIVE EVENT" or event date
- **Source Links**: Provide links to NASA data sources

## Testing

### Run EONET Integration Test

```bash
cd "f:\git repo store\nasa-spaceapps-project"
"F:/git repo store/nasa-spaceapps-project/.venv/Scripts/python.exe" backend/test_eonet_integration.py
```

### Expected Output:
```
================================================================================
Testing NASA EONET Integration
================================================================================

Test 1: Fetching EONET categories
✓ Found 15 categories:
  - Dust and Haze (dustHaze)
  - Wildfires (wildfires)
  ...

Test 2: Searching for 'Dust and Haze' events
✓ Found 3 dust/haze events:
  Event: Dust Storm over Sahara
  ...

✓ Dust storm query would return real-time EONET events!
...
```

### Test with FastAPI Backend

1. Start backend:
```bash
uvicorn backend.main:app --reload --port 8000
```

2. Test unified search:
```bash
curl -X POST http://localhost:8000/search/query \
  -H "Content-Type: application/json" \
  -d '{"query": "dust storms", "limit": 5, "include_events": true}'
```

3. Test direct EONET access:
```bash
curl "http://localhost:8000/search/events?category=Dust%20and%20Haze&limit=5"
```

4. Visit API docs:
```
http://localhost:8000/docs
```

## Important Notes

### Earth vs Other Bodies

- **EONET only tracks Earth events** - wildfires, storms, etc. on Earth
- **Mars queries** - Won't return Mars dust storms (no real-time Mars weather API)
- **Query handling** - System searches both:
  1. EONET for Earth events
  2. Database for Mars/Moon features
- **Result merging** - Combines both sources, user sees all relevant data

### Rate Limiting

EONET API is free and open but consider:
- Cache frequent queries
- Implement request throttling
- Handle API timeouts gracefully
- Fallback to feature search if EONET fails

### Data Freshness

- EONET events update in near real-time (minutes to hours)
- Some events are retrospectively added
- Event status can be "open" (active) or "closed" (resolved)
- Use `days` parameter to control lookback period

## Future Enhancements

### 1. Caching Layer
```python
# Add Redis caching for EONET responses
@cache(ttl=300)  # 5 minute cache
async def get_eonet_events():
    ...
```

### 2. WebSocket Updates
```python
# Push real-time event updates to frontend
async def stream_new_events():
    while True:
        new_events = await check_for_new_events()
        await websocket.send_json(new_events)
        await asyncio.sleep(60)
```

### 3. Event Notifications
- Subscribe to specific event categories
- Email/push notifications for new events
- Custom alert thresholds

### 4. Historical Analysis
- Trend analysis over time
- Event frequency heatmaps
- Seasonal patterns

### 5. Mars Weather Integration
- Integrate Mars Weather API (if available)
- Correlate with Mars rover data
- Historical Mars dust storm data

## Troubleshooting

### EONET API Not Responding
```python
# Error: httpx.TimeoutException
# Solution: Increase timeout or handle gracefully
async with httpx.AsyncClient(timeout=30.0) as client:
    ...
```

### No Events Returned
- Normal if no recent events in category
- Try increasing `days` parameter
- Check category name spelling
- Verify EONET API status

### Mixed Earth/Mars Results
- This is expected behavior!
- Events are Earth-based, features can be any body
- Frontend should clearly distinguish between them
- Use `is_dynamic_event` flag for filtering

## Resources

- [NASA EONET API](https://eonet.gsfc.nasa.gov/api/v3)
- [EONET Documentation](https://eonet.gsfc.nasa.gov/docs/v3)
- [NASA Worldview](https://worldview.earthdata.nasa.gov/) - Visualize events
- [EONET GitHub](https://github.com/nasa/EONET) - Source code

## Conclusion

✅ EONET integration complete  
✅ Handles "show me dust storms in mars" query  
✅ Returns real-time Earth events  
✅ Combines with Mars feature search  
✅ Ready for frontend integration  
✅ Test suite passing  

The system now provides a comprehensive search experience combining static planetary features with dynamic Earth events!
