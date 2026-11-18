// Mock data (same shape as the backend responses). Used only when the API client is not available.
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();

export const mockOwners = [
  { id: 1, ownerName: "Nimal Perera", phone: "0771234567", email: "nimal@example.lk", address: "Negombo", nic: "198512345678", businessRegistrationNo: "BR-1001", status: "active", notes: "Preferred partner", createdAt: daysAgo(60) },
  { id: 2, ownerName: "Kamal Fernando", phone: "0712345678", email: "kamal@example.lk", address: "Colombo 05", nic: "197845678912", businessRegistrationNo: "BR-1002", status: "active", notes: "", createdAt: daysAgo(52) },
  { id: 3, ownerName: "Sunil Silva", phone: "0761122334", email: "sunil@example.lk", address: "Kandy", nic: "822345678V", businessRegistrationNo: null, status: "active", notes: "", createdAt: daysAgo(45) },
  { id: 4, ownerName: "Ruwan Jayasinghe", phone: "0753344556", email: "ruwan@example.lk", address: "Galle", nic: "199056781234", businessRegistrationNo: "BR-1004", status: "inactive", notes: "Paused for the season", createdAt: daysAgo(30) },
  { id: 5, ownerName: "Dilani Wickramasinghe", phone: "0779988776", email: "dilani@example.lk", address: "Kurunegala", nic: "199267891234", businessRegistrationNo: "BR-1005", status: "active", notes: "", createdAt: daysAgo(21) },
  { id: 6, ownerName: "Chaminda Bandara", phone: "0705566778", email: "chaminda@example.lk", address: "Matara", nic: "791234567V", businessRegistrationNo: null, status: "active", notes: "", createdAt: daysAgo(12) },
  { id: 7, ownerName: "Anoma Rajapaksha", phone: "0786677889", email: "anoma@example.lk", address: "Anuradhapura", nic: "198834567891", businessRegistrationNo: "BR-1007", status: "inactive", notes: "", createdAt: daysAgo(6) },
];

const bus = (id, ownerId, reg, name, type, seats, ac, status, facilities, description) => ({
  id, ownerId, registrationNumber: reg, busName: name, busType: type, seatingCapacity: seats,
  airConditioned: ac, status, facilities, description, imageUrl: null, images: [],
  isAvailable: status === "available", createdAt: daysAgo(40 - id * 3),
});

export const mockBuses = [
  bus(1, 1, "NB-1234", "Ocean Star", "Luxury Coach", 45, true, "available", ["AC", "Wi-Fi", "USB Charging"], "Comfortable long-distance coach."),
  bus(2, 1, "NB-5678", "Sea Breeze", "Semi Luxury", 49, false, "assigned", ["Music System", "Reclining Seats"], ""),
  bus(3, 2, "WP-4455", "City Liner", "Mini Bus", 28, true, "available", ["AC", "Wi-Fi"], ""),
  bus(4, 2, "WP-7788", "Capital Express", "Luxury Coach", 40, true, "maintenance", ["AC", "TV", "Wi-Fi"], "In workshop until next week."),
  bus(5, 3, "CP-3021", "Hill Rider", "Semi Luxury", 52, false, "available", ["Luggage Space"], ""),
  bus(6, 3, "CP-9090", "Kandy Queen", "Luxury Coach", 44, true, "assigned", ["AC", "Wi-Fi", "Toilet"], ""),
  bus(7, 5, "NW-2210", "Royal Voyager", "Luxury Coach", 46, true, "available", ["AC", "USB Charging", "TV"], ""),
  bus(8, 6, "SP-6612", "Southern Pearl", "Mini Bus", 24, false, "inactive", ["Music System"], ""),
  bus(9, 6, "SP-1100", "Matara Mail", "Semi Luxury", 50, true, "available", ["AC"], ""),
];

export const mockDashboard = {
  summary: { totalBusOwners: 7, totalBuses: 9, availableBuses: 5, unavailableBuses: 4, totalDrivers: 18, totalTours: 36, pendingAssignments: 5 },
  busOwners: { active: 5, inactive: 2, total: 7 },
  buses: { available: 5, assigned: 2, maintenance: 1, inactive: 1, total: 9, airConditioned: 6, nonAirConditioned: 3, withoutImages: 9, availableSeats: 214 },
  drivers: { active: 15, inactive: 2, suspended: 1, total: 18 },
  tours: { planned: 9, ongoing: 3, completed: 21, cancelled: 3, total: 36 },
  assignments: { pending: 5, confirmed: 8, rejected: 1, cancelled: 2, completed: 20, total: 36 },
  topOwnersByBuses: [
    { id: 1, ownerName: "Nimal Perera", busCount: 2 },
    { id: 2, ownerName: "Kamal Fernando", busCount: 2 },
    { id: 3, ownerName: "Sunil Silva", busCount: 2 },
    { id: 6, ownerName: "Chaminda Bandara", busCount: 2 },
    { id: 5, ownerName: "Dilani Wickramasinghe", busCount: 1 },
  ],
};

export const mockTours = [
  { id: 1, tourCode: "TR-001", tourName: "Southern Tour", destination: "Galle", startAt: daysAgo(-3), status: "planned" },
  { id: 2, tourCode: "TR-004", tourName: "Hill Country Tour", destination: "Nuwara Eliya", startAt: daysAgo(-6), status: "planned" },
  { id: 3, tourCode: "TR-007", tourName: "Cultural Triangle", destination: "Sigiriya", startAt: daysAgo(-9), status: "planned" },
  { id: 4, tourCode: "TR-009", tourName: "East Coast Trip", destination: "Trincomalee", startAt: daysAgo(-14), status: "planned" },
];

export const mockActivities = [
  { id: 1, action: "buses.create", entityType: "Bus", description: "Bus NW-2210 created", createdAt: daysAgo(0.05), user: { firstName: "Admin", lastName: "" } },
  { id: 2, action: "bus-owners.update", entityType: "BusOwner", description: "Owner Ruwan Jayasinghe set to inactive", createdAt: daysAgo(0.4), user: { firstName: "Admin", lastName: "" } },
  { id: 3, action: "assignments.create", entityType: "TourAssignment", description: "Bus NB-5678 assigned to Southern Tour", createdAt: daysAgo(1), user: { firstName: "Admin", lastName: "" } },
  { id: 4, action: "drivers.status.update", entityType: "Driver", description: "Driver status changed to active", createdAt: daysAgo(2), user: { firstName: "Admin", lastName: "" } },
  { id: 5, action: "buses.availability", entityType: "Bus", description: "Bus WP-7788 set to maintenance", createdAt: daysAgo(3), user: { firstName: "Admin", lastName: "" } },
];

export const mockProfile = { id: 1, firstName: "System", lastName: "Administrator", email: "admin@buspool.lk", role: "admin" };
