const fs = require('fs');
const content = fs.readFileSync('dist/assets/index-DgdEI27e.js', 'utf-8');

// The Dashboard component has texts like "Shaping", "ThreadCo CRM", "The All-In-One Intelligence"
const dashboardIndex = content.indexOf('ThreadCo CRM');
if (dashboardIndex !== -1) {
    // extract a 10000 character chunk around it to inspect
    const start = Math.max(0, dashboardIndex - 5000);
    const end = Math.min(content.length, dashboardIndex + 5000);
    console.log(content.substring(start, end));
}
