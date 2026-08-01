const CF_API_BASE = 'https://codeforces.com/api';

export async function fetchAllProblems() {
  const url = `${CF_API_BASE}/problemset.problems`;
  console.log(`[cf-api] Fetching problem list from ${url} ...`);

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/139.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`CF API returned HTTP ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(`CF API error status: ${data.status}`);
  }

  const problems = data.result.problems.filter(p => p.contestId !== undefined);
  console.log(`[cf-api] ✓ Fetched ${problems.length} problems from CF API`);
  return problems;
}
