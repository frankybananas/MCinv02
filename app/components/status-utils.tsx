"use client";

import type { CarState } from "../types";

export const STATUS_OPTIONS: CarState[] = [
  "in-stock",
  "coming",
  "reserved",
  "sold",
];

export function formatStatusLabel(status: CarState): string {
  return status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ");
}

export function getStatusColor(status: CarState): string {
  switch (status) {
    case "in-stock":
      return "bg-green-100 text-green-800";
    case "coming":
      return "bg-blue-100 text-blue-800";
    case "reserved":
      return "bg-yellow-100 text-yellow-800";
    case "sold":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
