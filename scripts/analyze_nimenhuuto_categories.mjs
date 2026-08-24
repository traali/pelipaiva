(async () => {
  const url = 'https://westendindiansp14.nimenhuuto.com/calendar/ical';
  const res = await fetch(url);
  const text = await res.text();
  
  // Find all CATEGORIES and unique SUMMARY samples
  const categories = new Set();
  const summarySamples = [];
  const descriptions = [];

  const vevents = text.split('BEGIN:VEVENT');
  for (const v of vevents.slice(1)) {
    const catMatch = v.match(/CATEGORIES:(.+)/i);
    if (catMatch) categories.add(catMatch[1].trim());

    const sumMatch = v.match(/SUMMARY:(.+)/i);
    const descMatch = v.match(/DESCRIPTION:([\s\S]*?)(?=\n[A-Z-]+:|\nEND:VEVENT)/i);
    
    if (sumMatch && summarySamples.length < 15) {
      summarySamples.push({
        summary: sumMatch[1].trim(),
        category: catMatch ? catMatch[1].trim() : undefined,
        description: descMatch ? descMatch[1].trim().slice(0, 150) : undefined
      });
    }
  }

  console.log('--- DETECTED CATEGORIES IN THIS FEED ---');
  console.log(Array.from(categories));
  console.log('--- SAMPLE EVENTS ---');
  console.log(JSON.stringify(summarySamples.slice(0, 8), null, 2));
})();
