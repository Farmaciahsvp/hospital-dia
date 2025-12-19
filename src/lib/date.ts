import { format } from "date-fns";

export function toISODateString(date: Date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return format(new Date(), "yyyy-MM-dd");
  }
  return format(date, "yyyy-MM-dd");
}
