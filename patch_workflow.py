import re

with open(".github/workflows/keep-render-awake.yml", "r") as f:
    content = f.read()

# Replace the env var usage with the hardcoded URL
new_run_block = """
        run: |
          curl --fail --silent --show-error --location \\
            --connect-timeout 15 --max-time 90 --retry 2 --retry-all-errors \\
            "https://threadco-api.onrender.com/healthz"
"""

content = re.sub(r'        run: \|\s+test -n.*?BACKEND_HEALTH_URL"', new_run_block.strip(), content, flags=re.DOTALL)

with open(".github/workflows/keep-render-awake.yml", "w") as f:
    f.write(content)

