# NASA Space Apps - Page Structure

## Overview

The application now has a clean two-page structure that separates the search interface from the map viewer.

## Page Structure

### 🏠 Home Page (`/`)
**Purpose**: Landing page with search interface

**Features**:
- Large, prominent glass morphism search bar
- Hero section with title and description
- Popular search suggestions as clickable buttons
- Feature highlights (Multiple Planets, Gigapixel Images, Feature Markers)
- Clean, focused design without the map viewer

**User Flow**:
1. User arrives at the home page
2. User types a search query or clicks a suggested search term
3. User clicks the search button or presses Enter
4. Application navigates to `/explorer` with the search query as a URL parameter

---

### 🗺️ Explorer Page (`/explorer`)
**Purpose**: Interactive map viewer with search functionality

**Features**:
- Sticky header with search bar and back button
- Full tile viewer with OpenSeadragon integration
- Location markers for searched features
- Support for multiple celestial bodies (Moon, Mars, Mercury, Ceres)
- Feature list sidebar with clickable items
- Help section with usage tips

**User Flow**:
1. User arrives from home page with a search query (`/explorer?search=Tycho+Crater`)
2. Search query is automatically applied to filter features
3. User can:
   - Refine search using the header search bar
   - Click on features to place markers
   - Navigate and zoom the map
   - Return to home page using the back button

---

## Component Architecture

### Search Bar Component
**File**: `app/components/search_bar.tsx`

**Props**:
- `onSearch`: Callback function when search is submitted
- `placeholder`: Optional placeholder text
- `className`: Optional additional CSS classes

**Features**:
- Glass morphism design
- Magnifying glass icon
- Arrow up submit button
- Disabled state when query is empty

---

### Tile Viewer Wrapper
**File**: `app/components/tileViewWrapper.tsx`

**Props**:
- `searchQuery`: Optional search query to filter features

**Features**:
- Client-side only rendering (disabled SSR)
- Passes search query to the tile viewer
- Dynamic import for better performance

---

### Tile Viewer
**File**: `app/components/tileViewer3.tsx`

**Props**:
- `externalSearchQuery`: Search query from parent components

**Features**:
- OpenSeadragon integration for tile viewing
- NASA GIBS, USGS Gazetteer, and Trek data sources
- Location marker system
- Feature type classification
- Real-time search filtering
- Multi-planetary support

---

## URL Parameters

### Explorer Page
- `search`: The search query to filter features
  - Example: `/explorer?search=Tycho%20Crater`
  - Encoded automatically by the application
  - Displayed in the header as "Showing results for: [query]"

---

## Styling

### Design System
- **Colors**: Dark theme with gradient background (gray-900 → gray-800 → black)
- **Glass Morphism**: White/10 backgrounds with backdrop blur
- **Borders**: White/10 to White/20 with transitions
- **Typography**: White text with various opacity levels for hierarchy

### Responsive Design
- Mobile-first approach
- Breakpoints: `sm:`, `md:`, `lg:`
- Flexible layouts that adapt to screen size
- Touch-friendly button sizes

---

## Data Flow

```
Home Page
    ↓ (user searches)
    ↓
Explorer Page (?search=query)
    ↓
TileViewerWrapper (searchQuery prop)
    ↓
TileViewer (externalSearchQuery prop)
    ↓
Filter features & display markers
```

---

## Future Enhancements

1. **Search History**: Save recent searches in localStorage
2. **Bookmarks**: Allow users to save favorite locations
3. **Share Links**: Copy-to-clipboard functionality for current view
4. **Advanced Filters**: Filter by feature type, size, etc.
5. **Multi-language**: Support for multiple languages
6. **Dark/Light Mode**: Toggle between themes
7. **Export**: Download marked locations as files

---

## Development

### Running the Application
```bash
npm run dev
```

### Building for Production
```bash
npm run build
npm start
```

### Key Dependencies
- Next.js 15.5.4
- React 19
- OpenSeadragon
- Lucide React (icons)
- Tailwind CSS
