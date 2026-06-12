import { useState } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { useAuth } from "../hooks/useAuth";
import { toast } from "../utils/toast";
import "../styles/Church.css";

const DONATIONS = [
  { amount: 100, blessing: "Candle Blessing", happiness: 2 },
  { amount: 500, blessing: "Prayer of Peace", happiness: 5 },
  { amount: 2500, blessing: "Sanctified Offering", happiness: 12 },
  { amount: 10000, blessing: "Grand Tithe", happiness: 25 },
  { amount: 50000, blessing: "Cathedral Grace", happiness: 50 },
  { amount: 250000, blessing: "Divine Favor", happiness: 100 },
];

export default function Church() {
  const { user } = useAuth();
  const [selectedDonation, setSelectedDonation] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [donating, setDonating] = useState(false);

  const handleDonate = () => {
    if (selectedDonation === null) return;
    setDonating(true);
    setTimeout(() => {
      toast.success(`Donated $${selectedDonation.toLocaleString()} — you feel at peace.`);
      setDonating(false);
      setConfirming(false);
      setSelectedDonation(null);
    }, 1200);
  };

  const happiness = user?.happiness ?? 100;
  const maxHappiness = 100;
  const happinessPercent = Math.round((happiness / Math.max(maxHappiness, 1)) * 100);

  return (
    <Shell>
      <div className="church-container">
        <div className="church-header">
          <h1 className="church-title"><Icon name="church" size={26} className="icon-accent" /> Church</h1>
          <p className="church-desc">Seek solace, donate for blessings, and restore your happiness.</p>
        </div>

        <div className="church-grid">
          <div className="church-main">
            <div className="church-card">
              <h2 className="church-card-title">Make a Donation</h2>
              <p className="church-card-desc">
                Donations to the church bring peace of mind and restore happiness.
                The more you give, the greater the blessing.
              </p>
              <div className="church-donations">
                {DONATIONS.map((d) => (
                  <button
                    key={d.amount}
                    className={`church-donation-btn ${selectedDonation === d.amount ? "church-donation-active" : ""}`}
                    onClick={() => { setSelectedDonation(d.amount); setConfirming(false); }}
                  >
                    <span className="church-donation-amount">${d.amount.toLocaleString()}</span>
                    <span className="church-donation-blessing">{d.blessing}</span>
                    <span className="church-donation-happiness">+{d.happiness} <Icon name="happiness" size={12} /></span>
                  </button>
                ))}
              </div>
              {selectedDonation !== null && !confirming && (
                <button className="church-donate-btn" onClick={() => setConfirming(true)}>
                  Donate ${selectedDonation.toLocaleString()}
                </button>
              )}
              {confirming && (
                <div className="church-confirm">
                  <p className="church-confirm-text">
                    Donate <strong>${(selectedDonation ?? 0).toLocaleString()}</strong> to the church?
                  </p>
                  <div className="church-confirm-actions">
                    <button className="church-confirm-yes" disabled={donating} onClick={handleDonate}>
                      {donating ? "Praying..." : "Yes, Donate"}
                    </button>
                    <button className="church-confirm-no" disabled={donating} onClick={() => setConfirming(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="church-sidebar">
            <div className="church-card">
              <h3 className="church-card-title">Your Happiness</h3>
              <div className="church-happiness-display">
                <Icon name="happiness" size={32} className="icon-accent" />
                <span className="church-happiness-value">{happiness}</span>
                <span className="church-happiness-max">/ {maxHappiness}</span>
              </div>
              <div className="church-bar-track">
                <div className="church-bar-fill" style={{ width: `${happinessPercent}%` }} />
              </div>
              <p className="church-card-desc">
                Happiness affects your energy regeneration rate. Keep it high to stay sharp.
              </p>
            </div>

            <div className="church-card">
              <h3 className="church-card-title">Blessings</h3>
              <ul className="church-blessings">
                <li><Icon name="check" size={14} className="icon-success" /> Increased happiness regen</li>
                <li><Icon name="check" size={14} className="icon-success" /> Peace of mind</li>
                <li><Icon name="check" size={14} className="icon-success" /> Community respect</li>
              </ul>
            </div>

            <div className="church-card church-card-muted">
              <p className="church-card-desc">
                "The church doors are always open. Whether you seek forgiveness or
                simply a moment of quiet, you are welcome here."
              </p>
              <span className="church-quote-author">— Father Matthias</span>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
