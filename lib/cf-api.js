// Fetches the full problem list from Codeforces API

const CF_API_BASE = 'https://codeforces.com/api';

/**
 * Fetches all problems from CF problemset.problems API.
 * Returns array of { contestId, index, name, rating, tags }
 */
export async function fetchAllProblems() {
  const url = `${CF_API_BASE}/problemset.problems`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/139.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`CF API returned ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== 'OK') {
    throw new Error(`CF API status: ${data.status}`);
  }

  return data.result.problems.filter(p => p.contestId !== undefined);
}
