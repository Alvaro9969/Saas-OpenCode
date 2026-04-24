import { generateTimeSlots } from "../services/generateTimeSlots";

const slots = generateTimeSlots("13:00", "15:00");

console.log(slots);