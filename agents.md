# Agent Reference Guide: NASA Space Apps - Stellar Canvas

## Project Overview

**Stellar Canvas** is an immersive exploration platform for NASA satellite imagery featuring AI-powered search, timeline traversal, and a discovery-first experience inspired by Google Earth and VR interfaces.

### Core Principles
- No emojis anywhere in the codebase
- Performance target: 60 fps for 3D components
- Mobile-first responsive design
- Accessibility compliant (keyboard navigation, screen readers)

---

## Architecture Overview

### Tech Stack

**Frontend:**
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4 (PostCSS)
- OpenSeadragon 5.0.1 (2D tile viewer)
- React 19.1.0
- Three.js / React Three Fiber (for 3D sphere and globe - to be implemented)
- Cesium.js or OpenSpace (3D Globe implementation - to be implemented)

**Backend:**
- FastAPI 0.115.0 (Python)
- SQLAlchemy 2.0+ (ORM)
- SQLite (stellarcanvas.db) - can be migrated to PostgreSQL + PostGIS
- Sentence Transformers (all-MiniLM-L6-v2 for semantic search)
- NASA GIBS API (imagery source)
- httpx for async HTTP requests

**Infrastructure:**
- Vercel (deployment target)
- Redis (planned for tile caching)
- AWS S3 / Vercel Blob (planned for asset storage)

---

## Project Structure

```
nasa-spaceapps-project/
├── app/                          # Next.js app directory
│   ├── page.tsx                  # Main landing page
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Global styles
│   ├── api/                      # Next.js API routes
│   │   └── proxy/kmz/route.ts    # KMZ proxy endpoint
│   └── components/               # React components
│       ├── tileViewer.tsx        # OpenSeadragon v1
│       ├── tileViewer2.tsx       # OpenSeadragon v2
│       ├── tileViewer3.tsx       # OpenSeadragon v3
│       └── tileViewWrapper.tsx   # Wrapper component
│
├── backend/                      # Python FastAPI backend
│   ├── main.py                   # FastAPI app entry point
│   ├── ai_service.py             # OpenAI embedding generation
│   ├── config.py                 # Settings configuration
│   ├── database.py               # SQLAlchemy models
│   ├── gibs.py                   # NASA GIBS API integration
│   ├── schemas.py                # Pydantic schemas
│   ├── search.py                 # Search router/endpoints
│   ├── search_engine.py          # In-memory feature search
│   ├── requirements.txt          # Python dependencies
│   └── scripts/                  # Utility scripts
│       ├── ingest_features.py    # Feature ingestion with embeddings
│       └── kmzparser.py          # Parse NASA KMZ nomenclature files
│
├── data/                         # Static data files
│   ├── events/                   # NASA events data
│   └── features/                 # Parsed planetary feature JSONs
│       ├── all_features.json     # Combined features
│       ├── mars_features.json    # Mars nomenclature
│       ├── mercury_features.json # Mercury nomenclature
│       └── moon_features.json    # Moon nomenclature
│
├── public/                       # Static assets
│   └── *.svg                     # Icon files
│
├── stellarcanvas.db              # SQLite database
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript config
├── next.config.ts                # Next.js config
├── postcss.config.mjs            # PostCSS config
└── eslint.config.mjs             # ESLint config
```

---

## Core Components & Features

### 1. Discovery Home Experience (VR-Inspired Sphere)
**Status:** Not yet implemented
**Priority:** High
**Location:** To be created in `app/components/`

#### Requirements:
- 360-degree inner-sphere environment
- Mouse-drag/movement to look around
- Fetch random imagery from database for floating cards
- Smooth animations (floating, rotating)
- Click on image transitions to globe view
- Performance: 60 fps target

#### Tech:
- Three.js or React Three Fiber
- Integration with backend API for random imagery
- State management for view transitions

#### Implementation Notes:
- Create `app/components/DiscoverySphere.tsx`
- Use `useFrame` hook for animation loop
- Implement camera controls with mouse/touch events
- Lazy load textures to maintain performance

---

