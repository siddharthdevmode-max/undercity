import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authAPI } from "../services/api";
import { toast } from "../utils/toast";
import Header from "../components/Header";
import "../styles/Onboarding.css";

const TOTAL_STEPS = 5;

const STEP_BACKGROUNDS = [
  "/step1-welcome.jpg",
  "/step2-terms.jpg",
  "/step3-privacy.jpg",
  "/step4-rules.jpg",
  "/step5-referral.jpg",
];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [referralCode, setReferralCode] = useState("");
  const [completing, setCompleting] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const next = () => {
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
    }
  };

  const finish = async () => {
    setCompleting(true);
    try {
      await authAPI.completeOnboarding();
      await refreshUser();
      navigate("/home");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="onboarding-page">
      <Header />

      {/* Full-bleed background image per step */}
      <div
        key={step}
        className="ob-bg"
        style={{ backgroundImage: `url(${STEP_BACKGROUNDS[step - 1]})` }}
      />
      <div className="ob-bg-overlay" />

      <div className="onboarding-container">
        {/* Progress */}
        <div className="ob-progress">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`ob-progress-dot ${
                i + 1 === step ? "active" : i + 1 < step ? "done" : ""
              }`}
            />
          ))}
        </div>

        <div key={`card-${step}`} className="ob-card">
          {step === 1 && <StepWelcome onContinue={next} />}
          {step === 2 && <StepTerms onContinue={next} />}
          {step === 3 && <StepPrivacy onContinue={next} />}
          {step === 4 && <StepRules onContinue={next} />}
          {step === 5 && (
            <StepReferral
              code={referralCode}
              setCode={setReferralCode}
              onFinish={finish}
              loading={completing}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StepWelcome({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <div className="ob-icon">🏙️</div>
      <div className="ob-step-label">STEP 1 OF 5</div>
      <h1 className="ob-title">WELCOME TO UNDERCITY</h1>
      <p className="ob-subtitle">
        You just stepped into the most dangerous city in the world.
        Nothing is given. Everything is earned. Your name is your reputation
        — and the streets never forget.
      </p>
      <div className="ob-welcome-features">
        <div className="ob-feature-item">
          <span className="ob-feature-icon">🔫</span> Commit crimes for cash
        </div>
        <div className="ob-feature-item">
          <span className="ob-feature-icon">💪</span> Train at the gym
        </div>
        <div className="ob-feature-item">
          <span className="ob-feature-icon">⚔️</span> Join a gang
        </div>
        <div className="ob-feature-item">
          <span className="ob-feature-icon">🏢</span> Build your empire
        </div>
        <div className="ob-feature-item">
          <span className="ob-feature-icon">🎰</span> Gamble at the casino
        </div>
        <div className="ob-feature-item">
          <span className="ob-feature-icon">💥</span> Wage gang wars
        </div>
      </div>
      <button className="ob-continue-btn" onClick={onContinue}>
        CONTINUE <span className="arrow">→</span>
      </button>
    </>
  );
}

function StepTerms({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <div className="ob-icon">📜</div>
      <div className="ob-step-label">STEP 2 OF 5</div>
      <h1 className="ob-title">TERMS OF SERVICE</h1>
      <p className="ob-subtitle">
        By playing Undercity, you agree to the following terms.
      </p>
      <div className="ob-scroll-content">
        <h4>1. Account Responsibility</h4>
        <p>You are responsible for maintaining the security of your account. Do not share your password with anyone. One account per person.</p>

        <h4>2. Fair Play</h4>
        <p>Cheating, botting, scripting, multi-accounting, or exploiting bugs is strictly prohibited. Violators will be permanently banned without warning.</p>

        <h4>3. Conduct</h4>
        <p>Harassment, hate speech, doxxing, or threats of any kind will result in immediate account termination. Undercity is a game — keep it respectful.</p>

        <h4>4. Virtual Economy</h4>
        <p>All in-game currency, items, and assets are virtual and have no real-world monetary value. Trading accounts or in-game assets for real money is prohibited.</p>

        <h4>5. Content</h4>
        <p>Undercity contains themes of crime, violence, and gambling in a fictional context. By playing, you confirm you are at least 18 years of age or have parental consent.</p>

        <h4>6. Modifications</h4>
        <p>These terms may be updated at any time. Continued use of Undercity after changes constitutes acceptance. Major changes will be announced via in-game newspaper.</p>

        <h4>7. Termination</h4>
        <p>We reserve the right to terminate any account at any time for violation of these terms or for any reason deemed necessary to protect the game and its community.</p>
      </div>
      <button className="ob-continue-btn" onClick={onContinue}>
        I UNDERSTAND — CONTINUE <span className="arrow">→</span>
      </button>
    </>
  );
}

function StepPrivacy({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <div className="ob-icon">🔒</div>
      <div className="ob-step-label">STEP 3 OF 5</div>
      <h1 className="ob-title">PRIVACY POLICY</h1>
      <p className="ob-subtitle">
        Your data, your rights. Here's what we collect and why.
      </p>
      <div className="ob-scroll-content">
        <h4>What We Collect</h4>
        <ul>
          <li>Email address (for authentication and recovery)</li>
          <li>Username (public, chosen by you)</li>
          <li>IP address (for security and anti-cheat)</li>
          <li>Device fingerprint (for multi-account detection)</li>
          <li>Game activity (actions, timings, transactions)</li>
        </ul>

        <h4>Why We Collect It</h4>
        <ul>
          <li>To authenticate you and secure your account</li>
          <li>To prevent cheating and multi-accounting</li>
          <li>To improve game balance and detect exploits</li>
          <li>To provide you with the best possible experience</li>
        </ul>

        <h4>What We Never Do</h4>
        <ul>
          <li>Sell your personal data to third parties</li>
          <li>Share your email publicly or with other players</li>
          <li>Track you outside of Undercity</li>
          <li>Use your data for advertising</li>
        </ul>

        <h4>Data Retention</h4>
        <p>Your data is retained for as long as your account exists. You may request full account deletion at any time by contacting support.</p>

        <h4>Cookies</h4>
        <p>We use essential cookies for authentication. No tracking cookies, no analytics cookies, no third-party cookies.</p>

        <h4>Your Rights</h4>
        <p>You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.</p>
      </div>
      <button className="ob-continue-btn" onClick={onContinue}>
        CONTINUE <span className="arrow">→</span>
      </button>
    </>
  );
}

function StepRules({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <div className="ob-icon">⚖️</div>
      <div className="ob-step-label">STEP 4 OF 5</div>
      <h1 className="ob-title">GAME RULES</h1>
      <p className="ob-subtitle">
        The streets have rules. Break them, and you're done.
      </p>
      <div className="ob-scroll-content">
        <h4>1. One Account Per Person</h4>
        <p>Multi-accounting is the #1 bannable offense. Our anti-cheat system (UAC) tracks device fingerprints, IPs, and behavioral patterns. If you're caught, all accounts are permanently banned.</p>

        <h4>2. No Botting or Scripting</h4>
        <p>Automating any game action — crimes, gym, attacks, or anything else — is strictly prohibited. Our behavior engine detects timing anomalies, and you will be caught.</p>

        <h4>3. No Bug Exploitation</h4>
        <p>If you find a bug, report it. Exploiting bugs for personal gain results in account rollback and potential ban. Players who report bugs may be rewarded.</p>

        <h4>4. No Real-Money Trading</h4>
        <p>Selling or buying in-game items, currency, or accounts for real money is prohibited and will result in permanent bans for all parties involved.</p>

        <h4>5. Respect Other Players</h4>
        <p>Attacking, scamming, and stealing are part of the game. Harassment, hate speech, real-life threats, and doxxing are not. Know the difference.</p>

        <h4>6. Gang Warfare Rules</h4>
        <p>Gang wars are encouraged. Griefing outside of war mechanics is not. Wars have rules — your gang leader will explain them.</p>

        <h4>7. Staff Decisions Are Final</h4>
        <p>If a moderator or admin takes action on your account, the decision is final. Appeals can be submitted through the official process, but arguing in public channels will not help your case.</p>

        <h4>Trust Score System</h4>
        <p>Every player has a trust score (0-100). Violations reduce your score. Low scores result in shadow penalties, and a score of 0 means permanent ban. Play clean, stay clean.</p>
      </div>
      <button className="ob-continue-btn" onClick={onContinue}>
        I ACCEPT THE RULES <span className="arrow">→</span>
      </button>
    </>
  );
}

function StepReferral({
  code,
  setCode,
  onFinish,
  loading,
}: {
  code: string;
  setCode: (v: string) => void;
  onFinish: () => void;
  loading: boolean;
}) {
  return (
    <>
      <div className="ob-icon">🤝</div>
      <div className="ob-step-label">STEP 5 OF 5</div>
      <h1 className="ob-title">GOT A REFERRAL?</h1>
      <p className="ob-subtitle">
        If someone invited you to Undercity, enter their referral code below.
        Both of you get a bonus when you start playing.
      </p>
      <input
        className="ob-referral-input"
        type="text"
        placeholder="Enter referral code (optional)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={20}
        disabled={loading}
      />
      <p className="ob-referral-note">
        Don't have a code? No worries — skip and enter the city.
      </p>
      <button
        className="ob-continue-btn"
        onClick={onFinish}
        disabled={loading}
      >
        {loading ? "ENTERING..." : <>ENTER THE CITY <span className="arrow">→</span></>}
      </button>
    </>
  );
}
