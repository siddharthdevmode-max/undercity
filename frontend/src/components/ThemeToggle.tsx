import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import '../styles/ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; icon: string; label: string }[] = [
    { value: 'light', icon: '☀', label: 'Light' },
    { value: 'dark', icon: '🌙', label: 'Dark' },
    { value: 'grey', icon: '🩶', label: 'Grey' },
  ];

  return (
    <div className="theme-toggle" role="group" aria-label="Theme selector">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`theme-btn ${theme === opt.value ? 'active' : ''}`}
          onClick={() => setTheme(opt.value)}
          title={opt.label}
          aria-label={`Switch to ${opt.label} theme`}
          aria-pressed={theme === opt.value}
        >
          <span aria-hidden>{opt.icon}</span>
        </button>
      ))}
    </div>
  );
}