### 2. AI-Powered Search System
**Status:** In Progress (Jordan)
**Priority:** High
**Location:** `backend/search.py`, `backend/ai_service.py`, `backend/search_engine.py`

#### Current Implementation:

**Backend Endpoints** (`backend/search.py`):
- `POST /search` - Main search endpoint with AI semantic search
- `GET /search/features` - Simple text-based feature search
- `GET /search/suggestions` - Autocomplete suggestions

**AI Service** (`backend/ai_service.py`):
- `generate_embedding(text)` - Creates 384-dim embeddings using sentence transformers
- `parse_natural_language_query(query)` - Extracts search intent using keyword-based parsing
- Uses `all-MiniLM-L6-v2` model (local, no API key required)
- No external API dependencies

**Search Engine** (`backend/search_engine.py`):
- In-memory search through loaded features
- Simple text matching with scoring algorithm
- Filters by celestial body (Moon, Mars, Mercury)
- Returns top N results with coordinates

#### Database Schema (`backend/database.py`):
```python
class PlanetaryFeature(Base):
    id: int
    feature_name: str          # e.g., "Tycho Crater"
    target_body: str           # Moon, Mars, Mercury
    category: str              # Crater, Mountain, Valley, etc.
    latitude: float
    longitude: float
    diameter: float            # in km (optional)
    origin: str                # Named after (optional)
    approval_date: str         # IAU approval date (optional)
    description: str           # Full description for search
    embedding_data: JSON       # AI embedding vector (384 floats)
```

#### Frontend Integration (To Do):
- Create search bar component with autocomplete
- Display search results with thumbnails
- Trigger globe navigation on result click
- Show loading states
- Handle errors gracefully

#### API Usage Examples:

**Semantic Search:**
```bash
POST /search
Content-Type: application/json

{
  "query": "show me large craters on the moon",
  "limit": 10
}
```

**Simple Text Search:**
```bash
GET /search/features?query=tycho&body=moon&limit=5
```

**Autocomplete:**
```bash
GET /search/suggestions?prefix=tyc&body=moon&limit=5
```

---

### 3. Interactive Globe / Map Asset
**Status:** Not yet implemented
**Priority:** Critical (blocking feature)
**Location:** To be created in `app/components/`

#### Requirements:
- Google Earth-style 3D globe
- Static globe (no real-time rotation initially)
- Smooth camera animations for search results
- Layer NASA GIBS imagery tiles
- Clickable regions with info panels
- Zoom levels: Space → Country → City → Street
- Performance optimization for tile loading

#### Tech Options:
- **Cesium.js** (recommended for 3D globe)
- **OpenSpace** (NASA visualization tool)
- **OpenSeadragon** (2D fallback - already integrated)

#### Implementation Plan:
1. Create `app/components/Globe.tsx`
2. Initialize Cesium viewer with NASA GIBS layer
3. Implement camera controls (pan, zoom, rotate)
4. Add tile loading with progressive refinement
5. Connect to FastAPI backend for tile proxy
6. Implement coordinate-based navigation from search results
7. Add visual markers for search targets

#### Integration Points:
- Receives coordinates from search system
- Triggers timeline loading for selected location
- Provides viewport bounds to backend for tile requests

---

### 4. Timeline Feature
**Status:** Not yet implemented
**Priority:** High
**Location:** To be created in `app/components/`

#### Requirements:
- Horizontal timeline slider UI
- Fetch time-series data for selected coordinates
- Smooth image transitions between dates
- Date-range selector (day/month/year granularity)
- Compare mode (side-by-side before/after)
- Play/pause animation through timeline
- Clear indication of data availability gaps

#### Implementation:
- Create `app/components/Timeline.tsx`
- State management for current date and range
- Backend API for temporal queries to NASA GIBS
- Image preloading for smooth transitions
- Responsive mobile controls

#### NASA GIBS Temporal API:
- GIBS supports temporal parameters in tile URLs
- Format: `TIME=YYYY-MM-DD`
- Need to query available dates for layer

---

### 5. Backend Infrastructure
**Status:** Partial implementation
**Priority:** High
**Location:** `backend/main.py`, `backend/gibs.py`

#### Current Features:

