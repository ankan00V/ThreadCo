const fs = require('fs');
const content = fs.readFileSync('dist/assets/index-DgdEI27e.js', 'utf-8');

const dashboardIndex = content.indexOf('Shaping');
if (dashboardIndex !== -1) {
    const start = Math.max(0, dashboardIndex - 5000);
    const end = Math.min(content.length, dashboardIndex + 5000);
    console.log(content.substring(start, end));
}
