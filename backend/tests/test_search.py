"""
Comprehensive tests for sentence transformer-based search system.

Run tests with:
    pytest backend/tests/test_search.py -v
"""

import pytest
import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from backend.ai_service import (
    generate_embedding,
    parse_natural_query,
    cosine_similarity,
    create_searchable_text,
    get_model
)


class TestEmbeddingGeneration:
    """Tests for embedding generation with sentence transformers."""
    
    @pytest.mark.asyncio
    async def test_generate_embedding_basic(self):
        """Test that embeddings are generated correctly."""
        text = "Tycho is a large impact crater on the Moon"
        embedding = await generate_embedding(text)
        
        assert isinstance(embedding, list)
        assert len(embedding) == 384  # all-MiniLM-L6-v2 dimension
        assert all(isinstance(x, float) for x in embedding)
    
    @pytest.mark.asyncio
    async def test_generate_embedding_empty_string(self):
        """Test embedding generation with empty string."""
        embedding = await generate_embedding("")
        
        assert isinstance(embedding, list)
        assert len(embedding) == 384
    
    @pytest.mark.asyncio
    async def test_generate_embedding_consistency(self):
        """Test that same text generates same embedding."""
        text = "Mars crater formation"
        embedding1 = await generate_embedding(text)
        embedding2 = await generate_embedding(text)
        
        # Should be identical (deterministic)
        similarity = cosine_similarity(embedding1, embedding2)
        assert similarity > 0.999  # Allow for tiny floating point differences
    
    @pytest.mark.asyncio
    async def test_generate_embedding_different_texts(self):
        """Test that different texts generate different embeddings."""
        text1 = "Large lunar crater"
        text2 = "Martian volcano"
        
        embedding1 = await generate_embedding(text1)
        embedding2 = await generate_embedding(text2)
        
        # Should be different
        assert embedding1 != embedding2
    
    def test_model_initialization(self):
        """Test that model loads correctly."""
        model = get_model()
        assert model is not None
        assert model.get_sentence_embedding_dimension() == 384


class TestCosineSimilarity:
    """Tests for cosine similarity calculation."""
    
    @pytest.mark.asyncio
    async def test_identical_vectors_similarity(self):
        """Test similarity of identical vectors."""
        text = "Test text for similarity"
        embedding = await generate_embedding(text)
        
        similarity = cosine_similarity(embedding, embedding)
        assert 0.999 < similarity <= 1.0
    
    @pytest.mark.asyncio
    async def test_similar_texts_high_similarity(self):
        """Test that semantically similar texts have high similarity."""
        text1 = "large impact crater on the moon"
        text2 = "big lunar crater from meteorite"
        
        embedding1 = await generate_embedding(text1)
        embedding2 = await generate_embedding(text2)
        
        similarity = cosine_similarity(embedding1, embedding2)
        assert similarity > 0.6  # Should be fairly similar
    
    @pytest.mark.asyncio
    async def test_dissimilar_texts_low_similarity(self):
        """Test that unrelated texts have low similarity."""
        text1 = "lunar crater formation"
        text2 = "ocean currents and weather patterns"
        
        embedding1 = await generate_embedding(text1)
        embedding2 = await generate_embedding(text2)
        
        similarity = cosine_similarity(embedding1, embedding2)
        assert similarity < 0.5  # Should be dissimilar
    
    def test_zero_vector_similarity(self):
        """Test similarity with zero vector."""
        vec1 = [1.0, 2.0, 3.0]
        vec2 = [0.0, 0.0, 0.0]
        
        similarity = cosine_similarity(vec1, vec2)
        assert similarity == 0.0


class TestNaturalQueryParsing:
    """Tests for keyword-based natural language query parsing."""
    
    @pytest.mark.asyncio
    async def test_parse_body_extraction(self):
        """Test extraction of planetary body."""
        result = await parse_natural_query("show me craters on mars")
        assert result["target_body"] == "Mars"
        
        result = await parse_natural_query("lunar features")
        assert result["target_body"] == "Moon"
    
    @pytest.mark.asyncio
    async def test_parse_category_extraction(self):
        """Test extraction of feature category."""
        result = await parse_natural_query("show me craters on the moon")
        assert result["category"] == "Crater"
        
        result = await parse_natural_query("mountains on mars")
        assert result["category"] == "Mons"
        
        result = await parse_natural_query("valleys on mercury")
        assert result["category"] == "Vallis"
    
    @pytest.mark.asyncio
    async def test_parse_size_filter(self):
        """Test extraction of size filters."""
        result = await parse_natural_query("large craters on the moon")
        assert result["size_filter"] == "large"
        
        result = await parse_natural_query("small impact basins")
        assert result["size_filter"] == "small"
    
    @pytest.mark.asyncio
    async def test_parse_origin_filter(self):
        """Test extraction of origin filter."""
        result = await parse_natural_query("features named after scientists")
        assert result["origin_filter"] is True
        
        result = await parse_natural_query("show me craters")
        assert "origin_filter" not in result or result["origin_filter"] is not True
    
    @pytest.mark.asyncio
    async def test_parse_complex_query(self):
        """Test parsing of complex multi-part query."""
        result = await parse_natural_query("show me large craters on mars named after scientists")
        
        assert result["target_body"] == "Mars"
        assert result["category"] == "Crater"
        assert result["size_filter"] == "large"
        assert result["origin_filter"] is True
    
    @pytest.mark.asyncio
    async def test_parse_with_target_body_override(self):
        """Test that explicit target_body parameter takes precedence."""
        result = await parse_natural_query("show me craters", target_body="Mercury")
        assert result["target_body"] == "Mercury"


