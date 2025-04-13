/**
 * Formats a timestamp into a human-readable relative time string
 * @param dateString ISO date string or Date object
 * @returns Human-readable relative time (e.g., "just now", "5 mins ago", "yesterday")
 */
export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  // Just now (less than 1 minute)
  if (seconds < 60) {
    return 'just now';
  }
  
  // X minutes ago (less than 1 hour)
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ago`;
  }
  
  // X hours ago (less than 1 day)
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  // Yesterday
  const days = Math.floor(hours / 24);
  if (days === 1) {
    return 'yesterday';
  }
  
  // X days ago (less than 7 days)
  if (days < 7) {
    return `${days} days ago`;
  }
  
  // Format as date for older entries
  return formatDate(date);
}

/**
 * Formats a date as a readable string
 * @param date The date to format
 * @returns Formatted date string (e.g., "May 15, 2023")
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
