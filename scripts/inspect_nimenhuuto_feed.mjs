(async () => {
  const url = 'https://westendindiansp14.nimenhuuto.com/calendar/ical';
  console.log('Fetching', url);
  try {
    const res = await fetch(url);
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Length:', text.length);
    console.log('--- FIRST 2000 CHARACTERS ---');
    console.log(text.slice(0, 2000));
  } catch (err) {
    console.error('Fetch error:', err);
  }
})();
