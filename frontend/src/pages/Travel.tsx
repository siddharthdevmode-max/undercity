import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { travelAPI } from "../services/travel";
import type { City, CitiesResponse } from "../services/travel";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Travel.css";

export default function Travel() {
  const [data, setData] = useState<CitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flying, setFlying] = useState<number | null>(null);
  const [flightStatus, setFlightStatus] = useState<{ arrivesAt: string } | null>(null);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    travelAPI.getCities()
      .then((d) => { setData(d); setFlightStatus(null); })
      .catch((err: unknown) => { const m = err instanceof Error ? err.message : "Failed to load"; setError(m); toast.error(m); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleFly = async (cityId: number) => {
    setFlying(cityId);
    try {
      const res = await travelAPI.fly(cityId);
      setFlightStatus(res);
      userEvents.emit({ money: -res.cost });
      toast.success(res.message);
      setTimeout(() => { loadRef.current(); }, 2000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Flight failed");
    } finally { setFlying(null); }
  };

  const handleReturn = async () => {
    try {
      const res = await travelAPI.returnHome();
      toast.success(res.message);
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Return failed");
    }
  };

  if (loading) return <Shell><div className="travel-container"><div className="travel-header"><h1 className="travel-title"><Icon name="travel" size={28} className="icon-accent" /> Travel</h1></div><Skeleton width={200} height={4} /></div></Shell>;
  if (error) return <Shell><div className="travel-error" role="alert"><p>{error}</p><button className="travel-retry-btn" onClick={load}>Retry</button></div></Shell>;

  return (
    <Shell>
      <div className="travel-container">
        <div className="travel-header">
          <h1 className="travel-title"><Icon name="travel" size={26} className="icon-accent" /> Travel</h1>
        </div>

        {flightStatus ? (
          <div className="travel-flight-info">
            <h3 className="travel-flight-title">In Flight</h3>
            <p>Arriving at: <strong>{new Date(flightStatus.arrivesAt).toLocaleString()}</strong></p>
            <p className="travel-flight-note">You will arrive shortly. Please wait.</p>
          </div>
        ) : data && data.currentCity !== "Home" ? (
          <div className="travel-away">
            <p className="travel-away-text">You are in <strong>{data.currentCity}</strong>.</p>
            <button className="travel-return-btn" onClick={() => void handleReturn()}>Return Home</button>
          </div>
        ) : (
          <>
            <p className="travel-desc">Fly to a city. You must be at least the required level and have enough money.</p>
            <div className="travel-grid">
              {data?.cities.map((city: City) => (
                <div key={city.id} className={`travel-card ${!city.unlocked ? "travel-card-locked" : ""}`}>
                  <div className="travel-card-header">
                    <h3 className="travel-city-name">{city.name}</h3>
                    <span className="travel-country">{city.country}</span>
                  </div>
                  <p className="travel-city-desc">{city.description}</p>
                  <div className="travel-city-details">
                    <span><Icon name="money" size={12} /> ${city.flight_cost.toLocaleString()}</span>
                    <span><Icon name="timer" size={12} /> {city.flight_time}s</span>
                    <span><Icon name="level" size={12} /> Lvl {city.min_level}</span>
                  </div>
                  <button
                    className="travel-fly-btn"
                    disabled={!city.unlocked || flying !== null}
                    onClick={() => void handleFly(city.id)}
                  >
                    {flying === city.id ? "Flying..." : city.unlocked ? "Fly" : "Locked"}
                  </button>
                  {!city.unlocked && <span className="travel-locked-note">Level {city.min_level} required</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

