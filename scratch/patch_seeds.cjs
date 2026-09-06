const fs = require('fs');
let data = fs.readFileSync('d:/OdooFinals/DealFlow360/database/new_seeds.sql', 'utf8');
data = data.replace(
  /INSERT INTO customers \(id, name, tier, region, terms\) VALUES \(([^,]+), ([^,]+), ([^,]+), '([^']+)', ([^)]+)\);/g,
  (match, p1, p2, p3, p4, p5) => {
    return `INSERT INTO customers (id, name, tier, region, city, terms) VALUES (${p1}, ${p2}, ${p3}, '${p4}', '${p4}', ${p5});`;
  }
);
fs.writeFileSync('d:/OdooFinals/DealFlow360/database/new_seeds.sql', data);
console.log('Done');