**NASA GIBS Proxy** (`backend/main.py`, `backend/gibs.py`):
- Tile proxy with format negotiation
- Layer capability queries
- Viewer configuration generation
- CORS enabled for frontend access

**Key Endpoints:**

```python
# Health check
GET /health

# Get available layers
GET /layers

# Get layer capabilities
GET /gibs/capabilities/{layer_identifier}

# Proxy tile requests
GET /gibs/tile/{layer_identifier}/{z}/{x}/{y}.{format}
    ?time=YYYY-MM-DD  # Optional temporal parameter

# Viewer configuration (OpenSeadragon)
GET /viewer-config/{layer_identifier}
    ?time=YYYY-MM-DD
    ?zoom_levels=5
    ?tile_size=512
```

#### GIBS Integration (`backend/gibs.py`):
- `get_capabilities_xml(layer)` - Fetch WMTS capabilities
- `parse_capabilities_xml(xml)` - Parse layer metadata
- `get_capability_summaries()` - Get all layer summaries
- `pick_format(formats)` - Negotiate best tile format (JPEG > PNG)
- `format_extension(mime)` - Convert MIME to file extension

#### To Do:
- Implement Redis caching for tiles
- Add rate limiting
- Enhance error handling
- Add monitoring/logging
- Create temporal query endpoints for timeline

---

### 6. Database & Asset Management
**Status:** Partial implementation
**Priority:** High
**Location:** `backend/database.py`, `backend/scripts/`

#### Current Setup:
- SQLite database (`stellarcanvas.db`)
- SQLAlchemy ORM models
- Feature ingestion pipeline

#### Scripts:

**KMZ Parser** (`backend/scripts/kmzparser.py`):
```bash
# Parse NASA nomenclature KMZ files
python backend/scripts/kmzparser.py moon
python backend/scripts/kmzparser.py mars
python backend/scripts/kmzparser.py mercury

# Output: data/features/{body}_features.json
```

**Feature Ingestion** (`backend/scripts/ingest_features.py`):
```bash
# Ingest features with AI embeddings
python backend/scripts/ingest_features.py

# Reads: data/features/all_features.json
# Writes: stellarcanvas.db with embeddings
```

#### Database Operations:
```python
from backend.database import init_db, get_db_session, PlanetaryFeature

# Initialize database
init_db()

# Query features
session = get_db_session()
features = session.query(PlanetaryFeature).filter_by(target_body="Moon").limit(10).all()
```

#### Migration Path:
- Current: SQLite (good for development)
- Production: PostgreSQL + PostGIS for geospatial queries
- Asset storage: AWS S3 or Vercel Blob for imagery

---

### 7. UI/UX Assets & Animations
**Status:** In Progress (Lachlan & Earl)
**Priority:** Medium
**Location:** `app/components/`, `app/globals.css`

#### Current Assets:
- Tailwind CSS 4 configured
- Global styles in `app/globals.css`
- Multiple OpenSeadragon viewer versions

#### To Do:
- Design rocket/elevator scale indicator UI
- Loading animations (spinning globe, data fetching)
- Transition animations (search → globe spin)
- Responsive layout refinement
- Dark/light theme toggle
- Accessibility improvements

#### Animation Libraries:
- Framer Motion (recommended for React animations)
- CSS transitions for simple effects
- Three.js for 3D animations

---

### 8. Search → Globe Animation
**Status:** Not yet implemented
**Priority:** High (depends on Globe + Search)
**Location:** To be created in `app/components/`

#### Requirements:
- Parse search results into lat/lon coordinates
- Calculate camera path (arc over globe)
- Animate globe rotation and camera zoom
- Highlight target region with marker
- Trigger timeline loading for location
- Handle edge cases (invalid locations, oceans)

#### Implementation:
- Use Three.js camera animation helpers
- Implement easing functions (ease-in-out)
- Calculate great circle path for smooth arcs
- Add progress indicators
- Coordinate with search result data structure

---

## API Reference

### Backend API Endpoints

#### Search Endpoints

