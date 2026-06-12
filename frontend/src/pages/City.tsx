import { useState } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Link } from "react-router-dom";
import "../styles/City.css";

interface District {
  name: string;
  description: string;
  icon: string;
  path: string;
  danger: "low" | "medium" | "high";
}

const DISTRICTS: District[] = [
  { name: "Downtown", description: "Banks, markets, and legitimate businesses.", icon: "bank", path: "/bank", danger: "low" },
  { name: "Docks", description: "Smuggling, black market deals, and back alleys.", icon: "market", path: "/black-market", danger: "high" },
  { name: "Industrial Zone", description: "Warehouses, gyms, and job opportunities.", icon: "job", path: "/job", danger: "medium" },
  { name: "Casino Row", description: "High-stakes gambling and luxury.", icon: "casino", path: "/casino", danger: "medium" },
  { name: "Stock Exchange", description: "Legitimate investments and trading.", icon: "stocks", path: "/stock-market", danger: "low" },
  { name: "Underground", description: "Fight clubs, gang hideouts, and chaos.", icon: "attack", path: "/attack", danger: "high" },
  { name: "Church District", description: "Sanctuary, donations, and peace.", icon: "church", path: "/church", danger: "low" },
  { name: "Hospital", description: "Medical care and recovery.", icon: "hospital", path: "/hospital", danger: "low" },
  { name: "Courthouse", description: "Jail, federal prison, and public records.", icon: "jail", path: "/jail", danger: "medium" },
];

export default function City() {
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = filter ? DISTRICTS.filter((d) => d.danger === filter) : DISTRICTS;

  return (
    <Shell>
      <div className="city-container">
        <div className="city-header">
          <h1 className="city-title"><Icon name="city" size={26} className="icon-accent" /> Undercity</h1>
          <p className="city-desc">Navigate the districts of Undercity. Each area offers different opportunities.</p>
        </div>

        <div className="city-filters">
          <button className={`city-filter ${!filter ? "active" : ""}`} onClick={() => setFilter(null)}>All</button>
          <button className={`city-filter ${filter === "low" ? "active" : ""}`} onClick={() => setFilter("low")}>Safe</button>
          <button className={`city-filter ${filter === "medium" ? "active" : ""}`} onClick={() => setFilter("medium")}>Risky</button>
          <button className={`city-filter ${filter === "high" ? "active" : ""}`} onClick={() => setFilter("high")}>Dangerous</button>
        </div>

        <div className="city-grid">
          {filtered.map((district) => (
            <Link key={district.name} to={district.path} className="city-card">
              <div className="city-card-header">
                <Icon name={district.icon} size={24} className="icon-accent" />
                <span className={`city-danger city-danger-${district.danger}`}>
                  {district.danger === "low" ? "Safe" : district.danger === "medium" ? "Risky" : "Danger"}
                </span>
              </div>
              <h3 className="city-card-name">{district.name}</h3>
              <p className="city-card-desc">{district.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </Shell>
  );
}