class TestSearchableTextCreation:
    """Tests for creating searchable text from feature data."""
    
    def test_create_searchable_text_complete(self):
        """Test with all fields present."""
        feature = {
            "feature_name": "Tycho",
            "target": "Moon",
            "category": "Crater",
            "origin": "Danish astronomer Tycho Brahe",
            "center_lat": -43.3,
            "center_lon": -11.2,
            "diameter": 85.0
        }
        
        text = create_searchable_text(feature)
        
        assert "Tycho" in text
        assert "Moon" in text
        assert "Crater" in text
        assert "Danish astronomer" in text
        assert "85" in text
    
    def test_create_searchable_text_minimal(self):
        """Test with minimal fields."""
        feature = {
            "feature_name": "TestFeature"
        }
        
        text = create_searchable_text(feature)
        assert "TestFeature" in text
    
    def test_create_searchable_text_empty(self):
        """Test with empty feature dictionary."""
        feature = {}
        text = create_searchable_text(feature)
        
        # Should return empty string or minimal text
        assert isinstance(text, str)


class TestSearchPerformance:
    """Tests for search system performance."""
    
    @pytest.mark.asyncio
    async def test_embedding_generation_speed(self):
        """Test that embedding generation is reasonably fast."""
        import time
        
        text = "Test feature for performance measurement"
        start_time = time.time()
        
        for _ in range(10):
            await generate_embedding(text)
        
        elapsed = time.time() - start_time
        avg_time = elapsed / 10
        
        # Should be fast with local model
        assert avg_time < 0.5  # Less than 500ms per embedding
    
    @pytest.mark.asyncio
    async def test_batch_embedding_generation(self):
        """Test generating embeddings for multiple texts."""
        texts = [
            "Tycho crater on the Moon",
            "Olympus Mons on Mars",
            "Caloris Basin on Mercury",
            "Valles Marineris canyon system",
            "Mare Tranquillitatis"
        ]
        
        embeddings = []
        for text in texts:
            emb = await generate_embedding(text)
            embeddings.append(emb)
        
        assert len(embeddings) == len(texts)
        assert all(len(emb) == 384 for emb in embeddings)


class TestSemanticSearchQuality:
    """Tests for semantic search quality."""
    
    @pytest.mark.asyncio
    async def test_lunar_crater_search(self):
        """Test search for lunar craters."""
        query = "famous crater on the moon with bright rays"
        query_emb = await generate_embedding(query)
        
        # Feature descriptions
        tycho = "Tycho is a large impact crater on the Moon with prominent ray system"
        olympus = "Olympus Mons is the largest volcano on Mars"
        
        tycho_emb = await generate_embedding(tycho)
        olympus_emb = await generate_embedding(olympus)
        
        tycho_sim = cosine_similarity(query_emb, tycho_emb)
        olympus_sim = cosine_similarity(query_emb, olympus_emb)
        
        # Tycho should be more similar to the query than Olympus Mons
        assert tycho_sim > olympus_sim
    
    @pytest.mark.asyncio
    async def test_martian_volcano_search(self):
        """Test search for martian volcanoes."""
        query = "largest mountain on mars"
        query_emb = await generate_embedding(query)
        
        olympus = "Olympus Mons is the largest volcano on Mars"
        tycho = "Tycho is a prominent impact crater on the Moon"
        
        olympus_emb = await generate_embedding(olympus)
        tycho_emb = await generate_embedding(tycho)
        
        olympus_sim = cosine_similarity(query_emb, olympus_emb)
        tycho_sim = cosine_similarity(query_emb, tycho_emb)
        
        # Olympus Mons should be more similar
        assert olympus_sim > tycho_sim
    
    @pytest.mark.asyncio
    async def test_category_based_search(self):
        """Test that category-specific searches work."""
        crater_query = "impact crater formation"
        valley_query = "canyon valley formation"
        
        crater_emb = await generate_embedding(crater_query)
        valley_emb = await generate_embedding(valley_query)
        
        crater_desc = "Large impact crater with central peak"
        valley_desc = "Deep valley carved by ancient water flow"
        
        crater_desc_emb = await generate_embedding(crater_desc)
        valley_desc_emb = await generate_embedding(valley_desc)
        
        # Each query should match its corresponding category better
        crater_to_crater = cosine_similarity(crater_emb, crater_desc_emb)
        crater_to_valley = cosine_similarity(crater_emb, valley_desc_emb)
        
        assert crater_to_crater > crater_to_valley


