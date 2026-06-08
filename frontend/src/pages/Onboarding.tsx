import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { authAPI } from "../services/api";
import { toast } from "../utils/toast";
import Header from "../components/Header";
import Icon from "../components/ui/Icon";
import "../styles/Onboarding.css";

const TOTAL_STEPS = 5;
const OB_STORAGE_KEY = "undercity_onboarding_step";

const STEP_IMAGES = [
  { src: "/step1-welcome.jpg",  alt: "Cyberpunk city street at night"          },
  { src: "/step2-terms.jpg",    alt: "Ancient scroll with wax seal on desk"    },
  { src: "/step3-privacy.jpg",  alt: "Massive vault door with red glow"        },
  { src: "/step4-rules.jpg",    alt: "Gothic underground tribunal chamber"     },
  { src: "/step5-referral.jpg", alt: "Two silhouettes shaking hands in alley" },
];

const STEP_CONTENT = [
  {
    eyebrow: "STEP 1 OF 5",
    title:   "WELCOME TO\nUNDERCITY",
    body:    "You've found the city beneath the city. A place where the rules are written in blood and broken just as fast. Build your empire. Earn your reputation. Survive.",
    cta:     "I'M READY",
  },
  {
    eyebrow: "STEP 2 OF 5",
    title:   "TERMS OF\nSERVICE",
    body:    "By playing Undercity you agree to our Terms of Service. This is a browser-based crime simulation. No real criminal activity is encouraged or condoned. You must be 18+ to play.",
    cta:     "I AGREE",
  },
  {
    eyebrow: "STEP 3 OF 5",
    title:   "YOUR DATA,\nYOUR RIGHTS",
    body:    "We store only what we need to run the game. Your data is never sold. You can request export or deletion at any time. See our Privacy Policy for full details.",
    cta:     "UNDERSTOOD",
  },
  {
    eyebrow: "STEP 4 OF 5",
    title:   "THE RULES\nOF THE STREET",
    body:    "No cheating. No exploits. No botting. No harassing other players. One account per person. Violations result in permanent ban. The city has rules — even here.",
    cta:     "I WILL FOLLOW THE CODE",
  },
  {
    eyebrow: "STEP 5 OF 5",
    title:   "GOT A\nREFERRAL?",
    body:    "If someone sent you here, enter their referral code below. Both of you will earn a bonus when you reach Level 5. Skip if you found us on your own.",
    cta:     "ENTER THE CITY",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const stored = sessionStorage.getItem(OB_STORAGE_KEY);
    const parsed = stored ? parseInt(stored, 10) : 1;
    return Number.isFinite(parsed) && parsed >= 1 && parsed <= TOTAL_STEPS ? parsed : 1;
  });
  const [referralCode, setReferralCode] = useState("");
  const [completing, setCompleting]     = useState(false);
  const navigate                        = useNavigate();
  const { user, refreshUser }           = useAuth();

  // Guard — already onboarded
  useEffect(() => {
    if (user?.onboardingCompleted) {
      navigate("/home", { replace: true });
    }
  }, [user, navigate]);

  // Persist step
  useEffect(() => {
    try { sessionStorage.setItem(OB_STORAGE_KEY, String(step)); } catch { /* private mode */ }
  }, [step]);

  const next = () => { if (step < TOTAL_STEPS) setStep(step + 1); };
  const prev = () => { if (step > 1) setStep(step - 1); };

  const finish = async () => {
    setCompleting(true);
    try {
      await authAPI.completeOnboarding();
      // Referral code stored for post-launch processing
      // TODO Phase 3: send referralCode to backend when referral system ships
      if (referralCode.trim()) {
        try {
          sessionStorage.setItem("undercity_referral", referralCode.trim());
        } catch { /* private mode */ }
      }
      try { sessionStorage.removeItem(OB_STORAGE_KEY); } catch { /* ignore */ }
      await refreshUser();
      navigate("/home", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCompleting(false);
    }
  };

  const currentImage   = STEP_IMAGES[step - 1];
  const currentContent = STEP_CONTENT[step - 1];
  const isLastStep     = step === TOTAL_STEPS;

  return (
    <div className="onboarding-page">
      <Header />
      <div className="onboarding-container">

        {/* Progress dots */}
        <div className="ob-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`ob-progress-dot ${
                i + 1 === step ? "active" : i + 1 < step ? "done" : ""
              }`}
              aria-label={`Step ${i + 1}${i + 1 < step ? " complete" : i + 1 === step ? " current" : ""}`}
            />
          ))}
        </div>

        <div key={`card-${step}`} className="ob-card">

          {/* Hero image */}
          <div className="ob-hero">
            <img
              src={currentImage.src}
              alt={currentImage.alt}
              className="ob-hero-img"
              loading="eager"
            />
            <div className="ob-hero-overlay" />
          </div>

          {/* Content */}
          <div className="ob-content">
            <span className="ob-eyebrow">{currentContent.eyebrow}</span>
            <h1 className="ob-title">
              {currentContent.title.split("\n").map((line, i) => (
                <span key={i}>
                  {i === 1 ? <span className="accent">{line}</span> : line}
                  {i === 0 && <br />}
                </span>
              ))}
            </h1>
            <p className="ob-body">{currentContent.body}</p>

            {/* Referral input on last step */}
            {isLastStep && (
              <div className="ob-referral">
                <input
                  type="text"
                  placeholder="Referral code (optional)"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.trim())}
                  className="ob-referral-input"
                  maxLength={32}
                  disabled={completing}
                  aria-label="Referral code"
                />
              </div>
            )}

            {/* Nav buttons */}
            <div className="ob-actions">
              {step > 1 && (
                <button
                  className="ob-btn ob-btn-back"
                  onClick={prev}
                  disabled={completing}
                  aria-label="Go back"
                >
                  <Icon name="chevron-left" size={14} /> BACK
                </button>
              )}
              <button
                className="ob-btn ob-btn-next"
                onClick={isLastStep ? finish : next}
                disabled={completing}
                aria-label={isLastStep ? "Enter the city" : "Continue"}
              >
                {completing ? (
                  <><span className="spinner" /> ENTERING...</>
                ) : (
                  <>{currentContent.cta} <Icon name="chevron-right" size={14} /></>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
