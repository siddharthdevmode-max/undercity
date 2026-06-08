import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import Icon from './ui/Icon';
import '../styles/ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options: { value: Theme; icon: string; label: string }[] = [
    { value: 'light', icon: 'theme-light', label: 'Light' },
    { value: 'dark',  icon: 'theme-dark',  label: 'Dark' },
    { value: 'grey',  icon: 'theme-grey',  label: 'Grey' },
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
          <Icon name={opt.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
