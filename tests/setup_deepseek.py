#!/usr/bin/env python3
"""
Quick setup script for DeepSeek API key
"""

import os
from pathlib import Path

print("="*70)
print("  DeepSeek API Setup")
print("="*70)

# Check if .env exists
env_path = Path(".env")
if not env_path.exists():
    print("\nCreating .env file from .env.example...")
    with open(".env.example", "r") as src:
        with open(".env", "w") as dst:
            dst.write(src.read())
    print(".env file created!")

# Get API key from user
print("\nPaste your DeepSeek API key (starts with 'sk-'):")
print("(Get it from: https://platform.deepseek.com/api_keys)")
api_key = input("\nAPI Key: ").strip()

if not api_key:
    print("\nNo key provided. Exiting...")
    exit(1)

if not api_key.startswith("sk-"):
    print("\nWarning: API key should start with 'sk-'")
    confirm = input("Continue anyway? (y/n): ")
    if confirm.lower() != 'y':
        exit(1)

# Read existing .env
with open(".env", "r") as f:
    lines = f.readlines()

# Update or add DEEPSEEK_API_KEY
key_found = False
new_lines = []

for line in lines:
    if line.startswith("DEEPSEEK_API_KEY"):
        new_lines.append(f"DEEPSEEK_API_KEY={api_key}\n")
        key_found = True
    else:
        new_lines.append(line)

if not key_found:
    new_lines.append(f"\nDEEPSEEK_API_KEY={api_key}\n")

# Write back
with open(".env", "w") as f:
    f.writelines(new_lines)

print("\n" + "="*70)
print("  SUCCESS! DeepSeek API key configured")
print("="*70)
print("\nNext steps:")
print("1. Start backend: python -m uvicorn backend.main:app --reload")
print("2. Test it: python tests/test_deepseek_search.py")
print("\nYou should see: 'Using DeepSeek API-powered fast search'")
print("="*70)
