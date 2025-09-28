import type { Car, Picture } from "../types"

const createPicture = (url: string, title: string): Picture => {
  const timestamp = new Date().toISOString()
  return {
    id: url,
    title,
    imageUrl: url,
    createdAt: timestamp,
    updatedAt: timestamp,
    description: title,
  }
}

export const mockCars: Car[] = [
  {
    id: "1",
    _id: "car-1",
    images: [
      createPicture("/placeholder.svg?height=300&width=400", "Toyota Camry - Front"),
      createPicture("/placeholder.svg?height=300&width=401", "Toyota Camry - Interior"),
      createPicture("/placeholder.svg?height=300&width=402", "Toyota Camry - Rear"),
    ],
    year: 2022,
    make: "Toyota",
    model: "Camry",
    price: 28500,
    kilometers: 15000,
    color: "White",
    transmission: "automatic",
    vin: "1HGBH41JXMN109186",
    notes: "Excellent condition, one owner, full service history",
    status: "in-stock",
    createdAt: "2024-01-15T10:00:00Z",
    auditLog: [
      {
        action: "Created",
        user: "Admin",
        timestamp: "2024-01-15T10:00:00Z",
        details: "Car added to inventory",
      },
    ],
  },
  {
    id: "2",
    _id: "car-2",
    images: [
      createPicture("/placeholder.svg?height=300&width=403", "Honda Civic - Front"),
      createPicture("/placeholder.svg?height=300&width=404", "Honda Civic - Cabin"),
    ],
    year: 2021,
    make: "Honda",
    model: "Civic",
    price: 24000,
    kilometers: 22000,
    color: "Blue",
    transmission: "manual",
    vin: "2HGFC2F59MH123456",
    notes: "Sport trim, low mileage, garage kept",
    status: "reserved",
    reservedBy: "John Doe",
    createdAt: "2024-01-10T14:30:00Z",
    auditLog: [
      {
        action: "Created",
        user: "Admin",
        timestamp: "2024-01-10T14:30:00Z",
        details: "Car added to inventory",
      },
      {
        action: "Reserved",
        user: "Sales Rep",
        timestamp: "2024-01-20T09:15:00Z",
        details: "Reserved by John Doe",
      },
    ],
  },
  {
    id: "3",
    _id: "car-3",
    images: [createPicture("/placeholder.svg?height=300&width=405", "Tesla Model 3 - Exterior")],
    year: 2023,
    make: "Tesla",
    model: "Model 3",
    price: 42000,
    kilometers: 5000,
    color: "Black",
    transmission: "automatic",
    vin: "5YJ3E1EA4MF123789",
    notes: "Electric vehicle, autopilot, premium interior",
    status: "coming",
    createdAt: "2024-01-12T16:45:00Z",
    auditLog: [
      {
        action: "Created",
        user: "Admin",
        timestamp: "2024-01-12T16:45:00Z",
        details: "Car scheduled for arrival",
      },
    ],
  },
  {
    id: "4",
    _id: "car-4",
    images: [
      createPicture("/placeholder.svg?height=300&width=406", "BMW 3 Series - Front"),
      createPicture("/placeholder.svg?height=300&width=407", "BMW 3 Series - Dashboard"),
    ],
    year: 2020,
    make: "BMW",
    model: "3 Series",
    price: 35000,
    kilometers: 35000,
    color: "Silver",
    transmission: "automatic",
    vin: "WBA8E9G50LNT12345",
    notes: "Luxury package, leather seats, navigation",
    status: "sold",
    createdAt: "2024-01-08T11:20:00Z",
    auditLog: [
      {
        action: "Created",
        user: "Admin",
        timestamp: "2024-01-08T11:20:00Z",
        details: "Car added to inventory",
      },
      {
        action: "Sold",
        user: "Sales Rep",
        timestamp: "2024-01-18T15:30:00Z",
        details: "Vehicle sold to customer",
      },
    ],
  },
]
