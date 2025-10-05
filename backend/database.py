"""Database models and initialization for Stellar Canvas."""

from sqlalchemy import Column, Integer, String, Float, Text, JSON, create_engine, DateTime, ForeignKey
from sqlalchemy.orm import DeclarativeBase, sessionmaker, relationship
from typing import Optional
from datetime import datetime
import os

# Base class for models
class Base(DeclarativeBase):
    pass


class PlanetaryFeature(Base):
    """Model for planetary features with AI embeddings using sentence transformers."""
    
    __tablename__ = "planetary_features"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Feature identification
    feature_name = Column(String(200), nullable=False, index=True)
    target_body = Column(String(50), nullable=False, index=True)  # Moon, Mars, Mercury, etc.
    category = Column(String(50), nullable=False, index=True)
    
    # Geographic data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    diameter = Column(Float, nullable=True)  # in km
    
    # Additional metadata
    origin = Column(String(100), nullable=True)  # Named after person/place
    approval_date = Column(String(50), nullable=True)
    
    # Full description for search
    description = Column(Text, nullable=True)
    
    # AI Embeddings (stored as JSON array)
    # Using sentence-transformers model 'all-MiniLM-L6-v2' (384 dimensions)
    embedding_data = Column(JSON, nullable=True)
    
    # Tags for enhanced search
    tags = Column(JSON, nullable=True)  # Array of tags like ["large", "ancient", "impact"]
    
    def __repr__(self):
        return f"<PlanetaryFeature(name='{self.feature_name}', body='{self.target_body}', category='{self.category}')>"


class SearchHistory(Base):
    """Track user search queries for personalization and analytics"""
    
    __tablename__ = "search_history"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, index=True)  # User session identifier
    query = Column(Text, nullable=False)  # The search query
    query_type = Column(String(20), nullable=False)  # "simple" or "complex"
    results_count = Column(Integer, nullable=True)  # Number of results returned
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Query understanding (for complex queries)
    understood_intent = Column(String(50), nullable=True)
    target_body = Column(String(50), nullable=True)
    feature_type = Column(String(50), nullable=True)
    
    def __repr__(self):
        return f"<SearchHistory(query='{self.query}', session='{self.session_id}', time='{self.timestamp}')>"


class UserPreference(Base):
    """Store user preferences and personalized suggestions"""
    
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=False, unique=True, index=True)
    
    # Preference tracking
    favorite_bodies = Column(JSON, nullable=True)  # ["Mars", "Moon"]
    favorite_categories = Column(JSON, nullable=True)  # ["Crater", "Mountain"]
    search_frequency = Column(Integer, default=0)
    last_active = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    def __repr__(self):
        return f"<UserPreference(session='{self.session_id}', searches={self.search_frequency})>"


# Database connection setup
def get_database_url() -> str:
    """Get database URL from environment or use default SQLite."""
    return os.getenv("BACKEND_DATABASE_URL", "sqlite:///./stellarcanvas.db")


def init_db() -> None:
    """Initialize the database, creating all tables."""
    database_url = get_database_url()
    engine = create_engine(
        database_url,
        echo=False,  # Set to True to see SQL queries
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
    )
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized at: {database_url}")


def get_db_engine():
    """Get database engine for queries."""
    database_url = get_database_url()
    return create_engine(
        database_url,
        connect_args={"check_same_thread": False} if "sqlite" in database_url else {}
    )


def get_db_session():
    """Get a new database session."""
    engine = get_db_engine()
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()


if __name__ == "__main__":
    # Run this to create tables
    init_db()
    print("Database tables created successfully!")