**Semantic Search (AI-powered):**
```
POST /search
Content-Type: application/json

{
  "query": "large impact craters near the lunar south pole",
  "limit": 10,
  "offset": 0
}

Response:
{
  "results": [
    {
      "id": 123,
      "name": "Tycho Crater",
      "body": "Moon",
      "category": "Crater",
      "latitude": -43.3,
      "longitude": -11.2,
      "diameter": 85.0,
      "description": "Prominent lunar crater...",
      "similarity": 0.89
    }
  ],
  "total": 1,
  "query_embedding_preview": [0.123, -0.456, ...]
}
```

**Simple Text Search:**
```
GET /search/features?query=tycho&body=moon&limit=5

Response:
[
  {
    "name": "Tycho Crater",
    "body": "Moon",
    "category": "Crater",
    "latitude": -43.3,
    "longitude": -11.2,
    "score": 100
  }
]
```

**Autocomplete Suggestions:**
```
GET /search/suggestions?prefix=tyc&body=moon&limit=5

Response:
[
  {
    "name": "Tycho",
    "body": "Moon",
    "category": "Crater"
  }
]
```

#### GIBS Proxy Endpoints

**Get Available Layers:**
```
GET /layers

Response:
[
  {
    "identifier": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
    "title": "VIIRS True Color",
    "abstract": "True color imagery from VIIRS...",
    "available": true
  }
]
```

**Get Tile (Proxied from NASA GIBS):**
```
GET /gibs/tile/VIIRS_SNPP_CorrectedReflectance_TrueColor/5/10/12.jpg?time=2024-01-15

Response: JPEG image binary
```

**Get Viewer Configuration:**
```
GET /viewer-config/VIIRS_SNPP_CorrectedReflectance_TrueColor?time=2024-01-15&zoom_levels=9

Response:
{
  "layer_id": "VIIRS_SNPP_CorrectedReflectance_TrueColor",
  "time": "2024-01-15",
  "tile_source": {
    "type": "zoomify",
    "url": "/gibs/tile/...",
    "width": 131072,
    "height": 65536
  }
}
```

#### Health Check:
```
GET /health

Response:
{
  "status": "ok"
}
```

---

## Environment Configuration

### Backend Environment Variables

Create a `.env` file in the project root:

```bash
# Database URL (optional, defaults to SQLite)
BACKEND_DATABASE_URL=sqlite:///./stellarcanvas.db
# For PostgreSQL:
# BACKEND_DATABASE_URL=postgresql://user:pass@localhost/stellarcanvas

# NASA GIBS Base URL (optional, has default)
NASA_GIBS_BASE_URL=https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/

# Logging level
LOG_LEVEL=INFO

# Note: No API keys required - using local sentence transformers model
```

### Frontend Environment Variables

Create `.env.local` in project root:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Feature flags
NEXT_PUBLIC_ENABLE_3D_GLOBE=false
NEXT_PUBLIC_ENABLE_TIMELINE=false
```

---

## Development Workflow

### Starting the Backend

```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Initialize database
python -c "from backend.database import init_db; init_db()"

# Parse NASA nomenclature data (if needed)
python backend/scripts/kmzparser.py moon
python backend/scripts/kmzparser.py mars
python backend/scripts/kmzparser.py mercury

# Ingest features with AI embeddings (uses local sentence transformers)
python backend/scripts/ingest_features.py

# Start FastAPI server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Starting the Frontend

```bash
# Install Node.js dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Frontend will be available at: `http://localhost:3000`

### Running Both Together

Terminal 1:
```bash
uvicorn backend.main:app --reload --port 8000
```

Terminal 2:
```bash
npm run dev
```

---

## Data Flow

### Search Flow
1. User enters query in search bar (frontend)
2. Frontend sends POST request to `/search` endpoint
3. Backend generates embedding for query using OpenAI
4. Backend performs cosine similarity search against feature embeddings
5. Backend returns ranked results with coordinates
6. Frontend displays results and highlights location on globe
7. Click on result triggers globe animation to location
8. Timeline loads for selected coordinates

