export function generateTimeSlots(openTime: string, closeTime: string) {
  const slots: string[] = [];

  const [openHour, openMinute] = openTime.split(":").map(Number);
  const [closeHour, closeMinute] = closeTime.split(":").map(Number);

  let currentMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  while (currentMinutes < closeMinutes) {
    const hours = Math.floor(currentMinutes / 60)
      .toString()
      .padStart(2, "0");

    const minutes = (currentMinutes % 60)
      .toString()
      .padStart(2, "0");

    slots.push(`${hours}:${minutes}`);

    currentMinutes += 30;
  }

  return slots;
}