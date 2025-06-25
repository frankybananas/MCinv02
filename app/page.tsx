"use client"

import { useState } from "react"
import { LoginScreen } from "./components/login-screen"
import { OTPScreen } from "./components/otp-screen"
import { Dashboard } from "./components/dashboard"
import { CarDetail } from "./components/car-detail"
import { AddEditCar } from "./components/add-edit-car"
import { AddEditClient } from "./components/add-edit-client"
import { ReserveModal } from "./components/reserve-modal"
import { mockCars } from "./data/mock-data"
import type { Car, AppState, CarStatus, Client } from "./types"

export default function CarInventoryApp() {
  const [appState, setAppState] = useState<AppState>({
    isAuthenticated: false,
    currentScreen: "login",
    phoneNumber: "",
    selectedCar: null,
    cars: mockCars,
    showReserveModal: false,
    editingCar: null,
    clients: [],
    editingClient: null
  })

  const navigateTo = (screen: AppState["currentScreen"], data?: any) => {
    setAppState((prev) => ({
      ...prev,
      currentScreen: screen,
      selectedCar: data?.car || prev.selectedCar,
      editingCar: data?.editingCar || null,
      editingClient: data?.editingClient || null,
    }))
  }

  const login = (phoneNumber: string) => {
    setAppState((prev) => ({
      ...prev,
      phoneNumber,
      currentScreen: "otp",
    }))
  }

  const verifyOTP = (otp: string) => {
    // Mock OTP verification
    if (otp === "1234") {
      setAppState((prev) => ({
        ...prev,
        isAuthenticated: true,
        currentScreen: "dashboard",
      }))
    } else {
      alert("Invalid OTP. Please use 1234 for demo.")
    }
  }

  const addCar = (carData: Partial<Car>) => {
    const newCar: Car = {
      ...(carData as Car),
      id: Date.now().toString(),
      status: "in-stock",
      createdAt: new Date().toISOString(),
      auditLog: [
        {
          action: "Created",
          user: "Current User",
          timestamp: new Date().toISOString(),
          details: "Car added to inventory",
        },
      ],
    }

    setAppState((prev) => ({
      ...prev,
      cars: [...prev.cars, newCar],
      currentScreen: "dashboard",
    }))
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatStatus = (status: CarStatus) => {
    switch (status) {
      case "in-stock": return "In Stock";
      case "coming": return "Coming Soon";
      case "reserved": return "Reserved";
      case "sold": return "Sold";
      default: return status;
    }
  };

  const updateCar = (carId: string, carData: Partial<Car>) => {
    setAppState((prev) => {
      const oldCar = prev.cars.find(car => car.id === carId);
      if (!oldCar) return prev;

      // Track changes for audit log
      const changes: string[] = [];
      
      // Check for specific field changes
      if (carData.make && oldCar.make !== carData.make) {
        changes.push(`make from "${oldCar.make}" to "${carData.make}"`);
      }
      if (carData.model && oldCar.model !== carData.model) {
        changes.push(`model from "${oldCar.model}" to "${carData.model}"`);
      }
      if (carData.year && oldCar.year !== carData.year) {
        changes.push(`year from ${oldCar.year} to ${carData.year}`);
      }
      if (carData.price && oldCar.price !== carData.price) {
        changes.push(`price from ${formatPrice(oldCar.price)} to ${formatPrice(carData.price)}`);
      }
      if (carData.color && oldCar.color !== carData.color) {
        changes.push(`color from "${oldCar.color}" to "${carData.color}"`);
      }
      if (carData.transmission && oldCar.transmission !== carData.transmission) {
        changes.push(`transmission from ${oldCar.transmission} to ${carData.transmission}`);
      }
      if (carData.kilometers && oldCar.kilometers !== carData.kilometers) {
        changes.push(`mileage from ${oldCar.kilometers.toLocaleString()}km to ${carData.kilometers.toLocaleString()}km`);
      }
      if (carData.images && JSON.stringify(oldCar.images) !== JSON.stringify(carData.images)) {
        const addedImages = carData.images.length - oldCar.images.length;
        if (addedImages > 0) {
          changes.push(`added ${addedImages} image${addedImages > 1 ? 's' : ''}`);
        } else if (addedImages < 0) {
          changes.push(`removed ${Math.abs(addedImages)} image${addedImages < -1 ? 's' : ''}`);
        } else {
          changes.push('updated images');
        }
      }

      // Check for description changes
      if (carData.description && oldCar.description !== carData.description) {
        changes.push('updated description');
      }

      // Check for features changes
      if (carData.features && JSON.stringify(oldCar.features) !== JSON.stringify(carData.features)) {
        changes.push('updated features');
      }

      const details = changes.length > 0 
        ? `Updated: ${changes.join('; ')}`
        : 'No significant changes detected';

      return {
        ...prev,
        cars: prev.cars.map((car) =>
          car.id === carId
            ? {
                ...car,
                ...carData,
                auditLog: [
                  ...car.auditLog,
                  {
                    action: "Updated",
                    user: "Current User",
                    timestamp: new Date().toISOString(),
                    details: details,
                  },
                ],
              }
            : car,
        ),
        currentScreen: "dashboard",
        editingCar: null,
      };
    });
  }

  const updateCarStatus = (carId: string, status: CarStatus, reservedBy?: string, phone?: string) => {
    setAppState((prev) => {
      const oldCar = prev.cars.find(car => car.id === carId);
      if (!oldCar) return prev;

      // Create detailed status change message
      let statusChangeMessage = `Status changed from "${formatStatus(oldCar.status)}" to "${formatStatus(status)}"`;
      
      // Add reservation details if applicable
      if (status === "reserved" && reservedBy) {
        statusChangeMessage += ` (Reserved by ${reservedBy}${phone ? `, ${phone}` : ''})`;
      } else if (oldCar.status === "reserved" && status !== "reserved" && oldCar.reservedBy) {
        statusChangeMessage += ` (Removed reservation from ${oldCar.reservedBy})`;
      }

      // Add to audit log
      const updatedCars = prev.cars.map((car) =>
        car.id === carId
          ? {
              ...car,
              status,
              reservedBy: status === "reserved" ? reservedBy : undefined,
              auditLog: [
                ...car.auditLog,
                {
                  action: "Status Changed",
                  user: "Current User",
                  timestamp: new Date().toISOString(),
                  details: statusChangeMessage,
                },
              ],
            }
          : car,
      );

      // If the currently selected car is the one updated, refresh it too
      const updatedSelected = prev.selectedCar && prev.selectedCar.id === carId
        ? updatedCars.find((c) => c.id === carId) || prev.selectedCar
        : prev.selectedCar;

      // Add client if provided
      const updatedClients = phone && reservedBy
        ? prev.clients.some((c) => c.phone === phone)
          ? prev.clients
          : [...prev.clients, { id: Date.now().toString(), name: reservedBy, phone }]
        : prev.clients;

      return {
        ...prev,
        cars: updatedCars,
        selectedCar: updatedSelected,
        showReserveModal: false,
        clients: updatedClients,
      };
    })
  }

  const showReserveModal = () => {
    setAppState((prev) => ({ ...prev, showReserveModal: true }))
  }

  const hideReserveModal = () => {
    setAppState((prev) => ({ ...prev, showReserveModal: false }))
  }

  const deleteClient = (clientId: string) => {
    setAppState((prev) => ({
      ...prev,
      clients: prev.clients.filter((client) => client.id !== clientId)
    }))
  }

  const addClient = (clientData: Partial<Client>) => {
    const newClient: Client = {
      ...(clientData as Client),
      id: Date.now().toString(),
    }

    setAppState((prev) => ({
      ...prev,
      clients: [...prev.clients, newClient],
      currentScreen: "dashboard",
    }))
  }

  const updateClient = (clientId: string, clientData: Partial<Client>) => {
    setAppState((prev) => ({
      ...prev,
      clients: prev.clients.map((client) =>
        client.id === clientId
          ? { ...client, ...clientData }
          : client
      ),
      currentScreen: "dashboard",
    }))
  }

  return (
    <div className="w-full max-w-screen-xl mx-auto bg-background min-h-screen px-4">
      {appState.currentScreen === "login" && <LoginScreen onLogin={login} />}

      {appState.currentScreen === "otp" && (
        <OTPScreen phoneNumber={appState.phoneNumber} onVerify={verifyOTP} onBack={() => navigateTo("login")} />
      )}

      {appState.currentScreen === "dashboard" && (
        <Dashboard
          cars={appState.cars}
          clients={appState.clients}
          onCarSelect={(car) => navigateTo("car-detail", { car })}
          onAddCar={() => navigateTo("add-car")}
          onAddClient={() => navigateTo("add-client")}
          activeTabId={(tabId) => setAppState(prev => ({ ...prev, activeTabId: tabId }))}
          onClientSelect={(client) => navigateTo("edit-client", { editingClient: client })}
          onClientDelete={(clientId) => deleteClient(clientId)}
          onStatusChange={(carId, status) => {
            if (status === "reserved") {
              const selected = appState.cars.find((c) => c.id === carId)
              if (selected) {
                setAppState((prev) => ({ ...prev, selectedCar: selected, showReserveModal: true }))
              }
            } else {
              updateCarStatus(carId, status)
            }
          }}
        />
      )}

      {appState.currentScreen === "car-detail" && appState.selectedCar && (
        <CarDetail
          car={appState.selectedCar}
          onBack={() => navigateTo("dashboard")}
          onEdit={(car) => navigateTo("edit-car", { editingCar: car })}
          onReserve={showReserveModal}
          onStatusChange={(status) => updateCarStatus(appState.selectedCar!.id, status)}
        />
      )}

      {appState.currentScreen === "add-car" && <AddEditCar onSave={addCar} onCancel={() => navigateTo("dashboard")} />}

      {appState.currentScreen === "edit-car" && appState.editingCar && (
        <AddEditCar
          car={appState.editingCar}
          onSave={(carData) => updateCar(appState.editingCar!.id, carData)}
          onCancel={() => navigateTo("dashboard")}
        />
      )}

      {appState.currentScreen === "add-client" && (
        <AddEditClient onSave={addClient} onCancel={() => navigateTo("dashboard")} />
      )}

      {appState.currentScreen === "edit-client" && appState.editingClient && (
        <AddEditClient
          client={appState.editingClient}
          onSave={(clientData) => updateClient(appState.editingClient!.id, clientData)}
          onCancel={() => navigateTo("dashboard")}
        />
      )}

      {appState.showReserveModal && appState.selectedCar && (
        <ReserveModal
          car={appState.selectedCar}
          clients={appState.clients}
          onConfirm={(name, phone) => updateCarStatus(appState.selectedCar!.id, "reserved", name, phone)}
          onClose={hideReserveModal}
        />
      )}
    </div>
  )
}