### Tile Loading Flow
1. Globe component requests tiles for viewport
2. Request sent to backend `/gibs/tile/{layer}/{z}/{x}/{y}.{format}`
3. Backend checks cache (if Redis enabled)
4. If not cached, backend proxies request to NASA GIBS
5. Backend caches response and returns to frontend
6. Frontend renders tiles in viewer

### Timeline Flow
1. User selects location on globe
2. Frontend requests available dates for location
3. Backend queries NASA GIBS temporal capabilities
4. Frontend displays timeline slider with available dates
5. User scrubs timeline or plays animation
6. Frontend requests tiles for each date
7. Backend proxies temporal tiles (with `time` parameter)
8. Frontend displays smooth transitions

---

## Key Algorithms & Techniques

### Semantic Search (AI Embeddings)
- Uses sentence-transformers `all-MiniLM-L6-v2` model (local, no API costs)
- Generates 384-dimensional vectors
- Cosine similarity for ranking: `similarity = dot(query_vec, feature_vec) / (norm(query_vec) * norm(feature_vec))`
- Threshold: 0.7 for relevant results

### Simple Text Search Scoring
```python
score = 0
if exact_name_match: score += 100
if name_contains_query: score += 50
if category_matches: score += 30
if description_contains_query: score += 20
return results sorted by score descending
```

### Tile Coordinate Calculations
- Web Mercator projection (EPSG:3857) for most layers
- WGS84 (EPSG:4326) for NASA GIBS
- Z = zoom level (0-18)
- X = tile column (0 to 2^Z - 1)
- Y = tile row (0 to 2^Z - 1)

### Camera Animation (To Implement)
- Calculate great circle path between current and target position
- Use spherical interpolation (SLERP) for smooth rotation
- Easing function: `easeInOutCubic(t) = t < 0.5 ? 4*t^3 : 1 - pow(-2*t+2, 3)/2`
- Animation duration: 1-3 seconds based on distance

---

## Testing Strategy

### Backend Testing
```bash
# Run unit tests
pytest backend/tests/ -v

# Run specific test file
pytest backend/tests/test_search.py -v

# Manual API testing
curl http://localhost:8000/health
curl http://localhost:8000/layers
curl -X POST http://localhost:8000/search/query \
  -H "Content-Type: application/json" \
  -d '{"query": "tycho crater", "limit": 5}'
```

### Frontend Testing
```bash
# ESLint
npm run lint

# Type checking
npx tsc --noEmit

# Manual testing
# - Test search functionality
# - Test tile loading performance
# - Test responsive design (mobile, tablet, desktop)
# - Test keyboard navigation
# - Test with screen reader
```

### Performance Testing
- Globe rendering: 60 fps minimum
- Search response: <1 second
- Tile loading: <500ms per tile
- Initial page load: <2 seconds
- Lighthouse score: 90+ for performance

---

## Common Tasks for LLM Agents

### Adding a New Search Filter
1. Update `backend/schemas.py` - add filter to `SearchRequest` model
2. Update `backend/search.py` - modify search logic to apply filter
3. Update `backend/database.py` - ensure field exists in model
4. Update frontend search component - add UI control for filter

### Adding a New NASA GIBS Layer
1. Find layer identifier from GIBS documentation
2. Add to curated list in `backend/config.py` (if using curated list)
3. Test with `/gibs/capabilities/{layer_identifier}` endpoint
4. Update frontend layer selector component

### Implementing a New Component
1. Create component file in `app/components/`
2. Define TypeScript interfaces for props
3. Implement component logic and JSX
4. Add Tailwind CSS classes for styling
5. Export from component file
6. Import and use in parent page/component

### Adding AI Features
1. Import from `backend/ai_service.py`
2. Use `generate_embedding()` for vectorization (runs locally)
3. Use `parse_natural_query()` for keyword-based intent extraction
4. Model loads automatically on first use
5. No API keys or rate limits to worry about

### Database Migrations
1. Modify models in `backend/database.py`
2. For SQLite: drop and recreate (dev only)
3. For PostgreSQL: use Alembic for migrations
4. Re-run ingestion scripts if schema changes affect features

---

## Troubleshooting Guide

### Backend Issues

