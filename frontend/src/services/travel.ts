import { apiCall } from "./api";

export interface City {
  id: number;
  name: string;
  description: string;
  country: string;
  flight_cost: number;
  flight_time: number;
  min_level: number;
  unlocked: boolean;
}

export interface CitiesResponse {
  cities: City[];
  currentCity: string;
}

export interface TravelStatus {
  traveling: boolean;
  city: string | null;
  arrivesAt: string | null;
  remainingSeconds: number;
}

export interface FlightResult {
  message: string;
  arrivesAt: string;
  flightTime: number;
  cost: number;
}

export const travelAPI = {
  getCities: (): Promise<CitiesResponse> => apiCall("/travel/cities"),
  fly: (cityId: number): Promise<FlightResult> => apiCall("/travel/fly", {
    method: "POST", body: JSON.stringify({ cityId }),
  }),
  getStatus: (): Promise<TravelStatus> => apiCall("/travel/status"),
  returnHome: (): Promise<{ message: string }> => apiCall("/travel/return", { method: "POST" }),
};
