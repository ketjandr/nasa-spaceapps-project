"""Database models and initialization for Stellar Canvas."""

from sqlalchemy import Column, Integer, String, Float, Text, JSON, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from typing import Optional
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
    
    def __repr__(self):
        return f"<PlanetaryFeature(name='{self.feature_name}', body='{self.target_body}', category='{self.category}')>"


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
    print(f"✅ Database initialized at: {database_url}")


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
