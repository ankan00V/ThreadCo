import json

log_path = '/Users/ankanghosh/.gemini/antigravity/brain/9cd97bbc-e7c3-46a3-a4eb-dce04f8ac63d/.system_generated/logs/transcript.jsonl'

files = {
    'index.css': '/Users/ankanghosh/Desktop/xeno/xeno-crm-frontend/src/index.css',
    'Layout.jsx': '/Users/ankanghosh/Desktop/xeno/xeno-crm-frontend/src/components/Layout.jsx',
    'Dashboard.jsx': '/Users/ankanghosh/Desktop/xeno/xeno-crm-frontend/src/pages/Dashboard.jsx'
}

content_map = {}

with open(log_path, 'r') as f:
    for line in f:
        try:
            step = json.loads(line)
            # Find all write_to_file calls. 
            if 'tool_calls' in step:
                for call in step['tool_calls']:
                    if call.get('name') == 'default_api:write_to_file':
                        args = call.get('arguments', {})
                        tgt = args.get('TargetFile', '')
                        if tgt in files.values():
                            # Save it! Because we are iterating chronologically, 
                            # we want the LAST one before 16:55
                            content_map[tgt] = args.get('CodeContent', '')
                            
        except Exception:
            pass

# Now let's print out what we found
for name, path in files.items():
    if path in content_map:
        print(f"Found {name} with length {len(content_map[path])}")
        with open(path, 'w') as out:
            out.write(content_map[path])
    else:
        print(f"Could not find write_to_file for {name}")

