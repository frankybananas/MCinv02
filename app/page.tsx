"use client"

import { useState } from "react"
import { LoginScreen } from "./components/login-screen"
import { OTPScreen } from "./components/otp-screen"
import { Dashboard } from "./components/dashboard"
import { CarDetail } from "./components/car-detail"
import { AddEditCar } from "./components/add-edit-car"
import { ReserveModal } from "./components/reserve-modal"
import { mockCars } from "./data/mock-data"
import type { Car, AppState, CarStatus } from "./types"

export default function CarInventoryApp() {
  const [appState, setAppState] = useState<AppState>({
    isAuthenticated: false,
    currentScreen: "login",
    phoneNumber: "",
    selectedCar: null,
    cars: mockCars,
    showReserveModal: false,
    editingCar: null,
  })

  const navigateTo = (screen: AppState["currentScreen"], data?: any) => {
    setAppState((prev) => ({
      ...prev,
      currentScreen: screen,
      selectedCar: data?.car || prev.selectedCar,
      editingCar: data?.editingCar || null,
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
      id: Date.now().toString(),
      ...(carData as Car),
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

  const updateCar = (carId: string, carData: Partial<Car>) => {
    setAppState((prev) => ({
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
                  details: "Car information updated",
                },
              ],
            }
          : car,
      ),
      currentScreen: "dashboard",
      editingCar: null,
    }))
  }

  const updateCarStatus = (carId: string, status: CarStatus, reservedBy?: string) => {
    setAppState((prev) => ({
      ...prev,
      cars: prev.cars.map((car) =>
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
                  details: `Status changed to ${status}${reservedBy ? ` (Reserved by ${reservedBy})` : ""}`,
                },
              ],
            }
          : car,
      ),
      showReserveModal: false,
    }))
  }

  const showReserveModal = () => {
    setAppState((prev) => ({ ...prev, showReserveModal: true }))
  }

  const hideReserveModal = () => {
    setAppState((prev) => ({ ...prev, showReserveModal: false }))
  }

  return (
    <div className="max-w-md mx-auto bg-background min-h-screen">
      {appState.currentScreen === "login" && <LoginScreen onLogin={login} />}

      {appState.currentScreen === "otp" && (
        <OTPScreen phoneNumber={appState.phoneNumber} onVerify={verifyOTP} onBack={() => navigateTo("login")} />
      )}

      {appState.currentScreen === "dashboard" && (
        <Dashboard
          cars={appState.cars}
          onCarSelect={(car) => navigateTo("car-detail", { car })}
          onAddCar={() => navigateTo("add-car")}
          onStatusChange={(carId, status) => updateCarStatus(carId, status)}
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

      {appState.showReserveModal && appState.selectedCar && (
        <ReserveModal
          car={appState.selectedCar}
          onConfirm={(reservedBy) => updateCarStatus(appState.selectedCar!.id, "reserved", reservedBy)}
          onClose={hideReserveModal}
        />
      )}
    </div>
  )
}
