const html = await fetch('https://stockanalysis.com/stocks/jpm/financials/ratios/?p=annual', {
  headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html' }
}).then(r => r.text())

function extract(field) {
  const re = new RegExp(`(?:^|[,{])${field}:\\[([^\\]]+)\\]`)
  const m = html.match(re)
  return m ? m[1].slice(0, 100) : 'NOT FOUND'
}

for (const f of ['roa','roic','roce','pb','roe','pe','peForward']) {
  console.log(`${f}: ${extract(f)}`)
}
