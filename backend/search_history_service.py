"""
Search History and Personalization Service
Tracks user searches and provides personalized recommendations
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from database import SearchHistory, UserPreference, get_db_session
from collections import Counter
import uuid


class SearchHistoryService:
    """Manage search history and user preferences"""
    
    @staticmethod
    def generate_session_id() -> str:
        """Generate a unique session ID for a user"""
        return str(uuid.uuid4())
    
    @staticmethod
    def record_search(
        session_id: str,
        query: str,
        query_type: str,
        results_count: int,
        understanding: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Record a search query in history
        
        Args:
            session_id: User session identifier
            query: The search query
            query_type: "simple" or "complex"
            results_count: Number of results returned
            understanding: Parsed query understanding from DeepSeek
        """
        db = get_db_session()
        
        try:
            search_record = SearchHistory(
                session_id=session_id,
                query=query,
                query_type=query_type,
                results_count=results_count,
                understood_intent=understanding.get("intent") if understanding else None,
                target_body=understanding.get("target_body") if understanding else None,
                feature_type=understanding.get("feature_type") if understanding else None,
                timestamp=datetime.utcnow()
            )
            
            db.add(search_record)
            db.commit()
            
            # Update user preferences
            SearchHistoryService._update_user_preferences(db, session_id, understanding)
            
        except Exception as e:
            db.rollback()
            print(f"Error recording search: {e}")
        finally:
            db.close()
    
    @staticmethod
    def _update_user_preferences(
        db: Session, 
        session_id: str, 
        understanding: Optional[Dict[str, Any]]
    ) -> None:
        """Update user preferences based on search patterns"""
        
        # Get or create user preference
        pref = db.query(UserPreference).filter(
            UserPreference.session_id == session_id
        ).first()
        
        if not pref:
            pref = UserPreference(
                session_id=session_id,
                favorite_bodies=[],
                favorite_categories=[],
                search_frequency=0
            )
            db.add(pref)
        
        # Update search frequency
        pref.search_frequency += 1
        pref.last_active = datetime.utcnow()
        
        # Track favorite bodies and categories
        if understanding:
            if understanding.get("target_body"):
                bodies = pref.favorite_bodies or []
                bodies.append(understanding["target_body"])
                pref.favorite_bodies = bodies
            
            if understanding.get("feature_type"):
                categories = pref.favorite_categories or []
                categories.append(understanding["feature_type"])
                pref.favorite_categories = categories
        
        db.commit()
    
    @staticmethod
    def get_search_history(
        session_id: str, 
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent search history for a user"""
        db = get_db_session()
        
        try:
            history = db.query(SearchHistory).filter(
                SearchHistory.session_id == session_id
            ).order_by(
                SearchHistory.timestamp.desc()
            ).limit(limit).all()
            
            return [
                {
                    "query": h.query,
                    "query_type": h.query_type,
                    "results_count": h.results_count,
                    "timestamp": h.timestamp.isoformat(),
                    "target_body": h.target_body,
                    "feature_type": h.feature_type
                }
                for h in history
            ]
        finally:
            db.close()
    
    @staticmethod
    def get_personalized_suggestions(session_id: str) -> List[str]:
        """
        Generate personalized search suggestions based on user history
        
        Returns:
            List of suggested search queries
        """
        db = get_db_session()
        
        try:
            # Get user preferences
            pref = db.query(UserPreference).filter(
                UserPreference.session_id == session_id
            ).first()
            
            if not pref:
                return SearchHistoryService._get_default_suggestions()
            
            suggestions = []
            
            # Analyze favorite bodies
            if pref.favorite_bodies:
                body_counts = Counter(pref.favorite_bodies)
                top_body = body_counts.most_common(1)[0][0]
                suggestions.append(f"Explore {top_body}")
                suggestions.append(f"Recent discoveries on {top_body}")
            
            # Analyze favorite categories
            if pref.favorite_categories:
                category_counts = Counter(pref.favorite_categories)
                top_category = category_counts.most_common(1)[0][0]
                
                if pref.favorite_bodies:
                    top_body = Counter(pref.favorite_bodies).most_common(1)[0][0]
                    suggestions.append(f"{top_category}s on {top_body}")
                else:
                    suggestions.append(f"Large {top_category}s")
            
            # Get recent unique searches
            recent = db.query(SearchHistory).filter(
                SearchHistory.session_id == session_id
            ).order_by(
                SearchHistory.timestamp.desc()
            ).limit(20).all()
            
            # Extract unique feature types and bodies
            recent_bodies = set(h.target_body for h in recent if h.target_body)
            recent_types = set(h.feature_type for h in recent if h.feature_type)
            
            # Cross-suggest combinations
            for body in list(recent_bodies)[:2]:
                for feature_type in list(recent_types)[:2]:
                    if body and feature_type:
                        suggestions.append(f"Show me {feature_type.lower()}s on {body}")
            
            # Limit to 5 unique suggestions
            unique_suggestions = list(dict.fromkeys(suggestions))[:5]
            
            return unique_suggestions if unique_suggestions else SearchHistoryService._get_default_suggestions()
            
        finally:
            db.close()
    
    @staticmethod
    def _get_default_suggestions() -> List[str]:
        """Default suggestions for new users"""
        return [
            "Large craters on Mars",
            "Apollo landing sites",
            "Mountains on the Moon",
            "Recent discoveries",
            "Impact craters on Mercury"
        ]
    
    @staticmethod
    def get_trending_searches(days: int = 7, limit: int = 5) -> List[Dict[str, Any]]:
        """Get trending search queries across all users"""
        db = get_db_session()
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Get all searches in the time period
            searches = db.query(SearchHistory).filter(
                SearchHistory.timestamp >= cutoff_date
            ).all()
            
            # Count query frequency
            query_counts = Counter(s.query for s in searches)
            
            trending = [
                {"query": query, "count": count}
                for query, count in query_counts.most_common(limit)
            ]
            
            return trending
            
        finally:
            db.close()