**"Import sentence_transformers could not be resolved"**
- Install dependencies: `pip install -r backend/requirements.txt`
- First run will download the model (approximately 80-90 MB)
- Ensure you have sufficient disk space and internet connection

**"No module named 'backend'"**
- Run from project root directory
- Use: `python -m backend.main` or `uvicorn backend.main:app`

**Database locked error (SQLite)**
- Close any other connections to the database
- Restart the backend server
- Consider migrating to PostgreSQL for production

**NASA GIBS tile not loading**
- Check internet connection
- Verify layer identifier is correct
- Check if layer has data for requested time/location
- Review GIBS service status

### Frontend Issues

**"Failed to fetch" or CORS errors**
- Ensure backend is running on correct port
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS is enabled in `backend/main.py`

**OpenSeadragon not displaying tiles**
- Check browser console for errors
- Verify tile URLs are correct
- Check network tab for failed requests
- Ensure viewer config matches tile source format

**Build errors with Next.js**
- Clear `.next` cache: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npx tsc --noEmit`

### Performance Issues

**Slow search results**
- Check if embeddings are generated for all features
- Sentence transformer model runs locally (no API latency)
- Consider caching frequent queries
- Optimize database indexes
- First search may be slower as model loads into memory

**Low FPS in 3D components**
- Reduce polygon count in 3D models
- Implement level-of-detail (LOD) system
- Use texture compression
- Profile with Chrome DevTools Performance tab

**Slow tile loading**
- Implement tile caching (Redis)
- Use CDN for static assets
- Compress images (JPEG quality 85)
- Prefetch tiles for adjacent zoom levels

---

## Future Enhancements

### Planned Features
1. User accounts and saved searches
2. Collaborative annotations on globe
3. 3D terrain visualization
4. Augmented reality view (mobile)
5. Export high-resolution imagery
6. Custom layer creation
7. Real-time event notifications (wildfires, storms)
8. Social sharing of discoveries
9. Educational mode with guided tours
10. API for third-party integrations

### Technical Debt
1. Migrate from SQLite to PostgreSQL + PostGIS
2. Implement comprehensive test suite
3. Add error monitoring (Sentry)
4. Set up CI/CD pipeline
5. Add API rate limiting and authentication
6. Implement WebSocket for real-time updates
7. Optimize bundle size (code splitting)
8. Add service worker for offline support

---

## Resources & Links

### Documentation
- [NASA GIBS API](https://wiki.earthdata.nasa.gov/display/GIBS)
- [OpenSeadragon](https://openseadragon.github.io/)
- [Cesium.js](https://cesium.com/learn/)
- [Next.js 15](https://nextjs.org/docs)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Sentence Transformers](https://www.sbert.net/)

### NASA Data Sources
- [GIBS Visualization](https://worldview.earthdata.nasa.gov/)
- [Planetary Nomenclature](https://planetarynames.wr.usgs.gov/)
- [NASA Open Data Portal](https://data.nasa.gov/)

### Team Communication
- Repository: nasa-spaceapps-project
- Branch: main
- Owner: ketjandr

---

## Contributors & Roles

### Current Team
- **Jordan**: AI-powered search system (in progress)
- **Pure**: Backend infrastructure (in progress)
- **Kenzo**: Database & asset management (in progress)
- **Lachlan & Earl**: UI/UX assets & animations (in progress)
- **Muneeb**: Available for Globe implementation or Timeline feature

### Contribution Guidelines
- No emojis in code or comments
- Follow existing code style
- Write descriptive commit messages
- Test changes before committing
- Update this document when adding features

---

## Quick Command Reference

```bash
# Backend
uvicorn backend.main:app --reload --port 8000
python backend/scripts/ingest_features.py
python -c "from backend.database import init_db; init_db()"

# Frontend
npm run dev
npm run build
npm run lint

# Database
sqlite3 stellarcanvas.db ".tables"
sqlite3 stellarcanvas.db "SELECT COUNT(*) FROM planetary_features;"

# Git
git status
git add .
git commit -m "feat: descriptive message"
git push origin main
```

---

**Last Updated:** October 4, 2025
**Document Version:** 1.0
**For Questions:** Contact the development team through project repository issues
