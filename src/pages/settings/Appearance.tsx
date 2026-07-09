import { useAppearance, type TextSize, type ThemeMode } from '../../context/AppearanceProvider';
import { SettingsShell } from './SettingsShell';

function Segmented<T extends string>({
  legend, value, options, onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{legend}</legend>
      <div className="flex gap-1 rounded-lg border border-slate-200/70 bg-white/45 p-1 dark:border-slate-800/80 dark:bg-slate-950/25" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              value === o.value
                ? 'bg-white text-primary shadow-sm dark:bg-slate-800 dark:text-indigo-300'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none dark:focus-visible:ring-offset-slate-950 ${
          checked ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function Appearance() {
  const appearance = useAppearance();

  return (
    <SettingsShell title="Appearance" subtitle="Saved on this device">
      <div className="surface space-y-6 p-5">
        <Segmented<ThemeMode>
          legend="Theme"
          value={appearance.theme}
          onChange={(theme) => appearance.set({ theme })}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ]}
        />
        <Segmented<TextSize>
          legend="Text size"
          value={appearance.textSize}
          onChange={(textSize) => appearance.set({ textSize })}
          options={[
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' },
          ]}
        />
        <Toggle
          label="High contrast"
          description="Stronger borders and text for readability."
          checked={appearance.highContrast}
          onChange={(highContrast) => appearance.set({ highContrast })}
        />
        <Toggle
          label="Reduce motion"
          description="Turn off animations and transitions."
          checked={appearance.reduceMotion}
          onChange={(reduceMotion) => appearance.set({ reduceMotion })}
        />
      </div>
    </SettingsShell>
  );
}
