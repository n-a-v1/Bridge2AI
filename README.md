# PRODUCTION READY - SQL Query System

✅ TESTED AND WORKING

## Setup (4 Commands)

npm install
npm run setup
node src/index.js add-key anthropic YOUR-KEY
for file in data/*.xlsx; do node src/index.js import "$file"; done

## Test

node src/index.js chat

Try these:
- List all orders late in December 2025
- Who are the top 5 customers with delayed orders in 2024 and 2025?
- Which part numbers had the most delays in 2025?

All queries work!
