const html = await fetch('https://stockanalysis.com/stocks/jpm/financials/ratios/?p=annual', {
  headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' }
}).then(r => r.text())

const fields = [...html.matchAll(/(?:^|[,{])(\w+):\[/gm)].map(m => m[1])
console.log('JPM ratios fields:', [...new Set(fields)].join(', '))

// Also check JPM income statement for bank-specific fields
const incHtml = await fetch('https://stockanalysis.com/stocks/jpm/financials/?p=annual', {
  headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' }
}).then(r => r.text())

const incFields = [...incHtml.matchAll(/(?:^|[,{])(\w+):\[/gm)].map(m => m[1])
console.log('\nJPM income fields:', [...new Set(incFields)].join(', '))
