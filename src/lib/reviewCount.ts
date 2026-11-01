/** Review counts as GrabFood shows them: exact under 1,000, then rounded down like "6K+". */
export function formatReviewCount(count: number) {
  return count >= 1000 ? `${Math.floor(count / 1000)}K+` : String(count);
}
