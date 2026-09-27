// lib/utils/dateFormatter.ts
// OR add this to your existing lib/utils.ts file

/**
 * Formats a timestamp to relative time (e.g., "2 hours ago", "3 days ago")
 * Handles timezones automatically by using the user's local time
 * 
 * @param timestamp - Unix timestamp in milliseconds (from Convex _creationTime)
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  // Convert to seconds
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) {
    return seconds <= 1 ? "just now" : `${seconds} seconds ago`;
  } else if (minutes < 60) {
    return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`;
  } else if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  } else if (days < 7) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  } else if (weeks < 4) {
    return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
  } else if (months < 12) {
    return months === 1 ? "1 month ago" : `${months} months ago`;
  } else {
    return years === 1 ? "1 year ago" : `${years} years ago`;
  }
}

/**
 * Alternative: Use Intl.RelativeTimeFormat for internationalization
 * This provides localized relative time strings
 */
export function formatRelativeTimeIntl(timestamp: number, locale: string = 'en'): string {
  const now = Date.now();
  const diff = timestamp - now;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(seconds) < 60) {
    return rtf.format(seconds, 'second');
  } else if (Math.abs(minutes) < 60) {
    return rtf.format(minutes, 'minute');
  } else if (Math.abs(hours) < 24) {
    return rtf.format(hours, 'hour');
  } else if (Math.abs(days) < 7) {
    return rtf.format(days, 'day');
  } else if (Math.abs(weeks) < 4) {
    return rtf.format(weeks, 'week');
  } else if (Math.abs(months) < 12) {
    return rtf.format(months, 'month');
  } else {
    return rtf.format(years, 'year');
  }
}

/**
 * Format full date for hover tooltip or detailed views
 * Automatically converts to user's timezone
 */
export function formatFullDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

// USAGE EXAMPLES:

/*
// In your VideoCard component:
import { formatRelativeTime, formatFullDate } from '@/lib/utils/dateFormatter';

const Videocard = ({ videoId, onClick }: VideocardProps) => {
  const video = useQuery(api.videos.getvideobyId, { videoId: videoId });
  
  // ... other code ...
  
  return (
    <div>
      <p 
        className="text-sm text-muted-foreground"
        title={formatFullDate(video._creationTime)} // Shows full date on hover
      >
        {formatRelativeTime(video._creationTime)}
      </p>
    </div>
  );
};

// In WatchList or VideoPage:
import { formatRelativeTime } from '@/lib/utils/dateFormatter';

const formatDate = (timestamp: number) => {
  return formatRelativeTime(timestamp);
};
*/