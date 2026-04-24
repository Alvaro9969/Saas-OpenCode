export function isValidTimeSlot(date: Date) {
  const minutes = date.getMinutes();

  return minutes === 0 || minutes === 30;
}