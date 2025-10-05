# DeepSeek API Setup Guide

This project now uses DeepSeek API for fast, intelligent search - **replacing slow local models**.

## Why DeepSeek?

| Feature | Local Model (Old) | DeepSeek API (New) |
|---------|-------------------|-------------------|
| Speed | 5-10 seconds | 200-500ms |
| Setup Time | 10-30 minutes | 2 minutes |
| Cost | Free (but slow) | ~$0.00003/query |
| Quality | Good | Excellent |
| Memory | 2-4GB RAM | Minimal |

**Result: 10-20x faster with better results!**

## Quick Setup (2 minutes)

### Step 1: Get Free DeepSeek API Key

1. Go to: https://platform.deepseek.com/sign_up
2. Sign up (free account)
3. Go to API Keys: https://platform.deepseek.com/api_keys
4. Click "Create API Key"
5. Copy your API key

### Step 2: Add API Key to Project

Create `.env` file in project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your key:

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
```

### Step 3: Install Dependencies (if needed)

```bash
pip install httpx python-dotenv
```

### Step 4: Start Backend

```bash
python -m uvicorn backend.main:app --reload
```

You should see:
```
Using DeepSeek API-powered fast search
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 5: Test It!

```bash
python tests/test_deepseek_search.py
```

## Free Tier Limits

DeepSeek offers generous free credits:

- **First month**: Usually includes free credits
- **Cost after**: $0.28 per 1M input tokens, $0.42 per 1M output tokens
- **Per query cost**: ~$0.00003 (3 cents per 1000 queries)

For a personal project with 1000 searches/month = **$0.03/month**

## How It Works

### Old System (Slow)
```
User query → Load 2GB model → Generate embedding (5s) → 
Search 11,728 features → Return results
```

### New System (Fast)
```
User query → DeepSeek API (300ms) → Parse intent → 
Filter database → Return results
```

## API Features Used

### 1. Query Parsing
**Input**: "Show me large craters on the Moon"

**DeepSeek Returns**:
```json
{
  "target_body": "Moon",
  "category": "crater",
  "size_filter": "large",
  "search_keywords": ["crater", "large", "impact", "moon"],
  "confidence": 0.95
}
```

### 2. Natural Language Summary (Optional)
**Input**: Search results

**DeepSeek Returns**: 
"Found 15 large impact craters on the Moon, including Tycho and Copernicus."

## Testing

### Test 1: Quick Health Check
```bash
curl http://localhost:8000/health
```

### Test 2: Test Search
```bash
curl -X POST http://localhost:8000/search/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me large craters on the Moon", "limit": 5}'
```

### Test 3: Run Full Test Suite
```bash
python tests/test_deepseek_search.py
```

## Troubleshooting

### "Using legacy search (DeepSeek not available)"
- Check `.env` file exists in project root
- Check `DEEPSEEK_API_KEY` is set correctly
- Restart backend server

### "DeepSeek API error: 401"
- Invalid API key
- Get new key from https://platform.deepseek.com/api_keys

### "DeepSeek API timeout"
- Check internet connection
- DeepSeek API might be down (rare)
- System automatically falls back to keyword search

### Search still slow
- Make sure backend restarted after adding API key
- Check logs show "Using DeepSeek API-powered fast search"
- Old embedding generation is NOT used anymore

## Cost Management

### Stay Within Free Tier
The system is designed to be economical:

1. **Query parsing**: ~50 tokens input, ~100 tokens output = $0.00002
2. **Summary generation**: ~200 tokens total = $0.00001
3. **Total per search**: ~$0.00003

**1000 searches = $0.03 (3 cents)**

### Monitor Usage
Check your usage at: https://platform.deepseek.com/usage

### Disable Optional Features
In `backend/deepseek_service.py`, set:
```python
ENABLE_SUMMARIES = False  # Saves ~33% of API calls
```

## Comparison with OpenAI

| Feature | DeepSeek | OpenAI GPT-4 |
|---------|----------|--------------|
| Input cost | $0.28/1M tokens | $10/1M tokens |
| Output cost | $0.42/1M tokens | $30/1M tokens |
| Speed | Fast | Fast |
| Quality | Excellent | Excellent |
| **Per query** | **$0.00003** | **$0.001** |

**DeepSeek is 30x cheaper than OpenAI!**

## Advanced Configuration

### Adjust Token Limits
Edit `backend/deepseek_service.py`:

```python
MAX_TOKENS_OUTPUT = 200  # Lower = cheaper, faster
REQUEST_TIMEOUT = 10  # Seconds to wait for API
```

### Use Different Model
```python
# In deepseek_service.py
"model": "deepseek-chat"  # Fast, cheap
# OR
"model": "deepseek-reasoner"  # Slower, more intelligent
```

## Migration from Old System

The old embedding-based system is still available as fallback.

### If DeepSeek API fails:
1. System automatically uses keyword-based fallback
2. No errors, slightly lower quality results
3. Still faster than old embedding system

### To use old system:
1. Remove `DEEPSEEK_API_KEY` from `.env`
2. Backend will use legacy search automatically

## Next Steps

1. Get API key (2 minutes)
2. Add to `.env`
3. Restart backend
4. Test with `python tests/test_deepseek_search.py`
5. Enjoy 10-20x faster search!

## Support

- DeepSeek Docs: https://api-docs.deepseek.com/
- DeepSeek Discord: https://discord.gg/deepseek
- Project Issues: [Your GitHub repo]
