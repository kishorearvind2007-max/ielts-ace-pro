#!/bin/bash

# Test NVIDIA API with Kimi K2 model for reading passage generation

API_KEY="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"
API_URL="https://integrate.api.nvidia.com/v1/chat/completions"

echo "Testing NVIDIA API with Kimi K2 model..."
echo "=========================================="
echo

# Create JSON payload file
cat > /tmp/payload.json << 'JSONEOF'
{
  "model": "moonshotai/kimi-k2-instruct-0905",
  "messages": [
    {
      "role": "user",
      "content": "Generate IELTS Academic Reading test content in JSON only.\n\nReturn JSON with this exact shape:\n{\n  \"passages\": [\n    {\n      \"id\": 1,\n      \"title\": \"...\",\n      \"text\": \"...\",\n      \"questions\": [\n        {\n          \"id\": 1,\n          \"type\": \"mcq\" | \"short-answer\" | \"true-false-ng\",\n          \"text\": \"...\",\n          \"options\": [\"...\"]\n        }\n      ],\n      \"answerKey\": {\n        \"1\": \"...\"\n      }\n    }\n  ]\n}\n\nStrict constraints:\n- Generate exactly 3 passages (id: 1, 2, 3).\n- Generate exactly 40 questions total across all passages.\n- Question ids must be unique and sequential from 1 to 40.\n- Passage 1: 13 questions (1-13), Passage 2: 13 questions (14-26), Passage 3: 14 questions (27-40).\n- Each passage must be IELTS Academic Reading style only.\n- The passage text must be original, realistic, and around 650-850 words.\n- Use only IELTS-appropriate domains: science, environment, education, health, technology, history, society.\n- Do not output stories, fiction, personal blogs, dialogues, poems, or non-IELTS formats.\n- Include a mix of question types: mcq, true-false-ng, and short-answer.\n- For type mcq, provide exactly 4 options.\n- For type true-false-ng, options must be exactly [\"True\", \"False\", \"Not Given\"].\n- Every question id must have an answer in answerKey.\n- Answers must be concise strings and match the generated passage content.\n- Difficulty level: Band 6.\n\nReturn JSON only. No markdown, no extra text."
    }
  ],
  "temperature": 1,
  "top_p": 0.95,
  "max_tokens": 4096,
  "stream": false
}
JSONEOF

# Make the curl request
RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d "@/tmp/payload.json")

# Check if curl succeeded
if [ $? -ne 0 ]; then
  echo "ERROR: curl request failed"
  exit 1
fi

echo "Raw response:"
echo "$RESPONSE" | python -m json.tool 2>/dev/null || echo "$RESPONSE"
echo
echo "=========================================="
echo

# Extract the content
CONTENT=$(echo "$RESPONSE" | python -c "import sys, json; data=json.load(sys.stdin); print(data.get('choices', [{}])[0].get('message', {}).get('content', ''))" 2>/dev/null)

if [ -z "$CONTENT" ]; then
  echo "ERROR: No content in response"
  echo "Full response saved to test-response.json"
  echo "$RESPONSE" > test-response.json
  exit 1
fi

echo "Extracted content:"
echo "$CONTENT"
echo
echo "=========================================="
echo

# Try to extract and parse JSON
JSON_CONTENT=$(echo "$CONTENT" | python -c "
import sys, re, json
content = sys.stdin.read()
# Remove markdown code blocks
match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content, re.IGNORECASE)
if match:
    content = match.group(1).strip()
# Find first { and last }
start = content.find('{')
end = content.rfind('}')
if start != -1 and end != -1 and end > start:
    content = content[start:end+1]
print(content)
")

echo "Extracted JSON:"
echo "$JSON_CONTENT" | python -m json.tool 2>/dev/null
echo
echo "=========================================="
echo

# Validate the JSON structure
echo "Validating JSON structure..."
VALIDATION=$(echo "$JSON_CONTENT" | python -c "
import sys, json
try:
    data = json.load(sys.stdin)
    passages = data.get('passages', [])
    print(f'Passages count: {len(passages)}')
    total_questions = sum(len(p.get('questions', [])) for p in passages)
    print(f'Total questions: {total_questions}')
    for i, p in enumerate(passages):
        q_count = len(p.get('questions', []))
        print(f'  Passage {i+1}: {q_count} questions')
    if len(passages) == 3 and total_questions == 40:
        print('VALID: Structure matches requirements')
    else:
        print('INVALID: Structure does not match requirements')
except Exception as e:
    print(f'ERROR: {e}')
" 2>/dev/null)

echo "$VALIDATION"
echo
echo "Full response saved to test-response.json"
echo "$RESPONSE" > test-response.json
