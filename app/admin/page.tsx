import { auth } from "@/lib/auth";
import { getReservations } from "@/lib/reservations/getReservations";
import { getAvailableTimeSlots } from "@/services/getAvailableTimeSlots";
import type { Reservation } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const session = await auth();

  if (!session?.user?.restaurantId) {
    redirect("/");
  }

  const restaurantId = session.user.restaurantId;

  // 1. Obtener fecha desde URL o usar hoy
  const selectedDate =
    searchParams.date ?? new Date().toISOString().split("T")[0];

  const date = new Date(selectedDate);

  // 2. Obtener datos
  const reservations = await getReservations(restaurantId);
  const slots = await getAvailableTimeSlots(restaurantId, date);

  return (
    <div>
      <h1>Panel Admin</h1>

      {/* Fecha */}
      <p>Fecha seleccionada: {selectedDate}</p>

      {/* Reservas */}
      <h2>Reservas</h2>
      <ul>
        {reservations.map((reservation: Reservation) => (
          <li key={reservation.id}>
            {reservation.customerName} -{" "}
            {new Date(reservation.dateTime).toLocaleString()} -{" "}
            {reservation.partySize} personas
          </li>
        ))}
      </ul>

      {/* Slots */}
      <h2>Slots disponibles</h2>
      <ul>
        {slots.map((slot) => (
          <li key={slot}>{slot}</li>
        ))}
      </ul>
    </div>
  );
}
