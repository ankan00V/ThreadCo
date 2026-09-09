import re

with open("src/pages/Dashboard.jsx", "r") as f:
    content = f.read()

# Replace c.conversion_rate || 0 with actual calculation
calc_str = r"{(c.total_sent > 0 ? ((c.total_clicked / c.total_sent) * 100).toFixed(1) : 0)}"
content = content.replace("{(c.conversion_rate || 0)}%", calc_str + "%")

with open("src/pages/Dashboard.jsx", "w") as f:
    f.write(content)

