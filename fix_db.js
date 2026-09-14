const fs = require('fs');
const DB_FILE = './database.json';
if (fs.existsSync(DB_FILE)) {
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  const seen = new Set();
  const newTxs = [];
  let duplicates = 0;
  for (const tx of data.transactions) {
    if (seen.has(tx.id)) {
      duplicates++;
      tx.id = tx.id + '_' + duplicates;
    }
    seen.add(tx.id);
    newTxs.push(tx);
  }
  data.transactions = newTxs;
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Fixed', duplicates, 'duplicates');
} else {
  console.log('No DB file');
}