class TestInputValidation:
    """Tests for input validation and sanitization."""
    
    def test_sanitize_input_basic(self):
        """Test basic input sanitization."""
        from backend.ai_service import sanitize_input
        
        # Test whitespace trimming
        assert sanitize_input("  hello world  ") == "hello world"
        
        # Test multiple spaces
        assert sanitize_input("hello    world") == "hello world"
        
        # Test null bytes
        assert sanitize_input("hello\x00world") == "helloworld"
    
    def test_validate_query_empty(self):
        """Test validation of empty queries."""
        from backend.ai_service import validate_query
        
        is_valid, error = validate_query("")
        assert not is_valid
        assert "empty" in error.lower()
        
        is_valid, error = validate_query("   ")
        assert not is_valid
        assert "empty" in error.lower()
    
    def test_validate_query_too_short(self):
        """Test validation of too short queries."""
        from backend.ai_service import validate_query
        
        is_valid, error = validate_query("a")
        assert not is_valid
        assert "at least" in error.lower()
    
    def test_validate_query_too_long(self):
        """Test validation of too long queries."""
        from backend.ai_service import validate_query
        
        long_query = "a" * 501
        is_valid, error = validate_query(long_query)
        assert not is_valid
        assert "less than" in error.lower()
    
    def test_validate_query_dangerous_patterns(self):
        """Test validation rejects dangerous patterns."""
        from backend.ai_service import validate_query
        
        # SQL injection attempts
        is_valid, error = validate_query("show me craters; DROP TABLE users")
        assert not is_valid
        
        is_valid, error = validate_query("craters UNION SELECT * FROM passwords")
        assert not is_valid
        
        # Shell injection attempts
        is_valid, error = validate_query("craters | rm -rf /")
        assert not is_valid
    
    def test_validate_query_valid(self):
        """Test validation accepts valid queries."""
        from backend.ai_service import validate_query
        
        is_valid, error = validate_query("show me craters on mars")
        assert is_valid
        assert error is None
        
        is_valid, error = validate_query("large impact basins")
        assert is_valid
        assert error is None
    
    @pytest.mark.asyncio
    async def test_generate_embedding_with_validation(self):
        """Test that generate_embedding validates input by default."""
        # Valid query should work
        embedding = await generate_embedding("mars craters")
        assert len(embedding) == 384
        
        # Invalid query should raise ValueError
        with pytest.raises(ValueError, match="Invalid query"):
            await generate_embedding("")
        
        with pytest.raises(ValueError, match="Invalid query"):
            await generate_embedding("a")
    
    @pytest.mark.asyncio
    async def test_generate_embedding_skip_validation(self):
        """Test that validation can be skipped for trusted data."""
        # Short text should work with validate=False
        embedding = await generate_embedding("a", validate=False)
        assert len(embedding) == 384


class TestEventQueries:
    """Tests for event-based queries (dust storms, wildfires, etc.)."""
    
    @pytest.mark.asyncio
    async def test_parse_dust_storm_query(self):
        """Test parsing of dust storm queries."""
        result = await parse_natural_query("show me dust storms on mars")
        
        assert result["search_type"] == "event"
        assert result["target_body"] == "Mars"
        assert result["event_category"] == "Dust and Haze"
        assert "warning" in result
        assert "EONET" in result["warning"]
    
    @pytest.mark.asyncio
    async def test_parse_wildfire_query(self):
        """Test parsing of wildfire queries."""
        result = await parse_natural_query("wildfires in california")
        
        assert result["search_type"] == "event"
        assert result["event_category"] == "Wildfires"
    
    @pytest.mark.asyncio
    async def test_parse_volcano_query(self):
        """Test parsing of volcano queries."""
        result = await parse_natural_query("volcanic eruptions")
        
        assert result["search_type"] == "event"
        assert result["event_category"] == "Volcanoes"
    
    @pytest.mark.asyncio
    async def test_parse_feature_vs_event(self):
        """Test that feature queries don't trigger event search."""
        result = await parse_natural_query("craters on the moon")
        
        assert result["search_type"] == "feature"
        assert "event_category" not in result
        assert "warning" not in result
    
    @pytest.mark.asyncio
    async def test_parse_lunar_synonym(self):
        """Test that 'lunar' is recognized as Moon."""
        result = await parse_natural_query("lunar craters")
        
        assert result["target_body"] == "Moon"
        assert result["search_type"] == "feature"
    
    @pytest.mark.asyncio
    async def test_parse_martian_synonym(self):
        """Test that 'martian' is recognized as Mars."""
        result = await parse_natural_query("martian dust storms")
        
        assert result["target_body"] == "Mars"
        assert result["search_type"] == "event"


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
