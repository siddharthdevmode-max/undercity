import { useState } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { casinoAPI } from "../services/casino";
import type { PlayResult } from "../services/casino";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Casino.css";

type Game = "coinflip" | "roulette" | "slots";

export default function Casino() {
  const [game, setGame] = useState<Game>("coinflip");
  const [bet, setBet] = useState(100);
  const [result, setResult] = useState<PlayResult | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rouletteBet, setRouletteBet] = useState<"red" | "black" | number>("red");

  const handlePlay = async () => {
    if (playing || bet <= 0) return;
    setPlaying(true); setResult(null);
    try {
      const res = await casinoAPI.play(game, bet);
      setResult(res);
      userEvents.emit({ money: res.money });
      if (res.payout > 0) toast.success(`Won $${res.payout.toLocaleString()}`);
      else toast.error(`Lost $${bet.toLocaleString()}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Play failed");
    } finally { setPlaying(false); }
  };

  const getResultText = (r: PlayResult) => {
    if (r.payout > 0) return "WIN";
    return "LOSE";
  };

  return (
    <Shell>
      <div className="casino-container">
        <div className="casino-header">
          <h1 className="casino-title"><Icon name="casino" size={26} className="icon-accent" /> Casino</h1>
        </div>

        <div className="casino-game-select">
          <button className={`casino-game-btn ${game === "coinflip" ? "active" : ""}`} onClick={() => setGame("coinflip")}>Coin Flip</button>
          <button className={`casino-game-btn ${game === "roulette" ? "active" : ""}`} onClick={() => setGame("roulette")}>Roulette</button>
          <button className={`casino-game-btn ${game === "slots" ? "active" : ""}`} onClick={() => setGame("slots")}>Slots</button>
        </div>

        <div className="casino-game-area">
          {game === "coinflip" && (
            <div className="casino-game-inner">
              <Icon name="coinflip" size={48} className="icon-accent" />
              <p className="casino-game-desc">Flip a coin. 45% chance to double your bet.</p>
            </div>
          )}

          {game === "roulette" && (
            <div className="casino-game-inner">
              <Icon name="roulette" size={48} className="icon-accent" />
              <p className="casino-game-desc">Bet on red, black, or a number (0-36).</p>
              <div className="casino-roulette-bets">
                <button className={`casino-rb-btn ${rouletteBet === "red" ? "active" : ""}`} onClick={() => setRouletteBet("red")}>Red</button>
                <button className={`casino-rb-btn ${rouletteBet === "black" ? "active" : ""}`} onClick={() => setRouletteBet("black")}>Black</button>
                <input
                  className="casino-rb-input"
                  type="number"
                  min={0} max={36}
                  placeholder="Number"
                  value={typeof rouletteBet === "number" ? rouletteBet : ""}
                  onChange={(e) => setRouletteBet(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {game === "slots" && (
            <div className="casino-game-inner">
              <Icon name="slots" size={48} className="icon-accent" />
              <p className="casino-game-desc">Spin the reels. Match 3 symbols to win up to 100x!</p>
            </div>
          )}

          <div className="casino-bet-row">
            <span className="casino-bet-label">Bet:</span>
            <input
              className="casino-bet-input"
              type="number"
              min={1}
              value={bet}
              onChange={(e) => setBet(Math.max(1, parseInt(e.target.value) || 1))}
            />
            <button className="casino-play-btn" disabled={playing} onClick={() => void handlePlay()}>
              {playing ? "Playing..." : "Play"}
            </button>
          </div>

          {result && (
            <div className={`casino-result ${result.payout > 0 ? "casino-result-win" : "casino-result-lose"}`}>
              <h3 className="casino-result-title">{getResultText(result)}</h3>
              <p className="casino-result-msg">{result.message}</p>
              {result.payout > 0 && <p className="casino-result-payout">+${result.payout.toLocaleString()}</p>}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

